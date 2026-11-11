import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { mvpData } from "../../../lib/r9data.js";
import { myMvpPicks, saveMvpPick } from "../../../lib/round9.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the events whose MVP can be predicted and the visitor's picks. POST { token, event, player }: saves a pick.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const events = mvpData();
  if (b.event && b.player != null) {
    const r = saveMvpPick(db, events, { token: b.token, event: String(b.event), player: String(b.player) });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ events: events.map(({ players, ...e }) => ({ ...e, players: e.open ? players : [] })), mine: myMvpPicks(db, b.token) }, { headers: { "Cache-Control": "no-store" } });
}
