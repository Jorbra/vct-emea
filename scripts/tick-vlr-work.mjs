// vlr.gg's part of the background work (the matches being played, their maps and rounds, the results), in a process of its
// own started by scripts/tick.mjs beside the rest (scripts/tick-work.mjs). While matches were played, the rest (Toornament,
// Liquipedia, Discord, alerts) made the shared round run past its 55 s and be stopped before vlr.gg's reads were saved: the
// live scores stopped and results came hours late. Here vlr.gg has the whole minute to itself.
import path from "node:path";

// a local copy of its own, as the other process has (only what changed comes from Turso)
if (process.env.TURSO_REPLICA_PATH) process.env.TURSO_REPLICA_PATH = path.join(path.dirname(process.env.TURSO_REPLICA_PATH), "tick-vlr-copie.db");

const t0 = Date.now();
try {
  const { vlrMatchesIfDue } = await import("../lib/vlrmatch.js");
  const read = await vlrMatchesIfDue();
  const { noteWorked } = await import("../lib/health.js");
  noteWorked("vlr-tick");
  console.log(`[vlr-tick] ${read} page(s) read in ${Date.now() - t0} ms`);
} catch (e) {
  console.log(`[vlr-tick] ${e.message}`);
  process.exitCode = 1;
}
process.exit();
