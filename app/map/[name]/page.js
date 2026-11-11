import { cookies } from "next/headers";
import MapPage from "../../../components/MapPage";
import { getDb, getState } from "../../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { workSoon } from "../../../lib/readsoon.js";
import { eventsWithDetails, extraStats, mapCard, readDetails } from "../../../lib/tstats.js";
import { topAgents } from "../../../lib/mappage.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const name = decodeURIComponent((await params).name || "");
  const shown = name.charAt(0).toUpperCase() + name.slice(1);
  return { title: `${shown} · Stats · VCT EMEA`, description: `${shown} au VCT EMEA : attaque et défense, équipes et joueurs les plus forts sur la carte.` };
}

/** One map (/map/lotus?e=q1): every event, or one. */
export default async function Page({ params, searchParams }) {
  workSoon();
  const name = decodeURIComponent((await params).name || "").slice(0, 30);
  const db = getDb();
  const events = eventsWithDetails(db);
  const asked = String((await searchParams).e || "");
  const event = events.includes(asked) ? asked : "";
  const entries = readDetails(db, event);
  const card = mapCard(getState(db), entries, name);
  if (card) card.comps = extraStats(getState(db), entries).mapComps[name.toLowerCase()] || [];
  return <MapPage card={card} name={name} top={topAgents(entries, name)} event={event} events={events} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
