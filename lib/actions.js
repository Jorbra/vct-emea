// Every change to the tournament goes through here. Each function validates its input,
// writes to the database and returns { ok: true, message } or { ok: false, status, error }.
import { getState } from "./db.js";
import { SEMI_IDS, bracketDraw, calc, needWins, placedInRound, planBracket, planSwiss, swissDraw } from "./tournament.js";

const fail = (status, error) => ({ ok: false, status, error });
const done = (message) => ({ ok: true, message });

export function updateTeam(db, id, patch) {
  const team = db.prepare("SELECT id, staff FROM teams WHERE id = ?").get(id);
  if (!team) return fail(404, "Unknown team.");
  const name = String(patch.name ?? "").trim();
  const roster = String(patch.roster ?? "").trim();
  const staff = patch.staff === undefined ? team.staff : String(patch.staff).trim(); // not sent: keep what is there
  const status = patch.status;
  if (name.length > 40) return fail(400, "Team name is limited to 40 characters.");
  if (roster.length > 240) return fail(400, "Roster is limited to 240 characters.");
  if (staff.length > 200) return fail(400, "Staff is limited to 200 characters.");
  if (status !== "invited" && status !== "qualified") return fail(400, "Entry must be invited or qualified.");
  const tag = name ? String(patch.tag ?? "").trim().toUpperCase().slice(0, 7) : ""; // only what the editor typed
  db.prepare("UPDATE teams SET name = ?, tag = ?, status = ?, roster = ?, logo = ?, staff = ? WHERE id = ?").run(name, tag, status, roster, "", name ? staff : "", id); // the logo comes from the tag only
  return done("Team saved.");
}

export function saveScore(db, { id, sa, sb }) {
  const m = db.prepare("SELECT * FROM matches WHERE id = ?").get(id);
  if (!m) return fail(404, "Unknown match.");
  if (!m.a || !m.b) return fail(409, "Both teams must be known before a score can be entered.");
  const clear = sa == null && sb == null;
  let res = null;
  if (!clear) {
    const need = needWins(m.bo);
    const ok = Number.isInteger(sa) && Number.isInteger(sb) && sa >= 0 && sb >= 0 && sa <= need && sb <= need;
    res = ok ? calc(m.bo, sa, sb, m.a, m.b) : null;
    if (!res) return fail(400, `One team must reach ${need} maps, the other fewer.`);
  }
  db.transaction(() => {
    db.prepare("UPDATE matches SET sa = ?, sb = ? WHERE id = ?").run(clear ? null : sa, clear ? null : sb, id);
    if (m.feeds) {
      const col = m.slot === "a" ? "a" : "b"; // whitelist, never interpolate stored text
      const feed = db.prepare("SELECT a, b FROM matches WHERE id = ?").get(m.feeds);
      const winner = res ? res.winner : "";
      if (feed && (feed[col] || "") !== winner) {
        // The final now has a different opponent, so any score it had no longer applies.
        db.prepare(`UPDATE matches SET ${col} = ?, sa = NULL, sb = NULL WHERE id = ?`).run(winner, m.feeds);
      }
    }
  })();
  return done(clear ? "Score cleared." : "Score saved.");
}

export function generateSwiss(db) {
  const { teams, matches } = getState(db);
  const plan = planSwiss(teams, matches);
  if (plan.err) return fail(409, plan.err);
  const ins = db.prepare("INSERT INTO matches (id, stage, round, a, b, bo) VALUES (?, 'swiss', ?, ?, ?, 3)");
  db.transaction(() => {
    plan.pairs.forEach(([a, b], i) => {
      ins.run(`s${plan.round}-m${String(i + 1).padStart(2, "0")}`, String(plan.round), a, b);
    });
  })();
  return done(`Round ${plan.round} created.${plan.warning ? " " + plan.warning : ""}`);
}

/**
 * Places by hand the two teams of a Swiss match (id "s2-m05": round 2, 5th match of the layout). Both teams must have the
 * record of that match's bracket going into the round ("0-1"...), and a team plays once per round.
 * Changing the teams clears the match's score; two empty sides remove the match.
 */
