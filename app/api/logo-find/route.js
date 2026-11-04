import { NextResponse } from "next/server";
import { findLogo } from "../../../lib/db.js";
import { isAdmin, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// Which logo file in public/logos matches a short tag / team name (used by the editor to preview it while typing).
export async function GET(req) {
  if (!(await isAdmin())) return unauthorised();
  const u = new URL(req.url);
  const name = (u.searchParams.get("name") || "").slice(0, 60);
  const tag = (u.searchParams.get("tag") || "").slice(0, 8);
  return NextResponse.json({ logo: findLogo(name, undefined, tag) }, { headers: { "Cache-Control": "no-store" } });
}
