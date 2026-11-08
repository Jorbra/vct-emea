// Plurals, Q2's size, live maps, agents/compositions/records, exact scores, groups board, share card, comments, page views,
// health alerts, Discord's commands.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { savePrediction, myPredictions } from "../lib/community.js";
import { createGroup, groupRanking, joinGroup, seasonRanking, voterCard } from "../lib/fans.js";
import { makeT } from "../lib/i18n.js";
import { slotsOf } from "../lib/bracket.js";
import { liveUpdate } from "../lib/vlive.js";
import { extraStats } from "../lib/tstats.js";
import { addComment, countVisit, countedPath, healthProblems, listComments, removeComment, saveHealthSub, sendHealthAlerts, visitReport } from "../lib/social.js";
import { answerCommand, verifyDiscord } from "../lib/discordbot.js";
import { botCtx, cmd } from "./botctx.mjs";

const T1 = "c".repeat(40);
const T2 = "d".repeat(40);

test("one takes the singular, in French and English", () => {
  const fr = makeT("fr");
  assert.equal(fr("{n} votes", { n: 1 }), "1 vote");
  assert.equal(fr("{n} votes", { n: 2 }), "2 votes");
  assert.equal(fr("{n} members", { n: 1 }), "1 membre");
  const en = makeT("en");
  assert.equal(en("{n} votes", { n: 1 }), "1 vote");
  assert.equal(en("{n} votes", { n: 11 }), "11 votes");
  assert.equal(makeT("fr")("1 vers le Kickoff", { n: 1 }), "1 vers le Kickoff");
  assert.equal(makeT("fr")("{n} matchs joués", { n: 1 }), "1 match joué");
  assert.equal(slotsOf("q2"), 512);
});

test("a live match: maps as they go and its feed", () => {
  const page = (maps) => ({ maps: maps.map(([map, a, b]) => ({ map, a, b })) });
  let s = liveUpdate(null, page([["Lotus", 5, 3], ["Bind", 0, 0], ["Ascent", 0, 0]]), false, 1000);
  assert.deepEqual(s.maps.map((m) => m.map), ["Lotus"]);
  assert.equal(s.feed[0].kind, "start");
  s = liveUpdate(s, page([["Lotus", 13, 9], ["Bind", 2, 1], ["Ascent", 0, 0]]), false, 2000);
  assert.deepEqual([s.sa, s.sb], [1, 0]);
  assert.deepEqual(s.feed.map((f) => f.kind), ["start", "map", "start"]);
  const swapped = liveUpdate(null, page([["Lotus", 13, 9]]), true, 1000);
  assert.deepEqual([swapped.maps[0].a, swapped.maps[0].b, swapped.sb], [9, 13, 1]);
});

const row = (name, side, agent, acs, k = 20) => ({ name, cc: "", agents: [agent], r: 1, acs, k, d: 10, a: 3, side });
function played(db) {
  assert.equal(setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`).join("\n")).ok, true);
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  const A = ["jett", "omen", "sova", "killjoy", "kayo"];
  const B = ["raze", "viper", "fade", "cypher", "breach"];
  const rows = [...A.map((ag, i) => row(`a${i}`, "a", ag, 200 + i * 10, 15 + i)), ...B.map((ag, i) => row(`b${i}`, "b", ag, 150 + i, 10))];
  return [{ event: "meq1", id: "r64-1", details: { all: rows, maps: [{ map: "Lotus", a: 13, b: 3, rows }] } }];
}

test("agents, compositions and records", () => {
  const db = openDb(":memory:");
  const entries = played(db);
  const x = extraStats(getState(db), entries);
  const jett = x.agents.find((a) => a.agent === "jett");
  assert.deepEqual([jett.picks, jett.wins, jett.pct], [1, 1, 100]);
  assert.equal(x.mapComps.lotus.length, 2);
  assert.deepEqual(x.teamComps["team-1"][0].agents, ["jett", "kayo", "killjoy", "omen", "sova"]);
  assert.equal(x.records.acs[0].value, 240);
  assert.equal(x.records.blowout[0].w - x.records.blowout[0].l, 10);
});

test("exact score bonus, groups board, share card", () => {
  const db = openDb(":memory:");
  assert.equal(setQualifierTeams(db, "q1", Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`).join("\n")).ok, true);
  db.prepare("INSERT INTO kv (key, value) VALUES ('qbo:q1:r256', '3')").run();
  let s = getState(db);
  const m = s.qualifiers.q1;
  const [a, b] = [m.slots[0].name, m.slots[1].name];
  const r1 = savePrediction(db, s, { token: T1, name: "Fan", event: "q1", id: "r256-1", pick: a, score: "2-1" });
  assert.equal(r1.ok, true);
  assert.equal(savePrediction(db, s, { token: T2, name: "Other", event: "q1", id: "r256-1", pick: b, score: "5-0" }).ok, false);
  assert.equal(savePrediction(db, s, { token: T2, name: "Other", event: "q1", id: "r256-1", pick: a, score: "2-0" }).ok, true);
  assert.equal(myPredictions(db, T1).scores["q1:r256-1"], "2-1");
  saveQualifierScore(db, { event: "q1", id: "r256-1", sa: 2, sb: 1 });
  s = getState(db);
  assert.deepEqual(seasonRanking(db, s).map((r) => [r.name, r.points]), [["Fan", 2], ["Other", 1]]);
  const g = createGroup(db, { token: T1, name: "Amis" });
  joinGroup(db, { token: T2, code: g.code });
  assert.deepEqual(groupRanking(db, s).map((x) => [x.name, x.members, x.points]), [["Amis", 2, 1.5]]);
  assert.equal(voterCard(db, s, "fan").rank, 1);
  assert.equal(voterCard(db, s, "nobody"), null);
});

