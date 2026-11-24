// One round of the site's background work, run apart from the pages: on a server, a scheduled task starts it every
// minute (Coolify: node scripts/tick.mjs), with BACKGROUND_WORK=external set on the site so the pages leave it alone.
// It talks to Turso directly (no local copy: copying the whole database every minute would be wasteful), waits on
// the network as long as it needs, and never makes a visitor wait. It stops after 55 s at most.
delete process.env.TURSO_REPLICA_PATH;

const stop = setTimeout(() => {
  console.log("[tick] still running after 55 s: stopped, the next round takes over");
  process.exit(0);
}, 55000);
stop.unref();

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
