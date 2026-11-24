import { getDb, getState, dropStateCache } from "../../../lib/db.js";
import { queueRefresh } from "../../../lib/lprefresh.js";
import { rosterDiffs, saveRosterEverywhere } from "../../../lib/rosterdiff.js";
import { readTeamInfo } from "../../../lib/teamfetch.js";
import { recordAction } from "../../../lib/undo.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

// POST { action: "read" }: every team and player of the main events read again from Liquipedia, the teams first.
// POST { action: "follow" }: every roster that differs from Liquipedia's follows it, everywhere the team plays.
export async function POST(req) {
  const me = await currentEditor();
  if (!me) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.action === "read") {
    const r = queueRefresh(db);
    return reply({ ok: true, message: `Liquipedia: ${r.teams} teams and ${r.players} players will be read again, the teams first (about ${r.waiting} minutes for everything).` });
  }
  if (b.action === "follow") {
    const diffs = rosterDiffs(getState(db), readTeamInfo());
    if (!diffs.length) return reply({ ok: false, status: 409, error: "Rosters match Liquipedia for the teams read so far." });
    for (const d of diffs) saveRosterEverywhere(db, d.name, d.roster);
    dropStateCache();
    try { recordAction(db, `Rosters following Liquipedia: ${diffs.map((d) => d.name).join(", ")}`.slice(0, 500), me.who || ""); } catch { /* the history is a convenience */ }
    return reply({ ok: true, message: `${diffs.length} rosters updated from Liquipedia.` });
  }
  return badRequest();
}
