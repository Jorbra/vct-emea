// A finished match whose vlr.gg page lacked something (no maps, a "TBD", a table missing) is read again until it has it all.
import test from "node:test";
import assert from "node:assert/strict";
import { REREAD_FOR, completeRead, rereadDue, rereadWait } from "../lib/vlrmatch.js";

const ten = Array.from({ length: 10 }, (_, i) => ({ name: `p${i}` }));
const map = (name, rows = ten, a = 13, b = 8) => ({ map: name, a, b, rows });
const found = (maps, { score = { sa: 2, sb: 1 }, pstats = ten } = {}) => ({ score, extra: { pstats, maps: maps.map((m) => ({ map: m.map, a: m.a, b: m.b })) }, details: { maps } });

test("vlr.gg: a read is complete with the score, one named map per map played, each with its table, and the totals", () => {
  assert.equal(completeRead(found([map("Bind"), map("Lotus"), map("Haven")])), true);
  assert.equal(completeRead(found([map("Bind"), map("Lotus")])), false); // a map missing
  assert.equal(completeRead(found([map("Bind"), map("Lotus"), map("TBD", [], 0, 0)])), false);
  assert.equal(completeRead(found([map("Bind"), map("Lotus"), map("Haven", ten, 9, 6)])), false); // the last map not over
  assert.equal(completeRead(found([map("Bind"), map("Lotus", []), map("Haven")])), false); // a table missing
  assert.equal(completeRead(found([map("Bind"), map("Lotus"), map("Haven")], { pstats: [] })), false);
  // no score understood: the maps over stand for it
  assert.equal(completeRead(found([map("Bind"), map("Lotus")], { score: null })), true);
  assert.equal(completeRead(found([map("TBD", [], 0, 0)], { score: null })), false);
  assert.equal(completeRead(found([map("Bind"), map("Lotus")], { score: { sa: 0, sb: 2 } })), true); // a 2-0: 2 maps
  assert.equal(completeRead(null), false);
  // a read saved before (no tables kept): the maps and the totals
  assert.equal(completeRead({ score: { sa: 2, sb: 0 }, extra: { pstats: ten, maps: [{ map: "Bind", a: 13, b: 5 }, { map: "Ascent", a: 14, b: 12 }] } }), true);
  assert.equal(completeRead({ score: null, extra: { pstats: [], maps: [{ map: "TBD" }] } }), false);
});

test("vlr.gg: an incomplete read is read again, every 15 minutes, then less often, for 2 days after the match", () => {
  const at = Date.parse("2026-11-28T15:00:00Z");
  const read = (minutes, reads, extra = {}) => ({ full: true, at: new Date(at + minutes * 60000).toISOString(), reads, complete: false, ...extra });
  const now = at + 120 * 60000;
  assert.equal(rereadDue(read(110, 1), at, now), false); // read 10 minutes ago
  assert.equal(rereadDue(read(100, 1), at, now), true); // 20 minutes ago
  assert.equal(rereadDue(read(100, 8), at, now), false); // after 6 reads: every 45 minutes
  assert.equal(rereadDue(read(70, 8), at, now), true);
  assert.equal(rereadWait(20), 120 * 60000);
  assert.equal(rereadDue(read(100, 1, { complete: true }), at, now), false); // it has it all
  assert.equal(rereadDue(read(100, 1), at, at + REREAD_FOR + 1), false); // 2 days on: left as it is
  assert.equal(rereadDue({ ...read(100, 1), full: false }, at, now), false); // never read in full: read anyway by the first rule
  // no time on the site: counted from its first read
  assert.equal(rereadDue(read(100, 1, { first: new Date(at).toISOString() }), NaN, now), true);
  assert.equal(rereadDue(read(100, 1, { first: new Date(at).toISOString() }), NaN, at + REREAD_FOR + 1), false);
  // an old read (no "complete" kept) that has it all is not read again
  assert.equal(rereadDue({ full: true, at: new Date(at).toISOString(), reads: 1, score: { sa: 2, sb: 0 }, extra: { pstats: ten, maps: [{ map: "Bind", a: 13, b: 5 }, { map: "Split", a: 7, b: 13 }] } }, at, now), false);
});
