// A match being played, from its vlr.gg page: the maps' scores as they go, and a short feed of what happened. Pure.
// Also what the page tells during the match: the map being played, each map's rounds (who won, on which side, how) and the
// players' numbers, for the match page and /live.

import { nextRounds } from "./livemore.js";

const over = (a, b) => Math.max(a, b) >= 13 && Math.abs(a - b) >= 2;

const HOW = { elim: "e", boom: "b", defuse: "d", time: "t" };

/** A map's rounds, sides as on the site: "ate" = won by a, on attack, by eliminations ("b" spike exploded, "d" defused, "t" time). */
export function compactRounds(rounds, swap) {
  return (rounds || []).map((r) => `${(r.w === 1) !== !!swap ? "a" : "b"}${r.side === "ct" ? "c" : "t"}${HOW[r.how] || "e"}`);
}

/** The players' rows, sides as on the site, with only what the live view shows. */
export function compactPlayers(rows, swap) {
  return (rows || []).slice(0, 12).map((p) => ({
    name: p.name, side: !p.side ? "" : (p.side === 1) !== !!swap ? "a" : "b", agent: (p.agents || [])[0] || "",
    k: p.k, d: p.d, a: p.a, acs: p.acs, r: p.r ?? null, adr: p.adr ?? null, fk: p.fk ?? null, fd: p.fd ?? null,
  }));
}

/**
 * The next state of a live match from a page read: { at, sa, sb, now, maps: [{ map, a, b, done, t, ct, rnd }], feed: [{ at, kind, map, a, b, sa, sb }],
 * players: { map, all } }. sides as on the site (swap: the page lists the teams the other way). A map that ends adds "map" to the
 * feed; one that starts adds "start".
 */
export function liveUpdate(prev, parsed, swap, now = Date.now()) {
  const at = new Date(now).toISOString();
  const flip = (p) => (Array.isArray(p) && p.length === 2 ? (swap ? [p[1], p[0]] : [p[0], p[1]]) : undefined);
  const maps = (parsed.maps || []).filter((m) => m.a != null && m.b != null).map((m) => {
    const [a, b] = swap ? [m.b, m.a] : [m.a, m.b];
    const extra = {};
    if (flip(m.t) && flip(m.ct)) { extra.t = flip(m.t); extra.ct = flip(m.ct); }
    const rnd = compactRounds(m.rounds, swap);
    if (rnd.length) extra.rnd = rnd;
    return { map: m.map, a, b, done: over(a, b), ...extra };
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
  // the map being played: the one vlr.gg marks live, else the first one not over that has begun, else the last one over
  const playing = shown.find((m) => m.map === parsed.now && !/^tbd$/i.test(m.map)) || shown.find((m) => !m.done && m.a + m.b > 0) || [...shown].reverse().find((m) => m.done);
  const raw = (parsed.maps || []).find((m) => playing && m.map === playing.map);
  const players = { map: playing ? compactPlayers(raw && raw.rows, swap) : [], all: compactPlayers(parsed.all, swap) };
  return { at, sa, sb, now: playing ? playing.map : "", maps: shown, feed: feed.slice(-12), rounds: nextRounds(prev && prev.rounds, shown, at), players };
}
