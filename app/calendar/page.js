import { cookies } from "next/headers";
import CalendarPage from "../../components/CalendarPage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { workSoon } from "../../lib/readsoon.js";

import { publicState } from "../../lib/publicstate.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendrier · VCT EMEA", description: "Tous les matchs du VCT EMEA et des Game Changers EMEA, jour par jour." };

export default async function Page() {
  workSoon();
  return <CalendarPage initial={publicState(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
