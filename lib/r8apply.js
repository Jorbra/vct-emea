// The scores an editor scheduled, entered when their time comes, each as an undoable change in the history.
import { EVENTS } from "./bracket.js";
import { saveScore } from "./actions.js";
import { saveKickoffScore } from "./kactions.js";
import { saveQualifierScore } from "./qactions.js";
import { saveRegionalScore } from "./ractions.js";
import { takeDueScores } from "./round8.js";
import { recordAction } from "./undo.js";

export function saveAnyScore(db, { event, id, sa, sb }) {
  if (EVENTS.includes(event)) return saveQualifierScore(db, { event, id, sa, sb });
  if (event === "kickoff") return saveKickoffScore(db, { id, sa, sb });
  if (["tr", "mena", "gc"].includes(event)) return saveRegionalScore(db, { event, id, sa, sb });
  if (event === "playoffs") return saveScore(db, { id, sa, sb });
  return { ok: false, status: 404, error: "Unknown event." };
}

/** Enters the scores due now. Returns how many were entered. */
export function applyDueScores(db, now = Date.now()) {
  let n = 0;
  for (const s of takeDueScores(db, now)) {
    const r = saveAnyScore(db, s);
    if (r.ok) { recordAction(db, `Scheduled score entered: ${s.event} ${s.id} ${s.sa}-${s.sb}`, s.who || ""); n += 1; }
    else console.log(`[schedscore] ${s.event} ${s.id}: ${r.error}`);
  }
  return n;
}
