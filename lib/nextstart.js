// The next event to start, for the home page's countdown. Pure, and safe in the browser.
import { eventData, matchesOf } from "./matchlist.js";

/**
 * The next event to start, for the home page's countdown: { event, at, exact, matches: [{ id, a, b, at }] } or null.
 * exact: a match time is known; otherwise the event's start date.
 */
export function nextStart(state, now = Date.now()) {
  let best = null;
  for (const [event, times] of Object.entries(state.times || {})) {
    const items = matchesOf(event, eventData(state, event));
    if (!items.length || items.some((m) => m.sa != null)) continue;
    const list = items.filter((m) => times[m.id] && new Date(times[m.id]).getTime() > now).sort((a, b) => times[a.id].localeCompare(times[b.id]));
    if (!list.length) continue;
    const at = times[list[0].id];
    if (!best || at < best.at) best = { event, at, exact: true, matches: list.slice(0, 4).map((m) => ({ id: m.id, a: m.a || null, b: m.b || null, at: times[m.id] })) };
  }
  if (best) return best;
  // no time yet: the first event whose start date is still ahead
  for (const [event, info] of Object.entries(state.info || {})) {
    if (!info || !/^\d{4}-\d{2}-\d{2}$/.test(info.start || "")) continue;
    const at = new Date(`${info.start}T00:00:00`).toISOString();
    if (new Date(at).getTime() <= now) continue;
    if (!best || at < best.at) best = { event, at, exact: false, matches: [] };
  }
  return best;
}
