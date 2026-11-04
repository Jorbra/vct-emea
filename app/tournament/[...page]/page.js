import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import LpTournamentPage from "../../../components/LpTournamentPage";
import { LANG_COOKIE, normLang } from "../../../lib/i18n.js";
import { lpData } from "../../../lib/lpdata.js";
import { readSoon } from "../../../lib/readsoon.js";
import { teamSlug } from "../../../lib/paths.js";
import { requestDue, requestFetch, updateDue } from "../../../lib/teamfetch.js";

export const dynamic = "force-dynamic";

function load(segments, update = false) {
  const key = (segments || []).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }).join("/");
  const { tournamentInfo, dir } = lpData();
  const known = dir.tournaments[key];
  const entry = tournamentInfo[key];
  if (!known && !entry) return null; // only tournaments the saved information names
  const lpNow = update && updateDue(entry);
  if (lpNow || requestDue(entry)) requestFetch({ kind: "tournament", page: key }, Date.now(), lpNow);
  const lp = entry && entry.page
    ? { ...entry, placements: entry.placements.map((p) => ({ ...p, href: dir.teams[teamSlug(p.team)] ? `/team/${teamSlug(p.team)}` : "" })) }
    : null;
  return { name: known ? known.name : key.replace(/_/g, " "), logo: known ? known.logo : "", logoDark: known ? known.logoDark : "", lp, pending: !entry, updating: !!entry && lpNow };
}

/** A tournament of the achievements, with what Liquipedia says about it. */
export default async function Page({ params, searchParams }) {
  const { page } = await params;
  const t = load(page, (await searchParams).maj === "1"); // opened from the search bar: read again now
  if (!t) notFound();
  readSoon();
  return <LpTournamentPage t={t} lang={normLang((await cookies()).get(LANG_COOKIE)?.value)} />;
}

export async function generateMetadata({ params }) {
  const { page } = await params;
  const t = load(page);
  return { title: t ? `${t.name} · VCT EMEA` : "VCT EMEA" };
}
