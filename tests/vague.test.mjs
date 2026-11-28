// The big wave (grande-vague): what a finished map's rounds tell, and the rounds kept from the live follow-up.
import test from "node:test";
import assert from "node:assert/strict";
import { pistolsOf, roundFacts } from "../lib/roundfacts.js";
import { withRounds } from "../lib/tstats.js";

const R = (s) => s.split("").map((c) => `${c}te`);

test("rounds: the pistols, the longest run and the comeback of a map", () => {
  // b leads 0-5, then a takes 13 of the next 15
  const rnd = R("bbbbbaaaaaab" + "aabaaaa");
  const f = roundFacts(rnd);
  assert.deepEqual(f.pistols, ["b", "a"]);
  assert.deepEqual(f.run, { side: "a", n: 6, from: 6 });
  assert.deepEqual(f.comeback, { side: "a", down: 5 });
  assert.equal(f.ot, false);
  assert.equal(roundFacts(R("a")), null);
  assert.equal(roundFacts(R("aaaabbb")).comeback, null); // no winner yet
  assert.equal(roundFacts(R("abababababab" + "ababababababab")).ot, true);
  assert.deepEqual(pistolsOf([rnd, R("aaaaaaaaaaaa" + "a")], "a"), { won: 3, played: 4 });
});

test("rounds: a table read before they were kept takes those of the live follow-up when they add up", () => {
  const d = { all: [], maps: [{ map: "Lotus", a: 2, b: 1, rows: [] }, { map: "Bind", a: 1, b: 2, rows: [] }, { map: "Haven", a: 1, b: 0, rnd: ["ate"] }] };
  const out = withRounds(d, { Lotus: ["ate", "bce", "atb"], Bind: ["ate"], Haven: ["bte"] });
  assert.deepEqual(out.maps[0].rnd, ["ate", "bce", "atb"]);
  assert.equal(out.maps[1].rnd, undefined); // does not add up: left out
  assert.deepEqual(out.maps[2].rnd, ["ate"]); // its own stays
  assert.equal(withRounds(null, {}), null);
});

test("rounds: each half's pistol, then the half and the next round", async () => {
  const { halfPistols } = await import("../lib/tstats.js");
  // first half: a takes the pistol, the next round and 8 of 12; second half: b takes the pistol, a the next round, b 6 of 12
  const acc = halfPistols(R("aaabababaaab" + "babababababa"));
  assert.deepEqual(acc, { n: 2, half: 1, bonus: 1 });
  assert.deepEqual(halfPistols(R("aaa")), { n: 0, half: 0, bonus: 0 });
});
