import { getDb } from "../../../lib/db.js";
import { undoLast } from "../../../lib/undo.js";
import { undoTo } from "../../../lib/more.js";
import { currentEditor, unauthorised } from "../../../lib/session.js";
import { NextResponse } from "next/server";

export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  let body = {};
  try { body = await req.json(); } catch { /* the last change */ }
  // a given change: it and every change after it are undone
  const r = body && body.step ? undoTo(getDb(), body.step, me.who) : undoLast(getDb(), me.who);
  return r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status });
}
