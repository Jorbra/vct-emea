import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MatchPage from "../../../../components/MatchPage";
import { getDb, getState } from "../../../../lib/db.js";
import { LANG_COOKIE, makeT, normLang } from "../../../../lib/i18n.js";
import { eventData, matchesOf } from "../../../../lib/matchlist.js";
import { EVENT_NAMES, siteHref } from "../../../../lib/paths.js";
import { TIME_EVENTS } from "../../../../lib/schedule.js";
import { scoreLabel } from "../../../../lib/scoretext.js";
import { workSoon } from "../../../../lib/readsoon.js";

export const dynamic = "force-dynamic";

function load(event, id) {
  if (!TIME_EVENTS.includes(event)) return null;
  const state = getState(getDb());
  const items = matchesOf(event, eventData(state, event));
  const m = items.find((x) => x.id === id);
  if (!m) return null;
  const e = {
    event, href: siteHref(event), items,
    times: (state.times && state.times[event]) || {}, live: (state.live && state.live[event]) || {},
    extra: (state.extra && state.extra[event]) || {}, stream: (state.info && state.info[event] && state.info[event].stream) || "",
  };
  return { state, e, m };
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
      <MatchPage e={e} id={id} state={data.state} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />
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
  const image = `/api/og/${event}/${id}`;
  return {
    title, description,
    openGraph: { siteName: "VCT EMEA", type: "website", title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
