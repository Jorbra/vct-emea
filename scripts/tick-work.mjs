// The work of one round of the background task, started by scripts/tick.mjs in a process of its own (which it stops
// after 55 s: Turso's calls are synchronous, so a timer in this process could not stop it in time).
// It reads a local copy of its own (tick-copie.db beside the site's copy): only what changed comes from Turso and the reads
// stay on the server. Reading Turso itself (the whole site's state every 2 minutes) used up Turso's monthly read quota.
import path from "node:path";

if (process.env.TURSO_REPLICA_PATH) process.env.TURSO_REPLICA_PATH = path.join(path.dirname(process.env.TURSO_REPLICA_PATH), "tick-copie.db");

const t0 = Date.now();
try {
  const { regularWork } = await import("../lib/notify.js");
  const { readTurn } = await import("../lib/readturn.js");
  await Promise.all([regularWork(), readTurn()]);
  // a full round: for the health table and the editor's Server panel
  const { noteWorked } = await import("../lib/health.js");
  noteWorked("tick");
} catch (e) {
  console.log(`[tick] ${e.message}`);
  process.exitCode = 1;
}
console.log(`[tick] done in ${Date.now() - t0} ms`);
process.exit();
