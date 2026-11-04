import { getDb, getState } from "../../../lib/db.js";
import { rosterDiffs, saveRosterEverywhere } from "../../../lib/rosterdiff.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";
import { readTeamInfo } from "../../../lib/teamfetch.js";

export const dynamic = "force-dynamic";

// POST { key }: a team's roster follows Liquipedia, everywhere it plays. An editor's action: it can be undone.
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  const d = rosterDiffs(getState(db), readTeamInfo()).find((x) => x.key === String(b.key || ""));
  if (!d) return reply({ ok: false, status: 404, error: "This roster has nothing to update." });
  saveRosterEverywhere(db, d.name, d.roster);
  return reply({ ok: true, message: "Roster updated." });
}
