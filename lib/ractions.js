// Changes to a regional Qualifier Playoffs page (tables rteams and rmatches). Same contract as actions.js: { ok, message } or { ok: false, status, error }.
import { getRegional } from "./db.js";
import { REGIONS, buildRegional, isOpening, isRegId, placedElsewhere, regSlots } from "./regional.js";
import { needWins } from "./tournament.js";

const fail = (status, error) => ({ ok: false, status, error });
const done = (message) => ({ ok: true, message });

/** Removes the scores whose two teams are no longer the ones they were entered for (repeats: clearing one can empty later matches). */
function dropStale(db, event) {
  for (let guard = 0; guard < 20; guard++) {
    const r = getRegional(db, event);
    const b = buildRegional(r.manual, r.scores, event);
    const stale = Object.entries(r.scores).filter(([id, s]) => !b.byId[id] || b.byId[id].a !== s.a || b.byId[id].b !== s.b);
    if (!stale.length) return;
    const clear = db.prepare("UPDATE rmatches SET sa = NULL, sb = NULL, pa = NULL, pb = NULL WHERE event = ? AND id = ?");
    stale.forEach(([id]) => clear.run(event, id));
  }
}

export function setRegionalTeam(db, { event, slot, name, roster, staff, tag, entry }) {
  if (!REGIONS.includes(event)) return fail(404, "Unknown event.");
  if (!Number.isInteger(slot) || slot < 1 || slot > regSlots(event)) return fail(400, "Unknown slot.");
  const n = String(name ?? "").trim();
  const r = String(roster ?? "").trim();
  const s = String(staff ?? "").trim();
  if (n.length > 40) return fail(400, "Team name is limited to 40 characters.");
  if (r.length > 240) return fail(400, "Roster is limited to 240 characters.");
  if (s.length > 200) return fail(400, "Staff is limited to 200 characters.");
  if (entry !== undefined && entry !== "invited" && entry !== "qualified") return fail(400, "Entry must be invited or qualified.");
  const old = db.prepare("SELECT status FROM rteams WHERE event = ? AND slot = ?").get(event, slot);
  if (!old) return fail(404, "Unknown slot.");
  // a team typed by hand is no longer the one a qualifier put there (auto 0)
  db.prepare("UPDATE rteams SET name = ?, tag = ?, status = ?, roster = ?, staff = ?, auto = 0 WHERE event = ? AND slot = ?").run(
    n,
    n ? String(tag ?? "").trim().toUpperCase().slice(0, 7) : "",
    entry ?? old.status,
    n ? r : "",
    n ? s : "",
    event,
    slot
  );
  return done("Team saved.");
}

/** Sets by hand the two teams of a match nothing feeds (GSL opening matches, MENA semifinals). A team is placed in one match only. */
export function setRegionalMatch(db, { event, id, a, b }) {
  if (!REGIONS.includes(event)) return fail(404, "Unknown event.");
  if (!isOpening(id, event)) return fail(404, "Unknown match.");
  const ok = (v) => v == null || (Number.isInteger(v) && v >= 1 && v <= regSlots(event));
  if (!ok(a) || !ok(b)) return fail(400, "Unknown slot.");
  if (a != null && a === b) return fail(400, "A team cannot play itself.");
  const used = placedElsewhere(getRegional(db, event).manual, event, id);
  if ((a != null && used.has(a)) || (b != null && used.has(b))) return fail(409, "This team is already placed in another match.");
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO rmatches (event, id) VALUES (?, ?)").run(event, id);
    db.prepare("UPDATE rmatches SET a = ?, b = ? WHERE event = ? AND id = ?").run(a ?? null, b ?? null, event, id);
    dropStale(db, event);
  })();
  return done("Match saved.");
}

export function saveRegionalScore(db, { event, id, sa, sb }) {
  if (!REGIONS.includes(event)) return fail(404, "Unknown event.");
  if (!isRegId(id, event)) return fail(404, "Unknown match.");
  const r = getRegional(db, event);
  const m = buildRegional(r.manual, r.scores, event).byId[id];
  if (sa == null && sb == null) {
    db.transaction(() => {
      db.prepare("UPDATE rmatches SET sa = NULL, sb = NULL, pa = NULL, pb = NULL WHERE event = ? AND id = ?").run(event, id);
      dropStale(db, event);
    })();
    return done("Score cleared.");
  }
  if (!m.a || !m.b) return fail(409, "Both teams must be known before a score can be entered.");
  const need = needWins(m.bo);
  const valid = Number.isInteger(sa) && Number.isInteger(sb) && sa >= 0 && sb >= 0 && ((sa === need && sb < need) || (sb === need && sa < need));
  if (!valid) return fail(400, `One team must reach ${need} maps, the other fewer.`);
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO rmatches (event, id) VALUES (?, ?)").run(event, id);
    db.prepare("UPDATE rmatches SET sa = ?, sb = ?, pa = ?, pb = ? WHERE event = ? AND id = ?").run(sa, sb, m.a, m.b, event, id);
    dropStale(db, event);
  })();
  return done("Score saved.");
}

export function resetRegional(db, { event }) {
  if (!REGIONS.includes(event)) return fail(404, "Unknown event.");
  db.prepare("DELETE FROM rmatches WHERE event = ?").run(event);
  return done("Matches deleted.");
}
