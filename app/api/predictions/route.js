import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { removeVoter, savePrediction } from "../../../lib/community.js";
import { getDb, getState } from "../../../lib/db.js";
import { badRequest, isAdmin, readBody, unauthorised } from "../../../lib/session.js";

// A visitor's pick. Open to everyone, so limited per address. { remove: name } is the editors' moderation.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.remove) {
    if (!(await isAdmin())) return unauthorised();
    const r = removeVoter(db, { name: b.remove });
    return r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status });
  }
  const ip = "pick:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  // each failure counts toward the shared limit of 8 per 10 minutes, so that names cannot be tried over and over
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = savePrediction(db, getState(db), { token: b.token, name: b.name, event: String(b.event || ""), id: String(b.id || ""), pick: b.pick });
  if (!r.ok) recordFailure(ip);
  return r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status });
}
