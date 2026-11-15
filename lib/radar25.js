// Round 25: the teams' radar (where a team stands among the others), and the players with the closest profile.
import { RADAR_STATS } from "./radar24.js";

const round2 = (v) => Math.round(v * 100) / 100;

/** One row per team with 3 maps at least: maps won %, rounds won %, its players' rating and ACS (by maps), first kills per map. */
export function teamRows(stats, min = 3) {
  const byTeam = {};
  for (const p of stats.players || []) {
    if (!p.team || !p.maps) continue;
    const t = (byTeam[p.team.toLowerCase()] ||= { rS: 0, rN: 0, aS: 0, aN: 0, fk: 0 });
    if (p.r != null) { t.rS += p.r * p.maps; t.rN += p.maps; }
    if (p.acs != null) { t.aS += p.acs * p.maps; t.aN += p.maps; }
    t.fk += p.fk || 0;
  }
  return Object.entries(stats.teams || {}).filter(([, t]) => (t.maps || 0) >= min).map(([slug, t]) => {
    const pl = byTeam[String(t.name || "").toLowerCase()] || { rS: 0, rN: 0, aS: 0, aN: 0, fk: 0 };
    const rounds = (t.roundsW || 0) + (t.roundsL || 0);
    return {
      slug, name: t.name, maps: t.maps,
      win: Math.round(((t.mapsWon || 0) / t.maps) * 100),
      rounds: rounds ? Math.round(((t.roundsW || 0) / rounds) * 100) : null,
      r: pl.rN ? round2(pl.rS / pl.rN) : null,
      acs: pl.aN ? Math.round(pl.aS / pl.aN) : null,
      fk: t.maps ? round2(pl.fk / t.maps) : null,
    };
  });
}

export const TEAM_AXES = [["win", "Maps %"], ["rounds", "Rounds %"], ["r", "Rating"], ["acs", "ACS"], ["fk", "FK/map"]];

/** A team's percentile on each axis among the teams with 3 maps: [{ key, label, value, pct }], [] when unknown or too few maps. */
export function teamPercentiles(stats, name, min = 3) {
  const rows = teamRows(stats, min);
  const want = String(name || "").toLowerCase();
  const me = rows.find((t) => String(t.name || "").toLowerCase() === want || t.slug === want);
  if (!me || rows.length < 3) return [];
  return TEAM_AXES.map(([key, label]) => {
    if (me[key] == null) return null;
    const vals = rows.map((t) => t[key]).filter((v) => v != null);
    const below = vals.filter((v) => v < me[key]).length;
    return { key, label, value: key === "win" || key === "rounds" ? `${me[key]}%` : me[key], pct: Math.round((below / Math.max(1, vals.length - 1)) * 100) };
  }).filter(Boolean);
}

/** A team found by name for the bot: { name, slug, maps, list } or null. */
export function teamRadarFor(stats, query) {
  const q = String(query || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!q) return null;
  const rows = teamRows(stats);
  const plain = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = rows.find((x) => plain(x.name) === q || x.slug.replace(/-/g, "") === q) || rows.filter((x) => plain(x.name).startsWith(q)).sort((a, b) => b.maps - a.maps)[0];
  return t ? { name: t.name, slug: t.slug, maps: t.maps, list: teamPercentiles(stats, t.name) } : null;
}

/**
 * The players whose profile (percentile on each radar stat) is the closest to this one's, 3 maps at least:
 * [{ slug, name, team, r, acs, maps, agent, match }] (match: 0–100, how close), the nearest first.
 */
export function similarPlayers(players, me, n = 4, min = 3) {
  if (!me || (me.maps || 0) < min) return [];
  const pool = (players || []).filter((p) => (p.maps || 0) >= min);
  // each stat's sorted values, to read a percentile quickly
  const cols = RADAR_STATS.map(([, , read]) => pool.map(read).filter((v) => v != null).sort((a, b) => a - b));
  const pctOf = (i, v) => {
    const arr = cols[i];
    if (v == null || arr.length < 2) return null;
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
    return (lo / (arr.length - 1)) * 100;
  };
  const vec = (p) => RADAR_STATS.map(([, , read], i) => pctOf(i, read(p)));
  const mine = vec(me);
  const out = [];
  for (const p of pool) {
    if (p.slug === me.slug) continue;
    const v = vec(p);
    let s = 0, k = 0;
    for (let i = 0; i < v.length; i++) if (v[i] != null && mine[i] != null) { s += (v[i] - mine[i]) ** 2; k++; }
    if (k < 4) continue;
    const dist = Math.sqrt(s / k); // 0 (same) … 100
    out.push({ slug: p.slug, name: p.name, team: p.team || "", r: p.r, acs: p.acs, maps: p.maps, agent: p.agents && p.agents[0] ? p.agents[0].name : "", match: Math.max(0, Math.round(100 - dist)) });
  }
  return out.sort((a, b) => b.match - a.match || (b.maps || 0) - (a.maps || 0)).slice(0, n);
}
