import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CountryPage } from "../../../components/Round7Pages";
import { fantasyData } from "../../../lib/gamedata.js";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { countryName, countryStats } from "../../../lib/round7.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const cc = String((await params).cc || "").toLowerCase();
  return { title: `${countryName(cc)} · Pays · VCT EMEA`, description: `Les joueurs et les équipes de ${countryName(cc)} sur les tournois du site.` };
}

export default async function Page({ params }) {
  const cc = String((await params).cc || "").toLowerCase().slice(0, 8);
  const { players } = await fantasyData();
  const all = countryStats(players);
  const c = all.find((x) => x.cc === cc);
  if (!c) notFound();
  return <CountryPage c={c} rank={all.indexOf(c) + 1} of={all.length} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
