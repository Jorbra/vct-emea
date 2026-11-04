import { getDb } from "../../../../lib/db.js";
import { resetKickoff } from "../../../../lib/kactions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(resetKickoff(getDb()));
}
