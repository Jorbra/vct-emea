import { cookies } from "next/headers";
import WeekPage from "../../components/WeekPage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { allMatches } from "../../lib/matchlist.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ma semaine · VCT EMEA", description: "Tes pronostics et les résultats de tes équipes sur les 7 derniers jours." };

/** The visitor's week: the results of the last 7 days; their own picks and teams are read in the browser. */
export default async function Page() {
  const since = Date.now() - 7 * 86400000;
  const matches = allMatches(getState(getDb())).filter((m) => m.a && m.b && m.win && m.at && new Date(m.at).getTime() >= since)
    .sort((x, y) => y.at.localeCompare(x.at)).slice(0, 600)
    .map((m) => ({ event: m.event, id: m.id, at: m.at, a: { name: m.a.name, logo: m.a.logo, tag: m.a.tag }, b: { name: m.b.name, logo: m.b.logo, tag: m.b.tag }, sa: m.sa, sb: m.sb, win: m.win }));
  return <WeekPage matches={matches} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
