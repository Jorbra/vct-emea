// Round 11: players with a close profile, a match's preview, an event's and the season's feed, the week's team, the predictors' tiers.
import { allMatches, eventData, matchesOf } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";
import { qualifiedTeams } from "./r9pure.js";

const DAY = 86400000;
const KEYS = ["r", "acs", "kd", "kast", "adr", "hs"];

// ---- A12. players with a close profile

/** The players closest to one by their numbers (each scaled over the pool): [{ slug, name, team, r, acs, score }]. Pure. */
export function similarPlayers(players, slug, n = 5) {
  const pool = players.filter((p) => p.maps >= 4 && KEYS.every((k) => p[k] != null));
  const me = pool.find((p) => p.slug === slug);
  if (!me || pool.length < 6) return [];
  const span = Object.fromEntries(KEYS.map((k) => { const v = pool.map((p) => p[k]); return [k, Math.max(...v) - Math.min(...v) || 1]; }));
  const dist = (p) => Math.sqrt(KEYS.reduce((s, k) => s + ((p[k] - me[k]) / span[k]) ** 2, 0));
  return pool.filter((p) => p.slug !== slug).map((p) => ({ slug: p.slug, name: p.name, team: p.team, r: p.r, acs: p.acs, score: Math.round((1 - Math.min(1, dist(p) / 1.5)) * 100) }))
    .sort((a, b) => b.score - a.score).slice(0, n);
}

// ---- A13. a match's preview

/** { a: { form, w, l }, b: {...}, h2h: { a, b, last }, picks: { a, b, total }, keys: { a: [player], b: [player] } }. */
export function matchPreview(state, m, { players = [], picks = { a: 0, b: 0, total: 0 } } = {}) {
  const all = allMatches(state).filter((x) => x.win && x.a && x.b && x.at && x.at < (m.at || "9999"));
  const form = (name) => {
    const slug = teamSlug(name);
    const list = all.filter((x) => teamSlug(x.a.name) === slug || teamSlug(x.b.name) === slug).sort((x, y) => y.at.localeCompare(x.at));
    const won = (x) => teamSlug(x.win === "a" ? x.a.name : x.b.name) === slug;
    return { form: list.slice(0, 5).map((x) => (won(x) ? "w" : "l")).reverse(), w: list.filter(won).length, l: list.filter((x) => !won(x)).length };
  };
  const pair = [teamSlug(m.a.name), teamSlug(m.b.name)].sort().join("|");
  const meet = all.filter((x) => [teamSlug(x.a.name), teamSlug(x.b.name)].sort().join("|") === pair).sort((x, y) => y.at.localeCompare(x.at));
  const h2h = { a: meet.filter((x) => teamSlug(x.win === "a" ? x.a.name : x.b.name) === teamSlug(m.a.name)).length, b: 0, last: meet[0] ? { event: meet[0].event, id: meet[0].id, sa: meet[0].sa, sb: meet[0].sb, a: meet[0].a.name, b: meet[0].b.name } : null };
  h2h.b = meet.length - h2h.a;
  const keys = (name) => players.filter((p) => teamSlug(p.team) === teamSlug(name) && p.maps >= 2 && p.r != null).sort((x, y) => y.r - x.r).slice(0, 2).map((p) => ({ name: p.name, slug: p.slug, r: p.r, acs: p.acs }));
  return { a: form(m.a.name), b: form(m.b.name), h2h, picks, keys: { a: keys(m.a.name), b: keys(m.b.name) } };
}

// ---- R22. an event, day by day

/** [{ day ("2026-11-10"), items: [{ id, a, b, sa, sb, winner, upset }] }], latest first. upset: the lower-rated team won. Pure. */
export function eventFeed(state, event, rating = new Map()) {
  const days = {};
  for (const m of matchesOf(event, eventData(state, event))) {
    const at = state.times && state.times[event] && state.times[event][m.id];
    if (!at || m.sa == null || !m.a || !m.b) continue;
    const day = at.slice(0, 10);
    const ra = rating.get(teamSlug(m.a.name)) || 1500;
    const rb = rating.get(teamSlug(m.b.name)) || 1500;
    const winA = m.sa > m.sb;
    (days[day] ||= []).push({ id: m.id, at, a: m.a.name, b: m.b.name, sa: m.sa, sb: m.sb, winner: winA ? m.a.name : m.b.name, upset: Math.abs(ra - rb) >= 40 && (winA ? ra < rb : rb < ra) });
  }
  return Object.entries(days).sort((x, y) => y[0].localeCompare(x[0])).map(([day, items]) => ({ day, items: items.sort((x, y) => x.at.localeCompare(y.at)) }));
}

