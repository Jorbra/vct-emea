import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { jobsInfo, pingSites, statusSites } from "../../../lib/serverstatus.js";
import { currentEditor, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET, editors only: each site's answer and time, the last backup, the background task's last full round.
export async function GET() {
  if (!(await currentEditor())) return unauthorised();
  const sites = await pingSites(statusSites());
  return NextResponse.json({ at: new Date().toISOString(), sites, ...jobsInfo(getDb()) }, { headers: { "Cache-Control": "no-store" } });
}
