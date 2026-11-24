// The match night: today's matches (Paris time), with their live score, maps and stream.
import { allMatches } from "./matchlist.js";

const parisDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

/** A match's stream link: its own, else its event's; "" when none is known. */
export const streamOf = (state, m) => (((state.extra || {})[m.event] || {})[m.id] || {}).stream || (state.info && state.info[m.event] && state.info[m.event].stream) || "";

export function nightMatches(state, now = Date.now()) {
  const day = parisDay(new Date(now));
  return allMatches(state)
    .filter((m) => m.a && m.b && (m.live || (m.at && parisDay(new Date(m.at)) === day)))
    .slice(0, 300)
    .map((m) => {
      const s = m.live ? ((state.live || {})[m.event] || {})[m.id] || null : null;
      return {
        event: m.event, id: m.id, at: m.at || "", live: !!m.live, sa: m.sa ?? null, sb: m.sb ?? null, win: m.win || "", a: m.a, b: m.b,
        round: m.round || [], bo: m.bo || 0, stream: streamOf(state, m),
        score: s ? { a: s.a, b: s.b, maps: s.maps || [] } : null,
      };
    });
}

