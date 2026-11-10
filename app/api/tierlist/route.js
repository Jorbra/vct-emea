import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { communityTiers, myTierlist, saveTierlist, tierTeams } from "../../../lib/round8.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the visitor's tier list. POST { token, tiers }: saves it. Both answer with the community's.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const teams = tierTeams(getState(db));
  if (b.tiers) {
    const r = saveTierlist(db, teams, { token: b.token, tiers: b.tiers });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  const mine = myTierlist(db, b.token);
  return NextResponse.json({ mine: mine ? JSON.parse(mine) : null, community: communityTiers(db, teams) }, { headers: { "Cache-Control": "no-store" } });
}
