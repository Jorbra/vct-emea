import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { siteStamp } from "../../../lib/stamp.js";

export const dynamic = "force-dynamic";

// GET: the site's stamp (lib/stamp.js), for the pages to know whether they have anything new to fetch.
export async function GET() {
  let s = "";
  try { s = siteStamp(getDb()); } catch { /* no stamp: the page refreshes as before */ }
  return NextResponse.json({ s }, { headers: { "Cache-Control": "no-store" } });
}
