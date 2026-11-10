// The power ratings the simulator and the bot read, kept for the state they come from.
import { getDb, getState } from "./db.js";
import { powerRanking } from "./round6.js";

let memo = { state: null, out: null };
export function ratings() {
  const state = getState(getDb());
  if (memo.state === state) return memo.out;
  const out = { state, rating: new Map(powerRanking(state, Date.now(), { min: 1 }).map((t) => [t.slug, t.rating])) };
  memo = { state, out };
  return out;
}
