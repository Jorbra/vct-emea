import { getDb, getState } from "../lib/db.js";
import { allMatches } from "../lib/matchlist.js";
import { listNews } from "../lib/community.js";
import { siteHref, teamHref, EVENT_NAMES } from "../lib/paths.js";
import { siteTeams } from "../lib/teams.js";
import ASSETS from "../lib/valorant-assets.json";
import { headers } from "next/headers";
import { siteBase } from "../lib/maj40.js";
import { parseRoster } from "../lib/tournament.js";
import { playerHref } from "../lib/playerstats.js";

export const dynamic = "force-dynamic";

/** The pages search engines should know: events, teams of the site, matches with both teams, news, and the general pages. */
export default async function sitemap() {
  const h = await headers();
  const base = siteBase(process.env.VERCEL_PROJECT_PRODUCTION_URL, h.get("x-forwarded-host") || h.get("host"), h.get("x-forwarded-proto"));
  const db = getDb();
  const state = getState(db);
  const paths = [
    "/", "/calendar", "/news", "/predictions", "/transfers", "/lft", "/stats", "/live", "/compare", "/about",
    ...Object.keys(EVENT_NAMES).map((e) => siteHref(e)),
    ...siteTeams(state).map((t) => teamHref(t.name)).filter(Boolean),
    // the players of the site's teams: their pages too
    ...siteTeams(state).flatMap((t) => parseRoster(t.roster).map((p) => playerHref(p.name))).filter(Boolean),
    ...allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name).map((m) => `/match/${m.event}/${m.id}`),
    ...listNews(db).map((n) => `/news/${n.id}`),
    "/agent", "/agent/duel", "/map", "/jeux", "/fantasy", "/quiz", "/tierlist", "/puissance", "/jour", "/ce-soir", "/lexique", "/equipes", "/format",
    ...Object.keys(ASSETS.agents).map((k) => `/agent/${k}`),
    ...Object.entries(ASSETS.maps).filter(([, v]) => v.icon).map(([k]) => `/map/${k.toLowerCase()}`),
  ];
  return [...new Set(paths)].map((p) => ({ url: base + p }));
}
