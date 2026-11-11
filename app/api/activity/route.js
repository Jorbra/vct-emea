import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { listHistory } from "../../../lib/undo.js";
import { isAdmin } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET: the editors' latest changes, for the editor's live activity feed. Editors only.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  return NextResponse.json({ items: listHistory(getDb(), 30) }, { headers: { "Cache-Control": "no-store" } });
}
