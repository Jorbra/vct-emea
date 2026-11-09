import { cookies } from "next/headers";
import GamesPage from "../../components/GamesPage";
import { getDb } from "../../lib/db.js";
import { GAMES, dailyPlayers, dailyRanking, dayOf } from "../../lib/games.js";
import { gameData } from "../../lib/gamedata.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jeux du jour · VCT EMEA", description: "Joueur mystère, plus ou moins, logo mystère : trois jeux Valorant EMEA, nouveaux chaque jour." };

/** The daily games: what can be guessed (names only), the day's best and how many played. */
export default async function Page() {
  const db = getDb();
  const day = dayOf();
  const data = gameData(day);
  const available = GAMES.filter((g) => data.puzzles[g]);
  return (
    <GamesPage
      day={day} available={available}
      players={data.players.map((p) => p.name).sort((a, b) => a.localeCompare(b))} teams={data.teams}
      rankings={Object.fromEntries(available.map((g) => [g, dailyRanking(db, g, day)]))} counts={dailyPlayers(db, day)}
      lang={normLang((await cookies()).get(LANG_COOKIE)?.value)}
    />
  );
}
