import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportCopy } from "../../../lib/backup.js";
import { getDb } from "../../../lib/db.js";
import { isAdmin, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET: a copy of the database right now, to keep somewhere else.
export async function GET() {
  if (!(await isAdmin())) return unauthorised();
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "copy-")), "copy.db");
  exportCopy(getDb(), file);
  const data = fs.readFileSync(file);
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  return new Response(data, {
    headers: { "Content-Type": "application/vnd.sqlite3", "Content-Disposition": `attachment; filename="kickoff-${day}.db"`, "Cache-Control": "no-store" },
  });
}
