// Pure helpers of the big update (maj-40), read by components/Maj40Bits.jsx and checked in tests/maj40.test.mjs.

/** The time left before a match: { d, h, m } (rounded down to the minute), or null when it has begun. */
export function timeLeft(at, now) {
  const ms = new Date(at).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 };
}

/** The result as text, ready to paste in a chat: "UCAM 2–0 La masia · event · Bind 13–9, Lotus 13–11 · address". */
export function resultText({ a, b, sa, sb, event, maps, url }) {
  const list = (maps || []).filter((x) => x.a != null && x.b != null && x.map).map((x) => `${x.map} ${x.a}–${x.b}`).join(", ");
  return [`${a} ${sa}–${sb} ${b}`, event, list, url].filter(Boolean).join(" · ");
}
