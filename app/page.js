import { cookies } from "next/headers";
import Home from "../components/Home";
import { getDb, getState } from "../lib/db.js";
import { LANG_COOKIE, normLang } from "../lib/i18n.js";
import { workSoon } from "../lib/readsoon.js";
import { homeSpotlight } from "../lib/round13.js";
import { publicState } from "../lib/publicstate.js";

// Always read the database on request: results change while the event runs.
export const dynamic = "force-dynamic";

/** The home page: every VCT EMEA and Game Changers EMEA event, each linking to its own address. */
export default async function Page() {
  workSoon();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  const spot = await homeSpotlight().catch(() => []);
  return <Home initial={publicState(getState(getDb()))} spot={spot} lang={lang} />;
}
