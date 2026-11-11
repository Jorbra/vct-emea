// Round 10: agents by map, players in form, a visitor's accuracy over time, the editors' notes on a match, the prediction of the day.
import crypto from "node:crypto";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";

const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const validToken = (t) => /^[A-Za-z0-9_-]{20,80}$/.test(String(t || ""));
const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

export function fillRound10(db) {
  db.exec("CREATE TABLE IF NOT EXISTS match_notes (event TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (event, id));");
}

// ---- A6. agents by map

/**
 * How often each agent is picked on each map, from vlr.gg's tables: { maps: [{ map, games }], agents: [name], cells: { "map|agent": pct } }.
 * pct: the share of that map's teams that had the agent (a team has an agent once per map). The 12 most picked agents. Pure.
 */
export function agentMapTable(entries) {
  const games = {};
  const picks = {};
  const total = {};
  for (const { details } of entries) {
    for (const mp of (details && details.maps) || []) {
      if (!mp.map) continue;
      const sides = { a: new Set(), b: new Set() };
      for (const r of mp.rows || []) for (const a of r.agents || []) if (sides[r.side]) sides[r.side].add(a);
      const teams = ["a", "b"].filter((s) => sides[s].size);
      if (!teams.length) continue;
      games[mp.map] = (games[mp.map] || 0) + teams.length;
      for (const s of teams) for (const a of sides[s]) { picks[`${mp.map}|${a}`] = (picks[`${mp.map}|${a}`] || 0) + 1; total[a] = (total[a] || 0) + 1; }
    }
  }
  const agents = Object.entries(total).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([a]) => a);
  const maps = Object.entries(games).sort((x, y) => y[1] - x[1]).map(([map, g]) => ({ map, games: g }));
  const cells = {};
  for (const { map, games: g } of maps) for (const a of agents) cells[`${map}|${a}`] = Math.round(((picks[`${map}|${a}`] || 0) / g) * 100);
  return { maps, agents: agents.map(cap), keys: agents, cells };
}

// ---- A8. players in form

/**
 * The players whose last matches (14 days) are the furthest above their own average: [{ name, slug, team, recent, season, delta, n }].
 * 5 matches at least, 2 of them recent. Pure: from the stats' matches and the matches' times.
 */
export function playersInForm(state, stats, now = Date.now(), limit = 10) {
  const at = new Map(allMatches(state).map((m) => [`${m.event}:${m.id}`, m.at ? new Date(m.at).getTime() : 0]));
  const byName = new Map(stats.players.map((p) => [p.slug, p]));
  const out = [];
  for (const [slug, list] of Object.entries(stats.byPlayer || {})) {
    const rated = list.filter((g) => g.r != null).map((g) => ({ ...g, t: at.get(`${g.event}:${g.id}`) || 0 }));
    if (rated.length < 5) continue;
    const recent = rated.filter((g) => g.t && now - g.t <= 14 * 86400000);
    if (recent.length < 2) continue;
    const avg = (l) => l.reduce((s, g) => s + g.r, 0) / l.length;
    const p = byName.get(slug);
    const season = avg(rated);
    const last = avg(recent);
    out.push({ name: (p && p.name) || slug, slug, team: (p && p.team) || "", recent: Math.round(last * 100) / 100, season: Math.round(season * 100) / 100, delta: Math.round((last - season) * 100) / 100, n: recent.length });
  }
  return out.sort((a, b) => b.delta - a.delta || b.recent - a.recent).slice(0, limit);
}

// ---- A7. a visitor's accuracy, week by week

/** [{ week (Monday, "2026-11-09"), good, total }], oldest first, the weeks with a finished match predicted. */
export function accuracyByWeek(db, state, token) {
  if (!validToken(token)) return [];
  const monday = (t) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const done = new Map(allMatches(state).filter((m) => m.win && m.at).map((m) => [`${m.event}:${m.id}`, { winner: m.win === "a" ? m.a.name : m.b.name, at: m.at }]));
  const weeks = {};
  for (const p of db.prepare("SELECT event, id, pick FROM predictions WHERE hash = ?").all(hashOf(token))) {
    const m = done.get(`${p.event}:${p.id}`);
    if (!m) continue;
    const w = (weeks[monday(m.at)] ||= { week: monday(m.at), good: 0, total: 0 });
    w.total += 1;
    if (m.winner === p.pick) w.good += 1;
  }
  return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
}

// ---- E3. the editors' notes on a match

export function saveNote(db, { event, id, body, who = "" }, now = Date.now()) {
  if (!event || !id) return { ok: false, status: 400, error: "Unknown match." };
  const text = String(body || "").trim().slice(0, 500);
  if (!text) { db.prepare("DELETE FROM match_notes WHERE event = ? AND id = ?").run(event, id); return { ok: true }; }
  db.prepare("INSERT INTO match_notes (event, id, body, who, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET body = excluded.body, who = excluded.who, at = excluded.at").run(event, id, text, who, new Date(now).toISOString());
  return { ok: true };
}

/** { "event:id": { body, who, at } } */
export const listNotes = (db) => Object.fromEntries(db.prepare("SELECT event, id, body, who, at FROM match_notes").all().map((r) => [`${r.event}:${r.id}`, { body: r.body, who: r.who, at: r.at }]));

// ---- B4. the prediction of the day

const WEIGHT = (id) => (/^(gf|f)(-|$)/.test(id) ? 6 : /^sf/.test(id) ? 5 : /^qf/.test(id) ? 4 : /^r16/.test(id) ? 3 : /^(r32|ubf|lbf|uf|lf)/.test(id) ? 2 : 1);
const PRIORITY = { kickoff: 5, playoffs: 4, tr: 3, mena: 3, q1: 2, q2: 2, trq1: 1, trq2: 1, meq1: 1, meq2: 1, naq1: 1, naq2: 1, gc: 2 };

/** Today's most awaited match (Paris day), both teams known, not started: the match or null. Pure. */
export function matchOfTheDay(state, isOpen, now = Date.now()) {
  const day = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(t));
  const today = day(now);
  const list = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.at && day(m.at) === today && new Date(m.at).getTime() > now && isOpen(m));
  return list.sort((x, y) => (PRIORITY[y.event] || 0) * 10 + WEIGHT(y.id) - ((PRIORITY[x.event] || 0) * 10 + WEIGHT(x.id)) || x.at.localeCompare(y.at))[0] || null;
}

/** The picks made on a match: { a, b, total } (counts by team). */
export function pickSplit(db, m) {
  const rows = db.prepare("SELECT pick, COUNT(*) AS n FROM predictions WHERE event = ? AND id = ? GROUP BY pick").all(m.event, m.id);
  const a = (rows.find((r) => r.pick === m.a.name) || { n: 0 }).n;
  const b = (rows.find((r) => r.pick === m.b.name) || { n: 0 }).n;
  return { a, b, total: a + b };
}

export const eventLabel = (e) => EVENT_NAMES[e] || e;
export { teamSlug };
