import { cookies } from "next/headers";
import { AgentDuelPage } from "../../../components/AgentPages";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { agentPage, agentsOverview } from "../../../lib/agentpage.js";
import { agentDuel } from "../../../lib/round13.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duel d'agents · VCT EMEA", description: "Deux agents côte à côte : choix, victoires et cartes au VCT EMEA." };

/** Two agents side by side (/agent/duel?a=jett&b=raze). */
export default async function Page({ searchParams }) {
  const q = await searchParams;
  const a = String(q.a || "").slice(0, 20);
  const b = String(q.b || "").slice(0, 20);
  const duel = a && b ? agentDuel(agentPage(a), agentPage(b)) : null;
  return <AgentDuelPage duel={duel} all={agentsOverview()} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
