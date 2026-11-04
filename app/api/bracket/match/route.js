import { getDb } from "../../../../lib/db.js";
import { setBracketMatch } from "../../../../lib/actions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(setBracketMatch(getDb(), { id: String(b.id || ""), a: b.a ? String(b.a) : "", b: b.b ? String(b.b) : "" }));
}
