import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AgentPage } from "../../../components/AgentPages";
import { agentPage } from "../../../lib/agentpage.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const a = agentPage(decodeURIComponent((await params).name || ""));
  if (!a) return {};
  const description = `${a.name} sur les tournois du VCT EMEA : taux de choix, victoires, cartes et meilleurs joueurs.`;
  const image = `/api/og/agent/${a.key}`;
  return { title: `${a.name} · Agents · VCT EMEA`, description, openGraph: { title: `${a.name} · VCT EMEA`, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default async function Page({ params }) {
  const a = agentPage(decodeURIComponent((await params).name || ""));
  if (!a) notFound();
  return <AgentPage a={a} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
