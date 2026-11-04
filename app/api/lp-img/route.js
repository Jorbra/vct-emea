import { TYPES, lpLogo } from "../../../lib/lplogo.js";
import { itemsMention } from "../../../lib/lpstore.js";
import VALORANT_TEAMS from "../../../lib/valorant-teams.json";

export const dynamic = "force-dynamic";

// GET ?f=<logo path>: a logo shown on a team page or in the search (tournaments, teams), kept in data/lp-logos.
// Public, so only the logos that the saved Liquipedia information or the team list name: a visitor cannot make the site download anything else.
const LISTED = new Set(VALORANT_TEAMS.map((t) => t[2]).filter(Boolean));

export async function GET(req) {
  const f = new URL(req.url).searchParams.get("f") || "";
  const known = LISTED.has(f) || (!!f && itemsMention(f));
  const logo = known ? await lpLogo(f, 60) : null;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(logo.buf, {
    headers: { "Content-Type": TYPES[logo.ext], "Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff" },
  });
}
