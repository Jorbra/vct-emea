// What a visitor asks for is read by the site itself, right after the page is sent: GitHub's regular round can come very late.
import { after } from "next/server";
import { hasRequests, takeRequest, takeTurn } from "./lpstore.js";
import { fetchRequest } from "./teamfetch.js";
import { fetchVlr, readVlrInfo, refuseVlr, vlrBlocked } from "./vlrfetch.js";

async function readOneLp() {
  if (!takeTurn("lp")) return;
  const r = takeRequest("lp:");
  if (!r) return;
  try {
    await fetchRequest(r);
  } catch (e) {
    console.log(`[lp-info] ${r.id}: ${e.message}`); // the page asks again when it refreshes
  }
}

async function readOneVlr() {
  if (vlrBlocked(readVlrInfo()) || !takeTurn("vlr")) return;
  const r = takeRequest("vlr:");
  if (!r) return;
  try {
    await fetchVlr(r);
  } catch (e) {
    if (e.name === "Refused") refuseVlr(e.message);
    else console.log(`[vlr] ${r.id}: ${e.message}`);
  }
}

/** Called by the pages everybody opens: right after the page is sent, Toornament and the alerts get their turn. */
export function workSoon() {
  after(async () => {
    const { regularWork } = await import("./notify.js");
    await regularWork();
  });
}

/** Called by the pages that can ask for something. Does nothing when nothing waits, so most visits cost nothing. */
export function readSoon() {
  if (!hasRequests()) return;
  after(() => Promise.all([readOneLp(), readOneVlr()]));
}
