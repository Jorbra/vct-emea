import { cookies } from "next/headers";
import { AgentsPage } from "../../components/AgentPages";
import { agentsOverview, roleLeaders } from "../../lib/agentpage.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agents · VCT EMEA", description: "Les agents joués sur les tournois du VCT EMEA : taux de choix et victoires." };

export default async function Page() {
  return <AgentsPage list={agentsOverview()} leaders={roleLeaders()} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
