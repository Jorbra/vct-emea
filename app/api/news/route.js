import { removeNews, saveNews } from "../../../lib/community.js";
import { getDb } from "../../../lib/db.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

// { title, body, id? }: publishes or edits an article. { remove: id }: removes it.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  return reply(b.remove ? removeNews(db, { id: b.remove }) : saveNews(db, { id: b.id, title: b.title, body: b.body, who: me.who }));
}
