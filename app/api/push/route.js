import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { removePushSub, savePushSub, vapidKeys } from "../../../lib/push.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

const answer = (r) => (r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status }));

// GET: the key a browser subscribes with (public). POST: a browser's subscription and its teams. DELETE: stop.
// Not an editor's action: nothing here enters the history or the undo button.
export async function GET() {
  return NextResponse.json({ key: vapidKeys(getDb()).publicKey });
}

export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  return answer(savePushSub(getDb(), { endpoint: b.endpoint, keys: b.keys, teams: b.teams }));
}

export async function DELETE(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  return answer(removePushSub(getDb(), b.endpoint));
}
