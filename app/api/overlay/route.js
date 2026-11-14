import { NextResponse } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { overlayData, overlayParams } from "../../../lib/overlay.js";
import { detailsOf } from "../../../lib/tstats.js";

export const dynamic = "force-dynamic";

// GET ?event=&match=: what the stream overlays show, read every 10 seconds by the overlay pages (small, cached 5 s).
export async function GET(req) {
  const p = overlayParams(Object.fromEntries(new URL(req.url).searchParams));
  const db = getDb();
  return NextResponse.json(overlayData(getState(db), { event: p.event, match: p.match, details: (e, id) => detailsOf(db, e, id) }), { headers: { "Cache-Control": "public, max-age=5, s-maxage=5" } });
}
