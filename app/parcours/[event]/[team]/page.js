import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PathPage from "../../../../components/PathPage";
import { getDb, getState } from "../../../../lib/db.js";
import { LANG_COOKIE, makeT, normLang } from "../../../../lib/i18n.js";
import { eventData, matchesOf } from "../../../../lib/matchlist.js";
import { EVENT_NAMES, siteHref, teamSlug } from "../../../../lib/paths.js";
import { workSoon } from "../../../../lib/readsoon.js";
import { TIME_EVENTS } from "../../../../lib/schedule.js";

export const dynamic = "force-dynamic";

/** A team's matches in one event, from its side, in the order they are played. */
function load(event, slug) {
  if (!TIME_EVENTS.includes(event)) return null;
  const state = getState(getDb());
  const times = (state.times && state.times[event]) || {};
  const of = (t) => t && t.name && teamSlug(t.name) === slug;
  const rows = matchesOf(event, eventData(state, event)).filter((m) => of(m.a) || of(m.b)).map((m) => {
    const a = of(m.a);
    return {
      id: m.id, round: m.round, bo: m.bo, at: times[m.id] || "", opp: a ? m.b : m.a,
      sa: m.sa, note: m.note && m.note.kind === "raw" && !a ? { kind: "raw", a: m.note.b, b: m.note.a } : m.note || null, mine: a ? m.sa : m.sb, theirs: a ? m.sb : m.sa, won: m.win === (a ? "a" : "b"), team: a ? m.a : m.b,
    };
  });
  return rows.length ? { rows, team: rows[0].team } : null;
}

export default async function Page({ params }) {
  workSoon();
  const { event, team: slug } = await params;
  const data = load(event, slug);
  if (!data) notFound();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  return <PathPage lang={lang} event={event} href={siteHref(event)} team={data.team} rows={data.rows.map(({ team, ...r }) => r)} slug={slug} />;
}

export async function generateMetadata({ params }) {
  const { event, team: slug } = await params;
  const data = load(event, slug);
  if (!data) return { title: "VCT EMEA" };
  const tr = makeT(normLang((await cookies()).get(LANG_COOKIE)?.value));
  const title = `${tr("{team}'s run", { team: data.team.name })} · ${tr(EVENT_NAMES[event])}`;
  const played = data.rows.filter((m) => m.sa != null);
  const description = `${played.filter((m) => m.won).length} – ${played.filter((m) => !m.won).length}, ${tr(EVENT_NAMES[event])}`;
  return { title, description, openGraph: { siteName: "VCT EMEA", type: "website", title, description }, twitter: { card: "summary", title, description } };
}
