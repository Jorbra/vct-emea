// The editor's "Server" panel, about this site only: whether it answers (its own /api/health, asked from inside the server)
// and how fast, the last backup, the background task's last full round, and the free space of the data folder.
import fs from "node:fs";
import path from "node:path";
import { readItems } from "./lpstore.js";

/** The site's own health address, asked on the server itself (never an address from the request). */
export const selfHealthUrl = (env = process.env) => `http://127.0.0.1:${Number(env.PORT) || 3000}/api/health`;

/** Asks the site's own /api/health: { ok, status, ms, error }. More than `timeout` ms: not answering. */
export async function pingSelf({ url = selfHealthUrl(), fetchImpl = fetch, timeout = 6000, now = () => Date.now() } = {}) {
  const t0 = now();
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeout), cache: "no-store" });
    return { ok: res.status >= 200 && res.status < 400, status: res.status, ms: now() - t0, error: "" };
  } catch (e) {
    return { ok: false, status: 0, ms: now() - t0, error: e && e.name === "TimeoutError" ? "timeout" : String((e && e.message) || e).slice(0, 120) };
  }
}

/** The data folder: /app/data on the server (where the local copy and the backups live), else the project's data folder. */
export function dataDir(env = process.env, exists = fs.existsSync) {
  if (env.TURSO_REPLICA_PATH) return path.dirname(env.TURSO_REPLICA_PATH);
  if (env.DATABASE_PATH && !env.TURSO_DATABASE_URL) return path.dirname(env.DATABASE_PATH);
  return exists("/app/data") ? "/app/data" : path.join(process.cwd(), "data");
}

/** The data folder's disk: { dir, free, total } in bytes, or null when it cannot be read. */
export function diskOf(dir, statfs = fs.statfsSync) {
  try {
    const s = statfs(dir);
    return { dir, free: Number(s.bavail) * Number(s.bsize), total: Number(s.blocks) * Number(s.bsize) };
  } catch {
    return null;
  }
}

/** What the database says about the night's backup and the background task. */
export function jobsInfo(db) {
  const meta = readItems("meta", db);
  return {
    backup: meta.backup_last || null,
    backupError: meta.backup_error || null,
    tick: meta["ok:tick"] || null,
  };
}
