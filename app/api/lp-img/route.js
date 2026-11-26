import { TYPES, lpLogo } from "../../../lib/lplogo.js";
import { itemsMention } from "../../../lib/lpstore.js";
import VALORANT_TEAMS from "../../../lib/valorant-teams.json";

export const dynamic = "force-dynamic";

// GET ?f=<logo path>: a logo shown on a team page or in the search (tournaments, teams), kept in data/lp-logos.
// Public, so only the logos that the saved Liquipedia information or the team list name: a visitor cannot make the site download anything else.
const LISTED = new Set(VALORANT_TEAMS.map((t) => t[2]).filter(Boolean));

export async function GET(req) {
  const u = new URL(req.url);
  const f = u.searchParams.get("f") || "";
  // 60 px for logos, 240 px for players' photos
  const width = u.searchParams.get("w") === "240" ? 240 : 60;
  const known = LISTED.has(f) || (!!f && itemsMention(f));
  const logo = known ? await lpLogo(f, width) : null;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(logo.buf, {
    headers: { "Content-Type": TYPES[logo.ext], "Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff" },
  });
}
