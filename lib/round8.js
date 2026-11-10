// Round 8: the qualification simulator, the tier lists, the hall of fame, the rivalries, the site's polls, the scheduled scores
// and the editors' day board.
import crypto from "node:crypto";
import { EVENTS, buildBracket, podium, roundsFor } from "./bracket.js";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";
import { QUALIFY } from "./pickem.js";

const fail = (status, error) => ({ ok: false, status, error });
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));

export function fillRound8(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS tierlists (hash TEXT PRIMARY KEY, tiers TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS site_polls (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, options TEXT NOT NULL, created TEXT NOT NULL, closes TEXT NOT NULL DEFAULT '', closed INTEGER NOT NULL DEFAULT 0, who TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS poll_votes (poll INTEGER NOT NULL, voter TEXT NOT NULL, choice INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (poll, voter));
    CREATE TABLE IF NOT EXISTS sched_scores (event TEXT NOT NULL, id TEXT NOT NULL, sa INTEGER NOT NULL, sb INTEGER NOT NULL, at TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', PRIMARY KEY (event, id));`);
}

// ---- 1. the qualification simulator

/** The events that can be simulated: the qualifiers with a bracket. */
export const simEvents = (state) => EVENTS.filter((e) => state.qualifiers && state.qualifiers[e] && state.qualifiers[e].slots.some(Boolean));

function rng(seed) {
  let h = seed >>> 0 || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

/**
 * Each team's chances to qualify, from n draws of the matches left (the power ranking's ratings, the series' length), the
 * results already known and the visitor's own picks (forced: { matchId: slot }).
 * { teams: [{ slot, name, logo, pct }] (still in, best first), next: [{ id, round, a, b, aName, bName, forced }] (playable now), n }
 */
export function simulate(state, event, rating, forced = {}, { n = 2000, seed = 7 } = {}) {
  const q = state.qualifiers && state.qualifiers[event];
  if (!q) return null;
  const real = buildBracket(q.slots, q.scores, q.bo);
  const rounds = roundsFor(q.slots.length);
  const need = QUALIFY[event] || 1;
  const nameOf = (slot) => (slot && q.slots[slot - 1] ? q.slots[slot - 1].name : "");
  const elo = (slot) => rating.get(teamSlug(nameOf(slot))) || 1500;
  const pMap = (a, b) => 1 / (1 + 10 ** ((elo(b) - elo(a)) / 400));
  // a series: the first to win more than half of its maps
  const pSeries = (p, bo) => {
    if (bo <= 1) return p;
    const w = Math.ceil(bo / 2);
    let s = 0;
    const c = (k, r) => { let x = 1; for (let i = 1; i <= r; i++) x = (x * (k - r + i)) / i; return x; };
    for (let l = 0; l < w; l++) s += c(w - 1 + l, l) * p ** w * (1 - p) ** l;
    return s;
  };
  const count = new Map();
  const r = rng(seed);
  const byRound = rounds.map((rd) => real.matches.filter((m) => m.round === rd.key));
  for (let k = 0; k < n; k++) {
    let prev = null;
    let sfLosers = [];
    let gf = null;
    for (let ri = 0; ri < byRound.length; ri++) {
      const row = byRound[ri].map((m, i) => {
        const a = prev ? prev[2 * i] : m.a;
        const b = prev ? prev[2 * i + 1] : m.b;
        if (!a || !b) return { w: a || b, l: null };
        if (m.winner && m.a === a && m.b === b) return { w: m.winner, l: m.loser };
        const f = forced[m.id];
        if (f === a || f === b) return { w: f, l: f === a ? b : a };
        const win = r() < pSeries(pMap(a, b), m.bo) ? a : b;
        return { w: win, l: win === a ? b : a };
      });
      if (byRound[ri][0].round === "sf") sfLosers = row.map((x) => x.l);
      if (byRound[ri][0].round === "gf") gf = row[0];
      prev = row.map((x) => x.w);
    }
    const third = real.byId["third-1"];
    let th = null;
    if (sfLosers[0] && sfLosers[1]) {
      const [a, b] = sfLosers;
      if (third.winner && third.a === a && third.b === b) th = { w: third.winner, l: third.loser };
      else { const win = r() < pSeries(pMap(a, b), third.bo) ? a : b; th = { w: win, l: win === a ? b : a }; }
    }
    const top = [gf && gf.w, gf && gf.l, th && th.w, th && th.l].slice(0, need);
    for (const s of top) if (s) count.set(s, (count.get(s) || 0) + 1);
  }
  const lost = new Set(real.matches.filter((m) => m.loser && m.round !== "sf" && m.round !== "gf" && m.round !== "third").map((m) => m.loser));
  const done = podium(real).slice(0, need).every(Boolean);
  const teams = q.slots.map((t, i) => ({ slot: i + 1, t })).filter(({ t, slot }) => t && t.name && (count.get(slot) || (!lost.has(slot) && !done)))
    .map(({ t, slot }) => ({ slot, name: t.name, logo: t.logo || "", pct: Math.round(((count.get(slot) || 0) / n) * 1000) / 10 }))
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name)).slice(0, 32);
  const next = real.matches.filter((m) => m.a && m.b && !m.winner && !m.bye).slice(0, 16)
    .map((m) => ({ id: m.id, round: m.round, a: m.a, b: m.b, aName: nameOf(m.a), bName: nameOf(m.b), forced: forced[m.id] || null }));
  return { teams, next, n, need, done };
}

/** The chances of one team in every event it is still in: [{ event, pct }]. */
export function teamChances(state, rating, name) {
  const out = [];
  for (const ev of simEvents(state)) {
    const s = simulate(state, ev, rating, {}, { n: 800 });
    const t = s && s.teams.find((x) => teamSlug(x.name) === teamSlug(name));
    if (t && !s.done) out.push({ event: ev, name: EVENT_NAMES[ev] || ev, pct: t.pct });
  }
  return out;
}

// ---- 2. tier lists

export const TIERS = ["S", "A", "B", "C", "D"];
const TIER_SCORE = { S: 4, A: 3, B: 2, C: 1, D: 0 };

/** The teams a tier list can hold: the Kickoff's, the regional playoffs' and the EU playoffs' (the best known; no Game Changers). */
export function tierTeams(state) {
  const seen = new Map();
  const add = (t) => { if (t && t.name && !seen.has(teamSlug(t.name))) seen.set(teamSlug(t.name), { slug: teamSlug(t.name), name: t.name, tag: t.tag || "", logo: t.logo || "" }); };
  for (const t of (state.kickoff && state.kickoff.teams) || []) add(t);
  for (const e of ["tr", "mena"]) for (const t of ((state.regional && state.regional[e]) || { teams: [] }).teams || []) add(t);
  for (const t of state.teams || []) add(t);
  return [...seen.values()].slice(0, 48);
}

/** Keeps only known teams, each once, in known tiers: { S: [slug], … }. */
export function cleanTiers(raw, teams) {
  const known = new Set(teams.map((t) => t.slug));
  const used = new Set();
  const out = {};
  for (const k of TIERS) {
    out[k] = [];
    for (const s of Array.isArray(raw && raw[k]) ? raw[k] : []) {
      const slug = String(s);
      if (known.has(slug) && !used.has(slug)) { used.add(slug); out[k].push(slug); }
    }
  }
  return out;
}

export function saveTierlist(db, teams, { token, tiers }, now = Date.now()) {
  if (!validToken(token)) return fail(400, "Reload the page and try again.");
  const clean = cleanTiers(tiers, teams);
  if (TIERS.reduce((s, k) => s + clean[k].length, 0) < 3) return fail(400, "Place at least 3 teams.");
  db.prepare("INSERT INTO tierlists (hash, tiers, updated) VALUES (?, ?, ?) ON CONFLICT (hash) DO UPDATE SET tiers = excluded.tiers, updated = excluded.updated").run(hashOf(token), JSON.stringify(clean), new Date(now).toISOString());
  return { ok: true, message: "Tier list saved." };
}

export const myTierlist = (db, token) => (validToken(token) ? (db.prepare("SELECT tiers FROM tierlists WHERE hash = ?").get(hashOf(token)) || {}).tiers || null : null);

/** The community's tier list: each team's average (S 4 … D 0) over the lists that place it, in the tier it rounds to. */
export function communityTiers(db, teams) {
  const sum = new Map();
  let lists = 0;
  for (const r of db.prepare("SELECT tiers FROM tierlists").all()) {
    const t = cleanTiers(JSON.parse(r.tiers), teams);
    lists += 1;
    for (const k of TIERS) for (const s of t[k]) { const x = sum.get(s) || { n: 0, v: 0 }; x.n += 1; x.v += TIER_SCORE[k]; sum.set(s, x); }
  }
  const out = Object.fromEntries(TIERS.map((k) => [k, []]));
  const scored = [...sum.entries()].map(([slug, x]) => ({ slug, avg: x.v / x.n, n: x.n })).sort((a, b) => b.avg - a.avg);
  for (const s of scored) out[TIERS[Math.min(4, Math.max(0, 4 - Math.round(s.avg)))]].push(s.slug);
  return { tiers: out, lists };
}

/** A tier list as a short text for an address: "S:fnatic,th;A:kc". And back. */
export const tiersToParam = (tiers) => TIERS.filter((k) => (tiers[k] || []).length).map((k) => `${k}:${tiers[k].join(",")}`).join(";");
export const tiersFromParam = (s) => Object.fromEntries(String(s || "").split(";").map((p) => p.split(":")).filter(([k, v]) => TIERS.includes(k) && v).map(([k, v]) => [k, v.split(",").slice(0, 30)]));

// ---- 3. the hall of fame

/** A season's winners: [{ event, name, winner }] (the qualifiers' qualified teams, the other events' grand final), and its strongest team. */
export function seasonHonours(state, power = []) {
  const out = [];
  for (const ev of EVENTS) {
    const q = state.qualifiers && state.qualifiers[ev];
    if (!q) continue;
    const top = podium(buildBracket(q.slots, q.scores, q.bo)).slice(0, QUALIFY[ev] || 1).map((s) => (s && q.slots[s - 1] ? q.slots[s - 1].name : ""));
    if (top.every(Boolean)) out.push({ event: ev, name: EVENT_NAMES[ev] || ev, winner: top.join(", "), kind: "qualified" });
  }
  const all = allMatches(state);
  for (const ev of ["playoffs", "tr", "mena", "kickoff", "gc"]) {
    const gf = all.find((m) => m.event === ev && /^(gf|f)(-|$)/.test(m.id) && m.win);
    if (gf) out.push({ event: ev, name: EVENT_NAMES[ev] || ev, winner: gf.win === "a" ? gf.a.name : gf.b.name, kind: "champion" });
  }
  const mvps = {};
  for (const [, byId] of Object.entries(state.extra || {})) for (const x of Object.values(byId || {})) if (x && x.mvp) mvps[x.mvp] = (mvps[x.mvp] || 0) + 1;
  const mvp = Object.entries(mvps).sort((a, b) => b[1] - a[1])[0];
  return { honours: out, strongest: power[0] ? power[0].name : "", mvp: mvp ? { name: mvp[0], n: mvp[1] } : null, matches: all.filter((m) => m.win).length };
}

// ---- 5. rivalries

/** The pairs of teams that met the most: [{ a, b, slugA, slugB, meetings, wa, wb, last }], 2 meetings at least. Pure. */
export function rivalries(state, limit = 30) {
  const pairs = new Map();
  for (const m of allMatches(state).filter((x) => x.win && x.a && x.b && x.a.name && x.b.name)) {
    const [x, y] = [m.a.name, m.b.name].sort((p, q) => teamSlug(p).localeCompare(teamSlug(q)));
    const key = `${teamSlug(x)}|${teamSlug(y)}`;
    const p = pairs.get(key) || { a: x, b: y, slugA: teamSlug(x), slugB: teamSlug(y), meetings: 0, wa: 0, wb: 0, last: null };
    p.meetings += 1;
    const winner = m.win === "a" ? m.a.name : m.b.name;
    if (teamSlug(winner) === p.slugA) p.wa += 1; else p.wb += 1;
    if (!p.last || (m.at || "") > (p.last.at || "")) p.last = { event: m.event, id: m.id, at: m.at || "", winner, score: `${Math.max(m.sa, m.sb)}–${Math.min(m.sa, m.sb)}` };
    pairs.set(key, p);
  }
  return [...pairs.values()].filter((p) => p.meetings >= 2).sort((a, b) => b.meetings - a.meetings || Math.min(b.wa, b.wb) - Math.min(a.wa, a.wb) || (b.last.at || "").localeCompare(a.last.at || "")).slice(0, limit);
}

// ---- 6 and 7. the site's polls

export function createPoll(db, { question, options, closes, who = "" }, now = Date.now()) {
  const q = String(question || "").trim().slice(0, 140);
  const opts = (Array.isArray(options) ? options : String(options || "").split("\n")).map((o) => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, 6);
  if (q.length < 5) return fail(400, "Write the question.");
  if (opts.length < 2) return fail(400, "Give at least 2 answers.");
  const end = closes ? new Date(closes) : null;
  if (end && Number.isNaN(end.getTime())) return fail(400, "Unknown date.");
  db.prepare("INSERT INTO site_polls (question, options, created, closes, who) VALUES (?, ?, ?, ?, ?)").run(q, JSON.stringify(opts), new Date(now).toISOString(), end ? end.toISOString() : "", who);
  return { ok: true, message: "Poll published." };
}

export function closePoll(db, { id }) {
  const r = db.prepare("UPDATE site_polls SET closed = 1 WHERE id = ?").run(Number(id));
  return r.changes ? { ok: true, message: "Poll closed." } : fail(404, "Unknown poll.");
}

const isOpenPoll = (p, now) => !p.closed && (!p.closes || new Date(p.closes).getTime() > now);

/** A poll with its counts: { id, question, options, counts, total, open, closes }. */
export function pollView(db, p, now = Date.now()) {
  const opts = JSON.parse(p.options);
  const counts = opts.map(() => 0);
  for (const r of db.prepare("SELECT choice, COUNT(*) AS n FROM poll_votes WHERE poll = ? GROUP BY choice").all(p.id)) if (counts[r.choice] != null) counts[r.choice] = r.n;
  return { id: p.id, question: p.question, options: opts, counts, total: counts.reduce((s, x) => s + x, 0), open: isOpenPoll(p, now), closes: p.closes, created: p.created };
}

export const listPolls = (db, now = Date.now(), limit = 20) => db.prepare("SELECT * FROM site_polls ORDER BY id DESC LIMIT ?").all(limit).map((p) => pollView(db, p, now));

/** The latest open poll, or null. */
export function currentPoll(db, now = Date.now()) {
  const p = db.prepare("SELECT * FROM site_polls WHERE closed = 0 ORDER BY id DESC").all().find((x) => isOpenPoll(x, now));
  return p ? pollView(db, p, now) : null;
}

/** A vote, from the site (voter: the visitor's hash) or Discord ("d:" + user id). Can be changed while the poll is open. */
export function votePoll(db, { id, voter, choice }, now = Date.now()) {
  const p = db.prepare("SELECT * FROM site_polls WHERE id = ?").get(Number(id));
  if (!p) return fail(404, "Unknown poll.");
  if (!isOpenPoll(p, now)) return fail(409, "This poll is closed.");
  const c = Number(choice);
  if (!Number.isInteger(c) || c < 0 || c >= JSON.parse(p.options).length) return fail(400, "Unknown answer.");
  db.prepare("INSERT INTO poll_votes (poll, voter, choice, at) VALUES (?, ?, ?, ?) ON CONFLICT (poll, voter) DO UPDATE SET choice = excluded.choice, at = excluded.at").run(p.id, voter, c, new Date(now).toISOString());
  return { ok: true, poll: pollView(db, p, now) };
}

export const voterOf = (token) => (validToken(token) ? hashOf(token) : "");
export const myVote = (db, id, voter) => { const r = voter ? db.prepare("SELECT choice FROM poll_votes WHERE poll = ? AND voter = ?").get(Number(id), voter) : null; return r ? r.choice : null; };

// ---- 8. scheduled scores

export function scheduleScore(db, { event, id, sa, sb, at, who = "" }, now = Date.now()) {
  if (!event || !id) return fail(400, "Unknown match.");
  const a = Number(sa);
  const b = Number(sb);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return fail(400, "Give a score with a winner.");
  const t = new Date(at);
  if (Number.isNaN(t.getTime()) || t.getTime() <= now) return fail(400, "Pick a time to come.");
  db.prepare("INSERT INTO sched_scores (event, id, sa, sb, at, who) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET sa = excluded.sa, sb = excluded.sb, at = excluded.at, who = excluded.who").run(event, id, a, b, t.toISOString(), who);
  return { ok: true, message: "Score scheduled." };
}

export const listScheduledScores = (db) => db.prepare("SELECT event, id, sa, sb, at, who FROM sched_scores ORDER BY at").all();
export function cancelScheduledScore(db, { event, id }) { db.prepare("DELETE FROM sched_scores WHERE event = ? AND id = ?").run(event, id); return { ok: true, message: "Scheduled score removed." }; }

/** The scores due now, taken off the list: [{ event, id, sa, sb, who }]. */
export function takeDueScores(db, now = Date.now()) {
  const due = db.prepare("SELECT event, id, sa, sb, who FROM sched_scores WHERE at <= ?").all(new Date(now).toISOString());
  for (const s of due) db.prepare("DELETE FROM sched_scores WHERE event = ? AND id = ?").run(s.event, s.id);
  return due;
}

// ---- 9. the editors' day board

/** Today's matches (Paris) with what is missing: [{ event, id, a, b, at, live, done, missing: ["score", "maps", "mvp"], who }]. Pure but for claims. */
export function dayBoard(state, claims = {}, now = Date.now()) {
  const day = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(d));
  const today = day(now);
  return allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.at && day(m.at) === today).sort((x, y) => x.at.localeCompare(y.at)).map((m) => {
    const ex = (state.extra[m.event] || {})[m.id] || {};
    const started = new Date(m.at).getTime() <= now;
    const done = m.sa != null && m.sb != null;
    const missing = [];
    if (started && !done && !m.live) missing.push("score");
    if (done && !(ex.maps || []).some((x) => x.a != null) && !ex.hasDetails) missing.push("maps");
    if (done && !ex.mvp && !ex.hasDetails) missing.push("mvp");
    return { event: m.event, id: m.id, a: m.a.name, b: m.b.name, at: m.at, live: !!m.live, done, missing, who: claims[`${m.event}:${m.id}`] };
  });
}
