import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb, getState } from "../../../lib/db.js";
import { answerQuiz, myQuiz } from "../../../lib/round6.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, mine: true }: what this visitor did this week (204 before playing). POST { token, answers }: plays the week's quiz, once.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.mine) {
    const r = myQuiz(db, getState(db), b.token);
    return r ? NextResponse.json(r, { headers: { "Cache-Control": "no-store" } }) : new NextResponse(null, { status: 204 });
  }
  const ip = "quiz:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = answerQuiz(db, getState(db), { token: b.token, answers: b.answers });
  if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
  return NextResponse.json(r);
}
