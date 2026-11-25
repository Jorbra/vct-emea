import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MatchPage from "../../../../components/MatchPage";
import { getDb, getState, liveDetail } from "../../../../lib/db.js";
import { LANG_COOKIE, makeT, normLang } from "../../../../lib/i18n.js";
import { eventData, matchesOf } from "../../../../lib/matchlist.js";
import { EVENT_NAMES, siteHref } from "../../../../lib/paths.js";
import { TIME_EVENTS } from "../../../../lib/schedule.js";
import { scoreLabel } from "../../../../lib/scoretext.js";
import { workSoon } from "../../../../lib/readsoon.js";
import { detailsOf, readDetails, tournamentStats } from "../../../../lib/tstats.js";
import { teamPercentiles } from "../../../../lib/radar25.js";
import { ratingsFor } from "../../../../lib/proba26.js";
import { ratings as r8ratings } from "../../../../lib/r8data.js";

import { publicState } from "../../../../lib/publicstate.js";
import { archivedPlayed, headToHeadAll, playedOf } from "../../../../lib/h2h.js";
import { keepFor } from "../../../../lib/keep.js";

export const dynamic = "force-dynamic";

function load(event, id) {
  if (!TIME_EVENTS.includes(event)) return null;
  const state = publicState(getState(getDb()));
  const items = matchesOf(event, eventData(state, event));
  const m = items.find((x) => x.id === id);
  if (!m) return null;
  const e = {
    event, href: siteHref(event), items,
    times: (state.times && state.times[event]) || {}, live: (state.live && state.live[event]) || {},
    extra: (state.extra && state.extra[event]) || {}, stream: (state.info && state.info[event] && state.info[event].stream) || "",
  };
  // being played: what vlr.gg tells of it (the map being played, its rounds, the players)
  if (e.live[id]) {
    const detail = liveDetail(getDb(), event, id);
    if (detail) e.live = { ...e.live, [id]: { ...(typeof e.live[id] === "object" ? e.live[id] : {}), detail } };
  }
  if (e.extra[id] && e.extra[id].hasDetails) e.extra = { ...e.extra, [id]: { ...e.extra[id], details: detailsOf(getDb(), event, id) } };
  return { state, e, m };
}

/** Both teams' radars for the match page, when both have 3 maps or more in vlr.gg's tables. */
function teamsRadar(m) {
  if (!m.a || !m.b || !m.a.name || !m.b.name) return null;
  try {
    const db = getDb();
    const st = tournamentStats(getState(db), readDetails(db, ""));
    const a = teamPercentiles(st, m.a.name), b = teamPercentiles(st, m.b.name);
    return a.length >= 3 && b.length >= 3 ? { a, b } : null;
  } catch { return null; }
}

/** Their meetings over every season, when the archives have some (this season's are on the match card already). */
async function h2hAll(m, state) {
  if (!(m.a && m.b && m.a.name && m.b.name)) return null;
  try {
    const archives = await keepFor("h2h:archives", 300000, () => archivedPlayed(getDb()));
    const h = headToHeadAll(playedOf(state), archives, m.a, m.b, { exceptId: m.id });
    return h.seasons.some((x) => x.slug) ? h : null;
  } catch { return null; }
}

/** A match's own page (/match/kickoff/u1-1): what its window shows, at an address that can be shared. */
export default async function Page({ params }) {
  workSoon();
  const { event, id } = await params;
  const data = load(event, id);
  if (!data) notFound();
  const { m, e } = data;
  const at = e.times[id];
  const name = `${(m.a && m.a.name) || "TBD"} vs ${(m.b && m.b.name) || "TBD"}`;
  // what search engines read about the match
  const ld = { "@context": "https://schema.org", "@type": "SportsEvent", name, sport: "VALORANT", ...(at ? { startDate: at } : {}), eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode", competitor: [m.a, m.b].filter((t) => t && t.name).map((t) => ({ "@type": "SportsTeam", name: t.name })), superEvent: { "@type": "SportsEvent", name: EVENT_NAMES[event] } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <MatchPage e={e} id={id} state={data.state} h2h={await h2hAll(m, data.state)} radar={teamsRadar(m)} rating={(() => { try { return ratingsFor(r8ratings().rating, [m]); } catch { return null; } })()} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />
    </>
  );
}

export async function generateMetadata({ params }) {
  const { event, id } = await params;
  const data = load(event, id);
  if (!data) return { title: "VCT EMEA" };
  const { m, e } = data;
  const tr = makeT(normLang((await cookies()).get(LANG_COOKIE)?.value));
  const a = (m.a && m.a.name) || tr("TBD");
  const b = (m.b && m.b.name) || tr("TBD");
  const score = m.sa != null && m.sb != null ? ` ${scoreLabel(m, tr)} ` : " vs ";
  const title = `${a}${score}${b} · VCT EMEA`;
  const description = [tr(EVENT_NAMES[event]), m.round.map(([k, v]) => tr(k, v)).join(" · "), m.bo ? `Bo${m.bo}` : "", e.times[id] ? new Date(e.times[id]).toUTCString().slice(0, 22) : ""].filter(Boolean).join(" · ");
  // the score in the address: a result shared again shows its new picture, not one a network kept from before
  const image = `/api/og/${event}/${id}${m.sa != null && m.sb != null ? `?s=${m.sa}-${m.sb}` : ""}`;
  return {
    title, description,
    openGraph: { siteName: "VCT EMEA", type: "website", title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
