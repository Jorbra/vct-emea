// What an agent's page shows, from vlr.gg's tables of the site's events and the agents' pictures. Server only.
import RAW from "./valorant-assets.json" with { type: "json" };
import LOCAL from "./valorant-local.json" with { type: "json" };
import { abilitiesWithLocal, withLocal } from "./assetmerge.js";

const ASSETS = withLocal(RAW, LOCAL);
import ABILITIES from "./valorant-abilities.json" with { type: "json" };
import { getDb, getState } from "./db.js";
import { agentMapTable } from "./round10.js";
import { extraStats, readDetails, tournamentStats } from "./tstats.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** Every agent played: [{ key, name, role, color, portrait, icon, picks, pct, share }], most picked first. */
export function agentsOverview(db = getDb()) {
  const entries = readDetails(db, "");
  const list = extraStats(getState(db), entries).agents;
  const maps = agentMapTable(entries).maps.reduce((s, m) => s + m.games, 0) || 1;
  return list.map((a) => {
    const k = norm(a.agent);
    const info = ASSETS.agents[k] || {};
    return { key: k, name: info.name || a.name, role: info.role || "", color: info.color || "", portrait: info.portrait || "", pose: info.pose || "", icon: info.icon || "", picks: a.picks, pct: a.pct, share: Math.round((a.picks / maps) * 100) };
  });
}

/** The teams that play an agent the most: [{ slug, name, played, won }], 5 at most. */
function teamsOn(db, entries, k) {
  const state = getState(db);
  const comps = extraStats(state, entries).teamComps;
  const teams = tournamentStats(state, entries).teams;
  return Object.entries(comps).map(([slug, list]) => {
    const mine = list.filter((c) => c.agents.some((x) => norm(x) === k));
    return { slug, name: (teams[slug] || {}).name || slug, played: mine.reduce((s, c) => s + c.played, 0), won: mine.reduce((s, c) => s + c.won, 0) };
  }).filter((t) => t.played > 0).sort((x, y) => y.played - x.played || y.won - x.won).slice(0, 5);
}

/** One agent's page: null when it was never played on the site's events. */
export function agentPage(name, db = getDb()) {
  const k = norm(name);
  const entries = readDetails(db, "");
  const a = extraStats(getState(db), entries).agents.find((x) => norm(x.agent) === k);
  const info = ASSETS.agents[k];
  if (!a && !info) return null;
  const t = agentMapTable(entries);
  const col = t.keys.find((x) => norm(x) === k);
  const maps = col ? t.maps.map((m) => ({ map: m.map, games: m.games, pct: t.cells[`${m.map}|${col}`] || 0 })).filter((m) => m.pct > 0).sort((x, y) => y.pct - x.pct) : [];
  const total = t.maps.reduce((s, m) => s + m.games, 0) || 1;
  return {
    key: k, name: (info && info.name) || (a && a.name) || name, role: (info && info.role) || "", color: (info && info.color) || "", portrait: (info && info.portrait) || "", pose: (info && info.pose) || "", icon: (info && info.icon) || "",
    picks: a ? a.picks : 0, wins: a ? a.wins : 0, pct: a ? a.pct : 0, share: a ? Math.round((a.picks / total) * 100) : 0, best: a ? a.best : [], maps,
    teams: teamsOn(db, entries, k),
    abilities: abilitiesWithLocal(ABILITIES.agents[k], LOCAL.abilities && LOCAL.abilities[k]),
    rank: a ? extraStats(getState(db), entries).agents.findIndex((x) => norm(x.agent) === k) + 1 : 0,
  };
}
