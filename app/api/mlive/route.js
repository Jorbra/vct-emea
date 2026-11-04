import { getDb, setMatchLive } from "../../../lib/db.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setMatchLive(getDb(), { event: String(b.event || ""), id: String(b.id || ""), live: b.live === true, a: b.a, b: b.b }));
}
