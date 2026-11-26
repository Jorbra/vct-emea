// The Swiss table if the matches being played ended now (lib/tournament.js projectSwiss).
import test from "node:test";
import assert from "node:assert/strict";
import { projectSwiss, records } from "../lib/tournament.js";

const m = (id, a, b, sa = null, sb = null) => ({ id, stage: "swiss", round: 1, bo: 3, a, b, sa, sb });

test("projection: ahead in maps wins, level in maps goes to the map being played, level there stays open", () => {
  const matches = [m("s1-m01", "t1", "t2", 2, 0), m("s1-m02", "t3", "t4"), m("s1-m03", "t5", "t6"), m("s1-m04", "t7", "t8"), m("s1-m05", "t9", "t10")];
  const live = {
    "s1-m02": { a: 1, b: 0, maps: [{ map: "Abyss", a: 13, b: 8, done: true }, { map: "Lotus", a: 3, b: 7, done: false }] },
    "s1-m03": { a: 1, b: 1, maps: [{ a: 13, b: 8, done: true }, { a: 10, b: 13, done: true }, { a: 4, b: 9, done: false }] },
    "s1-m04": { a: 0, b: 0, maps: [{ a: 0, b: 0, done: false }] },
  };
  const { matches: p, ids } = projectSwiss(matches, live);
  assert.deepEqual([...ids].sort(), ["s1-m02", "s1-m03"]);
  assert.deepEqual([p[1].sa, p[1].sb], [2, 0]);
  assert.deepEqual([p[2].sa, p[2].sb], [1, 2]);
  assert.equal(p[3].sa, null);
  const rec = records([1, 2, 3, 4, 5, 6].map((n) => ({ id: `t${n}` })), p);
  assert.equal(rec.t3.w, 1);
  assert.equal(rec.t6.w, 1);
  assert.equal(matches[1].sa, null); // the real matches are left alone
});
