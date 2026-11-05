import { cookies } from "next/headers";
import Home from "../components/Home";
import { getDb, getState } from "../lib/db.js";
import { LANG_COOKIE, normLang } from "../lib/i18n.js";
import { workSoon } from "../lib/readsoon.js";

// Always read the database on request: results change while the event runs.
export const dynamic = "force-dynamic";

/** The home page: every VCT EMEA and Game Changers EMEA event, each linking to its own address. */
export default async function Page() {
  workSoon();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  return <Home initial={getState(getDb())} lang={lang} />;
}
