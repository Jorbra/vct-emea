// Changes to the Kickoff page (tables kteams and kmatches). Same contract as actions.js: { ok, message } or { ok: false, status, error }.
import { getKickoff } from "./db.js";
import { KICK_SLOTS, buildKickoff, isHandSide, isKickId, kickPlacedElsewhere } from "./kickoff.js";
import { needWins } from "./tournament.js";

const fail = (status, error) => ({ ok: false, status, error });
const done = (message) => ({ ok: true, message });

/** Removes the scores whose two teams are no longer the ones they were entered for (repeats: clearing one can empty later matches). */
function dropStale(db) {
  for (let guard = 0; guard < 40; guard++) {
    const k = getKickoff(db);
    const b = buildKickoff(k.manual, k.scores);
    const stale = Object.entries(k.scores).filter(([id, s]) => !b.byId[id] || b.byId[id].a !== s.a || b.byId[id].b !== s.b);
    if (!stale.length) return;
    const clear = db.prepare("UPDATE kmatches SET sa = NULL, sb = NULL, pa = NULL, pb = NULL WHERE id = ?");
    stale.forEach(([id]) => clear.run(id));
  }
}

export function setKickoffTeam(db, { slot, name, roster, staff, tag, entry }) {
  if (!Number.isInteger(slot) || slot < 1 || slot > KICK_SLOTS) return fail(400, "Unknown slot.");
  const n = String(name ?? "").trim();
  const r = String(roster ?? "").trim();
  const s = String(staff ?? "").trim();
  if (n.length > 40) return fail(400, "Team name is limited to 40 characters.");
  if (r.length > 240) return fail(400, "Roster is limited to 240 characters.");
  if (s.length > 200) return fail(400, "Staff is limited to 200 characters.");
  if (entry !== undefined && entry !== "invited" && entry !== "qualified") return fail(400, "Entry must be invited or qualified.");
  const old = db.prepare("SELECT status FROM kteams WHERE slot = ?").get(slot);
  if (!old) return fail(404, "Unknown slot.");
  db.prepare("UPDATE kteams SET name = ?, tag = ?, status = ?, logo = ?, roster = ?, staff = ? WHERE slot = ?").run(
    n,
    n ? String(tag ?? "").trim().toUpperCase().slice(0, 7) : "",
    entry ?? old.status,
    "", // the logo comes from the tag only
    n ? r : "",
    n ? s : "",
    slot
  );
  return done("Team saved.");
}

/** Sets by hand the team(s) of a match side that has no feed (seeds and drop-ins). */
/** Sets the teams of the sides chosen by hand (UB Round 1, the UB Quarterfinal seeds); a fed side is never stored. */
export function setKickoffMatch(db, { id, a, b }) {
  if (!isKickId(id)) return fail(404, "Unknown match.");
  if (!isHandSide(id, "a") && !isHandSide(id, "b")) return fail(409, "This match fills itself from earlier results.");
  if (!isHandSide(id, "a")) a = null;
  if (!isHandSide(id, "b")) b = null;
  const ok = (v) => v == null || (Number.isInteger(v) && v >= 1 && v <= KICK_SLOTS);
  if (!ok(a) || !ok(b)) return fail(400, "Unknown slot.");
  if (a != null && a === b) return fail(400, "A team cannot play itself.");
  const used = kickPlacedElsewhere(getKickoff(db).manual, id);
  if ((a != null && used.has(a)) || (b != null && used.has(b))) return fail(409, "This team is already placed in another match.");
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO kmatches (id) VALUES (?)").run(id);
    db.prepare("UPDATE kmatches SET a = ?, b = ? WHERE id = ?").run(a ?? null, b ?? null, id);
    dropStale(db);
  })();
  return done("Match saved.");
}

export function saveKickoffScore(db, { id, sa, sb }) {
  if (!isKickId(id)) return fail(404, "Unknown match.");
  const k = getKickoff(db);
  const m = buildKickoff(k.manual, k.scores).byId[id];
  if (sa == null && sb == null) {
    db.transaction(() => {
      db.prepare("UPDATE kmatches SET sa = NULL, sb = NULL, pa = NULL, pb = NULL WHERE id = ?").run(id);
      dropStale(db);
    })();
    return done("Score cleared.");
  }
  if (!m.a || !m.b) return fail(409, "Both teams must be known before a score can be entered.");
  const need = needWins(m.bo);
  const valid = Number.isInteger(sa) && Number.isInteger(sb) && sa >= 0 && sb >= 0 && ((sa === need && sb < need) || (sb === need && sa < need));
  if (!valid) return fail(400, `One team must reach ${need} maps, the other fewer.`);
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO kmatches (id) VALUES (?)").run(id);
    db.prepare("UPDATE kmatches SET sa = ?, sb = ?, pa = ?, pb = ? WHERE id = ?").run(sa, sb, m.a, m.b, id);
    dropStale(db);
  })();
  return done("Score saved.");
}

export function resetKickoff(db) {
  db.prepare("DELETE FROM kmatches").run();
  return done("Matches deleted.");
}
