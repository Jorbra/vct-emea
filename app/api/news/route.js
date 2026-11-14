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
  if (b.remove) return reply(removeNews(db, { id: b.remove }));
  // a news item for later: kept until its time, then published by the tick
  if (b.cancelScheduled) { const { cancelScheduledNews } = await import("../../../lib/editor17.js"); return reply(cancelScheduledNews(db, String(b.cancelScheduled))); }
  if (b.scheduleAt && !b.id) { const { scheduleNews } = await import("../../../lib/editor17.js"); return reply(scheduleNews(db, { title: b.title, body: b.body, at: b.scheduleAt, who: me.who })); }
  const r = saveNews(db, { id: b.id, title: b.title, body: b.body, who: me.who });
  // a new article (not an edit) goes to Discord too, when the editor wants it
  if (r.ok && !b.id) {
    const { listNews } = await import("../../../lib/community.js");
    const { botNews } = await import("../../../lib/botnotify.js");
    await botNews(db, listNews(db, 1)[0]).catch((e) => console.log(`[bot] news: ${e.message}`));
  }
  return reply(r);
}
