import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { nightMatches } from "../../../lib/night.js";

export const dynamic = "force-dynamic";

// GET: the match night's tiles, read again by the page every 20 seconds.
export async function GET() {
  return NextResponse.json({ matches: nightMatches(getState(getDb())) }, { headers: { "Cache-Control": "public, max-age=10, s-maxage=10" } });
}
