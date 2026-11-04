// Every match of an event as one flat list (teams, score, round name), for the schedules and the home page. Pure.
import { EVENTS, ROUNDS, THIRD, buildBracket } from "./bracket.js";
import { buildKickoff } from "./kickoff.js";
import { REGIONS, buildRegional } from "./regional.js";
import { TIME_EVENTS } from "./schedule.js";
import { result } from "./tournament.js";

const winSide = (m) => (m.winner == null ? null : m.winner === m.a ? "a" : "b");

/**
 * [{ id, round: [[english key, vars], ...] (joined with " · " once translated), bo (1, 3 or 5), a, b (teams or null), sa, sb, win: "a" | "b" | null }]
 * `data` is what the event's page gets: { teams, matches } for the EU Playoffs, the qualifier / kickoff / regional data otherwise.
 */
export function matchesOf(event, data) {
  if (!data) return [];
  if (event === "playoffs") {
    const byId = Object.fromEntries(data.teams.map((t) => [t.id, t]));
    return data.matches.map((m) => {
      const res = result(m);
      const round = m.stage === "swiss"
        ? [["Swiss · Round {n}", { n: m.round }]]
        : m.round === "final" ? [["Group {g} · Final", { g: m.group }]] : [["Group {g} · Semifinal {n}", { g: m.group, n: m.id.endsWith("s2") ? 2 : 1 }]];
      return { id: m.id, round, bo: m.bo || 3, a: byId[m.a] || null, b: byId[m.b] || null, sa: res ? m.sa : null, sb: res ? m.sb : null, win: res ? (res.winner === m.a ? "a" : "b") : null };
    });
  }
  if (EVENTS.includes(event)) {
    const { slots, scores, bo } = data;
    const names = Object.fromEntries([...ROUNDS, THIRD].map((r) => [r.key, r.name]));
    return buildBracket(slots, scores, bo).matches.map((m) => {
      const played = m.winner != null && !m.bye;
      return { id: m.id, round: [[names[m.round] || "", {}]], bo: m.bo, a: m.a ? slots[m.a - 1] : null, b: m.b ? slots[m.b - 1] : null, sa: played ? m.sa : null, sb: played ? m.sb : null, win: played ? winSide(m) : null };
    });
  }
  const team = (n) => (n ? data.teams[n - 1] : null);
  if (event === "kickoff") {
    return buildKickoff(data.manual, data.scores).sections.flatMap((s) => s.rounds.flatMap((r) => r.matches.map((m) => ({
      id: m.id, round: [[r.name, {}]], bo: m.bo, a: team(m.a), b: team(m.b), sa: m.sa, sb: m.sb, win: winSide(m),
    }))));
  }
  if (REGIONS.includes(event)) {
    return buildRegional(data.manual, data.scores, event).stages.flatMap((st) => st.rounds.flatMap((r) => r.matches.map((m) => ({
      id: m.id, round: st.key === "po" ? [[r.name, {}]] : [[st.name, {}], [r.name, {}]], bo: m.bo, a: team(m.a), b: team(m.b), sa: m.sa, sb: m.sb, win: winSide(m),
    }))));
  }
  return [];
}

/** The data each event's page gets, from getState(). */
export function eventData(initial, event) {
  if (event === "playoffs") return { teams: initial.teams, matches: initial.matches };
  if (EVENTS.includes(event)) return initial.qualifiers[event];
  if (event === "kickoff") return initial.kickoff;
  if (REGIONS.includes(event)) return initial.regional[event];
  return null;
}

/** Sorts the matches of every event: being played, waiting for their score (their time has passed), and the next ones. */
export function editorAgenda(initial, now) {
  const all = TIME_EVENTS.flatMap((event) => matchesOf(event, eventData(initial, event)).map((m) => ({
    ...m, event, at: (initial.times && initial.times[event] && initial.times[event][m.id]) || "",
    live: !!(initial.live && initial.live[event] && initial.live[event][m.id]),
  }))).filter((m) => m.sa == null);
  const when = (m) => new Date(m.at).getTime();
  return {
    live: all.filter((m) => m.live),
    late: all.filter((m) => !m.live && m.at && when(m) <= now).sort((x, y) => x.at.localeCompare(y.at)),
    next: all.filter((m) => !m.live && m.at && when(m) > now).sort((x, y) => x.at.localeCompare(y.at)).slice(0, 5),
  };
}

/** Every match of every event, with its event name, time and live flag; a result ends "live". */
export function allMatches(state) {
  return TIME_EVENTS.flatMap((event) => matchesOf(event, eventData(state, event)).map((m) => ({
    ...m, event, at: (state.times && state.times[event] && state.times[event][m.id]) || "",
    live: !!(state.live && state.live[event] && state.live[event][m.id]) && m.sa == null,
  })));
}
