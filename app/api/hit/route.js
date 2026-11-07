import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { countVisit } from "../../../lib/social.js";

export const dynamic = "force-dynamic";

// POST { path }: one page view, counted per day and page. Nothing about the visitor is kept.
export async function POST(req) {
  let b = null;
  try { b = await req.json(); } catch { /* nothing to count */ }
  if (b && typeof b.path === "string") countVisit(getDb(), { path: b.path, ua: req.headers.get("user-agent") });
  return new NextResponse(null, { status: 204 });
}
