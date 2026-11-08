import { cookies } from "next/headers";
import { PowerPage } from "../../components/Round6Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { powerRanking } from "../../lib/round6.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classement de puissance · VCT EMEA", description: "Les équipes classées par force, d'après tous leurs résultats de la saison." };

/** The teams by strength (Elo over every finished series). */
export default async function Page() {
  const rows = powerRanking(getState(getDb()));
  return <PowerPage rows={rows} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