// ---- A14. the season, as one feed

/** [{ at, kind: "result" | "qualified" | "transfer", text parts… }], latest first, 200 at most. */
export function seasonFeed(state, transfers = [], now = Date.now()) {
  const out = [];
  const big = new Set(["kickoff", "playoffs", "tr", "mena"]);
  for (const m of allMatches(state)) {
    if (!m.win || !m.at || !m.a || !m.b) continue;
    const final = /^(gf|f|sf)(-|$)/.test(m.id);
    if (!big.has(m.event) && !final) continue;
    out.push({ at: m.at, kind: "result", event: m.event, name: EVENT_NAMES[m.event] || m.event, id: m.id, a: m.a.name, b: m.b.name, sa: m.sa, sb: m.sb, winner: m.win === "a" ? m.a.name : m.b.name });
  }
  const times = state.times || {};
  for (const q of qualifiedTeams(state)) {
    const last = Object.values(times[q.event] || {}).sort().pop() || "";
    out.push({ at: last, kind: "qualified", event: q.event, name: q.name, team: q.team, slug: q.slug, to: q.to });
  }
  for (const t of transfers.slice(0, 60)) if (t.date) out.push({ at: `${t.date}T12:00:00.000Z`, kind: "transfer", move: t.kind, player: t.id || "", team: t.team || "", to: t.toName || "" });
  return out.filter((x) => x.at && new Date(x.at).getTime() <= now + DAY).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
}

// ---- B7. the team of the week: the best player per role over the last 7 days

const AGENT_ROLE = {
  jett: "duelist", raze: "duelist", reyna: "duelist", phoenix: "duelist", yoru: "duelist", neon: "duelist", iso: "duelist", waylay: "duelist",
  sova: "initiator", breach: "initiator", skye: "initiator", kayo: "initiator", fade: "initiator", gekko: "initiator", tejo: "initiator",
  brimstone: "controller", omen: "controller", viper: "controller", astra: "controller", harbor: "controller", clove: "controller",
  killjoy: "sentinel", cypher: "sentinel", sage: "sentinel", chamber: "sentinel", deadlock: "sentinel", vyse: "sentinel",
};

/** { duelist, initiator, controller, sentinel, flex }: { name, team, r, maps } each (2 maps at least). Pure. */
export function teamOfWeek(state, entries, now = Date.now()) {
  const recent = new Set(allMatches(state).filter((m) => m.win && m.at && now - new Date(m.at).getTime() <= 7 * DAY && new Date(m.at).getTime() <= now).map((m) => `${m.event}:${m.id}`));
  const per = new Map();
  for (const e of entries) {
    if (!recent.has(`${e.event}:${e.id}`)) continue;
    for (const mp of (e.details && e.details.maps) || []) {
      for (const r of mp.rows || []) {
        if (r.r == null || !r.name) continue;
        const p = per.get(r.name) || { name: r.name, sum: 0, maps: 0, roles: {}, team: "" };
        p.sum += r.r; p.maps += 1;
        for (const a of r.agents || []) { const role = AGENT_ROLE[String(a).toLowerCase().replace(/[^a-z]/g, "")]; if (role) p.roles[role] = (p.roles[role] || 0) + 1; }
        per.set(r.name, p);
      }
    }
  }
  const list = [...per.values()].filter((p) => p.maps >= 2).map((p) => ({ name: p.name, r: Math.round((p.sum / p.maps) * 100) / 100, maps: p.maps, role: Object.entries(p.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || "flex" })).sort((a, b) => b.r - a.r);
  const out = {};
  const used = new Set();
  for (const role of ["duelist", "initiator", "controller", "sentinel"]) { const p = list.find((x) => x.role === role && !used.has(x.name)); if (p) { out[role] = p; used.add(p.name); } }
  const flex = list.find((x) => !used.has(x.name));
  if (flex) out.flex = flex;
  return out;
}

// ---- B8. the predictors' tiers

export const TIERS = [["gold", 30], ["silver", 10], ["bronze", 1]];
/** A predictor's tier from their season points: "gold" (30+), "silver" (10+), "bronze" (1+) or "". */
export const tierOf = (points) => (TIERS.find(([, min]) => points >= min) || [""])[0];
