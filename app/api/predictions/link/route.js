import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db.js";
import { makeLinkCode } from "../../../../lib/botstore.js";
import { badRequest, readBody } from "../../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: a code to type in Discord (/lier) so that the bot's predictions count for this visitor's name.
export async function POST(req) {
  const b = await readBody(req);
  if (!b || !/^[A-Za-z0-9_-]{20,80}$/.test(String(b.token || ""))) return badRequest();
  const db = getDb();
  const hash = crypto.createHash("sha256").update(String(b.token)).digest("hex");
  if (!db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) return NextResponse.json({ error: "Make a first prediction to get your name first." }, { status: 409 });
  return NextResponse.json({ code: makeLinkCode(db, hash) }, { headers: { "Cache-Control": "no-store" } });
}
