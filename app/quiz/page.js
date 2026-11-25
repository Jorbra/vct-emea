import { cookies } from "next/headers";
import { QuizPage } from "../../components/Round6Pages";
import { getDb, getState } from "../../lib/db.js";
import { dailyQuiz, streakRanking } from "../../lib/dailyquiz.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { quizPlayers, quizQuestions, quizRanking, weekOf, weeklyQuiz } from "../../lib/round6.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quiz · VCT EMEA", description: "Le quiz du jour (3 questions, une série à tenir) et le quiz de la semaine sur les matchs du VCT EMEA." };

/** The quiz of the day and the quiz of the week: their questions without the answers, and the best players. */
export default async function Page() {
  const db = getDb();
  const state = getState(db);
  const week = weekOf();
  const daily = { questions: quizQuestions(dailyQuiz(state)), ranking: streakRanking(db) };
  return <QuizPage questions={quizQuestions(weeklyQuiz(state, week))} ranking={quizRanking(db, week)} players={quizPlayers(db, week)} week={week} daily={daily} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
