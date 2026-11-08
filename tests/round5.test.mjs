// Round 5: next-map predictions, the check before an event, going back to a given change, the bot's reminders, the match night.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchLive, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { savePrediction } from "../lib/community.js";
import { seasonRanking } from "../lib/fans.js";
import { addReminder, eventChecklist, listSteps, openMap, saveMapPick, takeDueReminders, undoTo } from "../lib/more.js";
import { nightMatches } from "../lib/night.js";
import { recordAction } from "../lib/undo.js";

const T = "f".repeat(40);
const bo3 = (db) => { db.prepare("INSERT INTO kv (key, value) VALUES ('qbo:meq1:r64', '3')").run(); };

test("next map: open while live and undecided, saved, counted once the maps are known", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`).join("\n"));
  bo3(db);
  let s = getState(db);
  assert.equal(savePrediction(db, s, { token: T, name: "Fan", event: "meq1", id: "r64-2", pick: "Team 3" }).ok, true);
  assert.equal(setMatchLive(db, { event: "meq1", id: "r64-1", live: true, a: 1, b: 0 }).ok, true);
  s = getState(db);
  const m = s.qualifiers.meq1 && { live: true, bo: 3 };
  assert.equal(openMap(m, { a: 1, b: 0 }), 2);
  assert.equal(openMap(m, { a: 2, b: 0 }), null);
  assert.equal(saveMapPick(db, s, { token: T, event: "meq1", id: "r64-1", map: 1, pick: "Team 1" }).ok, false);
  assert.equal(saveMapPick(db, s, { token: T, event: "meq1", id: "r64-1", map: 2, pick: "Team 1" }).ok, true);
  // the match ends 2-0, its maps saved: map 2 went to Team 1
  setMatchLive(db, { event: "meq1", id: "r64-1", live: false });
  saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 2, sb: 0 });
  db.prepare("INSERT INTO mextra (event, id, maps) VALUES ('meq1', 'r64-1', ?) ON CONFLICT (event, id) DO UPDATE SET maps = excluded.maps").run(JSON.stringify([{ map: "Lotus", a: 13, b: 5, pick: "" }, { map: "Bind", a: 13, b: 11, pick: "" }]));
  const r = seasonRanking(db, getState(db)).find((x) => x.name === "Fan");
  assert.equal(r.maps, 1);
});

test("the check before an event, and going back to a given change", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", "Alpha\nBeta");
  setMatchTime(db, { event: "meq1", id: "r64-1", at: new Date(Date.now() + 86400000).toISOString() });
  const c = eventChecklist(getState(db)).find((e) => e.event === "meq1");
  assert.ok(c.issues.some((x) => x.kind === "logo" && x.count === 2));
  assert.ok(c.issues.some((x) => x.kind === "stream"));
  recordAction(db, "first", "ed");
  setQualifierTeams(db, "meq1", "Gamma\nBeta");
  recordAction(db, "second", "ed");
  const steps = listSteps(db);
  assert.ok(steps.length >= 2);
  assert.equal(undoTo(db, 999999).ok, false);
});

test("the bot's reminders: kept, then given 15 minutes before; the match night", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  const m = { event: "meq1", id: "r64-1", at: new Date(now + 20 * 60000).toISOString(), a: { name: "A" }, b: { name: "B" } };
  assert.equal(addReminder(db, "u1", m, now).ok, true);
  assert.equal(addReminder(db, "u1", { ...m, at: new Date(now - 1000).toISOString() }, now).ok, false);
  assert.equal(takeDueReminders(db, now).length, 0);
  assert.deepEqual(takeDueReminders(db, now + 6 * 60000).map((r) => r.label), ["A vs B"]);
  assert.equal(takeDueReminders(db, now + 6 * 60000).length, 0);
  setQualifierTeams(db, "meq1", "Alpha\nBeta");
  setMatchTime(db, { event: "meq1", id: "r64-1", at: new Date().toISOString() });
  assert.equal(nightMatches(getState(db)).length, 1);
});
