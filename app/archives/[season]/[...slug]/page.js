import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Tournament from "../../../../components/Tournament";
import { getDb } from "../../../../lib/db.js";
import { LANG_COOKIE, normLang } from "../../../../lib/i18n.js";
import { parseSitePath, siteHref } from "../../../../lib/paths.js";
import { getSeason } from "../../../../lib/seasons.js";

export const dynamic = "force-dynamic";

/** An archived season: the site's event pages, frozen, under /archives/<season>/... */
export default async function Page({ params }) {
  const { season, slug = [] } = await params;
  const s = getSeason(getDb(), season);
  const path = "/" + slug.join("/");
  const start = parseSitePath(path);
  if (!s || !start) notFound();
  const href = siteHref(start.event, start.tab);
  if (path !== href) redirect(`/archives/${season}${href}`);
  const lang = normLang((await cookies()).get(LANG_COOKIE)?.value);
  return <Tournament initial={s.state} lang={lang} start={start} archive={{ prefix: `/archives/${season}`, name: s.name }} />;
}

export async function generateMetadata({ params }) {
  const { season } = await params;
  const s = getSeason(getDb(), season);
  return { title: s ? `${s.name} · Archives · VCT EMEA` : "Archives · VCT EMEA" };
}
