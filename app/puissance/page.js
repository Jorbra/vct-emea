import { cookies } from "next/headers";
import { PowerPage } from "../../components/Round6Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { powerRanking } from "../../lib/round6.js";
import { siteStreaks } from "../../lib/streaks.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classement de puissance · VCT EMEA", description: "Les équipes classées par force, d'après tous leurs résultats de la saison." };

/** The teams by strength (Elo over every finished series). */
export default async function Page() {
  const state = getState(getDb());
  const rows = powerRanking(state);
  const all = siteStreaks(state);
  const streaks = { hot: all.filter((s) => s.kind === "W" && s.n >= 3).slice(0, 8), cold: all.filter((s) => s.kind === "L" && s.n >= 3).sort((a, b) => b.n - a.n).slice(0, 5) };
  return <PowerPage rows={rows} streaks={streaks} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
