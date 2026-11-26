import { listNews } from "../../../lib/community.js";
import { getDb } from "../../../lib/db.js";
import { rssFeed } from "../../../lib/maj40.js";

export const dynamic = "force-dynamic";

// GET: the site's news as an RSS feed, for feed readers and Discord bots (preview "rss" shows the link on /news).
export async function GET(req) {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  let news = [];
  try { news = listNews(getDb(), 30); } catch { /* no database: an empty feed */ }
  return new Response(rssFeed(news, `${proto}://${host}`), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
