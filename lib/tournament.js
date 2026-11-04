// Pure tournament rules. No framework imports: the server uses these to validate and
// generate matches, and the UI uses them to display standings, so both always agree.

/**
 * "azury|fr, musashi|de, Fizzy, kamo|pl|sub" -> [{name, cc, sub}]. cc is a lowercase ISO code ("fr", "gb-eng") or "";
 * sub is true for a substitute (third part "sub", e.g. "kamo|pl|sub" or "kamo||sub").
 */
export function parseRoster(roster) {
  return String(roster || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, cc = "", role = ""] = x.split("|").map((y) => y.trim());
      return { name, cc: /^[a-z]{2}(-[a-z]{3})?$/i.test(cc) ? cc.toLowerCase() : "", sub: role.toLowerCase() === "sub" };
    })
    .filter((p) => p.name);
}

/** One roster entry back to text: "name", "name|cc", "name|cc|sub" or "name||sub". */
export const rosterEntry = (name, { cc, sub }) => (sub ? `${name}|${cc || ""}|sub` : cc ? `${name}|${cc}` : name);

export const STAFF_ROLES = ["coach", "assistant"];

/** "Chap|fr|coach, Bob|de|assistant" -> [{name, cc, role}]. An unknown role becomes "coach". */
export function parseStaff(staff) {
  return String(staff || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, cc = "", role = ""] = x.split("|").map((y) => y.trim());
      return {
        name,
        cc: /^[a-z]{2}(-[a-z]{3})?$/i.test(cc) ? cc.toLowerCase() : "",
        role: STAFF_ROLES.includes(role.toLowerCase()) ? role.toLowerCase() : "coach",
      };
    })
    .filter((p) => p.name);
}

/** A logo is empty, an https URL, a site-relative path, or a bare file name that lives in /logos/. */
export function validLogo(url) {
  return (
    url === "" ||
    (url.length <= 300 && /^(https:\/\/|\/(?!\/))[^\s"'<>]+$/.test(url)) ||
    /^[\w.-]{1,100}\.(png|svg|webp|jpe?g)$/i.test(url)
  );
}

/** "UCAM.png" -> "/logos/UCAM.png"; links and paths are kept; anything invalid becomes "". */
export function logoUrl(url) {
  const u = String(url || "").trim();
  if (!u || !validLogo(u)) return "";
  if (/^https:\/\//.test(u)) return u;
  // Local files go through /api/logos so they are served live, with no restart.
  const m = /^\/(?:api\/)?logos\/(.+)$/.exec(u);
  if (m) return `/api/logos/${m[1]}`;
  return u.startsWith("/") ? u : `/api/logos/${u}`;
}

export const SWISS_WINS = 3; // wins to advance
export const SWISS_LOSSES = 3; // losses to be eliminated

export function needWins(bo) {
  return Math.ceil((bo || 3) / 2);
}

/** Winner and loser of a series, or null while the score is missing or not a finished series. */
export function calc(bo, sa, sb, a, b) {
  if (sa == null || sb == null) return null;
  const need = needWins(bo);
  if (sa >= need && sb < need) return { winner: a, loser: b };
  if (sb >= need && sa < need) return { winner: b, loser: a };
  return null;
}

export function result(m) {
  return calc(m.bo, m.sa, m.sb, m.a, m.b);
}

/** Swiss record per team id: wins, losses, maps won/lost, matches played. */
export function records(teams, matches) {
  const r = {};
  for (const t of teams) r[t.id] = { w: 0, l: 0, mw: 0, ml: 0, n: 0 };
  for (const m of matches) {
    if (m.stage !== "swiss") continue;
    const res = result(m);
    const A = r[m.a];
    const B = r[m.b];
    if (!res || !A || !B) continue;
    A.mw += m.sa; A.ml += m.sb; B.mw += m.sb; B.ml += m.sa;
    A.n++; B.n++;
    if (res.winner === m.a) { A.w++; B.l++; } else { B.w++; A.l++; }
  }
  return r;
}

/** "adv" at 3 wins, "out" at 3 losses, otherwise "live". */
export function standing(rec, id) {
  const r = rec[id];
  if (!r) return "live";
  return r.w >= SWISS_WINS ? "adv" : r.l >= SWISS_LOSSES ? "out" : "live";
}

/** Teams sorted like a Swiss table: wins, then losses, then map difference, then seed. */
export function rankTeams(teams, rec) {
  return teams.slice().sort((a, b) => {
    const A = rec[a.id], B = rec[b.id];
    return (B.w - A.w) || (A.l - B.l) || ((B.mw - B.ml) - (A.mw - A.ml)) || ((a.order || 0) - (b.order || 0));
  });
}

/**
 * Next Swiss round. Round 1 pairs invited teams with qualified teams in seed order.
 * Later rounds pair teams with the same record (best seed against worst), avoiding rematches.
 * Returns { round, pairs: [[idA, idB], ...] } or { err }.
 */
export function planSwiss(teams, matches) {
  const rec = records(teams, matches);
  const swiss = matches.filter((m) => m.stage === "swiss");
  const round = swiss.reduce((x, m) => Math.max(x, m.round || 0), 0);
  if (teams.length < 16 || teams.some((t) => !t.name)) return { err: "Name all 16 teams first." };
  const ordered = teams.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  if (round === 0) {
    const inv = ordered.filter((t) => t.status === "invited");
    const qua = ordered.filter((t) => t.status !== "invited");
    if (inv.length !== 8 || qua.length !== 8) return { err: "Round 1 needs 8 invited and 8 qualified teams." };
    return { round: 1, pairs: inv.map((t, i) => [t.id, qua[i].id]) };
  }

  if (swiss.some((m) => !result(m)) || !roundDone(swiss, round)) return { err: `Finish every match of round ${round} first.` };
  const active = ordered.filter((t) => standing(rec, t.id) === "live");
  if (!active.length) return { err: "The Swiss Stage is complete." };

  const played = {};
  for (const m of swiss) {
    (played[m.a] ||= {})[m.b] = true;
    (played[m.b] ||= {})[m.a] = true;
  }
  const groups = {};
  for (const t of active) (groups[`${rec[t.id].w}-${rec[t.id].l}`] ||= []).push(t);
  const keys = Object.keys(groups).sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return (bw - aw) || (al - bl);
  });

  const pairs = [];
  let carry = [];
  let rematch = false;
  for (const k of keys) {
    const pool = carry.concat(groups[k]);
    carry = [];
    if (pool.length % 2) carry = [pool.pop()]; // the lowest seed floats down to the next record
    let ps = pairPool(pool, played);
    if (!ps) {
      // No rematch-free pairing exists inside this record: fall back to best against worst.
      rematch = true;
      ps = [];
      for (let i = 0; i < pool.length / 2; i++) ps.push([pool[i].id, pool[pool.length - 1 - i].id]);
    }
    pairs.push(...ps);
  }
  if (carry.length) return { err: "An odd number of teams is left. Add that match by hand." };
  return {
    round: round + 1,
    pairs,
    warning: rematch ? "At least one pairing is a rematch: no other pairing was possible." : "",
  };
}

/** Pairs everyone in `pool` (even length) best seed against worst available, with no rematches. */
function pairPool(pool, played) {
  if (pool.length === 0) return [];
  const [a, ...rest] = pool;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (played[a.id] && played[a.id][rest[i].id]) continue;
    const next = pairPool(rest.filter((_, j) => j !== i), played);
    if (next) return [[a.id, rest[i].id], ...next];
  }
  return null;
}

