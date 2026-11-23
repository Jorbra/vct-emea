import test from "node:test";
import assert from "node:assert/strict";

test("the shared turn: one taker per gap, for every server", async () => {
  const { openDb } = await import("../lib/db.js");
  const { claimTurn } = await import("../lib/notify.js");
  const db = openDb(":memory:");
  const t = 1_800_000_000_000;
  assert.equal(claimTurn(db, "turn:x", 120000, t), true);
  assert.equal(claimTurn(db, "turn:x", 120000, t + 1000), false); // another server, a second later
  assert.equal(claimTurn(db, "turn:x", 120000, t + 119000), false);
  assert.equal(claimTurn(db, "turn:x", 120000, t + 120000), true); // the gap is over
  assert.equal(claimTurn(db, "turn:y", 120000, t + 1000), true); // another kind of work has its own turn
});
