import { getDb } from "../../../../lib/db.js";
import { importFlags } from "../../../../lib/qactions.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../../lib/session.js";

export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(importFlags(getDb(), String(b.text || "").slice(0, 60000)));
}
