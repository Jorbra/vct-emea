// What a map's rounds tell, from their compact form ("ate": won by the site's first team, on attack, by eliminations; see
// lib/vlive.js compactRounds): the two pistol rounds, the longest run, the biggest lead come back from. Pure.

/**
 * { pistols: ["a" | "b" | null, …] (rounds 1 and 13), run: { side, n, from } (the longest run of rounds, from its first round,
 * 1-based), comeback: { side, down } (the map's winner was down by `down` rounds at worst, 4 or more), ot } or null.
 */
export function roundFacts(rnd) {
  const list = (rnd || []).filter((r) => r && (r[0] === "a" || r[0] === "b"));
  if (list.length < 2) return null;
  const pistols = [list[0] ? list[0][0] : null, list[12] ? list[12][0] : null];
  let run = { side: list[0][0], n: 1, from: 1 };
  let cur = { ...run };
  for (let i = 1; i < list.length; i++) {
    cur = list[i][0] === cur.side ? { ...cur, n: cur.n + 1 } : { side: list[i][0], n: 1, from: i + 1 };
    if (cur.n > run.n) run = { ...cur };
  }
  const wa = list.filter((r) => r[0] === "a").length;
  const winner = wa * 2 > list.length ? "a" : wa * 2 < list.length ? "b" : null;
  let a = 0;
  let b = 0;
  let worst = 0;
  for (const r of list) {
    if (r[0] === "a") a += 1; else b += 1;
    const down = winner === "a" ? b - a : winner === "b" ? a - b : 0;
    if (down > worst) worst = down;
  }
  return { pistols, run, comeback: winner && worst >= 4 ? { side: winner, down: worst } : null, ot: list.length > 24 };
}

/** One side's pistol rounds over a list of maps' rounds (sides as in each): { won, played }. */
export function pistolsOf(maps, side) {
  let won = 0;
  let played = 0;
  for (const rnd of maps) {
    const f = roundFacts(rnd);
    if (!f) continue;
    for (const p of f.pistols) if (p) { played += 1; if (p === side) won += 1; }
  }
  return { won, played };
}
