import { NextResponse } from "next/server";
import { MIN_LIVE_QUERY, liveSearch } from "../../../../lib/livesearch.js";

export const dynamic = "force-dynamic";

// GET ?q=<text>: what Liquipedia and vlr.gg find for it. Public, but answers are remembered and each site is asked in turn with a pause.
export async function GET(req) {
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 60).trim();
  if (q.length < MIN_LIVE_QUERY) return NextResponse.json({ events: [], teams: [], players: [] });
  return NextResponse.json(await liveSearch(q));
}
