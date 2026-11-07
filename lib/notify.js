// Tells the world about matches: Discord, and the alerts of those who asked for them. Each announcement leaves once, whoever calls.
import { getDb, getState } from "./db.js";
import { announceOnce } from "./discord.js";
import { takeTurn } from "./lpstore.js";
import { digestNow, pushNow } from "./push.js";
import { noteProblem, noteWorked } from "./health.js";

export async function announceNow() {
  try {
    await announceOnce(() => getState(getDb()), getDb);
    await pushNow(getDb(), getState(getDb()));
    await digestNow(getDb(), getState(getDb()));
  } catch (e) {
    console.log(`[notify] ${e.message}`);
    noteProblem("notify", e.message);
  }
}

/**
 * The regular work, also started by visits, so that it does not depend on an outside scheduler alone: Toornament, then the alerts.
 * A server looks at most every 20 seconds, so that most visits cost nothing.
 */
export async function regularWork(now = Date.now()) {
  if (now - (globalThis.__regularAt || 0) < 20000) return;
  globalThis.__regularAt = now;
  try {
    const { syncIfDue } = await import("./toornament.js");
    const changed = await syncIfDue(now);
    if (changed) { const { dropStateCache } = await import("./db.js"); dropStateCache(); }
    await announceIfDue();
    const { vlrMatchesIfDue } = await import("./vlrmatch.js");
    await vlrMatchesIfDue(now);
    const { lftIfDue } = await import("./lft.js");
    await lftIfDue(now);
    // for the health table, at most every 5 minutes; and the editors told of a problem
    if (now - (globalThis.__regularNoted || 0) > 300000) {
      globalThis.__regularNoted = now;
      noteWorked("regular");
      const { healthReport } = await import("./health.js");
      const { healthProblems } = await import("./social.js");
      const { healthPushNow } = await import("./push.js");
      await healthPushNow(getDb(), healthProblems(healthReport(getDb(), now), now));
    }
  } catch (e) {
    console.log(`[regular] ${e.message}`);
    noteProblem("regular", e.message);
  }
}

/** For regular calls: at most once every 30 seconds. */
export async function announceIfDue() {
  if (takeTurn("notify")) await announceNow();
}
