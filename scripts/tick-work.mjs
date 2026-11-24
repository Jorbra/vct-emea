// The work of one round of the background task, started by scripts/tick.mjs in a process of its own (which it stops
// after 55 s: Turso's calls are synchronous, so a timer in this process could not stop it in time).
// It talks to Turso directly (no local copy: copying the whole database every minute would be wasteful).
delete process.env.TURSO_REPLICA_PATH;

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
