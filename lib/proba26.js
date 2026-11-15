// Round 26: a match's win chances, from the teams' power ratings (the Elo of the power ranking and the simulator).
import { teamSlug } from "./paths.js";

/** One map's chance for A against B, from their ratings. */
export const mapChance = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

/** A series' chance from one map's: the first to win more than half of its maps (Bo1, Bo3, Bo5). */
export function seriesChance(p, bo = 3) {
  if (bo <= 1) return p;
  const w = Math.ceil(bo / 2);
  const c = (k, r) => { let x = 1; for (let i = 1; i <= r; i++) x = (x * (k - r + i)) / i; return x; };
  let s = 0;
  for (let l = 0; l < w; l++) s += c(w - 1 + l, l) * p ** w * (1 - p) ** l;
  return s;
}

/**
 * Both teams' chances for a match, in %: { a, b } (a + b = 100), or null when one of them has no rating yet.
 * rating: a Map or an object, team slug → Elo.
 */
export function winChance(rating, nameA, nameB, bo = 3) {
  const get = (n) => (rating instanceof Map ? rating.get(teamSlug(n)) : (rating || {})[teamSlug(n)]);
  const ra = get(nameA), rb = get(nameB);
  if (ra == null || rb == null || !nameA || !nameB) return null;
  const a = Math.round(seriesChance(mapChance(ra, rb), bo) * 100);
  return { a, b: 100 - a };
}

/** The ratings a page needs for these matches only: { slug: Elo }. */
export function ratingsFor(rating, matches) {
  const out = {};
  for (const m of matches || []) for (const t of [m.a, m.b]) {
    const s = t && t.name ? teamSlug(t.name) : "";
    if (s && rating.has(s)) out[s] = rating.get(s);
  }
  return out;
}
