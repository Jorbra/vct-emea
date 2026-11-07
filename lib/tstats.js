// A tournament's numbers from vlr.gg's tables (mextra.details): players, teams and maps. Read on the server only, kept a minute:
// the tables are big, and the pages get only what they show.
import { eventData, matchesOf } from "./matchlist.js";
import { teamSlug } from "./paths.js";

const KEEP_MS = 60000;

/** The tables saved: [{ event, id, details }], for one event or all. */
export function readDetails(db, event = "") {
  const key = `details:${event}`;
  const memo = (globalThis.__tstats ||= {})[key];
  if (memo && Date.now() - memo.at < KEEP_MS) return memo.rows;
  const sql = "SELECT event, id, details FROM mextra WHERE details IS NOT NULL AND details <> 'null'" + (event ? " AND event = ?" : "");
  const rows = (event ? db.prepare(sql).all(event) : db.prepare(sql).all()).map((r) => {
    try { return { event: r.event, id: r.id, details: JSON.parse(r.details) }; } catch { return null; }
  }).filter((r) => r && r.details && (r.details.all || []).length);
  globalThis.__tstats[key] = { at: Date.now(), rows };
  return rows;
}

/** The events that have tables. */
export const eventsWithDetails = (db) => db.prepare("SELECT DISTINCT event FROM mextra WHERE details IS NOT NULL AND details <> 'null'").all().map((r) => r.event);

/** One match's table, for its window. */
export function detailsOf(db, event, id) {
  const r = db.prepare("SELECT details FROM mextra WHERE event = ? AND id = ?").get(event, id);
  try { return r ? JSON.parse(r.details) : null; } catch { return null; }
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Everything at once: { players: [...], teams: { slug: {...} }, maps: [...], byPlayer: { slug: [matches] } }.
 * Averages are per map played; K/D from the totals.
 */
export function tournamentStats(state, entries) {
  // the same tables give the same numbers: kept as long as the tables are
  const memo = (globalThis.__tstatsOut ||= new WeakMap()).get(entries);
  if (memo && memo.state === state) return memo.out;
  const out = computeStats(state, entries);
  globalThis.__tstatsOut.set(entries, { state, out });
  return out;
}

function computeStats(state, entries) {
  const matchOf = {};
  for (const event of [...new Set(entries.map((e) => e.event))]) {
    for (const m of matchesOf(event, eventData(state, event))) matchOf[`${event}:${m.id}`] = m;
  }
  const players = new Map();
  const teams = new Map();
  const maps = new Map();
  const byPlayer = {};
  const avg = (o, k, v) => { if (v != null) { o[`${k}Sum`] = (o[`${k}Sum`] || 0) + v; o[`${k}N`] = (o[`${k}N`] || 0) + 1; } };
  for (const { event, id, details } of entries) {
    const m = matchOf[`${event}:${id}`];
    if (!m || !m.a || !m.b) continue;
    const team = { a: m.a.name, b: m.b.name };
    const won = m.win;
    for (const mp of details.maps || []) {
      const mm = maps.get(mp.map) || { map: mp.map, played: 0, diffSum: 0, closest: null, overtime: 0, atk: 0, def: 0 };
      if (Array.isArray(mp.t) && Array.isArray(mp.ct)) { mm.atk += mp.t[0] + mp.t[1]; mm.def += mp.ct[0] + mp.ct[1]; }
      mm.played += 1;
      mm.diffSum += Math.abs(mp.a - mp.b);
      if (mp.a + mp.b > 24) mm.overtime += 1;
      if (!mm.closest || Math.abs(mp.a - mp.b) < Math.abs(mm.closest.a - mm.closest.b)) mm.closest = { a: mp.a, b: mp.b, ta: team.a, tb: team.b, event, id };
      maps.set(mp.map, mm);
      for (const side of ["a", "b"]) {
        const key = teamSlug(team[side]);
        const t = teams.get(key) || { name: team[side], maps: 0, mapsWon: 0, roundsW: 0, roundsL: 0, byMap: {} };
        const mine = side === "a" ? mp.a : mp.b;
        const theirs = side === "a" ? mp.b : mp.a;
        t.maps += 1;
        t.roundsW += mine;
        t.roundsL += theirs;
        if (mine > theirs) t.mapsWon += 1;
        const bm = t.byMap[mp.map] || { played: 0, won: 0 };
        bm.played += 1;
        if (mine > theirs) bm.won += 1;
        t.byMap[mp.map] = bm;
        teams.set(key, t);
      }
      for (const r of mp.rows || []) {
        if (!r.side) continue;
        const key = teamSlug(r.name);
        const p = players.get(key) || { name: r.name, cc: r.cc || "", team: "", maps: 0, k: 0, d: 0, a: 0, fk: 0, fd: 0, agents: {} };
        p.team = team[r.side];
        p.cc = p.cc || r.cc || "";
        p.maps += 1;
        for (const k of ["k", "d", "a", "fk", "fd"]) p[k] += r[k] || 0;
        for (const k of ["r", "acs", "kast", "adr", "hs"]) avg(p, k, r[k]);
        for (const ag of r.agents || []) p.agents[ag] = (p.agents[ag] || 0) + 1;
        players.set(key, p);
      }
    }
    for (const r of details.all || []) {
      if (!r.side) continue;
      const key = teamSlug(r.name);
      (byPlayer[key] ||= []).push({
        event, id, round: m.round, team: team[r.side], opponent: r.side === "a" ? team.b : team.a, won: won === r.side,
        score: r.side === "a" ? [m.sa, m.sb] : [m.sb, m.sa], r: r.r, acs: r.acs, k: r.k, d: r.d, a: r.a, kast: r.kast, adr: r.adr, hs: r.hs, agents: r.agents || [],
      });
    }
  }
  const mean = (p, k, f = round1) => (p[`${k}N`] ? f(p[`${k}Sum`] / p[`${k}N`]) : null);
  const playerList = [...players.entries()].map(([slug, p]) => ({
    slug, name: p.name, cc: p.cc, team: p.team, maps: p.maps, r: mean(p, "r", round2), acs: mean(p, "acs", Math.round), kd: p.d ? round2(p.k / p.d) : p.k,
    kast: mean(p, "kast", Math.round), adr: mean(p, "adr", Math.round), hs: mean(p, "hs", Math.round), k: p.k, d: p.d, a: p.a, fk: p.fk, fd: p.fd,
    agents: Object.entries(p.agents).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([name, n]) => ({ name, n })),
  }));
  const teamOut = {};
  for (const [slug, t] of teams) {
    const best = playerList.filter((p) => teamSlug(p.team) === slug && p.maps >= 2).sort((x, y) => (y.r || 0) - (x.r || 0)).slice(0, 3);
    teamOut[slug] = { ...t, byMap: Object.entries(t.byMap).map(([map, v]) => ({ map, ...v })).sort((x, y) => y.played - x.played || x.map.localeCompare(y.map)), best };
  }
  const mapList = [...maps.values()].map((m) => ({ map: m.map, played: m.played, diff: round1(m.diffSum / m.played), overtime: m.overtime, closest: m.closest, attack: m.atk + m.def ? Math.round((m.atk / (m.atk + m.def)) * 100) : null })).sort((x, y) => y.played - x.played);
  return { players: playerList, teams: teamOut, maps: mapList, byPlayer };
}

