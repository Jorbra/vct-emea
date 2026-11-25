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
