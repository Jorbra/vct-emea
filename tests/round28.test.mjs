// Round 28: tonight's page, match start alerts, team comparison and head-to-head, private leagues, team colours, backups, server panel.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setEventInfo, setMatchTime } from "../lib/db.js";
import { setQualifierTeams } from "../lib/qactions.js";
import { nightMatches } from "../lib/night.js";
import { tonightLists } from "../lib/tonight.js";

test("tonight: today's matches with their event's stream, in live / next / finished", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", "Alpha\nBeta\nGamma\nDelta");
  setEventInfo(db, { event: "meq1", type: "online", stream: "https://www.twitch.tv/valorant_emea" });
  setMatchTime(db, { event: "meq1", id: "r64-1", at: new Date(Date.now() + 1000).toISOString() });
  const list = nightMatches(getState(db), Date.now());
  const m = list.find((x) => x.id === "r64-1");
  assert.ok(m, "the match of the day is there");
  assert.equal(m.stream, "https://www.twitch.tv/valorant_emea");
  const { live, next, done } = tonightLists([{ ...m }, { ...m, id: "x", live: true }, { ...m, id: "y", sa: 2, sb: 0 }]);
  assert.deepEqual([live.length, next.length, done.length], [1, 1, 1]);
});
