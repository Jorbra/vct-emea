import { getDb, getState } from "../lib/db.js";
import { allMatches } from "../lib/matchlist.js";
import { listNews } from "../lib/community.js";
import { siteHref, teamHref, EVENT_NAMES } from "../lib/paths.js";
import { siteTeams } from "../lib/teams.js";
import ASSETS from "../lib/valorant-assets.json";

export const dynamic = "force-dynamic";

/** The pages search engines should know: events, teams of the site, matches with both teams, news, and the general pages. */
export default function sitemap() {
  const base = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "vct-emea.vercel.app"}`;
  const db = getDb();
  const state = getState(db);
  const paths = [
    "/", "/calendar", "/news", "/predictions", "/transfers", "/lft", "/stats", "/live", "/compare", "/about",
    ...Object.keys(EVENT_NAMES).map((e) => siteHref(e)),
    ...siteTeams(state).map((t) => teamHref(t.name)).filter(Boolean),
    ...allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name).map((m) => `/match/${m.event}/${m.id}`),
    ...listNews(db).map((n) => `/news/${n.id}`),
    "/agent", "/agent/duel", "/map", "/jeux", "/fantasy", "/quiz", "/tierlist", "/puissance",
    ...Object.keys(ASSETS.agents).map((k) => `/agent/${k}`),
    ...Object.entries(ASSETS.maps).filter(([, v]) => v.icon).map(([k]) => `/map/${k.toLowerCase()}`),
  ];
  return [...new Set(paths)].map((p) => ({ url: base + p }));
}
