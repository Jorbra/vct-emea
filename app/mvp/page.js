import { cookies } from "next/headers";
import { MvpSeasonPage } from "../../components/Community17";
import { getDb } from "../../lib/db.js";
import { motmSeason } from "../../lib/fans.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "MVP du public · VCT EMEA", description: "Les joueurs les plus votés « joueur du match » par les visiteurs du site sur la saison." };

/** The season's man of the match votes. */
export default async function Page() {
  return <MvpSeasonPage list={motmSeason(getDb(), 30)} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
