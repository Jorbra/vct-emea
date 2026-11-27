// The bot, next steps: the commands' delays kept in the database, the tickets' saved answers, the members to keep an eye on.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { checkRule, cleanRules } from "../lib/botdash.js";
import { dbCooldowns } from "../lib/botstore.js";
import { addSanction, cleanServer } from "../lib/botserver.js";
import { watchList } from "../lib/botactivity.js";

test("delays: a command's delay survives a restart (kept in the database, not only in memory)", () => {
  const db = getDb();
  const rule = cleanRules({ score: { cooldown: 60 } }).score;
  const i = { member: { user: { id: "u1" }, roles: [], permissions: "0" }, channel_id: "c" };
  const now = Date.parse("2030-01-01T12:00:00Z");
  assert.equal(checkRule(rule, i, dbCooldowns(db, new Map()), now, "score"), "");
  // the site restarted: a new, empty memory
  assert.match(checkRule(rule, i, dbCooldowns(db, new Map()), now + 10000, "score"), /Attends encore un peu/);
  assert.equal(checkRule(rule, i, dbCooldowns(db, new Map()), now + 61000, "score"), "", "the delay is over");
  // another member is not held back
  assert.equal(checkRule(rule, { ...i, member: { ...i.member, user: { id: "u2" } } }, dbCooldowns(db, new Map()), now + 62000, "score"), "");
});

test("tickets: saved answers kept with a title and a text, 20 at most", () => {
  const s = cleanServer({ tickets: { canned: [{ title: "Compte à lier", text: "Va dans Réglages → Compte." }, { title: "", text: "sans titre" }, { title: "sans texte", text: "" }, ...Array.from({ length: 30 }, (_, k) => ({ title: `R${k}`, text: "x" }))] } });
  assert.equal(s.tickets.canned[0].title, "Compte à lier");
  assert.equal(s.tickets.canned.length, 20);
  assert.ok(!s.tickets.canned.some((c) => c.title === "sans texte" || c.text === "sans titre"));
  assert.deepEqual(cleanServer({}).tickets.canned, []);
});

test("members to watch: a sanction running or 2 warnings in 30 days, the running ones first", () => {
  const db = getDb();
  const g = "990000000000000001";
  const now = Date.parse("2030-03-01T12:00:00Z");
  const day = 86400000;
  addSanction(db, { guild: g, user: "a", kind: "warn", mod: "m", at: now - 2 * day });
  addSanction(db, { guild: g, user: "a", kind: "warn", mod: "m", at: now - 3 * day });
  addSanction(db, { guild: g, user: "b", kind: "warn", mod: "m", at: now - 2 * day });
  addSanction(db, { guild: g, user: "b", kind: "warn", mod: "m", at: now - 40 * day }); // too old to count
  addSanction(db, { guild: g, user: "c", kind: "timeout", mod: "m", at: now - 60000, until: new Date(now + 3600000).toISOString() });
  addSanction(db, { guild: g, user: "d", kind: "timeout", mod: "m", at: now - 2 * day, until: new Date(now - day).toISOString() }); // over
  const w = watchList(db, g, now);
  assert.deepEqual(w.map((m) => m.user), ["c", "a"]);
  assert.deepEqual(w[0].running, ["timeout"]);
  assert.equal(w[1].warns30, 2);
});
