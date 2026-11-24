import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { dataDir, diskOf, jobsInfo, pingSelf } from "../../../lib/serverstatus.js";
import { currentEditor, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET, editors only: this site's answer and time, the last backup, the background task's last full round, the data folder's disk.
export async function GET() {
  if (!(await currentEditor())) return unauthorised();
  const site = await pingSelf();
  return NextResponse.json({ at: new Date().toISOString(), site, disk: diskOf(dataDir()), ...jobsInfo(getDb()) }, { headers: { "Cache-Control": "no-store" } });
}
