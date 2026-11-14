import { cookies } from "next/headers";
import SecondScreen from "../../../../components/SecondScreen";
import { getDb, getState } from "../../../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../../../lib/i18n.js";
import { overlayData } from "../../../../lib/overlay.js";
import { detailsOf } from "../../../../lib/tstats.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Écran secondaire · VCT EMEA", robots: { index: false } };

/** The second screen of a match: /ecran/q2/r16-1. */
export default async function Page({ params }) {
  const { event, id } = await params;
  const ok = /^[a-z0-9]{1,12}$/.test(event) && /^[a-z0-9-]{1,40}$/.test(id);
  const db = getDb();
  const initial = ok ? overlayData(getState(db), { match: `${event}:${id}`, details: (e, i) => detailsOf(db, e, i) }) : { match: null };
  if (initial.match && (initial.match.event !== event || initial.match.id !== id)) initial.match = null;
  return <SecondScreen initial={initial} event={event} id={id} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
