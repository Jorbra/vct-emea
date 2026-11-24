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

test("match start alerts: the followers of a team are told when its match starts, once, and the regular alerts do not repeat it", async () => {
  const { savePushSub, sendPushes } = await import("../lib/push.js");
  const { sendStartPushes, dueStarts } = await import("../lib/startpush.js");
  const { setKickoffMatch } = await import("../lib/kactions.js");
  const db = openDb(":memory:");
  const keys = { p256dh: "p", auth: "a" };
  const fan = "https://fcm.googleapis.com/fan";
  const other = "https://fcm.googleapis.com/other";
  savePushSub(db, { endpoint: fan, keys, teams: ["team-vitality"] });
  savePushSub(db, { endpoint: other, keys, teams: ["fnatic"] });
  assert.equal(setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 }).ok, true);
  const got = [];
  const send = async (sub, payload) => { got.push([sub.endpoint, JSON.parse(payload)]); };
  const now = Date.now();
  await sendPushes(db, getState(db), now, send); // the regular alerts' first look
  assert.equal(await sendStartPushes(db, now, send), 0); // no time yet
  setMatchTime(db, { event: "kickoff", id: "u1-1", at: new Date(now + 5 * 60000).toISOString() });
  assert.equal(dueStarts(db, now).length, 0); // not yet
  const later = now + 5 * 60000 + 30000;
  assert.equal(dueStarts(db, later).length, 1);
  assert.equal(await sendStartPushes(db, later, send), 1);
  assert.deepEqual(got.map((g) => g[0]), [fan]);
  assert.match(got[0][1].body, /Team Vitality vs Karmine Corp/);
  assert.equal(got[0][1].url, "/match/kickoff/u1-1");
  assert.equal(await sendStartPushes(db, later + 60000, send), 0); // once
  // the regular alerts then see the match live (its time came): already sent
  got.length = 0;
  await sendPushes(db, getState(db), later + 60000, send);
  assert.equal(got.length, 0);
  // long after its time, nothing more
  assert.equal(dueStarts(db, now + 3 * 3600e3).length, 0);
});
