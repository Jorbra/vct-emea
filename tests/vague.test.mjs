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

test("editor: the finished matches read again until complete, with their reads and the next one", async () => {
  const { getState, openDb } = await import("../lib/db.js");
  const { saveQualifierScore, setQualifierTeams } = await import("../lib/qactions.js");
  const { allMatches } = await import("../lib/matchlist.js");
  const { vlrReport } = await import("../lib/round14.js");
  const db = openDb(":memory:");
  setQualifierTeams(db, "q1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "q1" && m.a && m.b && m.a.name && m.b.name);
  saveQualifierScore(db, { event: "q1", id: ms[0].id, sa: 2, sb: 0 });
  saveQualifierScore(db, { event: "q1", id: ms[1].id, sa: 2, sb: 1 });
  const now = Date.parse("2026-11-28T20:00:00Z");
  const seen = {
    [`q1:${ms[0].id}`]: { full: true, complete: false, reads: 2, at: "2026-11-28T19:50:00Z", first: "2026-11-28T19:00:00Z" },
    [`q1:${ms[1].id}`]: { full: true, complete: true, reads: 1, at: "2026-11-28T19:50:00Z" },
  };
  const r = vlrReport(getState(db), seen, undefined, {}, now);
  assert.deepEqual(r.retry.map((x) => [x.id, x.reads, x.next]), [[ms[0].id, 2, "2026-11-28T20:05:00.000Z"]]);
  // 2 days after its first read: left as it is
  assert.equal(vlrReport(getState(db), seen, undefined, {}, now + 2 * 86400000).retry.length, 0);
});
