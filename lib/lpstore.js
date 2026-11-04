// What used to be files: the information read from Liquipedia and vlr.gg, logos, and the list of pages to read next, in the database,
// because a Vercel server has no lasting disk. One row per team, person or tournament: reading one never rewrites the others.
import { getDb } from "./db.js";

/** Everything saved of a kind: { key: entry }. Read from the local copy, so it costs Turso nothing. */
export function readItems(kind, db = getDb()) {
  const out = {};
  for (const r of db.prepare("SELECT key, json FROM lp_items WHERE kind = ?").all(kind)) out[r.key] = JSON.parse(r.json);
  return out;
}

export function saveItem(kind, key, entry, db = getDb()) {
  db.prepare("INSERT OR REPLACE INTO lp_items (kind, key, json, at) VALUES (?, ?, ?, ?)").run(kind, key, JSON.stringify(entry), new Date().toISOString());
}

/** Changes whenever something was saved: tells when what was read can be kept. */
export function itemsStamp(db = getDb()) {
  const r = db.prepare("SELECT count(*) AS n, max(at) AS at FROM lp_items").get();
  return `${r.n}|${r.at}`;
}

/** Whether saved information names this logo path: only those may be downloaded on a visitor's behalf. */
export const itemsMention = (text, db = getDb()) => !!db.prepare("SELECT 1 FROM lp_items WHERE instr(json, ?) > 0 LIMIT 1").get(JSON.stringify(text));

/** A page to read soon. first: before the others. Looked up locally first, so a page refreshing does not write again. */
export function askToRead(id, payload, first = false, max = 300, db = getDb()) {
  const old = db.prepare("SELECT first FROM lp_requests WHERE id = ?").get(id);
  if (old && (!first || old.first)) return;
  if (!old && db.prepare("SELECT count(*) AS n FROM lp_requests").get().n >= max) return;
  db.prepare("INSERT OR REPLACE INTO lp_requests (id, payload, first, at) VALUES (?, ?, ?, ?)").run(id, JSON.stringify(payload), first ? 1 : 0, new Date().toISOString());
}

/** The next page asked for whose id starts with prefix, taken off the list. */
export function takeRequest(prefix, db = getDb()) {
  const r = db.prepare("SELECT id, payload FROM lp_requests WHERE id LIKE ? ORDER BY first DESC, at ASC LIMIT 1").get(`${prefix}%`);
  if (!r) return null;
  db.prepare("DELETE FROM lp_requests WHERE id = ?").run(r.id);
  return { ...JSON.parse(r.payload), id: r.id };
}

export function readBlob(key, db = getDb()) {
  const r = db.prepare("SELECT data, ext FROM lp_blobs WHERE key = ?").get(key);
  return r ? { buf: Buffer.from(r.data), ext: r.ext } : null;
}

export function saveBlob(key, buf, ext, db = getDb()) {
  db.prepare("INSERT OR REPLACE INTO lp_blobs (key, data, ext) VALUES (?, ?, ?)").run(key, buf, ext);
}

/** Whether a page was asked for and waits to be read. Local: costs Turso nothing. */
export const hasRequests = (db = getDb()) => !!db.prepare("SELECT 1 FROM lp_requests LIMIT 1").get();

const TURN = 30000;

/**
 * Whether this server may read now: a site allows one page every 30 seconds, whoever reads (a server of the site or the GitHub round).
 * The turn is taken in one write, so two servers asking at once cannot both get it.
 */
export function takeTurn(site, now = Date.now(), db = getDb()) {
  // kept apart from the editors' data: the undo button must not see the reader's comings and goings
  const last = db.prepare("SELECT json FROM lp_items WHERE kind = 'turn' AND key = ?").get(site);
  if (last && now - Number(last.json) < TURN) return false; // no need to ask Turso
  if (!last) db.prepare("INSERT OR IGNORE INTO lp_items (kind, key, json, at) VALUES ('turn', ?, '0', '')").run(site);
  const taken = db.prepare("UPDATE lp_items SET json = ? WHERE kind = 'turn' AND key = ? AND CAST(json AS INTEGER) <= ?").run(String(now), site, now - TURN);
  return taken.changes === 1;
}

/** Sends the database's latest state to this server's copy. */
export function syncNow(db = getDb()) {
  if (typeof db.sync === "function" && process.env.TURSO_DATABASE_URL) db.sync();
}
