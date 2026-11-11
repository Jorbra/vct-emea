import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PlayerPage from "../../../components/PlayerPage";
import { getDb, getState } from "../../../lib/db.js";
import { baseTitle, linkResults, linkVlr } from "../../../lib/directory.js";
import { readSoon } from "../../../lib/readsoon.js";
import { requestVlr, vlrBlocked, vlrDue } from "../../../lib/vlrfetch.js";
import { vlrId } from "../../../lib/vlrinfo.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { lpData } from "../../../lib/lpdata.js";
import { teamSlug } from "../../../lib/paths.js";
import { outsiderProfile, playerProfile } from "../../../lib/playerstats.js";
import { similarPlayers } from "../../../lib/round11.js";
import { sharedPreview } from "../../../lib/preview.js";
import { requestDue, requestFetch, updateDue } from "../../../lib/teamfetch.js";
import { siteTeams } from "../../../lib/teams.js";
import { playerTournament, readDetails, tournamentStats } from "../../../lib/tstats.js";

export const dynamic = "force-dynamic";

/** What Liquipedia says about the person, with links to the pages of this site; null without a page. */
function liquipediaPerson(entry, dir) {
  if (!entry || !entry.page) return null;
  return {
    ...entry,
    history: entry.history.map((h) => ({ ...h, href: dir.teams[teamSlug(h.team)] ? `/team/${teamSlug(h.team)}` : "" })),
    results: linkResults(entry.results, dir),
  };
}

/** update: opened from the search bar, so read again now. */
function load(slug, update = false) {
  const state = getState(getDb());
  const key = String(slug || "").toLowerCase();
  const { teamInfo, playerInfo, vlrInfo, searchFound, dir } = lpData();
  const site = playerProfile(state, teamInfo, key);
  const entry = playerInfo[key];
  const known = dir.people[key];
  if (!site && !entry && !known) return null; // nobody by that name: nothing to look up
  const lp = liquipediaPerson(entry, dir);
  const name = site ? site.name : known ? known.name : entry.page ? baseTitle(entry.page) : entry.name;
  const cc = (site && site.cc) || (known && known.cc) || "";
  // someone who is on no team of this site: the team Liquipedia gives, when it has a page here
  const otherTeam = (lp && lp.team && dir.teams[teamSlug(lp.team)] ? lp.team : "") || (known && known.team) || "";
  const lpNow = update && updateDue(entry);
  if (lpNow || requestDue(entry)) requestFetch({ kind: "person", name, cc, team: site ? site.team : (known && known.team) || "" }, Date.now(), lpNow);
  const vlrEntry = vlrInfo.players && vlrInfo.players[key];
  // the profile Liquipedia links to; only without one, what a search on vlr.gg found under this name
  const onVlr = (lp ? vlrId(lp.links, "player") : "") || (searchFound.people && searchFound.people[key] && searchFound.people[key].vlrId) || "";
  const vlrNow = !!onVlr && update && updateDue(vlrEntry) && !vlrBlocked(vlrInfo);
  if (onVlr && (vlrNow || vlrDue(vlrEntry))) requestVlr({ kind: "player", key, id: onVlr }, vlrNow);
  const person = site || { name, cc, role: (known && known.role) || "", team: otherTeam, teamSlug: teamSlug(otherTeam), realName: "", slug: key, ...outsiderProfile(state, key, teamSlug(otherTeam)) };
  const t = siteTeams(state).find((x) => teamSlug(x.name) === person.teamSlug);
  return {
    ...person, onSite: !!site, cc: person.cc || (lp && lp.nationality[0] ? lp.nationality[0].cc : ""),
    realName: person.realName || (lp ? lp.name : ""),
    teamLogo: t ? t.logo : (dir.teams[person.teamSlug] || {}).logo || "", teamTag: t ? t.tag : "", teamOnSite: !!t,
    tour: playerTournament(tournamentStats(state, readDetails(getDb())), key),
    // the players with the closest numbers
    similar: similarPlayers(tournamentStats(state, readDetails(getDb())).players, key),
    // the spread of each number among the players of the site's events, for the radar
    ranges: (() => {
      const pool = tournamentStats(state, readDetails(getDb())).players.filter((x) => x.maps >= 4);
      const span = (k) => { const v = pool.map((x) => x[k]).filter((x) => x != null); return v.length >= 5 ? [Math.min(...v), Math.max(...v)] : null; };
      return Object.fromEntries(["r", "acs", "kd", "kast", "adr", "hs"].map((k) => [k, span(k)]));
    })(),
    lp, lpState: lp ? "ready" : entry ? "none" : "pending", vlr: linkVlr(vlrEntry, dir), updating: !!entry && (lpNow || vlrNow),
  };
}

/** A person's page (/player/derke): team, numbers, matches and what Liquipedia says. Everyone can have one: players, coaches, staff. */
export default async function Page({ params, searchParams }) {
  const { slug } = await params;
  const profile = load(slug, (await searchParams).maj === "1");
  if (!profile) notFound();
  readSoon();
  return <PlayerPage profile={profile} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = load(slug);
  if (!p) return { title: "VCT EMEA" };
  return sharedPreview({ title: [p.name, p.team, "VCT EMEA"].filter(Boolean).join(" · "), description: [p.realName, p.team].filter(Boolean).join(" · "), image: p.teamOnSite && p.teamLogo ? p.teamLogo : "/brand/emea-icon.png" });
}
