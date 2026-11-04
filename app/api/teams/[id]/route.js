import { getDb } from "../../../../lib/db.js";
import { updateTeam } from "../../../../lib/actions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function PATCH(req, { params }) {
  if (!(await isAdmin())) return unauthorised();
  const body = await readBody(req);
  if (!body) return badRequest();
  const { id } = await params;
  return reply(updateTeam(getDb(), id, body));
}
