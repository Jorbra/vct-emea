// Round 17, during the matches: a live match's tense moments (overtime, a deciding map) and the bot's post about them,
// the evening's picture of the day. Pure functions first (tests), then the bot's.

/** A live match's tense moments: { ot: map name when the map being played is in overtime, decider: true when the series goes to its last map }. */
export function tension(live, bo) {
  const maps = (live && live.maps) || [];
  const now = maps.find((m) => !m.done && m.map && !/^tbd$/i.test(m.map));
  const need = bo ? Math.ceil(bo / 2) : 0;
  const sa = (live && live.sa) ?? (live && live.a) ?? 0;
  const sb = (live && live.sb) ?? (live && live.b) ?? 0;
  return {
    ot: now && now.a >= 12 && now.b >= 12 ? now.map : "",
    decider: need > 1 && sa === need - 1 && sb === need - 1,
    map: now ? now.map : "", a: now ? now.a : null, b: now ? now.b : null,
  };
}

/** The round by round story kept for a live map: the score each time it changed, 80 at most. Pure: the next list from a page read. */
export function nextRounds(prev, maps, at) {
  const list = [...(prev || [])];
  for (const m of maps || []) {
    if (!m.map || /^tbd$/i.test(m.map) || m.a == null || m.b == null) continue;
    const last = [...list].reverse().find((x) => x.map === m.map);
    if (!last || last.a !== m.a || last.b !== m.b) list.push({ at, map: m.map, a: m.a, b: m.b });
  }
  return list.slice(-80);
}
