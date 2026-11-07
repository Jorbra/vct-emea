import { cookies } from "next/headers";
import LivePage from "../../components/LivePage";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { allMatches } from "../../lib/matchlist.js";
import { workSoon } from "../../lib/readsoon.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "En direct · VCT EMEA", description: "Les matchs du VCT EMEA en cours, avec leur stream." };

export default async function Page() {
  workSoon();
  const state = getState(getDb());
  const now = Date.now();
  const streamOf = (m) => ((state.extra[m.event] || {})[m.id] || {}).stream || (state.info && state.info[m.event] && state.info[m.event].stream) || "";
  const slim = (m) => {
    const s = m.live ? (state.live[m.event] || {})[m.id] || null : null;
    // the page shows the maps, not the feed
    return { event: m.event, id: m.id, round: m.round, at: m.at, live: m.live, a: m.a, b: m.b, stream: streamOf(m), score: s ? { a: s.a, b: s.b, maps: s.maps || [] } : null };
  };
  const all = allMatches(state);
  const live = all.filter((m) => m.live).map(slim);
  const next = all.filter((m) => !m.live && m.sa == null && m.at && new Date(m.at).getTime() > now).sort((x, y) => x.at.localeCompare(y.at)).slice(0, 6).map(slim);
  return <LivePage live={live} next={next} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}
