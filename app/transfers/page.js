import { cookies } from "next/headers";
import { TransfersPage } from "../../components/ExtraPages";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { lpData } from "../../lib/lpdata.js";
import { teamSlug } from "../../lib/paths.js";
import { transfers } from "../../lib/transfers.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transferts · VCT EMEA", description: "Arrivées et départs des équipes du VCT EMEA." };

export default async function Page() {
  const { teamInfo, dir } = lpData();
  const list = transfers(teamInfo).map((t) => ({ ...t, toHref: t.toName && dir.teams[teamSlug(t.toName)] ? `/team/${teamSlug(t.toName)}` : "" }));
  return <TransfersPage list={list} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
