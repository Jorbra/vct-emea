import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../../lib/auth.js";
import { getDb, getState } from "../../../../lib/db.js";
import { answerDailyQuiz, myDailyQuiz } from "../../../../lib/dailyquiz.js";
import { badRequest, readBody } from "../../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, mine: true }: today's go and the streaks of this visitor. POST { token, answers }: plays the day's quiz, once.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.mine) return NextResponse.json(myDailyQuiz(db, b.token) || { today: null, streak: 0, best: 0 }, { headers: { "Cache-Control": "no-store" } });
  const ip = "dquiz:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = answerDailyQuiz(db, getState(db), { token: b.token, answers: b.answers });
  if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
  return NextResponse.json(r);
}
