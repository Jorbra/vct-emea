// The day's recap: the results, the player of the day (best rating), the fans' man of the match, the day's standout map line
// (most kills on one map) and the closest map. Shown at /jour, drawn by /api/og/day and posted by the bot's evening summary.
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES } from "./paths.js";
import { detailsOf } from "./tstats.js";

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }); // made once: making one is slow
export const parisDay = (t) => PARIS_DAY.format(new Date(t));
export const validDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));

/** The finished matches of a Paris day, in playing order. */
export const dayMatches = (state, day, all = allMatches) => all(state)
  .filter((m) => m.a && m.b && m.sa != null && m.at && parisDay(m.at) === day)
  .sort((x, y) => String(x.at).localeCompare(String(y.at)));

/** Everything the recap shows. details(event, id) gives a match's vlr.gg table; votes(event, id) its MVP votes. */
export function dayRecap(state, day, details, votes = () => ({ total: 0, counts: [] }), all = allMatches) {
  const done = dayMatches(state, day, all);
  let star = null;
  let best = null;
  let closest = null;
  let fans = null;
  for (const m of done) {
    const vs = `${m.a.name} vs ${m.b.name}`;
    const d = details(m.event, m.id);
    for (const r of (d && d.all) || []) if (r.r != null && (!star || r.r > star.r)) star = { name: r.name, r: r.r, acs: r.acs ?? null, vs };
    for (const map of (d && d.maps) || []) {
      for (const r of map.rows || []) if (r.k != null && (!best || r.k > best.k)) best = { name: r.name, k: r.k, d: r.d ?? null, acs: r.acs ?? null, map: map.map, vs };
      if (map.a != null && map.b != null) {
        const gap = Math.abs(map.a - map.b);
        const total = map.a + map.b;
        if (!closest || gap < closest.gap || (gap === closest.gap && total > closest.total)) closest = { map: map.map, a: map.a, b: map.b, gap, total, ta: m.a.name, tb: m.b.name };
      }
    }
    const v = votes(m.event, m.id);
    const top = v && v.counts && v.counts[0];
    if (top && (!fans || top.n > fans.n)) fans = { name: top.player, n: top.n, total: v.total, vs };
  }
  return {
    day,
    matches: done.map((m) => ({ event: m.event, id: m.id, eventName: EVENT_NAMES[m.event] || m.event, a: m.a.name, b: m.b.name, ta: m.a.tag || "", tb: m.b.tag || "", sa: m.sa, sb: m.sb, win: m.win || (m.sa > m.sb ? "a" : m.sb > m.sa ? "b" : "") })),
    star, best, closest, fans,
  };
}

/** The same with the site's database. */
export async function dayRecapOf(db, state, day) {
  const { motmResults } = await import("./fans.js");
  return dayRecap(state, day, (e, id) => detailsOf(db, e, id), (e, id) => motmResults(db, e, id));
}
