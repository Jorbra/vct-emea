import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { fantasyData } from "../../../lib/gamedata.js";
import { allMatches } from "../../../lib/matchlist.js";
import { pickSplit } from "../../../lib/round10.js";
import { matchPreview } from "../../../lib/round11.js";

export const dynamic = "force-dynamic";

// GET ?event=q2&id=r512-1: what to know before a match (form, head to head, picks, key players).
export async function GET(req) {
  const u = new URL(req.url);
  const db = getDb();
  const state = getState(db);
  const m = allMatches(state).find((x) => x.event === u.searchParams.get("event") && x.id === u.searchParams.get("id"));
  if (!m || !m.a || !m.b || !m.a.name || !m.b.name) return NextResponse.json({ error: "Unknown match." }, { status: 404 });
  const { players } = await fantasyData();
  return NextResponse.json(matchPreview(state, m, { players, picks: pickSplit(db, m) }), { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