test("comments, page views, health alerts", async () => {
  const db = openDb(":memory:");
  played(db);
  const s = getState(db);
  assert.equal(addComment(db, s, { token: T1, event: "meq1", mid: "r64-1", body: "gg" }).status, 409); // no name yet
  savePrediction(db, s, { token: T1, name: "Fan", event: "meq1", id: "r64-2", pick: s.qualifiers.meq1.slots[2].name });
  assert.equal(addComment(db, s, { token: T1, event: "meq1", mid: "r64-1", body: "x".repeat(281) }).ok, false);
  assert.equal(addComment(db, s, { token: T1, event: "meq1", mid: "r64-1", body: "  gg wp  " }).ok, true);
  assert.equal(addComment(db, s, { token: T1, event: "meq1", mid: "r64-1", body: "again" }).status, 429);
  const [c] = listComments(db, "meq1", "r64-1");
  assert.deepEqual([c.name, c.body], ["Fan", "gg wp"]);
  assert.equal(removeComment(db, { id: c.id }).ok, true);
  assert.equal(countedPath("/team/fnatic?x=1"), "/team/fnatic");
  assert.equal(countedPath("/admin"), "");
  assert.equal(countVisit(db, { path: "/", ua: "Mozilla/5.0" }), true);
  assert.equal(countVisit(db, { path: "/", ua: "Googlebot" }), false);
  assert.equal(visitReport(db).today, 1);
  const isPush = (u) => u.startsWith("https://fcm.googleapis.com/");
  assert.equal(saveHealthSub(db, { endpoint: "https://fcm.googleapis.com/fcm/send/9", keys: { p256dh: "k", auth: "a" } }, isPush).ok, true);
  const now = Date.now();
  const problems = healthProblems([{ part: "cron", late: true, at: new Date(now - 3600000).toISOString(), problem: null }, { part: "regular", late: true, at: "2020-01-01T00:00:00Z", problem: null }], now);
  assert.equal(problems.length, 1);
  const sent = [];
  const keys = await sendHealthAlerts(db, problems, [], async (sub, p) => sent.push(JSON.parse(p).body));
  assert.equal(sent.length, 1);
  await sendHealthAlerts(db, problems, keys, async (sub, p) => sent.push(p));
  assert.equal(sent.length, 1); // once
});

test("Discord: signature and the commands' answers", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");
  const body = JSON.stringify({ type: 1 });
  const sig = crypto.sign(null, Buffer.from("123" + body), privateKey).toString("hex");
  assert.equal(verifyDiscord(raw, sig, "123", body), true);
  assert.equal(verifyDiscord(raw, sig, "124", body), false);
  const db = openDb(":memory:");
  played(db);
  const later = new Date(Date.now() + 86400000).toISOString();
  setMatchTime(db, { event: "meq1", id: "r64-2", at: later });
  const s = getState(db);
  const ctx = botCtx(s);
  const text = (r) => JSON.stringify(r);
  assert.match(text(answerCommand("score", cmd("score"), ctx)), /Team 1/);
  assert.match(text(answerCommand("prochain", cmd("prochain", { equipe: "team 3" }), ctx)), /Team 3/);
  assert.match(text(answerCommand("classement", cmd("classement"), { ...ctx, ranking: () => [{ name: "Fan", points: 3, good: 3, total: 4 }] })), /Fan/);
});

test("team theme: the logo's two colors, readable in dark and light mode", async () => {
  const { paletteOf, themeColors, readableLogo } = await import("../components/teamcolors.js");
  // a logo with mostly red, some blue and white
  const px = [];
  const add = (rgb, n) => { for (let i = 0; i < n; i++) px.push(...rgb, 255); };
  add([200, 20, 40], 300); add([20, 60, 160], 150); add([255, 255, 255], 200); add([0, 0, 0], 100);
  const p = paletteOf(Uint8ClampedArray.from(px));
  assert.deepEqual([p.primary, p.secondary], [[200, 20, 40], [20, 60, 160]]);
  const dark = themeColors(p, true);
  const light = themeColors(p, false);
  assert.match(dark.accent, /^hsl\(35\d|^hsl\(\d+, \d+%, 62%\)$/);
  assert.match(light.accent, /, 36%\)$/);
  assert.equal(paletteOf(Uint8ClampedArray.from([128, 128, 128, 255, 128, 128, 128, 255])), null);
  const mono = paletteOf(Uint8ClampedArray.from(Array.from({ length: 40 }, (_, i) => (i % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255])).flat()));
  assert.equal(mono.mono, true);
  assert.equal(themeColors(mono, true).accent, "#ecece8");
  assert.equal(readableLogo("https://play.toornament.com/media/file/123456789/logo_medium"), "/api/tlogo?id=123456789");
  assert.equal(readableLogo("https://example.com/x.png"), "");
  assert.equal(readableLogo("/api/logos/BAR.png"), "/api/logos/BAR.png");
});
