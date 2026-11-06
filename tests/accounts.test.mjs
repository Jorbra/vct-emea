// Visitors' accounts, in memory.
import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../lib/db.js";
import { accountEditor, listRoles, setRole, changePassword, cleanFavorites, cleanPrefs, deleteAccount, logIn, makeAccountToken, readAccount, readAccountToken, removeAccount, resetPassword, saveAccount, signUp } from "../lib/accounts.js";
import { makeToken, readToken } from "../lib/auth.js";

const T1 = "a".repeat(40);
const T2 = "b".repeat(40);
const good = { name: "Lucas", password: "un-bon-mot" };

test("sign up: the name and password are checked, the password never kept nor returned", () => {
  const db = openDb(":memory:");
  assert.equal(signUp(db, { name: "x", password: "un-bon-mot" }).ok, false);
  assert.equal(signUp(db, { name: "Lucas<b>", password: "un-bon-mot" }).ok, false);
  assert.equal(signUp(db, { name: "Lucas", password: "court" }).ok, false);
  const r = signUp(db, { ...good, token: T1, favorites: ["fnatic", "BAD SLUG", 3], prefs: { theme: "light", lang: "xx", evil: 1 } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.account, { name: "Lucas", token: T1, favorites: ["fnatic"], prefs: { theme: "light" }, role: "" });
  assert.equal(signUp(db, { name: "LUCAS", password: "autre-mot-1" }).status, 409);
  const raw = db.prepare("SELECT * FROM accounts").get();
  assert.ok(!JSON.stringify(raw).includes("un-bon-mot"));
  assert.ok(!JSON.stringify(r).includes(raw.hash));
});

test("log in: wrong answers look the same, repeated ones lock the account, a good one clears them", () => {
  const db = openDb(":memory:");
  signUp(db, good);
  assert.equal(logIn(db, { name: "nobody", password: "x" }).error, "Wrong name or password.");
  assert.equal(logIn(db, { name: "Lucas", password: "x" }).error, "Wrong name or password.");
  assert.equal(logIn(db, { name: "lucas", password: "un-bon-mot" }).account.name, "Lucas"); // capitals do not matter
  const now = 1000000;
  for (let i = 0; i < 8; i++) assert.equal(logIn(db, { name: "Lucas", password: "x" }, now).status, 401);
  assert.equal(logIn(db, { ...good }, now + 1000).status, 429);
  assert.equal(logIn(db, { ...good }, now + 16 * 60000).ok, true);
});

test("a second device brings its favorites and predictions; then the account decides", () => {
  const db = openDb(":memory:");
  const ins = db.prepare("INSERT INTO predictions (hash, event, id, pick) VALUES (?, 'q1', ?, ?)");
  const hash = (t) => db.prepare("SELECT lower(hex(?)) AS x").get(t).x && t;
  signUp(db, { ...good, token: T1, favorites: ["a"] });
  // device 2 has voted under its own token
  const c = (t) => import("node:crypto").then((m) => m.default.createHash("sha256").update(t).digest("hex"));
  return Promise.all([c(T1), c(T2)]).then(([h1, h2]) => {
    db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, 'Device', 'x')").run(h2);
    ins.run(h2, "m1", "T");
    ins.run(h1, "m2", "A");
    ins.run(h2, "m2", "B");
    const r = logIn(db, { ...good, token: T2, favorites: ["b", "a"] });
    assert.deepEqual(r.account.favorites, ["a", "b"]);
    assert.equal(r.account.token, T1);
    const picks = db.prepare("SELECT id, pick FROM predictions WHERE hash = ? ORDER BY id").all(h1).map((x) => [x.id, x.pick]);
    assert.deepEqual(picks, [["m1", "T"], ["m2", "A"]]); // the account's own pick stays
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM predictions WHERE hash = ?").get(h2).n, 0);
    assert.equal(db.prepare("SELECT name FROM voters WHERE hash = ?").get(h1).name, "Device");
    // a favorite removed on a device is gone: no union after the login
    assert.equal(saveAccount(db, "Lucas", { favorites: ["b"], prefs: { countdown: false, lang: "tr" } }).ok, true);
    assert.equal(saveAccount(db, "Lucas", { prefs: { theme: "dark" } }).ok, true);
    assert.deepEqual(readAccount(db, "Lucas"), { name: "Lucas", token: T1, favorites: ["b"], prefs: { countdown: false, lang: "tr", theme: "dark" }, role: "" });
    assert.equal(hash, hash);
  });
});

