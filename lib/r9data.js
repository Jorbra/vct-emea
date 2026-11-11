// The events' recaps, for the MVP predictions: kept for the state they come from.
import { getDb, getState } from "./db.js";
import { EVENTS } from "./bracket.js";
import { recapOf } from "./recap.js";
import { readDetails } from "./tstats.js";
import { mvpEvents } from "./round9.js";

let memo = { state: null, out: null };
export function mvpData(now = Date.now()) {
  const db = getDb();
  const state = getState(db);
  if (memo.state === state && memo.out && now - memo.at < 60000) return memo.out;
  const recaps = Object.fromEntries(EVENTS.map((e) => [e, state.qualifiers && state.qualifiers[e] ? recapOf(state, readDetails(db, e), e) : null]));
  const out = mvpEvents(state, recaps, now);
  memo = { state, out, at: now };
  return out;
}
