import { cookies } from "next/headers";
import CalendarPage from "../../components/CalendarPage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier · VCT EMEA", description: "Tous les matchs du VCT EMEA et des Game Changers EMEA, jour par jour." };

export default async function Page() {
  return <CalendarPage initial={getState(getDb())} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
