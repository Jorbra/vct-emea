// Every team, person and tournament that can have a page on this site: the lists of all Valorant teams and people, and whatever the
// saved Liquipedia information names. A page's name comes from here, so a visitor cannot make the site look up just anything. Pure.
import { teamSlug } from "./paths.js";

const LP = "https://liquipedia.net/valorant/";

/** A tournament's Liquipedia address as its key here ("VCT/2025/Champions"); "" for any other address. */
export function tournamentKey(url) {
  const u = String(url || "");
  if (!u.startsWith(LP)) return "";
  try {
    return decodeURIComponent(u.slice(LP.length));
  } catch {
    return u.slice(LP.length);
  }
}

/** Its name without what Liquipedia adds to tell people apart: "Cloud (Turkish player)" is a "Cloud". */
export const baseTitle = (title) => String(title || "").replace(/\s*\([^()]*\)\s*$/, "");

/**
 * { teams: { slug: { name, tag, logo } }, people: { slug: { name, cc, role, team } }, tournaments: { key: { name, logo, logoDark } } }.
 * lists: { teams: [[name, tag, logo]], players: { players: [[id, cc]], staff: [[id, cc]] } }.
 */
export function buildDirectory({ teamInfo = {}, playerInfo = {}, tournamentInfo = {}, searchFound = {}, lists = {} } = {}) {
  const teams = {};
  const people = {};
  const tournaments = {};
  const addTeam = (name, more = {}) => {
    const key = teamSlug(name);
    if (key && key !== "tbd" && !teams[key]) teams[key] = { name, tag: "", logo: "", ...more };
  };
  const addPerson = (name, more = {}) => {
    const key = teamSlug(name);
    if (!key || key === "tbd") return;
    const old = people[key] || { name, cc: "", role: "", team: "" };
    people[key] = { ...old, cc: old.cc || more.cc || "", role: old.role || more.role || "", team: old.team || more.team || "" };
  };
  const addResults = (results) => {
    for (const r of results || []) {
      if (r.teamName) addTeam(r.teamName, { logo: r.teamLogo || "" });
      if (r.opponentName) addTeam(r.opponentName, { logo: r.opponentLogo || "" });
      const key = tournamentKey(r.tournamentUrl);
      if (key && !tournaments[key]) tournaments[key] = { name: r.tournament, logo: r.tournamentLogo || "", logoDark: r.tournamentLogoDark || "" };
    }
  };
  for (const [name, tag, logo] of lists.teams || []) addTeam(name, { tag: tag || "", logo: logo || "" });
  for (const [id, cc] of (lists.players && lists.players.players) || []) addPerson(id, { cc });
  for (const [id, cc] of (lists.players && lists.players.staff) || []) addPerson(id, { cc });
  for (const e of Object.values(teamInfo)) {
    addTeam(e.name);
    for (const o of e.org || []) addTeam(o.name, { logo: o.logo || "" });
    for (const p of e.roster || []) addPerson(p.id, { cc: p.cc, team: e.name });
    for (const p of e.staff || []) addPerson(p.id, { cc: p.cc, role: p.role, team: e.name });
    // people who left: a page of their own, but this is no longer their team
    for (const p of [...(e.inactivePlayers || []), ...(e.formerPlayers || []), ...(e.formerStaff || [])]) {
      addPerson(p.id, { cc: p.cc });
      if (p.newTeamName) addTeam(p.newTeamName);
    }
    addResults(e.results);
  }
  for (const e of Object.values(playerInfo)) {
    if (e.page) addPerson(baseTitle(e.page));
    for (const h of e.history || []) addTeam(h.team);
    addResults(e.results);
  }
  for (const e of Object.values(tournamentInfo)) {
    for (const p of e.placements || []) addTeam(p.team, { logo: p.logo || "" });
  }
  // what the search bar found on Liquipedia and vlr.gg
  for (const t of Object.values(searchFound.teams || {})) addTeam(t.name);
  for (const p of Object.values(searchFound.people || {})) addPerson(p.name, { cc: p.cc });
  for (const [key, t] of Object.entries(searchFound.tournaments || {})) if (!tournaments[key]) tournaments[key] = { name: t.name, logo: "", logoDark: "" };
  return { teams, people, tournaments };
}

/** People who left, with the address of their new team when it has a page here (newTeamHref). */
export function linkFormer(list, dir) {
  return (list || []).map((p) => ({ ...p, newTeamHref: p.newTeamName && dir.teams[teamSlug(p.newTeamName)] ? `/team/${teamSlug(p.newTeamName)}` : "" }));
}

/** vlr.gg's information with links to the teams that have a page here (aHref, bHref). */
export function linkVlr(entry, dir) {
  if (!entry) return null;
  const href = (name) => (dir.teams[teamSlug(name)] ? `/team/${teamSlug(name)}` : "");
  return { ...entry, results: (entry.results || []).map((r) => ({ ...r, aHref: href(r.a), bHref: href(r.b) })) };
}

/** Results with the addresses of what has a page here: tournamentHref, teamHref, opponentHref ("" when there is none). */
export function linkResults(results, dir) {
  const href = (name) => (name && dir.teams[teamSlug(name)] ? `/team/${teamSlug(name)}` : "");
  return (results || []).map((r) => {
    const key = tournamentKey(r.tournamentUrl);
    return { ...r, tournamentHref: key ? `/tournament/${r.tournamentUrl.slice(LP.length)}` : "", teamHref: href(r.teamName), opponentHref: href(r.opponentName) };
  });
}
