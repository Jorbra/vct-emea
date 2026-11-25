import { cookies } from "next/headers";
import DayRecap from "../../components/DayRecap";
import { getDb, getState } from "../../lib/db.js";
import { dayRecapOf, parisDay, validDay } from "../../lib/dayrecap.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { allMatches } from "../../lib/matchlist.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Récap du jour · VCT EMEA", description: "Les résultats du jour, le joueur du jour, le MVP des fans et l'action marquante, en une carte à partager." };

/** The day's recap (?d=2026-11-24); without a date, today, or the last day with a result. */
export default async function Page({ searchParams }) {
  const db = getDb();
  const state = getState(db);
  const days = [...new Set(allMatches(state).filter((m) => m.a && m.b && m.sa != null && m.at).map((m) => parisDay(m.at)))].sort();
  const asked = (await searchParams)?.d;
  const today = parisDay(Date.now());
  const day = validDay(asked) ? asked : days.includes(today) ? today : days[days.length - 1] || today;
  const i = days.indexOf(day);
  const prev = i > 0 ? days[i - 1] : i < 0 ? [...days].reverse().find((d) => d < day) || "" : "";
  const next = i >= 0 && i < days.length - 1 ? days[i + 1] : i < 0 ? days.find((d) => d > day) || "" : "";
  return <DayRecap recap={await dayRecapOf(db, state, day)} prev={prev} next={next} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
