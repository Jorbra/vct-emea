import { cookies } from "next/headers";
import { SearchPage } from "../../components/Round11Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { MIN_QUERY, searchAll, searchIndex } from "../../lib/search.js";
import { readTeamInfo } from "../../lib/teamfetch.js";
import VALORANT_PLAYERS from "../../lib/valorant-players.json";
import VALORANT_TEAMS from "../../lib/valorant-teams.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recherche · VCT EMEA", description: "Équipes, joueurs, matchs et tournois du VCT EMEA." };

export default async function Page({ searchParams }) {
  const q = String((await searchParams).q || "").slice(0, 60);
  const found = q.trim().length >= MIN_QUERY ? searchAll(searchIndex(getState(getDb()), readTeamInfo(), { teams: VALORANT_TEAMS, players: VALORANT_PLAYERS }), q) : null;
  return <SearchPage q={q} found={found} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
