import { cookies } from "next/headers";
import { QuizPage } from "../../components/Round6Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { quizPlayers, quizQuestions, quizRanking, weekOf, weeklyQuiz } from "../../lib/round6.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quiz de la semaine · VCT EMEA", description: "5 questions sur les matchs de la semaine passée. Un nouveau quiz chaque lundi." };

/** The quiz of the week: its questions without the answers, and the week's best. */
export default async function Page() {
  const db = getDb();
  const week = weekOf();
  return <QuizPage questions={quizQuestions(weeklyQuiz(getState(db), week))} ranking={quizRanking(db, week)} players={quizPlayers(db, week)} week={week} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
