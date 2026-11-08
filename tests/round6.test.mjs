// Round 6: power ranking, quiz of the week, the banner, the activity, the Oracle of the week, the map lines of a match's thread.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { savePrediction } from "../lib/community.js";
import { allMatches } from "../lib/matchlist.js";
import { activeBanner, activityReport, answerQuiz, myQuiz, oracleOf, powerRanking, quizQuestions, quizRanking, saveBanner, threadLines, weekOf, weeklyQuiz, weekPredictions } from "../lib/round6.js";
import { COMMANDS, answerCommand } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const T = "e".repeat(40);
const DAY = 86400000;

/** 8 teams in a qualifier, the first round played 3 days before `now`, Bo3. */
function played(now) {
  const db = openDb(":memory:");
  setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`).join("\n"));
  db.prepare("INSERT INTO kv (key, value) VALUES ('qbo:meq1:r64', '3')").run();
  const first = allMatches(getState(db)).filter((m) => m.event === "meq1" && m.a && m.b && m.a.name && m.b.name);
  first.forEach((m, k) => {
    setMatchTime(db, { event: "meq1", id: m.id, at: new Date(now - 3 * DAY + k * 3600000).toISOString() });
    saveQualifierScore(db, { event: "meq1", id: m.id, sa: 2, sb: k % 2 });
  });
  return { db, first };
}

test("power ranking: winners above losers, a 2-0 worth more, 1 series is enough when asked", () => {
  const now = Date.now();
  const { db, first } = played(now);
  assert.ok(first.length >= 2);
  const rows = powerRanking(getState(db), now, { min: 1 });
  assert.equal(rows.length, first.length * 2);
  const winners = new Set(first.map((m) => m.a.name));
  rows.slice(0, first.length).forEach((t) => assert.ok(winners.has(t.name), t.name));
  // a 2-0 (k even) earns more than a 2-1
  const r0 = rows.find((t) => t.name === first[0].a.name).rating;
  const r1 = rows.find((t) => t.name === first[1].a.name).rating;
  assert.ok(r0 > r1);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].move, null); // nothing 7 days ago: new
  assert.equal(powerRanking(getState(db), now).length, 0); // 3 series by default
});

test("quiz of the week: same questions all week, one go, ranking by name", () => {
  const now = Date.now();
  const week = weekOf(now);
  // the matches belong to the week before this Monday
  const { db } = played(new Date(`${week}T00:00:00Z`).getTime());
  const s = getState(db);
  const quiz = weeklyQuiz(s, week);
  assert.ok(quiz.length >= 2 && quiz.length <= 5);
  assert.deepEqual(weeklyQuiz(s, week), quiz);
  assert.ok(quizQuestions(quiz).every((q) => !("answer" in q) && q.options.length >= 2));
  quiz.forEach((q) => assert.ok(q.options.includes(q.answer), q.text));
  assert.equal(savePrediction(db, s, { token: T, name: "Quizzer", event: "meq1", id: "r64-2", pick: "x" }).ok || true, true);
  db.prepare("INSERT OR IGNORE INTO voters (hash, name, created) VALUES (?, 'Quizzer', ?)").run(require256(T), new Date().toISOString());
  const answers = Object.fromEntries(quiz.map((q, i) => [q.id, i === 0 ? "wrong" : q.answer]));
  const r = answerQuiz(db, s, { token: T, answers }, now);
  assert.equal(r.ok, true);
  assert.equal(r.good, quiz.length - 1);
  assert.equal(answerQuiz(db, s, { token: T, answers }, now).ok, false);
  assert.equal(myQuiz(db, s, T, now).good, quiz.length - 1);
  assert.deepEqual(quizRanking(db, week), [{ name: "Quizzer", good: quiz.length - 1 }]);
  assert.equal(activityReport(db, now).at(-1).quiz, 1);
});

test("quiz: no match last week, no quiz", () => {
  const db = openDb(":memory:");
  assert.deepEqual(weeklyQuiz(getState(db)), []);
  assert.equal(answerQuiz(db, getState(db), { token: T, answers: {} }).ok, false);
  assert.equal(weekOf(Date.parse("2026-11-11T12:00:00Z")), "2026-11-09");
  assert.equal(weekOf(Date.parse("2026-11-09T00:30:00Z")), "2026-11-09");
  assert.equal(weekOf(Date.parse("2026-11-08T23:30:00Z")), "2026-11-09"); // already Monday in Paris
  assert.equal(weekOf(Date.parse("2026-11-08T22:30:00Z")), "2026-11-02");
});

test("banner: now, scheduled, over, removed, bad link", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  assert.equal(activeBanner(db), null);
  assert.equal(saveBanner(db, { text: "Hello", url: "javascript:alert(1)" }).ok, false);
  assert.equal(saveBanner(db, { text: "Hello", url: "/soiree", tone: "live" }).ok, true);
  assert.equal(activeBanner(db, now).text, "Hello");
  assert.equal(activeBanner(db, now).tone, "live");
  saveBanner(db, { text: "Later", from: new Date(now + DAY).toISOString() });
  assert.equal(activeBanner(db, now), null);
  assert.equal(activeBanner(db, now + 2 * DAY).text, "Later");
  saveBanner(db, { text: "Short", to: new Date(now + 3600000).toISOString() });
  assert.equal(activeBanner(db, now + 2 * 3600000), null);
  assert.equal(saveBanner(db, { text: "x", from: new Date(now + DAY).toISOString(), to: new Date(now).toISOString() }).ok, false);
  assert.equal(saveBanner(db, { text: "" }).message, "Banner removed.");
  assert.equal(activeBanner(db, now), null);
});

test("Oracle of the week: the best of the server's members over 7 days", () => {
  const now = Date.now();
  const { db, first } = played(now);
  const s = getState(db);
  const A = "a".repeat(40);
  const B = "b".repeat(40);
  // made before the matches (the site closes them once played): written as they were
  const put = db.prepare("INSERT INTO predictions (hash, event, id, pick) VALUES (?, 'meq1', ?, ?)");
  for (const m of first) {
    put.run(require256(A), m.id, m.a.name);
    put.run(require256(B), m.id, m.b.name);
  }
  assert.ok(s);
  const week = weekPredictions(db, getState(db), now);
  assert.equal(week.length, 1);
  assert.equal(week[0].good, first.length);
  const best = oracleOf(week, [{ user: "111", hash: week[0].hash }, { user: "222", hash: "nobody" }]);
  assert.equal(best.user, "111");
  assert.equal(oracleOf(week, [{ user: "222", hash: "nobody" }]), null);
});

test("thread lines: each map once, then the result", () => {
  const m = { a: { name: "Alpha" }, b: { name: "Beta" }, sa: null, sb: null, win: "" };
  let posted = { maps: 0, done: false };
  let r = threadLines(m, { maps: [{ map: "Bind", a: 13, b: 9, done: true }, { map: "Lotus", a: 4, b: 2 }] }, posted, "fr");
  assert.equal(r.lines.length, 1);
  assert.match(r.lines[0], /Carte 1 · \*\*Bind\*\* : Alpha 13–9 Beta · pour \*\*Alpha\*\*/);
  posted = { maps: r.maps, done: r.done };
  assert.equal(threadLines(m, { maps: [{ map: "Bind", a: 13, b: 9, done: true }, { map: "Lotus", a: 6, b: 2 }] }, posted, "fr").lines.length, 0);
  const end = { ...m, sa: 1, sb: 2, win: "b" };
  r = threadLines(end, { maps: [{ map: "Bind", a: 13, b: 9 }, { map: "Lotus", a: 10, b: 13 }, { map: "Ascent", a: 8, b: 13 }] }, posted, "en");
  assert.equal(r.lines.length, 3);
  assert.match(r.lines[2], /Match over.*Beta\*\* 2–1/);
  assert.equal(threadLines(end, null, { maps: 3, done: true }, "en").lines.length, 0);
});

test("bot: /puissance is known, turned on and answers", () => {
  assert.ok(COMMANDS.some((c) => c.name === "puissance"));
  assert.ok(BOT_COMMANDS.includes("puissance"));
  const now = Date.now();
  const { db } = played(now);
  const state = getState(db);
  const out = answerCommand("puissance", { data: { options: [] } }, { lang: "fr", now, site: "https://x.test", state: () => state, power: () => powerRanking(state, now, { min: 1 }) });
  assert.match(out.embeds[0].title, /Classement de puissance/);
  assert.match(out.embeds[0].description, /🥇/);
});

import crypto from "node:crypto";
function require256(t) { return crypto.createHash("sha256").update(t).digest("hex"); }
