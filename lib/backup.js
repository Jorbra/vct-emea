// A copy of the database once a day in data/backups (the last 14 are kept), made safely while the site runs.
import fs from "node:fs";
import Database from "libsql";
import path from "node:path";

const KEEP = 14;
const NAME = /^kickoff-\d{4}-\d{2}-\d{2}\.db$/;

/** A value read from a database, as a local one takes it: Turso gives images as an ArrayBuffer. */
export function bindable(v) {
  if (v === undefined) return null;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  return v;
}

/** A whole copy of a database in a new local file, read table by table: Turso can only be read over the network. */
export function exportCopy(db, file) {
  const out = new Database(file);
  const things = db.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'").all();
  for (const t of things.filter((x) => x.type === "table")) {
    out.exec(t.sql);
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map((c) => c.name);
    const put = out.prepare(`INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
    const rows = db.prepare(`SELECT * FROM "${t.name}"`).all();
    out.transaction(() => rows.forEach((r) => put.run(...cols.map((c) => bindable(r[c])))))();
  }
  for (const t of things.filter((x) => x.type !== "table")) out.exec(t.sql);
  out.close();
}

/** The day's backup, unless it exists; older ones beyond the last 14 are removed. Returns the list, the newest first. */
export async function dailyBackup(db, dir, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `kickoff-${now.toISOString().slice(0, 10)}.db`);
  if (!fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/\\/g, "/").replace(/'/g, "''")}'`);
  const list = fs.readdirSync(dir).filter((f) => NAME.test(f)).sort().reverse();
  for (const old of list.slice(KEEP)) fs.rmSync(path.join(dir, old), { force: true });
  return list.slice(0, KEEP);
}

/** Server side: a backup now, then a check every hour. */
export function startBackups(getDb, dir) {
  if (globalThis.__kickoffBackups) return;
  const run = () => dailyBackup(getDb(), dir).catch((e) => console.log(`[backup] ${e.message}`));
  run();
  globalThis.__kickoffBackups = setInterval(run, 3600e3);
  globalThis.__kickoffBackups.unref?.();
}
