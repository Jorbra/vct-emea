import { cookies } from "next/headers";
import { AboutPage } from "../../components/ExtraPages";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "À propos · VCT EMEA", description: "Un site de fan, non officiel : d'où viennent les informations et quelles données sont gardées." };

export default async function Page() {
  return <AboutPage lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
