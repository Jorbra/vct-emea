import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Tournament from "../../components/Tournament";
import { getDb, getState } from "../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../lib/i18n.js";
import { parseSitePath, siteHref } from "../../lib/paths.js";
import { eventPreview, sharedPreview } from "../../lib/preview.js";
import { workSoon } from "../../lib/readsoon.js";

// Always read the database on request: results change while the event runs.
export const dynamic = "force-dynamic";

// Every tab of the site (/vctemea/eu/playoff/swiss, /vctemea/kickoff/overview...); "/" is the home page.
export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  const st = parseSitePath("/" + slug.join("/"));
  if (!st) return {};
  const state = getState(getDb());
  return sharedPreview(eventPreview(st.event, st.tab, state, normLang((await cookies()).get(LANG_COOKIE)?.value)));
}

export default async function Page({ params }) {
  workSoon();
  const { slug = [] } = await params;
  const path = "/" + slug.join("/");
  const start = parseSitePath(path);
  if (!start) notFound();
  // A short or old address goes on to the full one, so every tab is always shown under the same address.
  const href = siteHref(start.event, start.tab);
  if (path !== href) redirect(href);
  const initial = getState(getDb());
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  return <Tournament initial={initial} lang={lang} start={start} />;
}
