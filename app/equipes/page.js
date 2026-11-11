import { cookies } from "next/headers";
import { TeamComparePage } from "../../components/Round9Pages";
import { findTeam } from "../../lib/discordbot.js";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { compareTeams } from "../../lib/playerstats.js";
import { siteTeams } from "../../lib/teams.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparer des équipes · VCT EMEA", description: "Deux équipes face à face : bilan, cartes et confrontations." };

/** Two teams side by side (/equipes?a=fnatic&b=karmine-corp). */
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const state = getState(getDb());
  const teams = siteTeams(state);
  const pick = (q) => (q ? findTeam(teams, String(q).replace(/-/g, " ").slice(0, 60)) : undefined);
  const a = pick(sp.a);
  const b = pick(sp.b);
  const c = a && b ? compareTeams(state, a, b) : null;
  const slim = (t) => (t ? { name: t.name, logo: t.logo || "", tag: t.tag || "" } : t === undefined ? undefined : null);
  return <TeamComparePage teams={teams.map((t) => t.name).sort((x, y) => x.localeCompare(y))} a={sp.a ? slim(a) || null : undefined} b={sp.b ? slim(b) || null : undefined} c={c} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
