// One round of the site's background work, run apart from the pages: on a server, a scheduled task starts it every
// minute (Coolify: node scripts/tick.mjs), with BACKGROUND_WORK=external set on the site so the pages leave it alone.
// The work runs in a process of its own (scripts/tick-work.mjs), stopped for good after 55 s: its calls to Turso are
// synchronous, so a timer inside it never fired, and rounds that ran on for two minutes piled up and slowed the site.
// A round still running (a lock file with its process number) means this one does nothing.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 55000;
const LOCK = path.join(os.tmpdir(), "vct-emea-tick.lock");

/** True when the lock names a process still alive (and is less than 5 minutes old). */
export function busy(lock = LOCK, now = Date.now()) {
  try {
    const { pid, at } = JSON.parse(fs.readFileSync(lock, "utf8"));
    if (now - at > 5 * 60000) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (busy()) {
    console.log("[tick] the previous round is still running: this one is skipped");
    process.exit(0);
  }
  const work = fileURLToPath(new URL("./tick-work.mjs", import.meta.url));
  const child = spawn(process.execPath, [work], { stdio: "inherit", env: process.env });
  try { fs.writeFileSync(LOCK, JSON.stringify({ pid: child.pid, at: Date.now() })); } catch { /* no lock: rounds may meet */ }
  const stop = setTimeout(() => {
    console.log(`[tick] still running after ${LIMIT / 1000} s: stopped, the next round takes over`);
    child.kill("SIGKILL");
  }, LIMIT);
  child.on("exit", (code) => {
    clearTimeout(stop);
    try { fs.rmSync(LOCK, { force: true }); } catch { /* the next round checks the process anyway */ }
    process.exit(code ?? 0);
  });
}
