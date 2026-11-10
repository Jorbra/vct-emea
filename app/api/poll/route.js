import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";
import { currentPoll, myVote, voterOf, votePoll } from "../../../lib/round8.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the open poll and the visitor's vote. POST { token, id, choice }: votes (can change while open).
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const voter = voterOf(b.token);
  if (b.id != null && b.choice != null) {
    if (!voter) return NextResponse.json({ error: "Reload the page and try again." }, { status: 400 });
    const ip = "poll:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const r = votePoll(db, { id: b.id, voter, choice: b.choice });
    if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
    return NextResponse.json({ poll: r.poll, mine: Number(b.choice) });
  }
  const poll = currentPoll(db);
  return NextResponse.json({ poll, mine: poll ? myVote(db, poll.id, voter) : null }, { headers: { "Cache-Control": "no-store" } });
}
