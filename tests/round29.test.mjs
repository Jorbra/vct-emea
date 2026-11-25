// Round 29: league fantasy, the day's recap, the daily quiz, the match day home, the season's period, search from one letter, offline week.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { fantasyRanking, fillRound7 } from "../lib/round7.js";

test("fantasy: a private league ranks its members only", () => {
  const db = openDb(":memory:");
  fillRound7(db);
  const now = new Date().toISOString();
  for (const [hash, name] of [["h1", "Ana"], ["h2", "Ben"], ["h3", "Cy"]]) {
    db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, ?, ?)").run(hash, name, now);
    db.prepare("INSERT INTO fantasy (hash, slots, past, updated) VALUES (?, ?, '[]', ?)").run(hash, JSON.stringify([]), now);
  }
  assert.equal(fantasyRanking(db, new Map()).length, 3);
  assert.deepEqual(fantasyRanking(db, new Map(), { only: ["h1", "h3"] }).map((r) => r.name), ["Ana", "Cy"]);
});

test("day recap: results in order, player of the day, standout line, closest map and the fans' MVP", async () => {
  const { dayRecap } = await import("../lib/dayrecap.js");
  const state = { qualifiers: {}, matches: [] };
  const m = (id, at, sa, sb) => ({ event: "playoffs", id, at, a: { name: "Alpha", tag: "ALP" }, b: { name: "Beta", tag: "BET" }, sa, sb, win: sa > sb ? "a" : "b" });
  const list = [m("2", "2026-11-24T19:00:00Z", 2, 1), m("1", "2026-11-24T16:00:00Z", 0, 2), m("3", "2026-11-25T16:00:00Z", 2, 0)];
  const details = (e, id) => ({
    "1": { all: [{ name: "zed", r: 1.1, acs: 210 }], maps: [{ map: "Lotus", a: 13, b: 11, rows: [{ name: "zed", k: 22 }] }] },
    "2": { all: [{ name: "kai", r: 1.4, acs: 280 }], maps: [{ map: "Bind", a: 14, b: 12, rows: [{ name: "kai", k: 31, acs: 300 }] }, { map: "Haven", a: 13, b: 3, rows: [] }] },
  })[id];
  const votes = (e, id) => (id === "2" ? { total: 5, counts: [{ player: "kai", n: 4 }] } : { total: 0, counts: [] });
  const r = dayRecap({ ...state, _all: list }, "2026-11-24", details, votes, () => list);
  assert.deepEqual(r.matches.map((x) => x.id), ["1", "2"]);
  assert.equal(r.star.name, "kai");
  assert.equal(r.best.k, 31);
  assert.equal(r.closest.map, "Bind"); // 2 rounds apart like Lotus, but longer
  assert.equal(r.fans.name, "kai");
});

test("quiz of the day: one go per day, the streak of right answers in a row", async () => {
  const { streaks, answerDailyQuiz, myDailyQuiz, dailyQuiz } = await import("../lib/dailyquiz.js");
  assert.deepEqual(streaks([[true, true, false], [true, true]]), { streak: 2, best: 2 });
  assert.deepEqual(streaks([[true, true, true], [true, false]]), { streak: 0, best: 4 });
  const db = openDb(":memory:");
  const at = (d) => new Date(Date.UTC(2026, 10, d, 18)).toISOString();
  // the playoffs' Swiss matches, as the state keeps them: teams by id, the time apart
  const teams = Array.from({ length: 16 }, (_, i) => ({ id: `t${i}`, name: `Team ${i}` }));
  const matches = Array.from({ length: 8 }, (_, i) => ({ id: `r1m${i}`, stage: "swiss", round: 1, a: `t${2 * i}`, b: `t${2 * i + 1}`, sa: 2, sb: 1, bo: 3 }));
  const times = Object.fromEntries(matches.map((m, i) => [m.id, at(18 + (i % 5))]));
  const state = { teams, matches, times: { playoffs: times }, qualifiers: {}, regional: {}, kickoff: { teams: [], matches: [] }, extra: {} };
  const now = Date.UTC(2026, 10, 24, 12);
  const quiz = dailyQuiz(state, "2026-11-24");
  assert.equal(quiz.length, 3);
  const token = "t".repeat(30);
  const answers = Object.fromEntries(quiz.map((q) => [q.id, q.answer]));
  const r = answerDailyQuiz(db, state, { token, answers }, now);
  assert.equal(r.ok, true);
  assert.equal(r.streak, quiz.length);
  assert.equal(answerDailyQuiz(db, state, { token, answers }, now).ok, false); // once a day
  assert.equal(myDailyQuiz(db, token, now).today.length, quiz.length);
});

test("match day home: countdown before the first match, live once one started, the recap when all are over", async () => {
  const { matchDayState } = await import("../lib/matchday.js");
  const t = (h) => new Date(Date.UTC(2026, 10, 24, h)).toISOString();
  const now = Date.UTC(2026, 10, 24, 15);
  assert.equal(matchDayState([], now), null);
  const before = matchDayState([{ at: t(17), sa: null }, { at: t(19), sa: null }], now);
  assert.equal(before.kind, "before");
  assert.equal(before.left, 2 * 3600e3);
  assert.equal(matchDayState([{ at: t(14), sa: null }, { at: t(19), sa: null }], now).kind, "live");
  assert.equal(matchDayState([{ at: t(12), sa: 2 }, { at: t(14), sa: 0 }], now).kind, "over");
});

test("season period: Kickoff in January, Masters in March and June, Champions in September, off-season in November", async () => {
  const { periodOf } = await import("../lib/period.js");
  const at = (m, d) => Date.UTC(2027, m - 1, d, 12);
  assert.equal(periodOf(at(1, 20), ""), "kickoff");
  assert.equal(periodOf(at(3, 5), ""), "masters");
  assert.equal(periodOf(at(6, 10), ""), "masters");
  assert.equal(periodOf(at(4, 15), ""), "stage");
  assert.equal(periodOf(at(9, 20), ""), "champions");
  assert.equal(periodOf(at(11, 25), ""), "offseason");
  assert.equal(periodOf(at(11, 25), "champions"), "champions"); // forced on the server
});
