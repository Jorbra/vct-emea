import { getDb } from "../../../../lib/db.js";
import { setRegionalMatch } from "../../../../lib/ractions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setRegionalMatch(getDb(), { event: String(b.event || ""), id: String(b.id || ""), a: b.a ?? null, b: b.b ?? null }));
}
