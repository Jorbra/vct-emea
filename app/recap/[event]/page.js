import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RecapPage from "../../../components/RecapPage";
import { getDb, getState } from "../../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { EVENT_NAMES } from "../../../lib/paths.js";
import { workSoon } from "../../../lib/readsoon.js";
import { recapOf } from "../../../lib/recap.js";
import { readDetails } from "../../../lib/tstats.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { event } = await params;
  const name = EVENT_NAMES[event] || "";
  return { title: `Récap ${name} · VCT EMEA`, description: `Les qualifiés, leur parcours, les meilleurs joueurs et les matchs les plus serrés du ${name}.` };
}

/** A qualifier's recap (/recap/q1). */
export default async function Page({ params }) {
  workSoon();
  const { event } = await params;
  if (!EVENT_NAMES[event]) notFound();
  const db = getDb();
  const recap = recapOf(getState(db), readDetails(db, event), event);
  if (!recap) notFound();
  return <RecapPage recap={recap} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
