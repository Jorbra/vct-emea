import { cookies } from "next/headers";
import { readItems } from "../../lib/lpstore.js";
import { countAccounts } from "../../lib/accounts.js";
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
  const initial = me ? { ...state, admin: { sync: readItems("tsync_meta"), accounts: countAccounts(db), rosterDiffs: rosterDiffs(state, readTeamInfo()), who: me.who, undo: lastAction(db), history: listHistory(db), editors: me.who ? [] : listEditors(db), seasons: listSeasons(db), news: listNews(db), voters: listVoters(db) } } : null;
  return <Admin initial={initial} isAdmin={!!me} lang={lang} start={start} />;
}
