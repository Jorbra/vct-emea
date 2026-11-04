// Tells the world about matches: Discord, and the alerts of those who asked for them. Each announcement leaves once, whoever calls.
import { getDb, getState } from "./db.js";
import { announceOnce } from "./discord.js";
import { takeTurn } from "./lpstore.js";
import { pushNow } from "./push.js";

export async function announceNow() {
  try {
    await announceOnce(() => getState(getDb()), getDb);
    await pushNow(getDb(), getState(getDb()));
  } catch (e) {
    console.log(`[notify] ${e.message}`);
  }
}

/** For regular calls: at most once every 30 seconds. */
export async function announceIfDue() {
  if (takeTurn("notify")) await announceNow();
}
