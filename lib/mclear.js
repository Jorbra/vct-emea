// Clears a whole match in one go: score, teams chosen by hand, date and time, live flag, stream, VOD and maps.
// Same contract as actions.js: { ok, message } or { ok: false, status, error }.
import { saveScore, setBracketMatch, setSwissMatch } from "./actions.js";
import { forgetAnnouncements } from "./discord.js";
import { EVENTS } from "./bracket.js";
import { qualifierSize } from "./db.js";
import { saveKickoffScore, setKickoffMatch } from "./kactions.js";
import { isHandSide } from "./kickoff.js";
import { saveQualifierScore } from "./qactions.js";
import { saveRegionalScore, setRegionalMatch } from "./ractions.js";
import { REGIONS, isOpening } from "./regional.js";
import { TIME_EVENTS, isMatchOf } from "./schedule.js";
import { SEMI_IDS } from "./tournament.js";

/** The EU Playoffs match: returns true when its teams had to stay (its round or bracket can no longer be redrawn). */
function clearPlayoffs(db, id) {
  const m = db.prepare("SELECT a, b, sa FROM matches WHERE id = ?").get(id);
  if (!m) return false;
  if (m.a && m.b && m.sa != null) saveScore(db, { id, sa: null, sb: null });
  if (!m.a && !m.b) return false;
  if (id.startsWith("s")) return !setSwissMatch(db, { id, a: "", b: "" }).ok;
  if (SEMI_IDS.includes(id)) return !setBracketMatch(db, { id, a: "", b: "" }).ok;
  return false; // a group final: its teams come from the semifinals
}

export function clearMatch(db, { event, id }) {
  if (!TIME_EVENTS.includes(event)) return { ok: false, status: 404, error: "Unknown event." };
  if (!isMatchOf(event, id, EVENTS.includes(event) ? qualifierSize(db, event) : undefined)) return { ok: false, status: 404, error: "Unknown match." };
  let kept = false;
  db.transaction(() => {
    for (const table of ["mtimes", "mlive", "mextra"]) db.prepare(`DELETE FROM ${table} WHERE event = ? AND id = ?`).run(event, id);
    if (event === "playoffs") kept = clearPlayoffs(db, id);
    else if (EVENTS.includes(event)) saveQualifierScore(db, { event, id, sa: null, sb: null }); // its teams come from the list of teams
    else if (event === "kickoff") {
      saveKickoffScore(db, { id, sa: null, sb: null });
      if (isHandSide(id, "a") || isHandSide(id, "b")) setKickoffMatch(db, { id, a: null, b: null });
    } else if (REGIONS.includes(event)) {
      saveRegionalScore(db, { event, id, sa: null, sb: null });
      if (isOpening(id, event)) setRegionalMatch(db, { event, id, a: null, b: null });
    }
  })();
  forgetAnnouncements(db, event, id); // played again, it rings again
  return { ok: true, message: kept ? "Match cleared, but its teams stay: its round can no longer be redrawn." : "Match cleared." };
}
