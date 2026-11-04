// Season archives: a season is frozen as a copy of everything the site shows, to stay readable once the next one starts.
import { getState } from "./db.js";

export function fillSeasons(db) {
  db.exec("CREATE TABLE IF NOT EXISTS seasons (slug TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL, created TEXT NOT NULL)");
}

const slugOf = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Same contract as the other actions. */
export function archiveSeason(db, { name }) {
  const n = String(name ?? "").trim();
  const slug = slugOf(n);
  if (!slug || n.length > 40) return { ok: false, status: 400, error: "Give the season a name (40 characters at most)." };
  if (db.prepare("SELECT 1 FROM seasons WHERE slug = ?").get(slug)) return { ok: false, status: 409, error: "A season already has this name." };
  db.prepare("INSERT INTO seasons (slug, name, state, created) VALUES (?, ?, ?, ?)").run(slug, n, JSON.stringify(getState(db)), new Date().toISOString());
  return { ok: true, message: "Season archived." };
}

export const listSeasons = (db) => db.prepare("SELECT slug, name, created FROM seasons ORDER BY created DESC").all();

/** A season's frozen state with its name: { name, state }, or null. */
export function getSeason(db, slug) {
  const row = db.prepare("SELECT name, state FROM seasons WHERE slug = ?").get(String(slug || ""));
  return row ? { name: row.name, state: JSON.parse(row.state) } : null;
}

export function removeSeason(db, { slug }) {
  const r = db.prepare("DELETE FROM seasons WHERE slug = ?").run(String(slug || ""));
  return r.changes ? { ok: true, message: "Archive removed." } : { ok: false, status: 404, error: "Unknown season." };
}

/** Starts a new season: every result, draw, time and live flag goes; teams and rosters stay. Can be undone like any change. */
export function clearResults(db) {
  db.transaction(() => {
    for (const t of ["matches", "qscores", "kmatches", "rmatches", "mtimes", "mlive", "mextra"]) db.prepare(`DELETE FROM ${t}`).run();
  })();
  return { ok: true, message: "All results cleared." };
}
