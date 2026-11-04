// Copies the site's data from your computer to Turso, once: the database, the information files and the logos.
// Run: node scripts/turso-import.mjs ../vct-kickoff     It replaces what Turso holds, so it refuses to run twice without --again.
import Database from "libsql";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTursoEnv } from "./env-turso.mjs";

loadTursoEnv();
const { SCHEMA_REV, getDb } = await import("../lib/db.js");
const source = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || "");
const dataDir = path.join(source, "data");
if (!fs.existsSync(path.join(dataDir, "kickoff.db"))) throw new Error(`No data/kickoff.db in ${source}`);

const started = Date.now();
const db = getDb();
db.sync();
if (db.prepare("SELECT value FROM kv WHERE key = 'imported'").get() && !process.argv.includes("--again")) {
  console.log("Turso already holds imported data: nothing done. Add --again to replace it.");
  process.exit(0);
}

const MAX_BYTES = 150000;
const MAX_ROWS = 100;
const pause = new Int32Array(new SharedArrayBuffer(4));
/** A connection can drop during a long copy: tries a statement again before giving up. */
function withRetries(fn) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return fn();
    } catch (e) {
      if (attempt === 4) throw e;
      console.log(`  retrying (${e.message.slice(0, 60)})`);
      Atomics.wait(pause, 0, 0, attempt * 3000);
    }
  }
}
/** Sends rows in groups: each statement is one trip to Turso. */
function insertAll(table, columns, rows, verb = "INSERT OR REPLACE") {
  const one = `(${columns.map(() => "?").join(",")})`;
  let group = [];
  let bytes = 0;
  let trips = 0;
  const flush = () => {
    if (!group.length) return;
    const params = group.flat();
    const sql = `${verb} INTO ${table} (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${group.map(() => one).join(",")}`;
    withRetries(() => db.prepare(sql).run(...params));
    trips += 1;
    group = [];
    bytes = 0;
  };
  for (const row of rows) {
    const size = row.reduce((n, v) => n + (v == null ? 0 : v.length || 8), 0);
    if (group.length && (bytes + size > MAX_BYTES || group.length >= MAX_ROWS)) flush();
    group.push(row);
    bytes += size;
  }
  flush();
  return trips;
}

// the database, from a consistent copy; the undo steps start afresh
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "import-"));
const snapshot = path.join(tmp, "snapshot.db").replace(/\\/g, "/");
const live = new Database(path.join(dataDir, "kickoff.db"));
live.exec(`VACUUM INTO '${snapshot}'`);
live.close();
const old = new Database(snapshot);
const SKIP = new Set(["undolog", "undosteps", "undostate", "lp_items", "lp_blobs", "lp_logos", "lp_requests"]);
const tables = old.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name).filter((t) => !SKIP.has(t));
const exists = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
db.exec("UPDATE undostate SET off = 1");
for (const table of tables) {
  if (!exists.has(table)) {
    console.log(`${table}: not in the new database, skipped`);
    continue;
  }
  const cols = old.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const rows = old.prepare(`SELECT * FROM ${table}`).all().map((r) => cols.map((c) => r[c]));
  db.exec(`DELETE FROM ${table}`);
  const trips = insertAll(table, cols, rows);
  console.log(`${table}: ${rows.length} rows, ${trips} trips`);
}
old.close();

// the information files, one row per entry
const readJson = (name) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
  } catch {
    return {};
  }
};
const at = new Date().toISOString();
const items = [];
const addAll = (kind, map) => { for (const [k, v] of Object.entries(map || {})) items.push([kind, k, JSON.stringify(v), at]); };
addAll("team", readJson("team-info.json"));
addAll("player", readJson("player-info.json"));
addAll("tournament", readJson("tournament-info.json"));
const vlr = readJson("vlr-info.json");
addAll("vlr_player", vlr.players);
addAll("vlr_team", vlr.teams);
if (vlr.blockedUntil) items.push(["meta", "vlr", JSON.stringify({ blockedUntil: vlr.blockedUntil }), at]);
const found = readJson("search-found.json");
addAll("found_people", found.people);
addAll("found_teams", found.teams);
addAll("found_tournaments", found.tournaments);
db.exec("DELETE FROM lp_items");
console.log(`information: ${items.length} entries, ${insertAll("lp_items", ["kind", "key", "json", "at"], items)} trips`);

// logos: those added to the site, and the copies of Liquipedia's (named by their hash)
const filesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()) : []);
const logos = filesIn(path.join(source, "public", "logos")).map((f) => [f, fs.readFileSync(path.join(source, "public", "logos", f))]);
db.exec("DELETE FROM lp_logos");
console.log(`logos: ${logos.length}, ${insertAll("lp_logos", ["file", "data"], logos)} trips`);
const cached = filesIn(path.join(dataDir, "lp-logos")).map((f) => {
  const m = f.match(/^(.+)\.([a-z]+)$/);
  return [m[1], fs.readFileSync(path.join(dataDir, "lp-logos", f)), m[2]];
});
console.log(`Liquipedia logos: ${cached.length}, ${insertAll("lp_blobs", ["key", "data", "ext"], cached)} trips`);

db.exec("UPDATE undostate SET off = 0");
db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('imported', ?)").run(JSON.stringify(at));
db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('schema_rev', ?)").run(JSON.stringify(SCHEMA_REV)); // the copy above replaced this table's rows
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows may still hold the file: it is only a temporary copy */ }
console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s.`);
process.exit(0);
