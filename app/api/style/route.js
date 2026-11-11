import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { COLORS, EMOJIS, myStyle, saveStyle } from "../../../lib/round9.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the visitor's avatar and colour (and the choices). POST { token, emoji, color }: saves them.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.save) {
    const r = saveStyle(db, { token: b.token, emoji: b.emoji, color: b.color });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ style: myStyle(db, b.token), emojis: EMOJIS, colors: COLORS }, { headers: { "Cache-Control": "no-store" } });
}
