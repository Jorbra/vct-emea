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
