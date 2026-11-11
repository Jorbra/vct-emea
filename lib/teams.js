// One team across every event: where it plays, its roster and all its matches. Pure: works from getState().
import { EVENTS } from "./bracket.js";
import { eventData, matchesOf } from "./matchlist.js";
import { teamSlug } from "./paths.js";

// Events in the order a team's page lists them (the season's order), and where their teams are.
export const TEAM_EVENTS = ["q1", "q2", "playoffs", "trq1", "trq2", "tr", "meq1", "meq2", "naq1", "naq2", "mena", "kickoff", "gc"];

export const eventTeamsOf = (initial, event) => teamsOf(initial, event);

function teamsOf(initial, event) {
  if (event === "playoffs") return initial.teams;
  if (EVENTS.includes(event)) return (initial.qualifiers[event] || { slots: [] }).slots.filter(Boolean);
  if (event === "kickoff") return initial.kickoff.teams;
  if (event === "tr" || event === "mena" || event === "gc") return initial.regional[event].teams;
  return [];
}

/** Every team playing on the site, once each (the richest card, as on its page). */
export function siteTeams(initial) {
  const seen = new Map();
  for (const event of TEAM_EVENTS) {
    for (const t of teamsOf(initial, event)) {
      if (!t || !t.name) continue;
      const key = teamSlug(t.name);
      const old = seen.get(key);
      if (!old || (!old.roster && t.roster) || (!old.logo && t.logo)) seen.set(key, { ...old, ...t });
    }
  }
  return [...seen.values()];
}

/**
 * One line per time at the team: someone who went inactive and left later has two lines on Liquipedia, the second starting the day the first ends.
 * list: the latest first, as read.
 */
export function mergeStints(list) {
  const out = [];
  for (const p of list || []) {
    // the later line of the same stay, if any: it starts when this one ends
    const later = out.find((x) => x.id === p.id && p.leave && x.join === p.leave);
    if (later) {
      later.join = p.join;
      later.role = p.role && p.role !== "Inactive" ? p.role : later.role === "Inactive" ? "" : later.role;
    } else out.push({ ...p });
  }
  return out;
}

/** People who left, by the year they left: [{ year ("" when unknown), people }], the latest year first and unknown dates last. */
export function byLeaveYear(list) {
  const years = new Map();
  for (const p of list || []) {
    const year = /^\d{4}/.test(p.leave || "") ? p.leave.slice(0, 4) : "";
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(p);
  }
  return [...years.entries()].sort(([a], [b]) => (!a ? 1 : !b ? -1 : b.localeCompare(a))).map(([year, people]) => ({ year, people }));
}

/**
 * The other teams of a team's organization, from all the saved Liquipedia information (data/team-info.json): the ones its page
 * lists, and the ones that list it. Each: { name, page, logo, logoDark, href }, href being its page here.
 */
export function orgOf(info, slug) {
  const me = info[slug];
  if (!me || !me.page) return [];
  const found = new Map((me.org || []).map((t) => [t.page, t]));
  for (const e of Object.values(info)) {
    if (e.page && e.page !== me.page && !found.has(e.page) && (e.org || []).some((t) => t.page === me.page)) found.set(e.page, { name: e.name, page: e.page, logo: "", logoDark: "" });
  }
  const keyOf = (page) => Object.keys(info).find((k) => info[k].page === page);
  return [...found.values()].filter((t) => t.page !== me.page).map((t) => {
    return { ...t, href: `/team/${keyOf(t.page) || teamSlug(t.name)}` };
  });
}

/**
 * The team whose name gives `slug`: { name, team (the richest card: Kickoff first, then the latest stages), events: [{ event,
 * team, matches (matchesOf items it plays), w, l, mw, ml }] }, or null when no event has it.
 */
export function teamProfile(initial, slug) {
  const events = [];
  for (const event of TEAM_EVENTS) {
    const team = teamsOf(initial, event).find((t) => t && t.name && teamSlug(t.name) === slug);
    if (!team) continue;
    const mine = (t) => !!(t && t.name && teamSlug(t.name) === slug);
    const matches = matchesOf(event, eventData(initial, event)).filter((m) => mine(m.a) || mine(m.b));
    const rec = { w: 0, l: 0, mw: 0, ml: 0 };
    for (const m of matches) {
      if (m.sa == null || m.sb == null) continue;
      const side = mine(m.a) ? "a" : "b";
      const [f, g] = side === "a" ? [m.sa, m.sb] : [m.sb, m.sa];
      rec.mw += f; rec.ml += g;
      if (m.win === side) rec.w++; else if (m.win) rec.l++;
    }
    events.push({ event, team, matches, ...rec });
  }
  if (!events.length) return null;
  const pick = ["kickoff", "playoffs", "tr", "mena", "gc", "trq2", "trq1", "meq2", "meq1", "naq2", "naq1", "q2", "q1"];
  const ranked = [...events].sort((x, y) => pick.indexOf(x.event) - pick.indexOf(y.event));
  const team = (ranked.find((e) => e.team.roster) || ranked[0]).team;
  return { name: team.name, team, events };
}
