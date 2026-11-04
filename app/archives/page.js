import { cookies } from "next/headers";
import ArchivesList from "../../components/ArchivesList";
import { getDb } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { listSeasons } from "../../lib/seasons.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Archives · VCT EMEA", description: "Les saisons précédentes du VCT EMEA." };

export default async function Page() {
  return <ArchivesList seasons={listSeasons(getDb())} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
