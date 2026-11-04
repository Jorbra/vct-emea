import { getDb, setEventInfo } from "../../../lib/db.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setEventInfo(getDb(), { event: String(b.event || ""), start: b.start, end: b.end, type: b.type, location: b.location, venue: b.venue, tier: b.tier, stream: b.stream }));
}
