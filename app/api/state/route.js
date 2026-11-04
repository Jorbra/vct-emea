import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

// Public read-only snapshot: teams, matches, placements.
export async function GET() {
  return NextResponse.json(getState(getDb()));
}
