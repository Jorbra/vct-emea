// Round 17: the season as a timeline, lane by lane (Europe, Türkiye, MENA, then the Kickoff and Game Changers): each event's
// dates, where it stands and the teams it sent on. Pure: works from getState().
import { EVENT_NAMES } from "./paths.js";
import { eventStatus } from "./status.js";
import { qualifiedTeams } from "./r9pure.js";

export const LANES = [
  ["Europe", ["q1", "q2", "playoffs"]],
  ["Türkiye", ["trq1", "trq2", "tr"]],
  ["MENA", ["meq1", "meq2", "naq1", "naq2", "mena"]],
  ["Kickoff", ["kickoff"]],
  ["Game Changers", ["gc"]],
];

export function seasonTimeline(state) {
  const st = eventStatus(state);
  const qual = qualifiedTeams(state);
  return LANES.map(([lane, events]) => ({
    lane,
    events: events.filter((e) => EVENT_NAMES[e]).map((e) => ({
      event: e, name: EVENT_NAMES[e], state: (st[e] && st[e].state) || "upcoming", info: (state.info && state.info[e]) || null,
      teams: (st[e] && st[e].teams) || 0, of: (st[e] && st[e].of) || 0,
      qualified: qual.filter((q) => q.event === e).map((q) => ({ team: q.team, slug: q.slug, logo: q.logo })),
    })),
  }));
}
