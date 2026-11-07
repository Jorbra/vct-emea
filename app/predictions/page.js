import { cookies } from "next/headers";
import { Predictions } from "../../components/CommunityPages";
import { openForPrediction } from "../../lib/community.js";
import { groupInfo, seasonRanking } from "../../lib/fans.js";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { allMatches } from "../../lib/matchlist.js";
import { pickemBoards, pickemEvents } from "../../lib/pickem.js";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pronostics · VCT EMEA", description: "Choisis les vainqueurs des matchs du VCT EMEA et grimpe au classement." };

export default async function Page({ searchParams }) {
  const db = getDb();
  const g = groupInfo(db, String((await searchParams).g || ""));
  const state = getState(db);
  const now = Date.now();
  const matches = allMatches(state).filter((m) => openForPrediction(m, now)).sort((a, b) => (a.at || "9").localeCompare(b.at || "9")).slice(0, 60);
  const events = pickemEvents(state, now);
  const group = g ? { code: g.code, name: g.name, count: g.hashes.length, ranking: seasonRanking(db, state, { only: g.hashes, limit: 200, now }) } : null;
  return <Predictions group={group} pickem={{ events, boards: pickemBoards(db, events) }} matches={matches} ranking={seasonRanking(db, state, { now })} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
