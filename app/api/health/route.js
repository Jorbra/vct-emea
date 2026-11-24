import { getDb } from "../../../lib/db.js";
import { isPushEndpoint } from "../../../lib/push.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";
import { removeHealthSub, saveHealthSub } from "../../../lib/social.js";

export const dynamic = "force-dynamic";

// GET, for anyone (the server's watch, the editor's Server panel): the site answers and reads its database.
export async function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

// Editors only. POST { endpoint, keys }: this device gets the health alerts. DELETE { endpoint }: no longer.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(saveHealthSub(getDb(), { endpoint: b.endpoint, keys: b.keys, who: me.who || "main" }, isPushEndpoint));
}

export async function DELETE(req) {
  if (!(await currentEditor())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(removeHealthSub(getDb(), b.endpoint));
}
