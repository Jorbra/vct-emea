import { getDb } from "../../../../lib/db.js";
import { toggleSwap } from "../../../../lib/actions.js";
import { isAdmin, reply, unauthorised } from "../../../../lib/session.js";

export async function POST() {
  if (!(await isAdmin())) return unauthorised();
  return reply(toggleSwap(getDb()));
}
