// The editor opened from Discord (lib/staffaccess.js): the roles that open it, the one-use links, the access that follows
// the roles.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { checkStaff, dropStaff, levelFor, listStaff, makeStaffCode, readAccess, saveAccess, staffOf, useStaffCode } from "../lib/staffaccess.js";

const NOW = Date.parse("2030-06-15T12:00:00Z");
const MIN = 60000;
const GUILD = "900000000000000000";
const ED = "900000000000000001";
const MOD = "900000000000000002";

test("staff: the roles chosen, @everyone and duplicates left out, a role in one level only", () => {
  const db = getDb();
  assert.deepEqual(readAccess(db), { editor: [], moderator: [] });
  const a = saveAccess(db, { editor: [ED, ED, GUILD, "pas un rôle"], moderator: [MOD, ED] }, GUILD);
  assert.deepEqual(a, { editor: [ED], moderator: [MOD] });
  assert.deepEqual(readAccess(db), a);
  assert.equal(levelFor(a, ["1", MOD]), "moderator");
  assert.equal(levelFor(a, [MOD, ED]), "editor");
  assert.equal(levelFor(a, ["1"]), "");
  assert.equal(levelFor(a, undefined), "");
});

test("staff: a link works once, for 10 minutes, for the member it was made for", () => {
  const db = getDb();
  assert.equal(makeStaffCode(db, { id: "111111111111111111", name: "x", level: "owner" }, NOW), "");
  const code = makeStaffCode(db, { id: "111111111111111111", name: "Alice", level: "editor" }, NOW);
  assert.match(code, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(useStaffCode(db, "wrong-code-wrong-code-wrong", NOW), null);
  const s = useStaffCode(db, code, NOW + MIN);
  assert.equal(s.id, "111111111111111111");
  assert.equal(s.level, "editor");
  assert.equal(useStaffCode(db, code, NOW + MIN), null, "used once");
  const old = makeStaffCode(db, { id: "111111111111111112", name: "Bob", level: "moderator" }, NOW);
  assert.equal(useStaffCode(db, old, NOW + 11 * MIN), null, "too old");
  // a new link replaces the last one
  const one = makeStaffCode(db, { id: "111111111111111113", name: "C", level: "editor" }, NOW);
  const two = makeStaffCode(db, { id: "111111111111111113", name: "C", level: "editor" }, NOW + 1000);
  assert.equal(useStaffCode(db, one, NOW + 2000), null);
  assert.ok(useStaffCode(db, two, NOW + 2000));
  assert.ok(listStaff(db).some((x) => x.id === "111111111111111113"));
});

test("staff: the access follows the roles, asked again after 10 minutes", async () => {
  const db = getDb();
  saveAccess(db, { editor: [ED], moderator: [MOD] }, GUILD);
  const id = "222222222222222221";
  makeStaffCode(db, { id, name: "Dan", level: "editor" }, NOW);
  let asked = 0;
  let roles = [ED];
  const getMember = async () => { asked += 1; return roles ? { roles, nick: "Dan le modo", user: { username: "dan" } } : null; };
  assert.equal((await checkStaff(db, id, getMember, NOW + 5 * MIN)).level, "editor");
  assert.equal(asked, 0, "not asked again before 10 minutes");
  roles = [MOD];
  const s = await checkStaff(db, id, getMember, NOW + 11 * MIN);
  assert.deepEqual([s.level, s.name, asked], ["moderator", "Dan le modo", 1]);
  roles = ["1"];
  assert.equal(await checkStaff(db, id, getMember, NOW + 22 * MIN), null, "the role is gone");
  assert.equal(staffOf(db, id), null);
});

test("staff: Discord out of reach keeps a recent check for an hour, a member gone loses it", async () => {
  const db = getDb();
  const id = "222222222222222222";
  makeStaffCode(db, { id, name: "Eve", level: "moderator" }, NOW);
  const down = async () => { throw new Error("Discord down"); };
  assert.equal((await checkStaff(db, id, down, NOW + 30 * MIN)).level, "moderator");
  assert.equal((await checkStaff(db, id, null, NOW + 50 * MIN)).level, "moderator");
  assert.equal(await checkStaff(db, id, down, NOW + 61 * MIN), null);
  makeStaffCode(db, { id, name: "Eve", level: "moderator" }, NOW);
  assert.equal(await checkStaff(db, id, async () => null, NOW + 11 * MIN), null, "left the server");
  assert.equal(staffOf(db, id), null);
  makeStaffCode(db, { id, name: "Eve", level: "moderator" }, NOW);
  assert.equal(dropStaff(db, id), true);
  assert.equal(await checkStaff(db, id, down, NOW), null);
});
