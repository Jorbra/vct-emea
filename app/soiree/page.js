import { cookies } from "next/headers";
import MatchNight from "../../components/MatchNight";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { nightMatches } from "../../lib/night.js";
import { workSoon } from "../../lib/readsoon.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Soirée de match · VCT EMEA", description: "Tous les matchs du jour en grille, mis à jour en direct." };

export default async function Page() {
  workSoon();
  return <MatchNight matches={nightMatches(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
