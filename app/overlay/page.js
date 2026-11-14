import { cookies } from "next/headers";
import StreamOverlay from "../../components/StreamOverlay";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { overlayData, overlayParams } from "../../lib/overlay.js";
import { detailsOf } from "../../lib/tstats.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overlay · VCT EMEA", robots: { index: false } };

/**
 * A browser source for OBS (1920×1080): /overlay?type=scoreboard|next|ticker|standby|result|maps, with event=, match=event:id,
 * theme=dark|light|glass, accent=rrggbb, pos=top|bottom, scale=, title=, until=HH:MM, lang=fr|en. Set them up on /overlay/studio.
 */
export default async function Page({ searchParams }) {
  const q = await searchParams;
  const p = overlayParams(q);
  const asked = typeof q.lang === "string" ? q.lang : "";
  const lang = normLang(asked || (await cookies()).get(LANG_COOKIE)?.value);
  const db = getDb();
  return <StreamOverlay initial={overlayData(getState(db), { event: p.event, match: p.match, details: (e, id) => detailsOf(db, e, id) })} p={p} lang={lang} />;
}
