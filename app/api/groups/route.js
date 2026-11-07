import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { createGroup, joinGroup, leaveGroup, myGroups } from "../../../lib/fans.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, action: "mine" | "create" (name) | "join" (code) | "leave" (code) }: friends' groups for the predictions.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const action = String(b.action || "mine");
  if (action !== "mine") {
    const ip = "groups:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const fn = { create: createGroup, join: joinGroup, leave: leaveGroup }[action];
    if (!fn) return badRequest();
    const r = fn(db, { token: b.token, name: b.name, code: String(b.code || "") });
    if (!r.ok) { if (r.status === 400) recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
    return NextResponse.json({ ...r, groups: myGroups(db, b.token) });
  }
  return NextResponse.json({ groups: myGroups(db, b.token) }, { headers: { "Cache-Control": "no-store" } });
}
