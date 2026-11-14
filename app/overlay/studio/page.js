import { cookies, headers } from "next/headers";
import OverlayStudio from "../../../components/OverlayStudio";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overlays de stream · VCT EMEA", description: "Des overlays OBS pour ton stream du VCT EMEA : score, prochain match, bandeau, écran d'attente, résultat, cartes.", robots: { index: false } };

/** Setting up the stream overlays. */
export default async function Page() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "vct-emea.vercel.app";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return <OverlayStudio base={`${proto}://${host}`} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
