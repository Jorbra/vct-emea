import { cookies } from "next/headers";
import { SimulatorPage } from "../../components/Round8Pages";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { EVENT_NAMES } from "../../lib/paths.js";
import { simEvents } from "../../lib/round8.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulateur de qualification · VCT EMEA", description: "Les chances de chaque équipe de se qualifier, et ce qui change avec tes pronostics." };

export default async function Page() {
  const events = simEvents(getState(getDb())).map((e) => ({ event: e, name: EVENT_NAMES[e] || e }));
  return <SimulatorPage events={events} first={events.length ? events[events.length - 1].event : ""} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
