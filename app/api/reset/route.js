import { getDb } from "../../../lib/db.js";
import { resetStage } from "../../../lib/actions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const body = await readBody(req);
  if (!body) return badRequest();
  return reply(resetStage(getDb(), body.stage));
}
