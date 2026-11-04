import { getDb } from "../../../../lib/db.js";
import { resetRegional } from "../../../../lib/ractions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(resetRegional(getDb(), { event: String(b.event || "") }));
}
