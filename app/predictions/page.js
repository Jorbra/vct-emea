import { cookies } from "next/headers";
import { Predictions } from "../../components/CommunityPages";
import { openForPrediction, predictionRanking } from "../../lib/community.js";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { allMatches } from "../../lib/matchlist.js";
import { pickemBoards, pickemEvents } from "../../lib/pickem.js";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pronostics · VCT EMEA", description: "Choisis les vainqueurs des matchs du VCT EMEA et grimpe au classement." };

export default async function Page() {
  const db = getDb();
  const state = getState(db);
  const now = Date.now();
  const matches = allMatches(state).filter((m) => openForPrediction(m, now)).sort((a, b) => (a.at || "9").localeCompare(b.at || "9")).slice(0, 60);
  const events = pickemEvents(state, now);
  return <Predictions pickem={{ events, boards: pickemBoards(db, events) }} matches={matches} ranking={predictionRanking(db, state)} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
