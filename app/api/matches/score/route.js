import { getDb } from "../../../../lib/db.js";
import { saveScore } from "../../../../lib/actions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const body = await readBody(req);
  if (!body || typeof body.id !== "string") return badRequest();
  return reply(saveScore(getDb(), { id: body.id, sa: body.sa ?? null, sb: body.sb ?? null }));
}