/** A tournament's numbers for one player: { maps, r, acs, kd, kast, adr, hs, agents, matches } or null. */
export function playerTournament(stats, slug) {
  const p = stats.players.find((x) => x.slug === slug);
  if (!p) return null;
  return { ...p, matches: (stats.byPlayer[slug] || []).slice().reverse() };
}

/**
 * One map across a tournament (or all): { map, played, diff, overtime, attack (share of rounds won on attack, or null), teams, players, closest }.
 * teams: those with 2 maps there at least, best win rate first; players: 2 maps there at least, best rating first.
 */
export function mapCard(state, entries, map) {
  const want = String(map || "").toLowerCase();
  const stats = tournamentStats(state, entries);
  const m = stats.maps.find((x) => x.map.toLowerCase() === want);
  if (!m) return null;
  let atk = 0;
  let def = 0;
  const players = new Map();
  for (const { details } of entries) {
    for (const mp of details.maps || []) {
      if (String(mp.map).toLowerCase() !== want) continue;
      if (Array.isArray(mp.t) && Array.isArray(mp.ct)) { atk += mp.t[0] + mp.t[1]; def += mp.ct[0] + mp.ct[1]; }
      for (const r of mp.rows || []) {
        if (!r.side) continue;
        const key = teamSlug(r.name);
        const p = players.get(key) || { slug: key, name: r.name, cc: r.cc || "", maps: 0, rSum: 0, rN: 0, acsSum: 0, acsN: 0, k: 0, d: 0 };
        p.maps += 1;
        if (r.r != null) { p.rSum += r.r; p.rN += 1; }
        if (r.acs != null) { p.acsSum += r.acs; p.acsN += 1; }
        p.k += r.k || 0;
        p.d += r.d || 0;
        players.set(key, p);
      }
    }
  }
  const teams = Object.entries(stats.teams).map(([slug, t]) => {
    const b = t.byMap.find((x) => x.map.toLowerCase() === want);
    return b ? { slug, name: t.name, played: b.played, won: b.won } : null;
  }).filter((t) => t && t.played >= 2).sort((x, y) => y.won / y.played - x.won / x.played || y.played - x.played).slice(0, 10);
  const best = [...players.values()].filter((p) => p.maps >= 2).map((p) => ({
    slug: p.slug, name: p.name, cc: p.cc, maps: p.maps, r: p.rN ? round2(p.rSum / p.rN) : null, acs: p.acsN ? Math.round(p.acsSum / p.acsN) : null, kd: p.d ? round2(p.k / p.d) : p.k,
  })).sort((x, y) => (y.r || 0) - (x.r || 0)).slice(0, 10);
  return { ...m, attack: atk + def ? Math.round((atk / (atk + def)) * 100) : null, sided: atk + def, teams, players: best };
}
