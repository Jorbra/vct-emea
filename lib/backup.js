// A copy of the database once a day in data/backups (the last 14 are kept), made safely while the site runs.
import fs from "node:fs";
import path from "node:path";

const KEEP = 14;
const NAME = /^kickoff-\d{4}-\d{2}-\d{2}\.db$/;

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
