import { cookies } from "next/headers";
import { HallOfFamePage } from "../../components/Round8Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { powerRanking } from "../../lib/round6.js";
import { seasonHonours } from "../../lib/round8.js";
import { getSeason, listSeasons } from "../../lib/seasons.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Palmarès · VCT EMEA", description: "Les vainqueurs, l'équipe la plus forte et le MVP de chaque saison." };

export default async function Page() {
  const db = getDb();
  const state = getState(db);
  const seasons = [{ key: "now", name: "Saison 2027", current: true, ...seasonHonours(state, powerRanking(state)) }];
  for (const s of listSeasons(db)) {
    const old = getSeason(db, s.slug);
    if (!old) continue;
    try { seasons.push({ key: s.slug, name: s.name, href: `/archives/${s.slug}`, ...seasonHonours(old.state, powerRanking(old.state)) }); } catch { /* an archive from an older shape */ }
  }
  return <HallOfFamePage seasons={seasons} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
