import { NextResponse } from "next/server";
import { readCommitLog } from "../../../lib/changelog.js";
import { readItems, saveItem } from "../../../lib/lpstore.js";
import { currentEditor, unauthorised } from "../../../lib/session.js";
import { entriesSince, siteVersion } from "../../../lib/version.js";

export const dynamic = "force-dynamic";

// the last commit written by hand in the log (as app/admin/nouveautes/page.js)
const WRITTEN_UP_TO = "3859ad2";

// GET ?since=ISO: the running version, and the log's lines of the updates after `since` (editors only).
export async function GET(req) {
  if (!(await currentEditor())) return unauthorised();
  const since = new URL(req.url).searchParams.get("since");
  const version = siteVersion();
  let entries = [];
  if (since) {
    const log = await readCommitLog(WRITTEN_UP_TO, { readItems, saveItem });
    entries = entriesSince(log.entries, since);
  }
  return NextResponse.json({ version, entries }, { headers: { "Cache-Control": "no-store" } });
}
