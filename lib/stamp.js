// The site's "stamp": a short fingerprint of what the pages show. The pages ask for it (a few bytes) instead of drawing
// themselves again every 20 to 60 seconds: a page is refreshed only when the stamp moved (components/autoRefresh.js).
import crypto from "node:crypto";
import { getState } from "./db.js";
import { publicState } from "./publicstate.js";

const memo = new WeakMap(); // state -> its fingerprint (the state is kept a few seconds on the server, then read again)

/** The fingerprint of the state the public pages get, of vlr.gg's live details, and of the community's latest writes. */
export function siteStamp(db) {
  const state = getState(db);
  let base = memo.get(state);
  if (!base) {
    base = crypto.createHash("sha1").update(JSON.stringify(publicState(state))).digest("base64url").slice(0, 16);
    memo.set(state, base);
  }
  const extra = [];
  // the live details (rounds, players) are read apart from the state, as are the predictions and comments
  for (const sql of [
    "SELECT max(json_extract(json, '$.at')) AS v FROM lp_items WHERE kind = 'vlr_live'",
    "SELECT max(rowid) AS v FROM comments",
    "SELECT max(rowid) AS v FROM predictions",
  ]) {
    try { const r = db.prepare(sql).get(); extra.push(r && r.v != null ? String(r.v) : ""); } catch { extra.push(""); }
  }
  return `${base}.${crypto.createHash("sha1").update(extra.join("|")).digest("base64url").slice(0, 8)}`;
}
