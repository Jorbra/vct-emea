import { cookies } from "next/headers";
import { RivalriesPage } from "../../components/Round8Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { rivalries } from "../../lib/round8.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rivalités · VCT EMEA", description: "Les équipes qui se sont le plus affrontées cette saison." };

export default async function Page() {
  return <RivalriesPage list={rivalries(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
