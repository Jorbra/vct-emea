import { getDb, setMatchLive } from "../../../lib/db.js";
import { forgetAnnouncements } from "../../../lib/discord.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const r = setMatchLive(getDb(), { event: String(b.event || ""), id: String(b.id || ""), live: b.live === true, a: b.a, b: b.b });
  if (r.ok && b.live !== true) forgetAnnouncements(getDb(), String(b.event || ""), String(b.id || ""), true); // marked live again, it rings again
  return reply(r);
}
