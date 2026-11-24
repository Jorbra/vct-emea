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

test("head to head over every season, recent form and pools from the site's details", async () => {
  const { headToHeadAll, meetingsOf, recentForm, poolOf, archivedPlayed, playedOf } = await import("../lib/h2h.js");
  const { archiveSeason, fillSeasons } = await import("../lib/seasons.js");
  const { saveKickoffScore, setKickoffMatch } = await import("../lib/kactions.js");
  const db = openDb(":memory:");
  fillSeasons(db);
  setKickoffMatch(db, { id: "u1-1", a: 1, b: 2 });
  saveKickoffScore(db, { id: "u1-1", sa: 2, sb: 1 });
  assert.equal(archiveSeason(db, { name: "Saison 2026" }).ok, true);
  const archives = archivedPlayed(db);
  assert.equal(archives.length, 1);
  const [x] = archives[0].matches;
  assert.ok(x && x.a.name && x.b.name, "the archive's match is read");
  const A = x.a, B = x.b;
  // this season they meet again and B wins
  const cur = [{ event: "kickoff", id: "u2-1", at: "2027-01-20T18:00:00Z", a: B, b: A, sa: 2, sb: 0, win: "a" }];
  const h = headToHeadAll(cur, archives, A, B);
  assert.deepEqual([h.a, h.b], [1, 1]);
  assert.deepEqual([h.mapsA, h.mapsB], [2, 3]);
  assert.deepEqual(h.seasons.map((s) => s.slug), ["", "saison-2026"]);
  assert.equal(meetingsOf(cur, A, B, "u2-1").length, 0);
  assert.equal(headToHeadAll(cur, archives, A, B, { exceptId: "u2-1" }).seasons.length, 1);
  const form = recentForm([...cur, ...archives[0].matches], A);
  assert.deepEqual(form.map((m) => m.won), [false, true]);
  assert.deepEqual(poolOf([{ map: "Bind", played: 3, w: 2, l: 1 }, { map: "Pearl", played: 1, w: 0, l: 0 }]), [{ map: "Bind", played: 3, won: 2 }]);
  assert.deepEqual(playedOf({ nonsense: true }), []);
});
