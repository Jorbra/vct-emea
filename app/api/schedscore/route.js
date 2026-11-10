import { getDb } from "../../../lib/db.js";
import { cancelScheduledScore, scheduleScore } from "../../../lib/round8.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { event, id, sa, sb, at }: the score is entered by itself at that time. { cancel: true, event, id } removes it.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.cancel) return reply(cancelScheduledScore(db, { event: String(b.event || ""), id: String(b.id || "") }));
  return reply(scheduleScore(db, { event: String(b.event || ""), id: String(b.id || ""), sa: b.sa, sb: b.sb, at: b.at, who: me.who || "" }));
}
