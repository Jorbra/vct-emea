// A first-round slot with one team only (a bye) is not a match waiting for its score (lib/matchlist.js).
import test from "node:test";
import assert from "node:assert/strict";
import { isBye } from "../lib/matchlist.js";

test("byes: one team in a first-round slot, nobody against it", () => {
  assert.equal(isBye({ first: true, a: { name: "Szach Mat" }, b: null }), true);
  assert.equal(isBye({ first: true, a: null, b: { name: "Passion" } }), true);
  assert.equal(isBye({ first: true, a: { name: "A" }, b: { name: "B" } }), false);
  // later rounds wait for the winner of the round before: not a bye
  assert.equal(isBye({ first: false, a: { name: "A" }, b: null }), false);
  assert.equal(isBye({ first: true, a: null, b: null }), false);
});
