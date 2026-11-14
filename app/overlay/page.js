import { cookies } from "next/headers";
import Overlay from "../../components/Overlay";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

import { publicState } from "../../lib/publicstate.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overlay · VCT EMEA", robots: { index: false } };

/** A browser source for OBS: /overlay, or /overlay?event=kickoff for one event. */
export default async function Page({ searchParams }) {
  const { event } = await searchParams;
  return <Overlay initial={publicState(getState(getDb()))} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} event={typeof event === "string" ? event : ""} />;
}
