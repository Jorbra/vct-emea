import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: the server's time zone and its clock as text (to check the pages' times are written in Central European Time).
export async function GET() {
  const now = new Date();
  return NextResponse.json({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, local: now.toString() }, { headers: { "Cache-Control": "no-store" } });
}
