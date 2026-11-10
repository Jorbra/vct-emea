import { cookies } from "next/headers";
import { TierlistPage } from "../../components/Round8Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { tierTeams } from "../../lib/round8.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tier list · VCT EMEA", description: "Classe les équipes EMEA de S à D, partage ta tier list et compare-la à celle de la communauté." };

export default async function Page() {
  return <TierlistPage teams={tierTeams(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
