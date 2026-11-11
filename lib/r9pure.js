// Round 9, the pure parts the pages can use in the browser too: the teams with no logo, the open matches, the qualified teams, an event's numbers.
import { EVENTS, buildBracket, qualifiedOf } from "./bracket.js";
import { allMatches, eventData, matchesOf } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";

// how many places each open qualifier gives (as in pickem.js, kept here so the browser does not load it)
const QUALIFY = { q1: 4, q2: 4, trq1: 2, trq2: 2, meq1: 1, meq2: 1, naq1: 1, naq2: 1 };

// ---- E1. the teams with no logo

/** The teams of each event that show the default logo: [{ event, name, teams: [name] }]. Pure, from getState. */
export function missingLogos(state) {
  const out = [];
  const add = (event, list) => { const teams = [...new Set(list.filter((t) => t && t.name && !t.logo).map((t) => t.name))]; if (teams.length) out.push({ event, name: EVENT_NAMES[event] || event, teams }); };
  add("kickoff", (state.kickoff && state.kickoff.teams) || []);
  add("playoffs", state.teams || []);
  for (const e of ["tr", "mena", "gc"]) add(e, ((state.regional && state.regional[e]) || { teams: [] }).teams);
  for (const e of EVENTS) add(e, ((state.qualifiers && state.qualifiers[e]) || { slots: [] }).slots);
  return out;
}

// ---- E2. the open matches, to enter many scores at once

export const openMatches = (state, limit = 60) => allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null)
  .sort((x, y) => (x.at || "9").localeCompare(y.at || "9")).slice(0, limit)
  .map((m) => ({ event: m.event, id: m.id, a: m.a.name, b: m.b.name, at: m.at || "", bo: m.bo || 1, live: !!m.live }));

// ---- B1. the qualified teams, to announce

/** Every team that has qualified from an open qualifier: [{ event, name, team, logo, to }]. Pure. */
export function qualifiedTeams(state) {
  const NEXT = { q1: "EU Qualifier Playoffs", q2: "EU Qualifier Playoffs", trq1: "Türkiye Qualifier Playoffs", trq2: "Türkiye Qualifier Playoffs", meq1: "MENA Qualifier Playoffs", meq2: "MENA Qualifier Playoffs", naq1: "MENA Qualifier Playoffs", naq2: "MENA Qualifier Playoffs" };
  const out = [];
  for (const event of EVENTS) {
    const q = state.qualifiers && state.qualifiers[event];
    if (!q) continue;
    for (const s of qualifiedOf(buildBracket(q.slots, q.scores, q.bo), QUALIFY[event] || 1)) {
      const t = s && q.slots[s - 1];
      if (t && t.name) out.push({ event, name: EVENT_NAMES[event] || event, team: t.name, slug: teamSlug(t.name), logo: t.logo || "", to: NEXT[event] });
    }
  }
  return out;
}

// ---- R7. an event's header numbers

/** { played, total, next (time of the next match), places, live }. Pure. */
export function eventNumbers(state, event, now = Date.now()) {
  const items = matchesOf(event, eventData(state, event)).filter((m) => m.a && m.b);
  const times = (state.times && state.times[event]) || {};
  const coming = Object.entries(times).filter(([id, at]) => new Date(at).getTime() > now && items.some((m) => m.id === id && m.sa == null)).map(([, at]) => at).sort();
  return {
    played: items.filter((m) => m.sa != null).length,
    total: items.filter((m) => !m.bye).length,
    next: coming[0] || "",
    places: QUALIFY[event] || (event === "playoffs" ? 2 : event === "tr" || event === "mena" ? 1 : 0),
    live: Object.keys((state.live && state.live[event]) || {}).filter((id) => items.some((m) => m.id === id && m.sa == null)).length,
  };
}
