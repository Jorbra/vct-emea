import { NextResponse } from "next/server";
import { myPredictions } from "../../../../lib/community.js";
import { getDb } from "../../../../lib/db.js";
import { badRequest, readBody } from "../../../../lib/session.js";

// POST, not GET: the visitor's secret token stays out of addresses and logs.
export async function POST(req) {
  const b = await readBody(req);
  if (!b) return badRequest();
  return NextResponse.json(myPredictions(getDb(), b.token));
}
