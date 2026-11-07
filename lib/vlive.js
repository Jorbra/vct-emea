// A match being played, from its vlr.gg page: the maps' scores as they go, and a short feed of what happened. Pure.

const over = (a, b) => Math.max(a, b) >= 13 && Math.abs(a - b) >= 2;

/**
 * The next state of a live match from a page read: { at, sa, sb, maps: [{ map, a, b, done }], feed: [{ at, kind, map, a, b, sa, sb }] }.
 * sides as on the site (swap: the page lists the teams the other way). A map that ends adds "map" to the feed; one that starts adds "start".
 */
export function liveUpdate(prev, parsed, swap, now = Date.now()) {
  const at = new Date(now).toISOString();
  const maps = (parsed.maps || []).filter((m) => m.a != null && m.b != null).map((m) => {
    const [a, b] = swap ? [m.b, m.a] : [m.a, m.b];
    return { map: m.map, a, b, done: over(a, b) };
  });
  // the maps not started yet show 0-0 after one that is being played: only up to the first 0-0
  const firstBlank = maps.findIndex((m, i) => i > 0 && m.a === 0 && m.b === 0 && !maps[i - 1].done);
  const shown = firstBlank > 0 ? maps.slice(0, firstBlank) : maps.filter((m, i) => !(m.a === 0 && m.b === 0 && i > 0 && maps.slice(0, i).some((x) => !x.done)));
  const sa = shown.filter((m) => m.done && m.a > m.b).length;
  const sb = shown.filter((m) => m.done && m.b > m.a).length;
  const feed = [...((prev && prev.feed) || [])];
  const before = (prev && prev.maps) || [];
  let ca = 0;
  let cb = 0;
  shown.forEach((m) => {
    if (m.done) { if (m.a > m.b) ca += 1; else cb += 1; }
    const old = before.find((x) => x.map === m.map);
    if (!old && !m.done && m.a + m.b > 0) feed.push({ at, kind: "start", map: m.map });
    if (m.done && !(old && old.done)) feed.push({ at, kind: "map", map: m.map, a: m.a, b: m.b, sa: ca, sb: cb });
  });
  return { at, sa, sb, maps: shown, feed: feed.slice(-12) };
}
