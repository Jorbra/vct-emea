import { cookies } from "next/headers";
import { readItems } from "../../lib/lpstore.js";
import { ACCOUNT_COOKIE, countAccounts, listRoles, readAccountToken } from "../../lib/accounts.js";
import { notFound, redirect } from "next/navigation";
import Admin from "../../components/Admin";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { adminHref, parseAdminPath } from "../../lib/paths.js";
import { currentEditor } from "../../lib/session.js";
import { rosterDiffs } from "../../lib/rosterdiff.js";
import { readTeamInfo } from "../../lib/teamfetch.js";
import { listEditors } from "../../lib/editors.js";
import { listSeasons } from "../../lib/seasons.js";
import { listNews, listVoters } from "../../lib/community.js";
import { lastAction, listHistory } from "../../lib/undo.js";
import { healthReport } from "../../lib/health.js";
import { latestComments, visitReport } from "../../lib/social.js";
import { activityReport, readBanner } from "../../lib/round6.js";
import { listClaims, newsDrafts } from "../../lib/round7.js";
import { dayBoard, listPolls, listScheduledScores } from "../../lib/round8.js";
import { recapOf } from "../../lib/recap.js";
import { readDetails } from "../../lib/tstats.js";
import { eventChecklist, listSteps } from "../../lib/more.js";
import { editorR14 } from "../../lib/round14.js";
import { sourcesReport } from "../../lib/sourcesreport.js";
import { dayOf } from "../../lib/games.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editor · VCT EMEA" };

export default async function Page({ params }) {
  const { slug = [] } = await params;
  const path = "/admin" + (slug.length ? "/" + slug.join("/") : "");
  const start = parseAdminPath(path);
  if (!start) notFound();
  // "/admin" and short or old addresses go on to the full one (/admin/vctemea/eu/qualifier-1...).
  const href = adminHref(start);
  if (path !== href) redirect(href);
  const me = await currentEditor();
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  // Nothing from the database is sent to someone who is not signed in.
  const db = getDb();
  const state = me ? getState(db) : null;
  const initial = me ? { ...state, admin: { steps: listSteps(db), checklist: eventChecklist(state), health: healthReport(db), visits: visitReport(db), activity: activityReport(db), banner: readBanner(db), claims: listClaims(db), polls: listPolls(db), schedScores: listScheduledScores(db), dayBoard: dayBoard(state, listClaims(db)), me: me.who || "", drafts: newsDrafts(Object.fromEntries(["q1", "q2", "trq1", "trq2", "meq1", "meq2", "naq1", "naq2"].map((ev) => [ev, state.qualifiers && state.qualifiers[ev] ? recapOf(state, readDetails(db, ev), ev) : null])), listNews(db)), comments: latestComments(db), sync: readItems("tsync_meta"), accounts: countAccounts(db), roles: me.who ? [] : listRoles(db), rosterDiffs: rosterDiffs(state, readTeamInfo()), who: me.who, undo: lastAction(db), history: listHistory(db, 200), editors: me.who ? [] : listEditors(db), seasons: listSeasons(db), news: listNews(db), voters: listVoters(db), r14: editorR14(db, state, dayOf()), sources: sourcesReport(db) } } : null;
  // signed in with an account that has no access: it is told so, rather than asked for a password
  const account = me ? "" : readAccountToken(db, (await cookies()).get(ACCOUNT_COOKIE)?.value, process.env.SESSION_SECRET);
  return <Admin initial={initial} isAdmin={!!me} denied={account} lang={lang} start={start} />;
}
