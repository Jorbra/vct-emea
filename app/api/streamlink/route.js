import { getDb } from "../../../lib/db.js";
import { setMatchStream } from "../../../lib/editor17.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, id, stream }: a match's stream link only; its other details stay as they are.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(await setMatchStream(getDb(), { event: String(b.event || ""), id: String(b.id || ""), stream: b.stream }));
}
