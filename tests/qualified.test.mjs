// The teams that go on: known before the final, written straight into the next event.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb } from "../lib/db.js";
import { buildBracket, qualifiedOf } from "../lib/bracket.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { updateTeam } from "../lib/actions.js";
import { allMatches } from "../lib/matchlist.js";

/** Plays every open match of an event up to (not including) the given rounds; side a wins. */
function playUntil(db, event, stop) {
  for (let k = 0; k < 12; k++) {
    const open = allMatches(getState(db)).filter((m) => m.event === event && m.a && m.b && m.a.name && m.b.name && m.sa == null && !stop.some((s) => m.id.startsWith(`${s}-`)));
    if (!open.length) return;
    for (const m of open) for (const w of [1, 2, 3]) if (saveQualifierScore(db, { event, id: m.id, sa: w, sb: 0 }).ok) break;
  }
}

test("qualified places: the semifinalists (4), the finalists (2), the winner (1)", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 64 }, (_, i) => `T${i}`).join("\n"));
  playUntil(db, "meq1", ["sf", "gf", "third"]);
  const q = getState(db).qualifiers.meq1;
  const b = buildBracket(q.slots, q.scores, q.bo);
  assert.ok(qualifiedOf(b, 4).every(Boolean));
  assert.ok(qualifiedOf(b, 2).every((x) => x == null));
  assert.equal(qualifiedOf(b, 1)[0], null);
  playUntil(db, "meq1", ["gf", "third"]);
  const q2 = getState(db).qualifiers.meq1;
  const b2 = buildBracket(q2.slots, q2.scores, q2.bo);
  assert.ok(qualifiedOf(b2, 2).every(Boolean));
  const sfWinners = [b2.byId["sf-1"].winner, b2.byId["sf-2"].winner];
  assert.deepEqual(qualifiedOf(b2, 4).slice(0, 2), sfWinners);
});

test("EU: the semifinalists of Qualifier 1 take its 4 places in the Qualifier Playoffs; a team typed by hand stays", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "q1", Array.from({ length: 256 }, (_, i) => `Team ${i}`).join("\n"));
  assert.deepEqual(getState(db).teams.filter((t) => t.source === "Qualifier 1").map((t) => t.name), ["", "", "", ""]);
  playUntil(db, "q1", ["sf", "gf", "third"]);
  const names = getState(db).teams.filter((t) => t.source === "Qualifier 1").map((t) => t.name);
  assert.ok(names.every(Boolean), names.join(","));
  const q = getState(db).qualifiers.q1;
  const b = buildBracket(q.slots, q.scores, q.bo);
  assert.deepEqual(names.slice().sort(), qualifiedOf(b, 4).map((s) => q.slots[s - 1].name).sort());
  // an editor types another team in a place: it is kept
  const t = getState(db).teams.find((x) => x.source === "Qualifier 1" && x.pos === 4);
  assert.equal(updateTeam(db, t.id, { name: "Hand Picked", status: "qualified" }).ok, true);
  playUntil(db, "q1", ["gf", "third"]);
  const after = getState(db).teams.filter((x) => x.source === "Qualifier 1");
  assert.equal(after.find((x) => x.pos === 4).name, "Hand Picked");
  assert.ok(after.filter((x) => x.pos < 4).every((x) => x.name));
});

test("Türkiye: the two finalists take their places as soon as the semifinals are over", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "trq1", Array.from({ length: 64 }, (_, i) => `TR ${i}`).join("\n"));
  playUntil(db, "trq1", ["gf", "third"]);
  const places = getState(db).regional.tr.teams.filter((t) => t.source === "Qualifier 1");
  assert.ok(places.length >= 2 && places.every((t) => t.name), places.map((t) => t.name).join(","));
});
