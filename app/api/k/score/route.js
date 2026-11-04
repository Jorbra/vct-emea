import { getDb } from "../../../../lib/db.js";
import { saveKickoffScore } from "../../../../lib/kactions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(saveKickoffScore(getDb(), { id: String(b.id || ""), sa: b.sa ?? null, sb: b.sb ?? null }));
}
