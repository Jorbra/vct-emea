import { cookies } from "next/headers";
import { SeasonPage } from "../../components/Round11Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { seasonFeed } from "../../lib/round11.js";
import { readTeamInfo } from "../../lib/teamfetch.js";
import { transfers } from "../../lib/transfers.js";
import { seasonTimeline } from "../../lib/season17.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Le fil de la saison · VCT EMEA", description: "Tout ce qui s'est passé cette saison, dans l'ordre : résultats, qualifications, transferts." };

export default async function Page() {
  const state = getState(getDb());
  return <SeasonPage feed={seasonFeed(state, transfers(readTeamInfo(), 80))} timeline={seasonTimeline(state)} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
