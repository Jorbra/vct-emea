// The editor's "update everything from Liquipedia" button: every team of the site's main events (EU playoffs, Kickoff,
// regional playoffs) and their players are asked to be read again, the teams first. The background task reads them one by one
// (one Liquipedia page a minute, by their API terms); the rosters that differ can then be followed in one go.
import { parseRoster } from "./tournament.js";
import { teamSlug } from "./paths.js";

const TABLES = ["teams", "kteams", "rteams"];

/** The teams of the main events (not the open qualifiers' hundreds) and their players: [{ name, players: [{ name, cc }] }]. */
export function refreshList(db) {
  const byName = new Map();
  for (const t of TABLES) {
    for (const r of db.prepare(`SELECT name, roster FROM ${t}`).all()) {
      const name = String(r.name || "").trim();
      if (name.length < 2 || byName.has(name.toLowerCase())) continue;
      byName.set(name.toLowerCase(), { name, players: parseRoster(r.roster).map(({ name: p, cc }) => ({ name: p, cc })) });
    }
  }
  return [...byName.values()];
}

/**
 * Asks for every team and player to be read again: the teams before anything else waiting, the players after them.
 * Returns { teams, players, waiting } (waiting: every page in the list now).
 */
export function queueRefresh(db) {
  const list = refreshList(db);
  // the same request as a visitor opening the page, read first (lib/teamfetch.js requestFetch)
  const ask = (id, payload, first) => {
    const old = db.prepare("SELECT first FROM lp_requests WHERE id = ?").get(id);
    if (old && (!first || old.first)) return;
    db.prepare("INSERT OR REPLACE INTO lp_requests (id, payload, first, at) VALUES (?, ?, ?, ?)").run(id, JSON.stringify(payload), first ? 1 : 0, new Date().toISOString());
  };
  let players = 0;
  db.transaction(() => {
    for (const t of list) ask(`lp:team:${teamSlug(t.name)}`, { kind: "team", name: t.name }, true);
    for (const t of list) for (const p of t.players) { ask(`lp:person:${teamSlug(p.name)}`, { kind: "person", name: p.name, cc: p.cc, team: t.name }, false); players += 1; }
  })();
  const waiting = db.prepare("SELECT count(*) AS n FROM lp_requests WHERE id LIKE 'lp:%'").get().n;
  return { teams: list.length, players, waiting };
}
