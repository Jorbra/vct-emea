import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { readItems } from "../../../lib/lpstore.js";
import { isAdmin, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// GET (editors): vlr.gg's last round in one line, and each followed list with its age and the matches it shows being played.
export async function GET() {
  if (!(await isAdmin())) return unauthorised();
  const db = getDb();
  const round = readItems("vlr_round", db).last || null;
  const lists = Object.entries(readItems("vlr_event", db)).map(([key, l]) => ({
    vlr: key.replace(/^vlr:/, ""), at: l.at || "", matches: (l.matches || []).length,
    live: (l.matches || []).filter((m) => m.live && !m.done).length,
  })).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
  return NextResponse.json({ round, lists });
}
