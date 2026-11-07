import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb, getState } from "../../../lib/db.js";
import { myPickem, savePickem } from "../../../lib/pickem.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token, mine: true }: this visitor's picks. POST { token, name, event, picks, champion }: saves them.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.mine) return NextResponse.json({ picks: myPickem(db, b.token) }, { headers: { "Cache-Control": "no-store" } });
  const ip = "pickem:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  const r = savePickem(db, getState(db), { token: b.token, name: b.name, event: String(b.event || ""), picks: b.picks, champion: b.champion });
  if (!r.ok) recordFailure(ip);
  return r.ok ? NextResponse.json({ ok: true, message: r.message }) : NextResponse.json({ error: r.error }, { status: r.status });
}
