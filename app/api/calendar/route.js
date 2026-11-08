import { getDb, getState } from "../../../lib/db.js";
import { allMatches } from "../../../lib/matchlist.js";
import { icsFile, scheduleEvents } from "../../../lib/media.js";
import { teamSlug } from "../../../lib/paths.js";

export const dynamic = "force-dynamic";

const REGIONS = { eu: ["q1", "q2", "playoffs"], tr: ["trq1", "trq2", "tr"], mena: ["meq1", "meq2", "naq1", "naq2", "mena"], kickoff: ["kickoff"], gc: ["gc"] };

// GET ?region=eu, ?team=fnatic or ?teams=fnatic,team-liquid (the visitor's teams): the scheduled matches as a calendar to subscribe to (a region, a team, or all of them).
export async function GET(req) {
  const url = new URL(req.url);
  const allowed = REGIONS[url.searchParams.get("region")];
  const team = url.searchParams.get("team");
  const teams = (url.searchParams.get("teams") || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
  const list = allMatches(getState(getDb())).filter((m) => (!allowed || allowed.includes(m.event)) && (!team || teamSlug(m.a && m.a.name) === team || teamSlug(m.b && m.b.name) === team) && (!teams.length || teams.includes(teamSlug(m.a && m.a.name)) || teams.includes(teamSlug(m.b && m.b.name))));
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return new Response(icsFile(scheduleEvents(list, `${proto}://${host}`)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="vct-emea.ics"', "Cache-Control": "no-store" },
  });
}