export function setSwissMatch(db, { id, a, b }) {
  const m = /^s([1-5])-m(\d\d)$/.exec(String(id || ""));
  if (!m) return fail(404, "Unknown match.");
  const { teams, matches } = getState(db);
  const draw = swissDraw(teams, matches, Number(m[1]));
  const slot = draw.slots.find((s) => s.id === id);
  if (!slot) return fail(404, "Unknown match.");
  if (!draw.editable) return fail(409, draw.why);
  const A = a || "";
  const B = b || "";
  if (A && A === B) return fail(400, "A team cannot play itself.");
  for (const t of [A, B]) {
    if (t && !(draw.pools[slot.key] || []).includes(t)) return fail(400, `This team does not have a ${slot.key} record.`);
  }
  const used = placedInRound(draw.slots, id);
  if ((A && used.has(A)) || (B && used.has(B))) return fail(409, "This team already plays in this round.");
  const old = slot.match;
  db.transaction(() => {
    if (!A && !B) db.prepare("DELETE FROM matches WHERE id = ?").run(id);
    else if (!old) db.prepare("INSERT INTO matches (id, stage, round, a, b, bo) VALUES (?, 'swiss', ?, ?, ?, 3)").run(id, String(draw.round), A, B);
    else if (old.a !== A || old.b !== B) db.prepare("UPDATE matches SET a = ?, b = ?, sa = NULL, sb = NULL WHERE id = ?").run(A, B, id);
  })();
  return done("Match saved.");
}

/**
 * Places by hand the two teams of a bracket semifinal from the 8 teams with 3 wins, each in one semifinal only.
 * The bracket is created on the first one. Changing a semifinal clears its score and its side of the group final.
 */
export function setBracketMatch(db, { id, a, b }) {
  if (!SEMI_IDS.includes(id)) return fail(404, "Unknown match.");
  const { teams, matches } = getState(db);
  const draw = bracketDraw(teams, matches);
  if (!draw.editable) return fail(409, draw.why);
  const A = a || "";
  const B = b || "";
  if (A && A === B) return fail(400, "A team cannot play itself.");
  for (const t of [A, B]) if (t && !draw.adv.includes(t)) return fail(400, "Only the teams with 3 wins play the bracket.");
  const used = placedInRound(draw.slots, id);
  if ((A && used.has(A)) || (B && used.has(B))) return fail(409, "This team is already placed in another semifinal.");
  db.transaction(() => {
    if (!matches.some((x) => x.stage === "elim")) {
      const ins = db.prepare("INSERT INTO matches (id, stage, round, grp, a, b, bo, feeds, slot) VALUES (?, 'elim', ?, ?, ?, ?, ?, ?, ?)");
      for (const g of ["A", "B"]) {
        ins.run(`e${g}-s1`, "semi", g, "", "", 3, `e${g}-f`, "a");
        ins.run(`e${g}-s2`, "semi", g, "", "", 3, `e${g}-f`, "b");
        ins.run(`e${g}-f`, "final", g, "", "", 5, null, null);
      }
    }
    const old = db.prepare("SELECT a, b, feeds, slot FROM matches WHERE id = ?").get(id);
    if (old.a === A && old.b === B) return;
    db.prepare("UPDATE matches SET a = ?, b = ?, sa = NULL, sb = NULL WHERE id = ?").run(A, B, id);
    // the semifinal's winner is gone, so is its place (and any score) in the group final
    const col = old.slot === "a" ? "a" : "b"; // whitelist, never interpolate stored text
    db.prepare(`UPDATE matches SET ${col} = '', sa = NULL, sb = NULL WHERE id = ?`).run(old.feeds);
  })();
  return done("Match saved.");
}

export function generateBracket(db) {
  const { teams, matches } = getState(db);
  const plan = planBracket(teams, matches);
  if (plan.err) return fail(409, plan.err);
  const ins = db.prepare(
    "INSERT INTO matches (id, stage, round, grp, a, b, bo, feeds, slot) VALUES (?, 'elim', ?, ?, ?, ?, ?, ?, ?)"
  );
  db.transaction(() => {
    for (const g of ["A", "B"]) {
      const T = plan[g];
      ins.run(`e${g}-s1`, "semi", g, T[0], T[3], 3, `e${g}-f`, "a");
      ins.run(`e${g}-s2`, "semi", g, T[1], T[2], 3, `e${g}-f`, "b");
      ins.run(`e${g}-f`, "final", g, "", "", 5, null, null);
    }
  })();
  return done("Bracket created.");
}

export function resetStage(db, stage) {
  if (stage !== "swiss" && stage !== "elim") return fail(400, "Unknown stage.");
  db.transaction(() => {
    // Without the Swiss results the bracket has no meaning, so resetting Swiss also clears it.
    if (stage === "swiss") db.prepare("DELETE FROM matches").run();
    else db.prepare("DELETE FROM matches WHERE stage = 'elim'").run();
    db.prepare("DELETE FROM kv WHERE key = 'swap'").run();
  })();
  return done("Matches deleted.");
}

export function toggleSwap(db) {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'swap'").get();
  const next = row && row.value === "1" ? "0" : "1";
  db.prepare("INSERT INTO kv (key, value) VALUES ('swap', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(next);
  return done("Places swapped.");
}