/** Eight teams with 3 wins, ranked, split into two groups of four. Returns { A: [ids], B: [ids] } or { err }. */
export function planBracket(teams, matches) {
  if (matches.some((m) => m.stage === "elim")) return { err: "The bracket already exists." };
  const rec = records(teams, matches);
  const adv = teams.filter((t) => standing(rec, t.id) === "adv");
  if (adv.length !== 8) return { err: `Needs 8 teams with 3 wins (${adv.length} so far).` };
  adv.sort((a, b) => (rec[a.id].l - rec[b.id].l) || ((a.order || 0) - (b.order || 0)));
  const id = (i) => adv[i].id;
  return { A: [id(0), id(3), id(4), id(7)], B: [id(1), id(2), id(5), id(6)] };
}

/** Everything the prize pool table shows, as team ids ("" while unknown). */
export function prizePool(teams, matches, placements = {}) {
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const rec = records(teams, matches);
  const rA = byId["eA-f"] && result(byId["eA-f"]);
  const rB = byId["eB-f"] && result(byId["eB-f"]);
  let p3 = rA ? rA.loser : "";
  let p4 = rB ? rB.loser : "";
  if (placements.swap) [p3, p4] = [p4, p3];
  // Places 5-8 (lost a semifinal) and 9-16 (out of the Swiss Stage) are ordered by Swiss table rank.
  const rank = Object.fromEntries(rankTeams(teams, rec).map((t, i) => [t.id, i]));
  const byRank = (ids) => ids.slice().sort((a, b) => rank[a] - rank[b]);
  return {
    winners: [rA ? rA.winner : "", rB ? rB.winner : ""],
    p3,
    p4,
    semiLosers: byRank(matches.filter((m) => m.round === "semi" && result(m)).map((m) => result(m).loser)),
    out: byRank(teams.filter((t) => standing(rec, t.id) === "out").map((t) => t.id)),
  };
}

