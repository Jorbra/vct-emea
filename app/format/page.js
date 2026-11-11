import { cookies } from "next/headers";
import { FormatsPage } from "../../components/Round9Pages";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const metadata = { title: "Comment ça marche · VCT EMEA", description: "Les formats des qualifiers, des Qualifier Playoffs et du Kickoff EMEA, expliqués." };

export default async function Page() {
  return <FormatsPage lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
