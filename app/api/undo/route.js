import { getDb } from "../../../lib/db.js";
import { undoLast } from "../../../lib/undo.js";
import { currentEditor, unauthorised } from "../../../lib/session.js";
import { NextResponse } from "next/server";

export async function POST() {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const r = undoLast(getDb(), me.who);
  return r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status });
}
