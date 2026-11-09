import { cookies } from "next/headers";
import { CountriesPage } from "../../components/Round7Pages";
import { fantasyData } from "../../lib/gamedata.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { countryStats } from "../../lib/round7.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pays · VCT EMEA", description: "Les joueurs et les équipes de chaque pays sur les tournois du site." };

export default async function Page() {
  const { players } = await fantasyData();
  const list = countryStats(players).map((c) => ({ cc: c.cc, name: c.name, count: c.players.length, teams: c.teams.length, best: c.best, rating: c.rating }));
  return <CountriesPage list={list} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
