import { cookies } from "next/headers";
import Home from "../components/Home";
import { getDb, getState } from "../lib/db.js";
import { LANG_COOKIE, normLang } from "../lib/i18n.js";
import { workSoon } from "../lib/readsoon.js";
import { homeSpotlight } from "../lib/round13.js";
import { publicState } from "../lib/publicstate.js";

// Always read the database on request: results change while the event runs.
export const dynamic = "force-dynamic";

/** The home page: every VCT EMEA and Game Changers EMEA event, each linking to its own address. */
export default async function Page() {
  workSoon();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  const spot = await homeSpotlight().catch(() => []);
  // the players in form: their last 14 days against their season
  let form = [];
  // the season's podium: the three best ratings, 6 maps at least
  let podium = [];
  try { const { readDetails, tournamentStats } = await import("../lib/tstats.js"); const st = getState(getDb()); podium = tournamentStats(st, readDetails(getDb(), "")).players.filter((p) => p.maps >= 6 && p.r != null).sort((a, b) => b.r - a.r).slice(0, 3).map(({ slug, name, team, r, agents }) => ({ slug, name, team, r, agents: (agents || []).slice(0, 1) })); } catch { /* none */ }
  try { const { playersInForm } = await import("../lib/round10.js"); const { readDetails, tournamentStats } = await import("../lib/tstats.js"); const st = getState(getDb()); form = playersInForm(st, tournamentStats(st, readDetails(getDb(), "")), Date.now(), 6); } catch { /* none */ }
  return <Home initial={publicState(getState(getDb()))} spot={spot} form={form} podium={podium} lang={lang} />;
}
