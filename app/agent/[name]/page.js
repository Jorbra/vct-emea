import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AgentPage } from "../../../components/AgentPages";
import { agentPage } from "../../../lib/agentpage.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const a = agentPage(decodeURIComponent((await params).name || ""));
  return a ? { title: `${a.name} · Agents · VCT EMEA`, description: `${a.name} sur les tournois du VCT EMEA : taux de choix, victoires, cartes et meilleurs joueurs.` } : {};
}

export default async function Page({ params }) {
  const a = agentPage(decodeURIComponent((await params).name || ""));
  if (!a) notFound();
  return <AgentPage a={a} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
