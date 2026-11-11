import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { accuracyByWeek } from "../../../lib/round10.js";
import { badRequest, readBody } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { token }: the visitor's right picks week by week.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  return NextResponse.json({ weeks: accuracyByWeek(db, getState(db), b.token) }, { headers: { "Cache-Control": "no-store" } });
}