test("the cookie: signed, dated, not an editor's, and ended by a new password or by deletion", () => {
  const db = openDb(":memory:");
  const s = "secret-secret-secret-secret";
  signUp(db, good);
  const t = makeAccountToken(s, "Lucas", 1);
  assert.equal(readAccountToken(db, t, s), "Lucas");
  assert.equal(readAccountToken(db, t, "other"), "");
  assert.equal(readAccountToken(db, `${t}x`, s), "");
  assert.equal(readAccountToken(db, makeAccountToken(s, "Lucas", 1, 0), s), ""); // too old
  assert.equal(readToken(t, s), null); // cannot open the editor
  assert.equal(readAccountToken(db, makeToken(s), s), "");
  assert.equal(changePassword(db, "Lucas", { password: "x", next: "nouveau-mot" }).ok, false);
  assert.equal(changePassword(db, "Lucas", { password: "un-bon-mot", next: "court" }).ok, false);
  const r = changePassword(db, "Lucas", { password: "un-bon-mot", next: "nouveau-mot" });
  assert.equal(r.ver, 2);
  assert.equal(readAccountToken(db, t, s), "");
  assert.equal(readAccountToken(db, makeAccountToken(s, "Lucas", 2), s), "Lucas");
  assert.equal(logIn(db, { name: "Lucas", password: "nouveau-mot" }).ok, true);
  assert.equal(deleteAccount(db, "Lucas", { password: "x" }).ok, false);
  assert.equal(deleteAccount(db, "Lucas", { password: "nouveau-mot" }).ok, true);
  assert.equal(readAccountToken(db, makeAccountToken(s, "Lucas", 2), s), "");
});

test("deleting takes the predictions too; a new password from an editor works and can be used once known", () => {
  const db = openDb(":memory:");
  signUp(db, { ...good, token: T1 });
  const r = resetPassword(db, "lucas");
  assert.ok(r.password.length >= 10);
  assert.equal(logIn(db, { name: "Lucas", password: "un-bon-mot" }).ok, false);
  assert.equal(logIn(db, { name: "Lucas", password: r.password }).ok, true);
  assert.equal(removeAccount(db, "Lucas").ok, true);
  assert.equal(resetPassword(db, "Lucas").ok, false);
  assert.deepEqual(cleanFavorites("no"), []);
  assert.deepEqual(cleanPrefs({ countdown: true, theme: "red" }), { countdown: true });
});

test("editor access: nothing by default, given and taken at once, never your own by accident", () => {
  const db = openDb(":memory:");
  const s = "secret-secret-secret-secret";
  signUp(db, good);
  signUp(db, { name: "Autre", password: "encore-un-mot" });
  const owner = makeAccountToken(s, "Lucas", 1);
  const other = makeAccountToken(s, "Autre", 1);
  assert.equal(accountEditor(db, owner, s), null);
  assert.equal(setRole(db, { name: "lucas", role: "boss" }).ok, false);
  assert.equal(setRole(db, { name: "nobody", role: "editor" }).ok, false);
  assert.equal(setRole(db, { name: "lucas", role: "owner" }).ok, true);
  assert.deepEqual(accountEditor(db, owner, s), { who: "", account: "Lucas" }); // same as the main account
  assert.equal(setRole(db, { name: "autre", role: "editor", by: "Lucas" }).name, "Autre");
  assert.deepEqual(accountEditor(db, other, s), { who: "Autre", account: "Autre" }); // an editor: not the main one
  assert.deepEqual(listRoles(db), [{ name: "Lucas", role: "owner" }, { name: "Autre", role: "editor" }]);
  assert.equal(setRole(db, { name: "LUCAS", role: "", by: "Lucas" }).status, 409);
  assert.equal(setRole(db, { name: "Autre", role: "", by: "Lucas" }).ok, true);
  assert.equal(accountEditor(db, other, s), null);
  // a signature, an expiry and a new password all still count
  assert.equal(accountEditor(db, owner, "other"), null);
  assert.equal(accountEditor(db, `${owner}x`, s), null);
  assert.equal(changePassword(db, "Lucas", { password: "un-bon-mot", next: "nouveau-mot" }).ok, true);
  assert.equal(accountEditor(db, owner, s), null);
  assert.equal(readAccount(db, "Lucas").role, "owner");
  // an account never gives itself anything: the sign-up ignores any role sent
  const r = signUp(db, { name: "Malin", password: "un-long-mot", role: "owner" });
  assert.equal(r.account.role, "");
});

