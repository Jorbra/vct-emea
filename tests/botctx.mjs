// A bot context for the tests: the same shape as app/api/discord/route.js gives, from a state.
import { siteTeams } from "../lib/teams.js";
import { sitePlayers } from "../lib/playerstats.js";
import { openForPrediction } from "../lib/community.js";
import { siteHref } from "../lib/paths.js";

export const cmd = (name, options = {}, extra = {}) => ({ type: 2, data: { name, options: Object.entries(options).map(([n, value]) => ({ name: n, value, ...(extra.focused === n ? { focused: true } : {}) })) } });

export function botCtx(state, more = {}) {
  const now = Date.now();
  return {
    lang: "fr", now, site: "https://site.test", state: () => state,
    teams: () => siteTeams(state), players: () => sitePlayers(state),
    stats: () => ({ players: [{ slug: "alpha", name: "Alpha", team: "Team 1", maps: 6, r: 1.3, acs: 260, kd: 1.4, kast: 75, adr: 160, hs: 28, k: 120, d: 80, a: 30, fk: 10, agents: [{ name: "jett", n: 6 }] }, { slug: "beta", name: "Beta", team: "Team 2", maps: 5, r: 1.1, acs: 290, kd: 1.1, kast: 70, adr: 150, hs: 22, k: 100, d: 90, a: 20, fk: 6, agents: [] }] }),
    teamInfo: () => null, ranking: () => [], recap: () => null, eventHref: (e) => siteHref(e),
    isOpen: (m) => openForPrediction(m, now), mvp: () => "", lft: () => [{ name: "Free", cc: "fr", date: "2026-11-01", from: "Fnatic", role: "", staff: false }],
    ...more,
  };
}
