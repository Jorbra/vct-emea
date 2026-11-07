import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { detailsOf } from "../../../lib/tstats.js";

export const dynamic = "force-dynamic";

/** One match's vlr.gg table, read when its window opens: the pages do not carry them all. */
export async function GET(req) {
  const u = new URL(req.url);
  const event = String(u.searchParams.get("event") || "");
  const id = String(u.searchParams.get("id") || "");
  if (!/^[a-z0-9]{1,12}$/.test(event) || !/^[a-z0-9-]{1,20}$/.test(id)) return NextResponse.json({ details: null }, { status: 400 });
  return NextResponse.json({ details: detailsOf(getDb(), event, id) }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
