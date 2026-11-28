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
  saveAccess(db, {}, GUILD);
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

test("account and Discord: a code ties them, predictions follow, the roles give the account its level", async () => {
  const { accountDiscord, accountOfCode, discordLevel, linkAccount, makeAccountCode, unlinkAccount } = await import("../lib/accountdiscord.js");
  const { signUp } = await import("../lib/accounts.js");
  const db = getDb();
  const N1 = `L${Date.now().toString(36)}`;
  const N2 = `${N1}b`;
  const r = signUp(db, { name: N1, password: "motdepasse1", token: `tok_${N1}_abcdefghijklmnopqrstuv` });
  assert.ok(r.ok, r.error);
  const code = makeAccountCode(db, N1, NOW);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(accountOfCode(db, code, NOW + MIN), N1);
  assert.equal(accountOfCode(db, code, NOW + 16 * MIN), "", "15 minutes");
  const U = "333333333333333331";
  assert.equal(linkAccount(db, code, { id: U, name: "lucie_dc" }, NOW + MIN), N1);
  assert.deepEqual(accountDiscord(db, N1), { id: U, name: "lucie_dc" });
  assert.equal(linkAccount(db, code, { id: U, name: "x" }, NOW + MIN), "", "used once");
  assert.ok(db.prepare("SELECT 1 FROM bot_links WHERE user = ?").get(U), "predictions count for the account");
  // the level from the roles, kept 10 minutes, no access when no role is chosen
  saveAccess(db, { editor: [], moderator: [] }, GUILD);
  let asked = 0;
  const member = async () => { asked += 1; return { roles: [MOD] }; };
  assert.equal(await discordLevel(db, U, member, NOW), "");
  assert.equal(asked, 0, "Discord not asked when no role opens the editor");
  saveAccess(db, { editor: [ED], moderator: [MOD] }, GUILD);
  assert.equal(await discordLevel(db, U, member, NOW), "moderator");
  assert.equal(await discordLevel(db, U, member, NOW + 5 * MIN), "moderator");
  assert.equal(asked, 1);
  assert.equal(await discordLevel(db, U, async () => null, NOW + 11 * MIN), "", "left the server");
  // another account linked to the same Discord takes it over
  signUp(db, { name: N2, password: "motdepasse1", token: `tok_${N2}_abcdefghijklmnopqrstu` });
  linkAccount(db, makeAccountCode(db, N2, NOW), { id: U, name: "lucie_dc" }, NOW);
  assert.equal(accountDiscord(db, N1), null);
  assert.equal(unlinkAccount(db, N2), true);
  assert.equal(accountDiscord(db, N2), null);
  assert.equal(db.prepare("SELECT 1 FROM bot_links WHERE user = ?").get(U), undefined);
});
