import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb, getState } from "../../../lib/db.js";
import { myMapPick, saveMapPick } from "../../../lib/more.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, event, id, map }: this visitor's pick for the map. With { pick }: saves it (while that map can be predicted).
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const event = String(b.event || "");
  const id = String(b.id || "");
  if (b.pick) {
    const ip = "mappick:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const r = saveMapPick(db, getState(db), { token: b.token, event, id, map: b.map, pick: String(b.pick) });
    if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
  }
  return NextResponse.json({ pick: myMapPick(db, b.token, event, id, b.map) }, { headers: { "Cache-Control": "no-store" } });
}
