// What the maps' pages show, from vlr.gg's tables of the site's events and the maps' pictures. Server only.
import ASSETS from "./valorant-assets.json" with { type: "json" };
import { getDb, getState } from "./db.js";
import { agentMapTable } from "./round10.js";
import { readDetails, tournamentStats } from "./tstats.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** The agents most picked on a map: [{ name, pct }], 3 at most. */
export function topAgents(entries, map) {
  const t = agentMapTable(entries);
  const m = t.maps.find((x) => norm(x.map) === norm(map));
  if (!m) return [];
  return t.keys.map((k) => ({ name: k, pct: t.cells[`${m.map}|${k}`] || 0 })).filter((a) => a.pct > 0).sort((x, y) => y.pct - x.pct).slice(0, 3);
}

/** Every competitive map (the ones with a layout): played ones first, most played first. */
export function mapsOverview(db = getDb()) {
  const entries = readDetails(db, "");
  const stats = tournamentStats(getState(db), entries).maps;
  return Object.entries(ASSETS.maps).filter(([, v]) => v.icon).map(([name, v]) => {
    const m = stats.find((x) => norm(x.map) === norm(name));
    return { key: norm(name), name, splash: v.splash, list: v.list, icon: v.icon, played: m ? m.played : 0, diff: m ? m.diff : null, agents: topAgents(entries, name) };
  }).sort((x, y) => y.played - x.played || x.name.localeCompare(y.name));
}
