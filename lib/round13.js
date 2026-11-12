// Round 13: agents' tier list by map, a player's rating map by map, the map veto read from vlr.gg, the home page's spotlight.
// Pure functions first (tests), the server's reads at the end.
import { teamSlug } from "./paths.js";
import ASSETS from "./valorant-assets.json" with { type: "json" };

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * The agents on one map ranked in tiers from vlr.gg's tables: [{ tier: "S"|"A"|"B"|"C", agents: [{ name, games, pick, win }] }].
 * pick: % of the teams that took it there; win: % of those maps won. 2 games at least.
 */
export function agentTiers(entries, map) {
  const want = norm(map);
  let teams = 0;
  const by = {};
  for (const { details } of entries) {
    for (const mp of (details && details.maps) || []) {
      if (norm(mp.map) !== want || mp.a == null || mp.b == null) continue;
      for (const side of ["a", "b"]) {
        const set = new Set();
        for (const r of mp.rows || []) if (r.side === side) for (const a of r.agents || []) set.add(norm(a));
        if (!set.size) continue;
        teams += 1;
        const won = side === "a" ? mp.a > mp.b : mp.b > mp.a;
        for (const a of set) { const x = (by[a] ||= { name: a, games: 0, won: 0 }); x.games += 1; if (won) x.won += 1; }
      }
    }
  }
  if (!teams) return [];
  const list = Object.values(by).filter((x) => x.games >= 2).map((x) => ({ name: x.name, games: x.games, pick: Math.round((x.games / teams) * 100), win: Math.round((x.won / x.games) * 100) }))
    // mostly how often it is taken, a little how often it wins
    .map((x) => ({ ...x, score: x.pick + (x.win - 50) * 0.4 })).sort((x, y) => y.score - x.score || y.games - x.games);
  const cut = (s) => (s >= 45 ? "S" : s >= 25 ? "A" : s >= 10 ? "B" : "C");
  return ["S", "A", "B", "C"].map((tier) => ({ tier, agents: list.filter((x) => cut(x.score) === tier).map(({ score, ...x }) => x) })).filter((t) => t.agents.length);
}

/** One player's numbers map by map: [{ map, n, r, acs, won }], most played first. */
export function ratingByMap(entries, slug) {
  const by = {};
  for (const { details } of entries) {
    for (const mp of (details && details.maps) || []) {
      if (!mp.map) continue;
      for (const r of mp.rows || []) {
        if (teamSlug(r.name) !== slug || !r.side) continue;
        const x = (by[mp.map] ||= { map: mp.map, n: 0, rS: 0, rN: 0, acsS: 0, acsN: 0, won: 0 });
        x.n += 1;
        if (r.r != null) { x.rS += r.r; x.rN += 1; }
        if (r.acs != null) { x.acsS += r.acs; x.acsN += 1; }
        if (mp.a != null && mp.b != null && (r.side === "a" ? mp.a > mp.b : mp.b > mp.a)) x.won += 1;
      }
    }
  }
  return Object.values(by).map((x) => ({ map: x.map, n: x.n, r: x.rN ? round2(x.rS / x.rN) : null, acs: x.acsN ? Math.round(x.acsS / x.acsN) : null, won: x.won }))
    .sort((x, y) => y.n - x.n || x.map.localeCompare(y.map));
}

/**
 * The map veto from a vlr.gg match page's header note ("FNC ban Lotus; TH ban Split; FNC pick Haven; TH pick Bind; Ascent remains"):
 * [{ who, act: "ban"|"pick"|"left", map }], [] when the page has none.
 */
export function parseVeto(html) {
  const note = (/class="match-header-note"[^>]*>([\s\S]*?)<\/div>/.exec(String(html || "")) || [])[1] || "";
  const text = note.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (!/\b(ban|pick|remains)\b/i.test(text)) return [];
  return text.split(";").map((s) => s.trim()).map((s) => {
    let m = /^(.+?)\s+(ban|pick)\s+(.+)$/i.exec(s);
    if (m) return { who: m[1].slice(0, 30), act: m[2].toLowerCase(), map: m[3].slice(0, 30) };
    m = /^(.+?)\s+remains$/i.exec(s);
    return m ? { who: "", act: "left", map: m[1].slice(0, 30) } : null;
  }).filter(Boolean).slice(0, 9);
}

/** Two agents side by side: { a, b, maps: [{ map, a, b }] } from their pages, the maps either is played on. */
export function agentDuel(pa, pb) {
  if (!pa || !pb) return null;
  const names = [...new Set([...pa.maps, ...pb.maps].map((m) => m.map))];
  const pct = (p, map) => (p.maps.find((m) => m.map === map) || { pct: 0 }).pct;
  const maps = names.map((map) => ({ map, a: pct(pa, map), b: pct(pb, map) })).sort((x, y) => (y.a + y.b) - (x.a + x.b));
  return { a: pa, b: pb, maps };
}

// ---- server reads

/** What the home page puts in its spotlight: the agent and the map of the moment, the agent that wins the most. */
export async function homeSpotlight() {
  const { agentsOverview } = await import("./agentpage.js");
  const { mapsOverview } = await import("./mappage.js");
  const agents = agentsOverview();
  const maps = mapsOverview().filter((m) => m.played);
  const out = [];
  if (agents[0]) out.push({ kind: "agent", title: "Agent of the moment", name: agents[0].name, href: `/agent/${agents[0].key}`, img: agents[0].portrait, color: agents[0].color, line: { n: agents[0].share, k: "taken by {n}% of the teams" } });
  if (maps[0]) out.push({ kind: "map", title: "Map of the moment", name: maps[0].name, href: `/map/${maps[0].key}`, img: maps[0].splash, color: "", line: { n: maps[0].played, k: "{n} maps played" } });
  // the player of the moment: the best rating with 6 maps at least, their main agent behind
  const { getDb, getState } = await import("./db.js");
  const { readDetails, tournamentStats } = await import("./tstats.js");
  const db = getDb();
  const star = tournamentStats(getState(db), readDetails(db, "")).players.filter((p) => p.maps >= 6 && p.r != null).sort((x, y) => y.r - x.r)[0];
  const starAgent = star && star.agents[0] ? ASSETS.agents[norm(star.agents[0].name)] : null;
  const winner = agents.filter((a) => a.picks >= 10).sort((x, y) => y.pct - x.pct)[0];
  if (winner && (!agents[0] || winner.key !== agents[0].key)) out.push({ kind: "agent", title: "The agent that wins", name: winner.name, href: `/agent/${winner.key}`, img: winner.portrait, color: winner.color, line: { n: winner.pct, k: "{n}% of its maps won" } });
  if (star && starAgent) out.push({ kind: "agent", title: "Player of the moment", name: star.name, href: `/player/${star.slug}`, img: starAgent.portrait, color: starAgent.color, line: { n: star.r.toFixed(2), k: "{n} rating on the season" } });
  return out;
}
