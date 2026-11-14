import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import TeamPage from "../../../components/TeamPage";
import { getDb, getState } from "../../../lib/db.js";
import { linkFormer, linkResults, linkVlr } from "../../../lib/directory.js";
import { readSoon } from "../../../lib/readsoon.js";
import { requestVlr, teamVlrId, vlrBlocked, vlrDue } from "../../../lib/vlrfetch.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { lpData } from "../../../lib/lpdata.js";
import { requestDue, requestFetch, teamOutdated, updateDue } from "../../../lib/teamfetch.js";
import { orgOf, teamProfile } from "../../../lib/teams.js";
import { sharedPreview, teamPreview } from "../../../lib/preview.js";
import { workSoon } from "../../../lib/readsoon.js";
import { extraStats, readDetails, tournamentStats } from "../../../lib/tstats.js";

// Always read the database on request: results change while the events run.
import { publicState } from "../../../lib/publicstate.js";

export const dynamic = "force-dynamic";

/**
 * A team's page (/team/navi-junior). One that plays on this site: roster, matches and season across every event. Any other team
 * known to Liquipedia: what Liquipedia says, read when the page is first opened.
 */
export default async function Page({ params, searchParams }) {
  workSoon();
  const { slug } = await params;
  const update = (await searchParams).maj === "1"; // opened from the search bar: read again now
  const key = String(slug || "").toLowerCase();
  const initial = getState(getDb());
  const p = teamProfile(initial, key);
  const { teamInfo, vlrInfo, searchFound, dir } = lpData();
  const vlrEntry = vlrInfo.teams && vlrInfo.teams[key];
  const onVlr = teamVlrId(key, teamInfo, { players: vlrInfo.players || {} }, searchFound);
  const vlrNow = !!onVlr && update && updateDue(vlrEntry) && !vlrBlocked(vlrInfo);
  if (onVlr && (vlrNow || vlrDue(vlrEntry))) requestVlr({ kind: "team", key, id: onVlr }, vlrNow);
  const entry = teamInfo[key];
  const known = dir.teams[key];
  if (!p && !entry && !known) notFound();
  const name = p ? p.name : known ? known.name : entry.name;
  const lpNow = (update && updateDue(entry)) || teamOutdated(entry); // old information: this page needs the former members now
  if (lpNow || requestDue(entry)) requestFetch({ kind: "team", name }, Date.now(), lpNow);
  readSoon();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  const lp = entry && entry.page
    ? { ...entry, results: linkResults(entry.results, dir), inactivePlayers: entry.inactivePlayers || [], formerPlayers: linkFormer(entry.formerPlayers, dir), formerStaff: linkFormer(entry.formerStaff, dir) }
    : null;
  const outside = p ? null : { name, tag: known ? known.tag : "", logo: known ? known.logo : "", pending: !entry };
  const entries = p ? readDetails(getDb()) : [];
  const tstats = p && tournamentStats(initial, entries).teams[key] ? { ...tournamentStats(initial, entries).teams[key], comps: extraStats(initial, entries).teamComps[key] || [] } : null;
  // each of its players' numbers, for the roster cards
  const rosterStats = p ? tournamentStats(initial, entries).players.filter((x) => x.team && x.team.toLowerCase() === p.name.toLowerCase()).map(({ slug, name, r, acs, kd, maps, agents }) => ({ slug, name, r, acs, kd, maps, agent: agents[0] ? agents[0].name : "" })) : [];
  return <TeamPage rosterStats={rosterStats} tstats={tstats} initial={p ? publicState(initial) : null} slug={key} lang={lang} lp={lp} org={orgOf(teamInfo, key)} outside={outside} vlr={linkVlr(vlrEntry, dir)} updating={!entry || lpNow || vlrNow} />;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const key = String(slug || "").toLowerCase();
  const p = teamProfile(getState(getDb()), key);
  if (p) return sharedPreview(teamPreview(p, normLang((await cookies()).get(LANG_COOKIE)?.value)));
  const known = lpData().dir.teams[key];
  return { title: known ? `${known.name} · VCT EMEA` : "VCT EMEA" };
}
