import { getDb } from "../../../lib/db.js";
import { saveBanner } from "../../../lib/round6.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { text, url, from, to, tone }: the banner at the top of every page, between two dates. No text: removed. Undoable.
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(saveBanner(getDb(), b));
}
