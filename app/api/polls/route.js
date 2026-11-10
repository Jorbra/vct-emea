import { getDb } from "../../../lib/db.js";
import { closePoll, createPoll } from "../../../lib/round8.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { question, options, closes } publishes a poll; { close: id } closes one. Editors only.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.close != null) return reply(closePoll(db, { id: b.close }));
  const r = createPoll(db, { question: b.question, options: b.options, closes: b.closes, who: me.who || "" });
  if (r.ok && b.discord) { const { relayPoll } = await import("../../../lib/botnotify.js"); try { await relayPoll(db); } catch { /* the bot may be off */ } }
  return reply(r);
}
