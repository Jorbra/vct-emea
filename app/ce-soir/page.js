import { cookies } from "next/headers";
import Tonight from "../../components/Tonight";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { nightMatches } from "../../lib/night.js";
import { workSoon } from "../../lib/readsoon.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ce soir · VCT EMEA", description: "Tous les matchs du jour sur un seul écran : le stream du match en cours et les scores en direct." };

/** Today's matches of every event on one screen, with the stream of the one being played. */
export default async function Page() {
  workSoon();
  return <Tonight matches={nightMatches(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
