import { cookies } from "next/headers";
import { RankingsPage } from "../../components/ExtraPages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { playerLeaders } from "../../lib/playerstats.js";
import { TIME_EVENTS } from "../../lib/schedule.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classements · VCT EMEA", description: "Les meilleurs joueurs des tournois du VCT EMEA." };

export default async function Page() {
  const state = getState(getDb());
  const byEvent = { "": playerLeaders(state) };
  for (const e of TIME_EVENTS) {
    const rows = playerLeaders(state, e);
    if (rows.length) byEvent[e] = rows;
  }
  return <RankingsPage byEvent={byEvent} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
