import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { announcements } from "../../../lib/discord.js";

export const dynamic = "force-dynamic";

// GET: what has started and finished, for the browser alerts.
export async function GET() {
  return NextResponse.json({ items: announcements(getState(getDb())) });
}
