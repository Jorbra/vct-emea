// A finished match told in three short sentences, written from its result, its maps and the best player of vlr.gg's table.
// Pure: { a, b, sa, sb } (team names and score in maps), maps: [{ map, a, b }] (rounds, sides as the match), best: { name, acs, r }.

const W = {
  fr: { beat: "{w} bat {l} {x}–{y}", clean: "{w} s'impose {x}–{y} face à {l}, sans perdre de carte", full: "{w} bat {l} {x}–{y} au bout de la dernière carte",
    key: "Carte la plus serrée : {map} ({a}–{b})", ot: "Carte la plus serrée : {map} ({a}–{b}), en prolongation", best: "Meilleur joueur : {name} ({acs} ACS{r})", rating: ", note {r}" },
  en: { beat: "{w} beat {l} {x}–{y}", clean: "{w} won {x}–{y} against {l} without dropping a map", full: "{w} beat {l} {x}–{y} in the last map",
    key: "Closest map: {map} ({a}–{b})", ot: "Closest map: {map} ({a}–{b}), in overtime", best: "Best player: {name} ({acs} ACS{r})", rating: ", rating {r}" },
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ""));

/** Up to three sentences, or [] when the match is not over. */
export function matchSummary({ a, b, sa, sb, bo = 0 }, maps = [], best = null, lang = "fr") {
  const t = W[lang] || W.en;
  if (sa == null || sb == null || sa === sb || !a || !b) return [];
  const aWon = sa > sb;
  const v = { w: aWon ? a : b, l: aWon ? b : a, x: Math.max(sa, sb), y: Math.min(sa, sb) };
  const played = (maps || []).filter((m) => m && m.map && !/^tbd$/i.test(m.map) && m.a != null && m.b != null && m.a + m.b > 0);
  const total = sa + sb;
  // the last map: one map short of the win each before it (2-1 in a Bo3, 3-2 in a Bo5); without the format, a one-map gap
  const need = bo ? Math.ceil(bo / 2) : 0;
  const last = need ? v.x === need && v.y === need - 1 && need > 1 : total >= 3 && v.x - v.y === 1;
  const out = [fill(v.y === 0 ? t.clean : last ? t.full : t.beat, v)];
  if (played.length >= 2) {
    const close = [...played].sort((p, q) => Math.abs(p.a - p.b) - Math.abs(q.a - q.b) || (q.a + q.b) - (p.a + p.b))[0];
    out.push(fill(close.a >= 13 && close.b >= 12 || close.b >= 13 && close.a >= 12 ? (close.a + close.b > 24 ? t.ot : t.key) : t.key, { map: close.map, a: close.a, b: close.b }));
  }
  if (best && best.name && best.acs != null) out.push(fill(t.best, { name: best.name, acs: Math.round(best.acs), r: best.r != null ? fill(t.rating, { r: Number(best.r).toFixed(2) }) : "" }));
  return out;
}
