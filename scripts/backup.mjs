// The nightly backup: the whole Turso database copied into a dated SQLite file, the last 14 kept.
// On the server, a scheduled task runs it (Coolify: node scripts/backup.mjs, at 0 4 * * *). The files go to
// BACKUP_DIR, else /app/data/sauvegardes when /app/data exists (the site's persistent volume), else data/sauvegardes.
// It reads Turso directly, table by table (Turso can only be read over the network), writes a temporary file, checks it,
// then gives it its name: a backup that stops halfway never replaces a good one. Its date and size are noted in the
// database, for the editor's "Server" panel.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

delete process.env.TURSO_REPLICA_PATH; // Turso itself, not the site's local copy

const KEEP = 14;
const NAME = /^vct-emea-\d{4}-\d{2}-\d{2}\.db$/;

export function backupDir(env = process.env, exists = fs.existsSync) {
  if (env.BACKUP_DIR) return env.BACKUP_DIR;
  return exists("/app/data") ? "/app/data/sauvegardes" : path.join(process.cwd(), "data", "sauvegardes");
}

/** The files beyond the newest `keep` (by their dated names), to remove. */
export function toRemove(files, keep = KEEP) {
  return files.filter((f) => NAME.test(f)).sort().reverse().slice(keep);
}

export async function runBackup({ now = new Date(), dir = backupDir() } = {}) {
  const { getDb } = await import("../lib/db.js");
  const { exportCopy } = await import("../lib/backup.js");
  const { default: Database } = await import("libsql");
  const t0 = Date.now();
  fs.mkdirSync(dir, { recursive: true });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const file = path.join(dir, `vct-emea-${day}.db`);
  const tmp = `${file}.partiel`;
  fs.rmSync(tmp, { force: true });
  const db = getDb();
  exportCopy(db, tmp);
  // the copy must open and hold the site's tables
  const check = new Database(tmp, { readonly: true });
  const tables = check.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get().n;
  const teams = check.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'teams'").get().n;
  check.close();
  if (!tables || !teams) throw new Error("the copy has no tables: nothing replaced");
  // (Windows may still hold the file a moment after it is closed: a copy then)
  try { fs.renameSync(tmp, file); } catch { fs.copyFileSync(tmp, file); try { fs.rmSync(tmp, { force: true }); } catch { /* left for the next night */ } }
  const removed = toRemove(fs.readdirSync(dir));
  for (const old of removed) fs.rmSync(path.join(dir, old), { force: true });
  const info = { at: new Date().toISOString(), file: path.basename(file), size: fs.statSync(file).size, tables, ms: Date.now() - t0, kept: fs.readdirSync(dir).filter((f) => NAME.test(f)).length };
  try {
    const { saveItem } = await import("../lib/lpstore.js");
    saveItem("meta", "backup_last", info, db);
  } catch (e) {
    console.log(`[backup] saved, but not noted in the database: ${e.message}`);
  }
  return info;
}

// run as a script (not when the tests import it)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  try {
    const info = await runBackup();
    console.log(`[backup] ${info.file}: ${(info.size / 1048576).toFixed(1)} MB, ${info.tables} tables, in ${Math.round(info.ms / 1000)} s; ${info.kept} kept`);
    process.exit(0);
  } catch (e) {
    console.log(`[backup] failed: ${e.message}`);
    try {
      const { saveItem } = await import("../lib/lpstore.js");
      saveItem("meta", "backup_error", { at: new Date().toISOString(), message: String(e.message).slice(0, 200) });
    } catch { /* nothing more to do */ }
    process.exit(1);
  }
}
