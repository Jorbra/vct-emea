// What the public pages send to the browser: the site's state without what only the editors or the server use.
// A match with vlr.gg's full table has its players' numbers dropped (the match window loads the table itself);
// that alone is a third of the state. The same state gives the same object back (kept until the state changes).
const memo = new WeakMap();

export function publicState(state) {
  if (!state || typeof state !== "object") return state;
  const hit = memo.get(state);
  if (hit) return hit;
  const extra = {};
  for (const [event, list] of Object.entries(state.extra || {})) {
    const out = {};
    for (const [id, x] of Object.entries(list || {})) out[id] = x && x.hasDetails && Array.isArray(x.pstats) && x.pstats.length ? { ...x, pstats: [] } : x;
    extra[event] = out;
  }
  const lite = { ...state, extra };
  memo.set(state, lite);
  return lite;
}
