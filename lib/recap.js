// A qualifier's recap: who went through and how, the best players, the closest maps. Pure: from getState() and vlr.gg's tables.
import { buildBracket, qualifiedOf } from "./bracket.js";
import { eventData, matchesOf } from "./matchlist.js";
import { teamSlug } from "./paths.js";
import { QUALIFY } from "./pickem.js";
import { tournamentStats } from "./tstats.js";

const nameOf = (t) => (t && t.name) || "";

/** One team's way through the event: [{ id, round, opponent, mine, theirs, won, note }], first match first. */
export function teamPath(items, team) {
  const key = teamSlug(team);
  return items.filter((m) => m.sa != null && m.sb != null && [teamSlug(nameOf(m.a)), teamSlug(nameOf(m.b))].includes(key)).map((m) => {
    const side = teamSlug(nameOf(m.a)) === key ? "a" : "b";
    return { id: m.id, round: m.round, opponent: side === "a" ? m.b : m.a, mine: side === "a" ? m.sa : m.sb, theirs: side === "a" ? m.sb : m.sa, won: m.win === side, note: m.note || null };
  });
}

/**
 * { event, done, n, qualified: [{ team, path }], alive: [team] (while it runs), played, total, top: [players], bigGames: [...], closest: [...], maps, overtime, agent }
 * null when the event has no bracket.
 */
export function recapOf(state, entries, event) {
  const q = state.qualifiers && state.qualifiers[event];
  if (!q) return null;
  const items = matchesOf(event, eventData(state, event));
  const n = QUALIFY[event] || 1;
  const top = qualifiedOf(buildBracket(q.slots, q.scores, q.bo), n).map((s) => (s && q.slots[s - 1]) || null);
  const done = top.length === n && top.every(Boolean);
  const losers = new Set(items.filter((m) => m.win).map((m) => teamSlug(nameOf(m.win === "a" ? m.b : m.a))));
  const alive = done ? [] : q.slots.filter((t) => t && t.name && !losers.has(teamSlug(t.name)));
  const ready = items.filter((m) => m.a && m.b);
  const stats = tournamentStats(state, entries.filter((e) => e.event === event));
  const players = stats.players.filter((p) => p.maps >= 4).sort((a, b) => (b.r || 0) - (a.r || 0) || (b.acs || 0) - (a.acs || 0)).slice(0, 10)
    .map(({ slug, name, cc, team, maps, r, acs, kd, kast, adr }) => ({ slug, name, cc, team, maps, r, acs, kd, kast, adr }));
  const games = Object.entries(stats.byPlayer).flatMap(([slug, list]) => list.map((g) => ({ slug, ...g })));
  const nameBySlug = Object.fromEntries(stats.players.map((p) => [p.slug, p.name]));
  const bigGames = games.filter((g) => g.acs != null).sort((a, b) => b.acs - a.acs).slice(0, 6)
    .map((g) => ({ name: nameBySlug[g.slug] || g.slug, slug: g.slug, team: g.team, opponent: g.opponent, acs: g.acs, k: g.k, d: g.d, id: g.id, won: g.won }));
  const closest = [];
  for (const { id, details } of entries.filter((e) => e.event === event)) {
    const m = items.find((x) => x.id === id);
    if (!m) continue;
    for (const mp of details.maps || []) closest.push({ id, map: mp.map, a: nameOf(m.a), b: nameOf(m.b), sa: mp.a, sb: mp.b, rounds: mp.a + mp.b });
  }
  closest.sort((x, y) => Math.abs(x.sa - x.sb) - Math.abs(y.sa - y.sb) || y.rounds - x.rounds);
  const agents = {};
  for (const p of stats.players) for (const a of p.agents) agents[a.name] = (agents[a.name] || 0) + a.n;
  const agent = Object.entries(agents).sort((a, b) => b[1] - a[1])[0];
  return {
    event, done, n,
    qualified: done ? top.map((t) => ({ team: t, path: teamPath(items, t.name) })) : [],
    alive: alive.length <= 16 ? alive.map((t) => ({ team: t, path: teamPath(items, t.name) })) : [],
    aliveCount: alive.length,
    played: ready.filter((m) => m.sa != null).length, total: ready.length,
    top: players, bigGames, closest: closest.slice(0, 6),
    maps: stats.maps.slice(0, 5).map((m) => ({ map: m.map, played: m.played })), overtime: stats.maps.reduce((s, m) => s + m.overtime, 0),
    agent: agent ? { name: agent[0], n: agent[1] } : null,
  };
}
