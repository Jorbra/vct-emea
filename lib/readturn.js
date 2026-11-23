// One turn of reading what visitors asked for (a Liquipedia page, a vlr.gg page), without Next: the site calls it after a
// page is sent (lib/readsoon.js), and on a server that runs it apart from the pages, scripts/tick.mjs does.
import { takeRequest, takeTurn } from "./lpstore.js";
import { fetchRequest } from "./teamfetch.js";
import { fetchVlr, readVlrInfo, refuseVlr, vlrBlocked } from "./vlrfetch.js";

export async function readOneLp() {
  if (!takeTurn("lp")) return;
  const r = takeRequest("lp:");
  if (!r) return;
  try {
    await fetchRequest(r);
  } catch (e) {
    console.log(`[lp-info] ${r.id}: ${e.message}`); // the page asks again when it refreshes
  }
}

export async function readOneVlr() {
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

/** Both reads, side by side. */
export const readTurn = () => Promise.all([readOneLp(), readOneVlr()]);
