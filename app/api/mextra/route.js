import { getDb, setMatchExtra } from "../../../lib/db.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setMatchExtra(getDb(), { event: String(b.event || ""), id: String(b.id || ""), stream: b.stream, vod: b.vod, highlights: b.highlights, mvp: b.mvp, pstats: b.pstats, maps: b.maps }));
}
