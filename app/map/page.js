import { cookies } from "next/headers";
import { MapsPage } from "../../components/AgentPages";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { mapsOverview } from "../../lib/mappage.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cartes · VCT EMEA", description: "Les cartes du VCT EMEA : les plus jouées, les agents choisis sur chacune." };

export default async function Page() {
  return <MapsPage list={mapsOverview()} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
