// What a visitor asks for is read by the site itself, right after the page is sent: GitHub's regular round can come very late.
import { after } from "next/server";
import { hasRequests } from "./lpstore.js";
import { getDb } from "./db.js";
import { claimTurn } from "./notify.js";
import { readTurn } from "./readturn.js";

// On a server that runs this work apart from the pages (a scheduled task: scripts/tick.mjs), the pages leave it alone.
const external = () => process.env.BACKGROUND_WORK === "external";

/** Called by the pages everybody opens: right after the page is sent, Toornament and the alerts get their turn. */
export function workSoon() {
  if (external()) return;
  after(async () => {
    const { regularWork } = await import("./notify.js");
    await regularWork();
  });
}

/** Called by the pages that can ask for something. Does nothing when nothing waits, so most visits cost nothing. */
export function readSoon() {
  if (external() || !hasRequests()) return;
  // one read every minute for the whole site, not one per page view
  if (!claimTurn(getDb(), "turn:read", 60000)) return;
  after(() => readTurn());
}
