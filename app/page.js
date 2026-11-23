import { cookies } from "next/headers";
import { after } from "next/server";
import Home from "../components/Home";
import { getDb, getState } from "../lib/db.js";
import { LANG_COOKIE, normLang } from "../lib/i18n.js";
import { workSoon } from "../lib/readsoon.js";
import { homeSpotlight } from "../lib/round13.js";
import { publicState } from "../lib/publicstate.js";

// Always read the database on request: results change while the event runs.
export const dynamic = "force-dynamic";

/**
 * The home page's blocks that go over the whole season (spotlight, players in form, podium, win chances): about
 * 5 seconds of work, for numbers that only move when a match ends. They are kept for a minute; once older, the next
 * visitor still gets them at once and they are worked out again right after that page is sent.
 */
const HOME_FOR = 60000;

async function computeHome() {
  const spot = await homeSpotlight().catch(() => []);
  // the power ratings of the teams in the coming matches, for their win chances
  let elo = {};
  try { const { ratings } = await import("../lib/r8data.js"); const { ratingsFor } = await import("../lib/proba26.js"); const { allMatches } = await import("../lib/matchlist.js"); elo = ratingsFor(ratings().rating, allMatches(getState(getDb())).filter((m) => m.sa == null && m.a && m.b)); } catch { /* none */ }
  // the season's podium (the three best ratings, 6 maps at least) and the players in form (their last maps against the ones before)
  let podium = [];
  let form = [];
  try {
    const { readDetails, tournamentStats } = await import("../lib/tstats.js");
    const { playersInForm } = await import("../lib/round10.js");
    const st = getState(getDb());
    const stats = tournamentStats(st, readDetails(getDb(), ""));
    podium = stats.players.filter((p) => p.maps >= 6 && p.r != null).sort((a, b) => b.r - a.r).slice(0, 3).map(({ slug, name, team, r, agents }) => ({ slug, name, team, r, agents: (agents || []).slice(0, 1) }));
    form = playersInForm(st, stats, Date.now(), 6);
  } catch { /* none */ }
  return { spot, elo, podium, form };
}

async function homeData() {
  const kept = globalThis.__homeData;
  if (kept && Date.now() - kept.at < HOME_FOR) return kept.data;
  if (kept) {
    // older than a minute: this visitor gets it now, the next ones get fresh numbers
    if (!kept.refreshing) {
      kept.refreshing = true;
      after(async () => {
        try { globalThis.__homeData = { at: Date.now(), data: await computeHome() }; } catch { kept.refreshing = false; }
      });
    }
    return kept.data;
  }
  const data = await computeHome();
  globalThis.__homeData = { at: Date.now(), data };
  return data;
}

/** The home page: every VCT EMEA and Game Changers EMEA event, each linking to its own address. */
export default async function Page() {
  workSoon();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  const { spot, elo, podium, form } = await homeData();
  return <Home initial={publicState(getState(getDb()))} spot={spot} form={form} podium={podium} elo={elo} lang={lang} />;
}
