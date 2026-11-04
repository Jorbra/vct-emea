import { getDb } from "../../../../lib/db.js";
import { saveRegionalScore } from "../../../../lib/ractions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(saveRegionalScore(getDb(), { event: String(b.event || ""), id: String(b.id || ""), sa: b.sa ?? null, sb: b.sb ?? null }));
}
