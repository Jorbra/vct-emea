// New things shown to the editors first, then to everyone with one switch (lib/apercu.js).
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { APERCU, publicApercu, setApercu, shownApercu } from "../lib/apercu.js";

test("preview: an editor sees every new thing, a visitor none until it is opened to everyone, and it can be put back", () => {
  const db = openDb(":memory:");
  const all = Object.keys(APERCU);
  assert.deepEqual(shownApercu(db, true), all);
  assert.deepEqual(shownApercu(db, false), []);
  assert.equal(setApercu(db, "pictos", true).ok, true);
  assert.deepEqual(shownApercu(db, false), ["pictos"]);
  assert.equal(publicApercu(db).pictos, true);
  assert.deepEqual(shownApercu(db, true), all);
  setApercu(db, "pictos", false);
  assert.deepEqual(shownApercu(db, false), []);
  assert.equal(setApercu(db, "nope", true).ok, false);
});
