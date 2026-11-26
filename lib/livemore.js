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

/**
 * Who is one round from winning a map: "a", "b" or "". In regulation a team on 12 against fewer; in overtime the team one round
 * ahead (13-12, 14-13…). A map over gives "".
 */
export function mapPoint(m) {
  if (!m || m.done || m.a == null || m.b == null) return "";
  const { a, b } = m;
  if (a >= 12 && b >= 12) return a === b + 1 ? "a" : b === a + 1 ? "b" : "";
  return a === 12 && b < 12 ? "a" : b === 12 && a < 12 ? "b" : "";
}

/** A map point that would also win the series: { side, match: true/false } or null. maps: the series so far, bo: its format. */
export function seriesPoint(maps, bo) {
  const list = maps || [];
  const now = list.find((m) => !m.done && m.map && !/^tbd$/i.test(m.map));
  const side = mapPoint(now);
  if (!side) return null;
  const won = list.filter((m) => m.done && (side === "a" ? m.a > m.b : m.b > m.a)).length;
  const need = bo ? Math.ceil(bo / 2) : 0;
  return { side, match: need > 0 && won === need - 1 };
}

/** The first half's score from a map's rounds ("ate", "bcd"…): { a, b } once 12 rounds are played, else null. */
export function halfTime(rnd) {
  const list = rnd || [];
  if (list.length < 12) return null;
  const first = list.slice(0, 12);
  return { a: first.filter((r) => r[0] === "a").length, b: first.filter((r) => r[0] === "b").length };
}

/** The rounds won in a row at the end: { side, n } (n of 3 or more), else null. */
export function roundStreak(rnd) {
  const list = rnd || [];
  if (!list.length) return null;
  const side = list[list.length - 1][0];
  let n = 0;
  for (let i = list.length - 1; i >= 0 && list[i][0] === side; i--) n += 1;
  return n >= 3 ? { side, n } : null;
}
