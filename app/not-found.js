import { cookies } from "next/headers";
import NotFoundView from "../components/NotFoundView";
import { LANG_COOKIE, normLang } from "../lib/i18n.js";

export const metadata = { title: "Page introuvable · VCT EMEA" };

export default async function NotFound() {
  return <NotFoundView lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
