import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { fantasyData } from "../../../lib/gamedata.js";
import { myFantasy, saveFantasy } from "../../../lib/round7.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the visitor's team and points. POST { token, slots: { duelist, initiator, controller, sentinel, joker } }: saves it.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const { pool, points } = await fantasyData();
  if (b.slots) {
    const r = saveFantasy(db, pool, { token: b.token, slots: b.slots });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ team: myFantasy(db, pool, points, b.token) }, { headers: { "Cache-Control": "no-store" } });
}
