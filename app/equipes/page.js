import { cookies } from "next/headers";
import { TeamComparePage } from "../../components/Round9Pages";
import { findTeam } from "../../lib/discordbot.js";
import { getDb, getState } from "../../lib/db.js";
import { archivedPlayed, headToHeadAll, playedOf, poolOf, recentForm } from "../../lib/h2h.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { keepFor } from "../../lib/keep.js";
import { compareTeams } from "../../lib/playerstats.js";
import { siteTeams } from "../../lib/teams.js";
import { readDetails, tournamentStats } from "../../lib/tstats.js";
import { teamSlug } from "../../lib/paths.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparer des équipes · VCT EMEA", description: "Deux équipes face à face : forme, cartes, joueurs clés et confrontations sur toutes les saisons." };

/** Two teams side by side (/equipes?a=fnatic&b=karmine-corp). */
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const state = getState(getDb());
  const teams = siteTeams(state);
  const pick = (q) => (q ? findTeam(teams, String(q).replace(/-/g, " ").slice(0, 60)) : undefined);
  const a = pick(sp.a);
  const b = pick(sp.b);
  const c = a && b ? compareTeams(state, a, b) : null;
  if (c) {
    // each team's maps, from vlr.gg's tables, else from the site's own match details; their best players
    const ts = tournamentStats(state, readDetails(getDb(), "")).teams;
    const ta = ts[teamSlug(a.name)] || {}, tb = ts[teamSlug(b.name)] || {};
    c.pools = { a: ta.byMap || [], b: tb.byMap || [] };
    if (!c.pools.a.length && !c.pools.b.length) c.pools = { a: poolOf(c.mapsA), b: poolOf(c.mapsB), own: true };
    c.stars = { a: ta.best || [], b: tb.best || [] };
    // the archives change only when a season is archived: read once every 5 minutes
    const archives = await keepFor("h2h:archives", 300000, () => archivedPlayed(getDb()));
    const cur = playedOf(state);
    c.all = headToHeadAll(cur, archives, a, b);
    const every = [...cur, ...archives.flatMap((s) => s.matches)];
    c.form = { a: recentForm(every, a), b: recentForm(every, b) };
    delete c.mapsA; delete c.mapsB; // what the page does not show
  }
  const slim = (t) => (t ? { name: t.name, logo: t.logo || "", tag: t.tag || "" } : t === undefined ? undefined : null);
  return <TeamComparePage teams={teams.map((t) => t.name).sort((x, y) => x.localeCompare(y))} a={sp.a ? slim(a) || null : undefined} b={sp.b ? slim(b) || null : undefined} c={c} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
