import { cookies } from "next/headers";
import AccountPage from "../../components/AccountPage";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon compte · VCT EMEA", description: "Retrouve tes équipes favorites, tes pronostics et tes réglages sur tous tes appareils.", robots: { index: false } };

export default async function Page() {
  return <AccountPage lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
