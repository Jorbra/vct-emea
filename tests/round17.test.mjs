// Round 17: tense matches, the round by round story.
import test from "node:test";
import assert from "node:assert/strict";
import { nextRounds, tension } from "../lib/livemore.js";
import { liveUpdate } from "../lib/vlive.js";

test("tense moments: overtime on the map being played, the deciding map of the series", () => {
  assert.deepEqual(tension({ a: 1, b: 0, maps: [{ map: "Bind", a: 13, b: 5, done: true }, { map: "Haven", a: 12, b: 12, done: false }] }, 3), { ot: "Haven", decider: false, map: "Haven", a: 12, b: 12 });
  assert.equal(tension({ a: 1, b: 1, maps: [{ map: "Bind", a: 13, b: 5, done: true }, { map: "Haven", a: 9, b: 13, done: true }, { map: "Lotus", a: 2, b: 1 }] }, 3).decider, true);
  assert.equal(tension({ a: 1, b: 1, maps: [] }, 1).decider, false); // a Bo1 has no deciding map
  assert.equal(tension({ a: 0, b: 0, maps: [{ map: "TBD", a: 12, b: 12 }] }, 3).ot, ""); // a map vlr.gg has not named
  assert.deepEqual(tension(null, 3), { ot: "", decider: false, map: "", a: null, b: null });
});

test("round by round: a score kept each time it changes, 80 at most", () => {
  let r = nextRounds([], [{ map: "Bind", a: 0, b: 0 }], "t0");
  r = nextRounds(r, [{ map: "Bind", a: 0, b: 0 }], "t1");
  r = nextRounds(r, [{ map: "Bind", a: 1, b: 0 }], "t2");
  assert.deepEqual(r.map((x) => [x.at, x.a, x.b]), [["t0", 0, 0], ["t2", 1, 0]]);
  for (let i = 0; i < 100; i++) r = nextRounds(r, [{ map: "Bind", a: i, b: 1 }], `x${i}`);
  assert.equal(r.length, 80);
  // the live match keeps it from one read to the next
  const p1 = liveUpdate(null, { maps: [{ map: "Bind", a: 3, b: 1 }] }, false, Date.parse("2026-11-14T18:00:00Z"));
  const p2 = liveUpdate(p1, { maps: [{ map: "Bind", a: 4, b: 1 }] }, false, Date.parse("2026-11-14T18:03:00Z"));
  assert.deepEqual(p2.rounds.map((x) => [x.a, x.b]), [[3, 1], [4, 1]]);
});

test("the fans' MVP over the season: votes and matches won", async () => {
  const { openDb } = await import("../lib/db.js");
  const { motmSeason } = await import("../lib/fans.js");
  const db = openDb(":memory:");
  const add = (hash, event, id, player) => db.prepare("INSERT INTO motm (hash, event, id, player, at) VALUES (?, ?, ?, ?, ?)").run(hash, event, id, player, "2026-11-14");
  add("h1", "q2", "m1", "Pa1ze"); add("h2", "q2", "m1", "Pa1ze"); add("h3", "q2", "m1", "trexx");
  add("h1", "q2", "m2", "trexx");
  assert.deepEqual(motmSeason(db), [{ player: "Pa1ze", n: 2, matches: 1 }, { player: "trexx", n: 2, matches: 1 }]);
});
