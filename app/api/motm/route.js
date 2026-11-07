import { NextResponse } from "next/server";
import { recordFailure, tooManyAttempts } from "../../../lib/auth.js";
import { getDb, getState } from "../../../lib/db.js";
import { motmResults, myMotm, voteMotm } from "../../../lib/fans.js";
import { badRequest, readBody } from "../../../lib/session.js";
import { detailsOf } from "../../../lib/tstats.js";

export const dynamic = "force-dynamic";
const okIds = (event, id) => /^[a-z0-9]{1,12}$/.test(event) && /^[a-z0-9-]{1,20}$/.test(id);

// POST { token, event, id }: the votes and this visitor's own. With { player }: votes for them first.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const event = String(b.event || "");
  const id = String(b.id || "");
  if (!okIds(event, id)) return badRequest();
  const db = getDb();
  if (b.player) {
    const ip = "motm:" + (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if (tooManyAttempts(ip)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const r = voteMotm(db, getState(db), { token: b.token, event, id, player: String(b.player) }, detailsOf(db, event, id));
    if (!r.ok) { recordFailure(ip); return NextResponse.json({ error: r.error }, { status: r.status }); }
  }
  return NextResponse.json({ ...motmResults(db, event, id), mine: myMotm(db, b.token, event, id) }, { headers: { "Cache-Control": "no-store" } });
}
