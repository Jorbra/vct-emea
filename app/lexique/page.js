import { cookies } from "next/headers";
import Lexicon from "../../components/Lexicon";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const metadata = { title: "Lexique · VCT EMEA", description: "ACS, KAST, Bo3, veto, phase suisse… Les mots de l'esport VALORANT expliqués simplement." };

/** The words of VALORANT esports, explained. */
export default async function Page() {
  return <Lexicon lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
