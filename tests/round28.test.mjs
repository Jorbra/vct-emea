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

test("private leagues: created with a code, joined with it, their own ranking; French words", async () => {
  const { createGroup, joinGroup, groupInfo, seasonRanking } = await import("../lib/fans.js");
  const { savePrediction } = await import("../lib/community.js");
  const { makeT, serverFr } = await import("../lib/i18n.js");
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", "Alpha\nBeta\nGamma\nDelta");
  const s = getState(db);
  const [t1, t2, t3] = ["a", "b", "c"].map((c) => c.repeat(30));
  for (const [t, n] of [[t1, "Ana"], [t2, "Bob"], [t3, "Cid"]]) assert.equal(savePrediction(db, s, { token: t, name: n, event: "meq1", id: "r64-1", pick: "Alpha" }).ok, true);
  const g = createGroup(db, { token: t1, name: "Les potes" });
  assert.equal(g.ok, true);
  assert.match(g.code, /^[a-z0-9]{8}$/);
  assert.equal(joinGroup(db, { token: t2, code: g.code }).ok, true);
  assert.equal(joinGroup(db, { token: t2, code: "zzzzzzzz" }).ok, false);
  const info = groupInfo(db, g.code);
  assert.equal(info.hashes.length, 2);
  const { saveQualifierScore } = await import("../lib/qactions.js");
  saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 2, sb: 0 });
  const names = seasonRanking(db, getState(db), { only: info.hashes }).map((r) => r.name).sort();
  assert.deepEqual(names, ["Ana", "Bob"]); // Cid is not in the league
  assert.equal(makeT("fr")("Friends' groups"), "Ligues privées");
  assert.equal(serverFr("You joined the group."), "Tu as rejoint la ligue.");
});

test("team tint: a logo's colours worked out on the server, kept in the database; logos made PNG for the share pictures", async () => {
  const { teamTint, paletteOfImage, logoPng } = await import("../lib/teamtint.js");
  const { default: sharp } = await import("sharp");
  const red = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 220, g: 30, b: 40, alpha: 1 } } }).png().toBuffer();
  const p = await paletteOfImage(red);
  assert.ok(p && p.primary[0] > 180 && p.primary[1] < 80, "red is found");
  assert.equal(await paletteOfImage(Buffer.from("not an image")), null);
  const db = openDb(":memory:");
  db.prepare("INSERT INTO lp_logos (file, data) VALUES (?, ?)").run("RED.png", red);
  const t = await teamTint(db, "/api/logos/RED.png");
  assert.deepEqual(t.primary, p.primary);
  assert.ok(db.prepare("SELECT 1 FROM lp_items WHERE kind = 'tcolor' AND key = ?").get("/api/logos/RED.png"), "kept in the database");
  assert.equal(await teamTint(db, "https://evil.test/x.png"), null);
  assert.match(await logoPng(db, "/api/logos/RED.png"), /^data:image\/png;base64,/);
  assert.equal(await logoPng(db, ""), "");
});

test("server panel: the sites from STATUS_SITES (three by default), their answer and time; the backup keeps the last 14", async () => {
  const { statusSites, pingSites, jobsInfo, DEFAULT_SITES } = await import("../lib/serverstatus.js");
  const { toRemove, backupDir } = await import("../scripts/backup.mjs");
  assert.deepEqual(statusSites("").map((s) => s.url), DEFAULT_SITES);
  assert.deepEqual(statusSites("").map((s) => s.name), ["VCT EMEA", "Flashback", "Planning"]);
  assert.deepEqual(statusSites("Mon site=https://a.test/, https://b.test").map((s) => [s.name, s.url]), [["Mon site", "https://a.test"], ["b", "https://b.test"]]);
  assert.deepEqual(statusSites("pas-une-adresse"), []);
  let t = 0;
  const fetchImpl = async (url) => { t += 40; if (url.startsWith("https://b.test")) throw new Error("ECONNREFUSED"); return { status: url.startsWith("https://c.test") ? 502 : 200 }; };
  const r = await pingSites(statusSites("https://a.test https://b.test https://c.test"), { fetchImpl, now: () => t });
  assert.deepEqual(r.map((s) => s.ok), [true, false, false]);
  assert.ok(r[0].ms >= 40);
  assert.equal(r[1].error, "ECONNREFUSED");
  const db = openDb(":memory:");
  const { saveItem } = await import("../lib/lpstore.js");
  saveItem("meta", "backup_last", { at: "2026-11-25T03:00:05Z", file: "vct-emea-2026-11-25.db", size: 1, kept: 14 }, db);
  assert.equal(jobsInfo(db).backup.file, "vct-emea-2026-11-25.db");
  const files = Array.from({ length: 16 }, (_, i) => `vct-emea-2026-11-${String(i + 1).padStart(2, "0")}.db`).concat(["autre.txt"]);
  assert.deepEqual(toRemove(files), ["vct-emea-2026-11-02.db", "vct-emea-2026-11-01.db"]);
  assert.equal(backupDir({}, (p) => p === "/app/data"), "/app/data/sauvegardes");
  assert.equal(backupDir({ BACKUP_DIR: "/x" }), "/x");
});