/**
 * Fixed shape of a 16-team Swiss to 3 wins: which records meet in each round and how many matches
 * each bracket holds. "High" has the most wins, "Low" the fewest.
 */
export const SWISS_LAYOUT = [
  { round: 1, groups: [{ key: "0-0", size: 8 }] },
  { round: 2, groups: [{ key: "1-0", name: "High", size: 4 }, { key: "0-1", name: "Low", size: 4 }] },
  {
    round: 3,
    groups: [
      { key: "2-0", name: "High", size: 2 },
      { key: "1-1", name: "Mid", size: 4 },
      { key: "0-2", name: "Low", size: 2 },
    ],
  },
  { round: 4, groups: [{ key: "2-1", name: "High", size: 3 }, { key: "1-2", name: "Low", size: 3 }] },
  { round: 5, groups: [{ key: "2-2", size: 3 }] },
];

/**
 * Swiss matches placed by round and by the record both teams had going into that round.
 * A match that fits no bracket (added by hand) goes in the first bracket of its round.
 */
export function swissGroups(teams, matches) {
  const swiss = matches.filter((m) => m.stage === "swiss");
  return SWISS_LAYOUT.map((r) => {
    const before = records(teams, swiss.filter((m) => m.round < r.round));
    const groups = r.groups.map((g) => ({ ...g, matches: [] }));
    for (const m of swiss.filter((x) => x.round === r.round)) {
      const key = before[m.a] ? `${before[m.a].w}-${before[m.a].l}` : "";
      (groups.find((g) => g.key === key) || groups[0]).matches.push(m);
    }
    return { round: r.round, groups };
  });
}

/** The id of the n-th match (0-based) of a Swiss round, in SWISS_LAYOUT order ("s2-m05" = 1st match of the 0-1 bracket). */
export const swissId = (round, n) => `s${round}-m${String(n + 1).padStart(2, "0")}`;

/** True when every match of a Swiss round exists (as many as the layout holds) and has a result. */
function roundDone(swiss, round) {
  const L = SWISS_LAYOUT.find((x) => x.round === round);
  const ms = swiss.filter((m) => m.round === round);
  return ms.length >= L.groups.reduce((n, g) => n + g.size, 0) && ms.every((m) => result(m));
}

/**
 * A Swiss round drawn by hand. Returns its slots in layout order ({ id, key, name, match }), the teams each record
 * holds going into the round (pools: { "1-0": [ids] }), whether its matches can be chosen now and, if not, why:
 * every earlier round must be complete, and no later round may exist yet.
 */
export function swissDraw(teams, matches, round) {
  const L = SWISS_LAYOUT.find((x) => x.round === round);
  if (!L) return null;
  const swiss = matches.filter((m) => m.stage === "swiss");
  const before = records(teams, swiss.filter((m) => m.round < round));
  const pools = {};
  for (const t of teams) {
    if (!t.name || standing(before, t.id) !== "live") continue;
    (pools[`${before[t.id].w}-${before[t.id].l}`] ||= []).push(t.id);
  }
  const byId = Object.fromEntries(swiss.map((m) => [m.id, m]));
  const slots = [];
  for (const g of L.groups) for (let i = 0; i < g.size; i++) {
    const id = swissId(round, slots.length);
    slots.push({ id, key: g.key, name: g.name || "", match: byId[id] || null });
  }
  let why = "";
  if (teams.length < 16 || teams.some((t) => !t.name)) why = "Name all 16 teams first.";
  else if (matches.some((m) => m.stage === "elim")) why = "The bracket already exists.";
  else if (swiss.some((m) => m.round > round)) why = `Round ${round + 1} already exists.`;
  else for (let r = 1; r < round && !why; r++) if (!roundDone(swiss, r)) why = `Finish round ${r} first.`;
  return { round, slots, pools, editable: !why, why };
}

/** The teams placed in the other matches of the same round (or of the other semifinals): a team plays once per round. */
export function placedInRound(slots, except) {
  const used = new Set();
  for (const s of slots) if (s.id !== except && s.match) for (const t of [s.match.a, s.match.b]) if (t) used.add(t);
  return used;
}

/** The bracket semifinals ("eA-s1", "eA-s2", "eB-s1", "eB-s2") drawn by hand from the 8 teams with 3 wins. */
export const SEMI_IDS = ["eA-s1", "eA-s2", "eB-s1", "eB-s2"];
export function bracketDraw(teams, matches) {
  const rec = records(teams, matches);
  const adv = teams.filter((t) => standing(rec, t.id) === "adv").map((t) => t.id);
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const slots = SEMI_IDS.map((id) => ({ id, key: id.charAt(1), match: byId[id] || null }));
  const why = adv.length !== 8 ? `Needs 8 teams with 3 wins (${adv.length} so far).` : "";
  return { slots, adv, editable: !why, why };
}
