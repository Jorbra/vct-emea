import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb, getState } from "../../../lib/db.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";
import { addComment, listComments, removeComment } from "../../../lib/social.js";

export const dynamic = "force-dynamic";
const okIds = (event, id) => /^[a-z0-9]{1,12}$/.test(event) && /^[a-z0-9-]{1,20}$/.test(id);

// GET ?event&id: a match's comments.
export async function GET(req) {
  const u = new URL(req.url);
  const event = String(u.searchParams.get("event") || "");
  const id = String(u.searchParams.get("id") || "");
  if (!okIds(event, id)) return badRequest();
  return NextResponse.json({ comments: listComments(getDb(), event, id) }, { headers: { "Cache-Control": "no-store" } });
}

// POST { token, event, id, body }: posts one. { remove: id }: the editors' moderation.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.remove) {
    if (!(await currentEditor())) return unauthorised();
    return reply(removeComment(db, { id: b.remove }));
  }
  const event = String(b.event || "");
  const id = String(b.id || "");
  if (!okIds(event, id)) return badRequest();
  const ip = "comment:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = addComment(db, getState(db), { token: b.token, event, mid: id, body: b.body });
  if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
  return NextResponse.json({ ok: true, message: r.message, comments: listComments(db, event, id) });
}
