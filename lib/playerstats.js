// Players, MVPs and map statistics, from what the editor saves in each match's details. Pure: works from getState().
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";
import { siteTeams } from "./teams.js";
import { parseRoster, parseStaff } from "./tournament.js";

export const playerSlug = teamSlug;
export const playerHref = (name) => (teamSlug(name) ? `/player/${teamSlug(name)}` : "");

const detailsOf = (state, m) => (state.extra && state.extra[m.event] && state.extra[m.event][m.id]) || null;

/** Every match that has details, with them. */
const withDetails = (state) => allMatches(state).map((m) => ({ m, x: detailsOf(state, m) })).filter(({ x }) => x);

/** MVPs: [{ name, n }], most first. */
export function mvpRanking(state, event = "") {
  const count = new Map();
  for (const { m, x } of withDetails(state)) {
    if (!x.mvp || (event && m.event !== event)) continue;
    const k = teamSlug(x.mvp);
    count.set(k, { name: x.mvp, n: (count.get(k) ? count.get(k).n : 0) + 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/**
 * Per map: [{ map, played, picks, w, l, rf, ra }], the most played first. With `team` (its address name), that team's record on each
 * map; else all matches of `event` (or all of them), where w and l mean nothing.
 */
export function mapStats(state, { event = "", team = "" } = {}) {
  const out = new Map();
  for (const { m, x } of withDetails(state)) {
    if (event && m.event !== event) continue;
    const side = team ? (teamSlug(m.a && m.a.name) === team ? "a" : teamSlug(m.b && m.b.name) === team ? "b" : "") : "";
    if (team && !side) continue;
    for (const map of x.maps || []) {
      if (!map.map || map.a == null || map.b == null) continue; // a map not played yet
      const key = map.map.toLowerCase();
      const row = out.get(key) || { map: map.map, played: 0, picks: 0, w: 0, l: 0, rf: 0, ra: 0 };
      row.played += 1;
      if (side) {
        const [f, g] = side === "a" ? [map.a, map.b] : [map.b, map.a];
        row.rf += f; row.ra += g;
        if (f > g) row.w += 1; else if (g > f) row.l += 1;
        if (map.pick === side) row.picks += 1;
      }
      out.set(key, row);
    }
  }
  return [...out.values()].sort((a, b) => b.played - a.played || a.map.localeCompare(b.map));
}

/** Players' numbers over their matches: [{ name, matches, k, d, a, acs (average), kd }], the best average ACS first. */
export function playerLeaders(state, event = "") {
  const out = new Map();
  for (const { m, x } of withDetails(state)) {
    if (event && m.event !== event) continue;
    for (const p of x.pstats || []) {
      const key = teamSlug(p.name);
      const r = out.get(key) || { name: p.name, matches: 0, k: 0, d: 0, a: 0, sum: 0 };
      r.matches += 1; r.k += p.k; r.d += p.d; r.a += p.a; r.sum += p.acs;
      out.set(key, r);
    }
  }
  return [...out.values()].map(({ sum, ...r }) => ({ ...r, acs: Math.round(sum / r.matches), kd: r.d ? Math.round((r.k / r.d) * 100) / 100 : r.k }))
    .sort((a, b) => b.acs - a.acs || b.kd - a.kd);
}

/** The people the site knows: { slug: { name, realName, cc, team (name), captain, role (staff) } }, from its rosters and staff then Liquipedia's. */
export function playerIndex(state, info = {}) {
  const out = {};
  const add = (name, patch) => {
    const key = teamSlug(name);
    if (!key || key === "tbd") return;
    out[key] = { name: (out[key] && out[key].name) || name, ...patch, ...(out[key] || {}) };
  };
  for (const t of siteTeams(state)) {
    for (const p of parseRoster(t.roster)) add(p.name, { cc: p.cc, team: t.name, realName: "", sub: !!p.sub });
    const lp = info[teamSlug(t.name)];
    for (const p of (lp && lp.roster) || []) {
      const key = teamSlug(p.id);
      if (out[key]) { out[key].realName = out[key].realName || p.name; out[key].cc = out[key].cc || p.cc; out[key].join = p.join; out[key].captain = p.captain; }
      else add(p.id, { cc: p.cc, team: t.name, realName: p.name, join: p.join, captain: p.captain });
    }
  }
  // the staff after every player: someone who plays for one team and coaches another stays a player
  for (const t of siteTeams(state)) {
    for (const p of parseStaff(t.staff)) add(p.name, { cc: p.cc, team: t.name, realName: "", role: p.role === "assistant" ? "Assistant Coach" : "Coach" });
    const lp = info[teamSlug(t.name)];
    for (const p of (lp && lp.staff) || []) add(p.id, { cc: p.cc, team: t.name, realName: p.name, join: p.join, role: p.role });
  }
  return out;
}

/** Every player of the site, for looking them up on Liquipedia: [{ name, cc, team }]. */
export const sitePlayers = (state, info = {}) => Object.values(playerIndex(state, info)).map((p) => ({ name: p.name, cc: p.cc || "", team: p.team || "" }));

/** Whether a name typed in a match's details is a player of a team's roster, so that a link to the player's page works. */
export const knownPlayer = (state, name) => !!playerIndex(state)[teamSlug(name)];

/** Someone on no team of the site: what the matches say of them, and the matches of their team if it plays here. team: its address name, or "". */
export function outsiderProfile(state, slug, team = "") {
  const matches = team ? allMatches(state).filter((m) => teamSlug(m.a && m.a.name) === team || teamSlug(m.b && m.b.name) === team) : [];
  const mvps = withDetails(state).filter(({ x }) => x.mvp && teamSlug(x.mvp) === slug).map(({ m }) => m);
  const lines = withDetails(state).flatMap(({ m, x }) => (x.pstats || []).filter((s) => teamSlug(s.name) === slug).map((s) => ({ ...s, event: m.event, id: m.id, round: m.round, opponent: m.b && m.a ? (team && teamSlug(m.a.name) === team ? m.b : m.a) : null })));
  const totals = playerLeaders(state).find((r) => teamSlug(r.name) === slug) || null;
  return { matches, mvps, lines, totals };
}

/** A player's page: who, the team's matches, MVPs and numbers; null when the site does not know the player. */
export function playerProfile(state, info, slug) {
  const p = playerIndex(state, info)[slug];
  if (!p) return null;
  const team = teamSlug(p.team);
  const matches = allMatches(state).filter((m) => teamSlug(m.a && m.a.name) === team || teamSlug(m.b && m.b.name) === team);
  const mvps = withDetails(state).filter(({ x }) => x.mvp && teamSlug(x.mvp) === slug).map(({ m }) => m);
  const lines = withDetails(state).flatMap(({ m, x }) => (x.pstats || []).filter((s) => teamSlug(s.name) === slug).map((s) => ({ ...s, event: m.event, id: m.id, round: m.round, opponent: teamSlug(m.a && m.a.name) === team ? m.b : m.a })));
  const totals = playerLeaders(state).find((r) => teamSlug(r.name) === slug) || null;
  return { ...p, slug, teamSlug: team, matches, mvps, lines, totals };
}

/** Two teams side by side: the wins and maps of each over the whole site, and their earlier meetings (the current match left out). */
export function compareTeams(state, a, b, exceptId = "") {
  const A = teamSlug(a && a.name);
  const B = teamSlug(b && b.name);
  const all = allMatches(state).filter((m) => m.sa != null && m.sb != null);
  const record = (s) => {
    const r = { w: 0, l: 0, mw: 0, ml: 0 };
    for (const m of all) {
      const side = teamSlug(m.a && m.a.name) === s ? "a" : teamSlug(m.b && m.b.name) === s ? "b" : "";
      if (!side) continue;
      // a forfeit or a score in rounds wins the match, but no map was counted
      if (!m.note) {
        r.mw += side === "a" ? m.sa : m.sb;
        r.ml += side === "a" ? m.sb : m.sa;
      }
      if (m.win === side) r.w += 1; else r.l += 1;
    }
    return r;
  };
  const meetings = all.filter((m) => m.id !== exceptId && [teamSlug(m.a && m.a.name), teamSlug(m.b && m.b.name)].sort().join() === [A, B].sort().join());
  const h2h = { a: meetings.filter((m) => teamSlug(m.win === "a" ? m.a && m.a.name : m.b && m.b.name) === A).length, b: meetings.filter((m) => teamSlug(m.win === "a" ? m.a && m.a.name : m.b && m.b.name) === B).length };
  const list = meetings.map((m) => {
    const flip = teamSlug(m.a && m.a.name) !== A;
    return { event: m.event, id: m.id, at: m.at || "", round: m.round, sa: flip ? m.sb : m.sa, sb: flip ? m.sa : m.sb, won: (m.win === "a") !== flip ? "a" : "b", note: m.note || null };
  }).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  return { a: record(A), b: record(B), h2h, meetings: list, mapsA: mapStats(state, { team: A }), mapsB: mapStats(state, { team: B }) };
}
