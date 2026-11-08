// The match night: today's matches (Paris time), with their live score and maps.
import { allMatches } from "./matchlist.js";

const parisDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

export function nightMatches(state, now = Date.now()) {
  const day = parisDay(new Date(now));
  return allMatches(state)
    .filter((m) => m.a && m.b && (m.live || (m.at && parisDay(new Date(m.at)) === day)))
    .slice(0, 300)
    .map((m) => {
      const s = m.live ? (state.live[m.event] || {})[m.id] || null : null;
      return { event: m.event, id: m.id, at: m.at || "", live: !!m.live, sa: m.sa ?? null, sb: m.sb ?? null, win: m.win || "", a: m.a, b: m.b, score: s ? { a: s.a, b: s.b, maps: s.maps || [] } : null };
    });
}
