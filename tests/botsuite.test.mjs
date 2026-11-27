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

test("to do: open tickets nobody took (oldest first), sanctions ending within a day", async () => {
  const { todoOf } = await import("../lib/botactivity.js");
  const db = getDb();
  const g = "990000000000000002";
  const now = Date.parse("2030-04-01T12:00:00Z");
  const h = 3600000;
  const ins = db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened, closed, claimed) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ins.run("t-new", g, "u", "Récent", new Date(now - h).toISOString(), "", "");
  ins.run("t-old", g, "u", "Ancien", new Date(now - 30 * h).toISOString(), "", "");
  ins.run("t-taken", g, "u", "Pris", new Date(now - 40 * h).toISOString(), "", "mod");
  ins.run("t-closed", g, "u", "Fermé", new Date(now - 50 * h).toISOString(), new Date(now).toISOString(), "");
  addSanction(db, { guild: g, user: "x", kind: "tempban", mod: "m", at: now - h, until: new Date(now + 5 * h).toISOString() });
  addSanction(db, { guild: g, user: "y", kind: "timeout", mod: "m", at: now - h, until: new Date(now + 48 * h).toISOString() }); // not within a day
  addSanction(db, { guild: g, user: "z", kind: "timeout", mod: "m", at: now - 2 * h, until: new Date(now - h).toISOString() }); // over
  const t = todoOf(db, g, now);
  assert.deepEqual(t.unclaimed.map((x) => x.thread), ["t-old", "t-new"]);
  assert.deepEqual(t.ending.map((r) => r.user), ["x"]);
});

test("member's file: a warning and a time-out given from the editor, as the commands give them", async () => {
  const { editorSanction } = await import("../lib/botadmin.js");
  const db = getDb();
  const g = "990000000000000003";
  const calls = [];
  const discord = async (method, path, body, opts = {}) => { calls.push({ method, path, body, reason: opts.reason || "" }); if (path === "/users/@me/channels") return { id: "dm" }; return {}; };
  const told = [];
  const deps = { db, discord, server: cleanServer({}), guild: g, who: "Camille", notify: (t) => told.push(t), now: Date.parse("2030-05-01T12:00:00Z") };
  assert.match((await editorSanction(deps, { user: "123456789012345678", kind: "warn", reason: "" })).error, /raison/);
  const w = await editorSanction(deps, { user: "123456789012345678", kind: "warn", reason: "Spam" });
  assert.ok(w.ok, w.error);
  const row = db.prepare("SELECT kind, mod, reason FROM bot_sanctions WHERE guild = ? ORDER BY id DESC").get(g);
  assert.deepEqual([row.kind, row.mod], ["warn", "editor"]);
  assert.match(row.reason, /Spam \(Camille, depuis le site\)/);
  assert.ok(calls.some((c) => c.path === "/channels/dm/messages"), "the member is told in private");
  assert.match(told[0], /avertissement/);
  const t = await editorSanction(deps, { user: "123456789012345678", kind: "timeout", duration: "1h", reason: "Insultes" });
  assert.ok(t.ok, t.error);
  const patch = calls.find((c) => c.method === "PATCH");
  assert.equal(patch.body.communication_disabled_until, "2030-05-01T13:00:00.000Z");
  assert.match(patch.reason, /depuis l'éditeur du site par Camille/);
  assert.match((await editorSanction(deps, { user: "123456789012345678", kind: "timeout", duration: "plus tard" })).error, /Durée illisible/);
  assert.match((await editorSanction(deps, { user: "123456789012345678", kind: "timeout", duration: "30d" })).error, /28 jours/);
  const u = await editorSanction(deps, { user: "123456789012345678", kind: "untimeout" });
  assert.ok(u.ok);
  assert.equal(calls.filter((c) => c.method === "PATCH").pop().body.communication_disabled_until, null);
});

test("member's file: a kick and a ban from the editor, the member told first, the case taken back if Discord refuses", async () => {
  const { editorSanction } = await import("../lib/botadmin.js");
  const db = getDb();
  const g = "990000000000000004";
  const calls = [];
  let refuse = false;
  const discord = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, reason: opts.reason || "" });
    if (path === "/users/@me/channels") return { id: "dm" };
    if (refuse && (method === "PUT" || method === "DELETE")) throw Object.assign(new Error("Missing Permissions"), { code: 50013, status: 403 });
    return {};
  };
  const deps = { db, discord, server: cleanServer({}), guild: g, who: "Camille", now: Date.parse("2030-06-01T12:00:00Z") };
  assert.match((await editorSanction(deps, { user: "223456789012345678", kind: "ban", reason: "" })).error, /raison du bannissement/);
  const k = await editorSanction(deps, { user: "223456789012345678", kind: "kick", reason: "Hors sujet" });
  assert.ok(k.ok, k.error);
  const dm = calls.findIndex((c) => c.path === "/channels/dm/messages");
  const kick = calls.findIndex((c) => c.method === "DELETE" && c.path === `/guilds/${g}/members/223456789012345678`);
  assert.ok(dm >= 0 && kick > dm, "the private message goes before the kick");
  const b = await editorSanction(deps, { user: "223456789012345678", kind: "ban", reason: "Raid", deleteDays: 7 });
  assert.ok(b.ok, b.error);
  assert.equal(calls.find((c) => c.method === "PUT").body.delete_message_seconds, 7 * 86400);
  const before = db.prepare("SELECT COUNT(*) AS n FROM bot_sanctions WHERE guild = ?").get(g).n;
  refuse = true;
  const no = await editorSanction(deps, { user: "223456789012345678", kind: "ban", reason: "Encore" });
  assert.match(no.error, /n'a pas le droit/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bot_sanctions WHERE guild = ?").get(g).n, before, "no case kept for a refused ban");
});

test("team: each moderator's 30 days, AutoMod left out, notes not counted as sanctions, tickets and ratings", async () => {
  const { teamActivity } = await import("../lib/botactivity.js");
  const db = getDb();
  const g = "990000000000000005";
  const now = Date.parse("2030-07-01T12:00:00Z");
  const day = 86400000;
  addSanction(db, { guild: g, user: "u1", kind: "warn", mod: "modA", at: now - day });
  addSanction(db, { guild: g, user: "u2", kind: "ban", mod: "modA", at: now - 2 * day });
  addSanction(db, { guild: g, user: "u2", kind: "note", mod: "modA", at: now - 2 * day });
  addSanction(db, { guild: g, user: "u3", kind: "warn", mod: "modB", at: now - 40 * day }); // too old
  addSanction(db, { guild: g, user: "u3", kind: "warn", mod: "auto", at: now - day }); // AutoMod
  const ins = db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened, claimed, rating) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ins.run("tm1", g, "u1", "a", new Date(now - day).toISOString(), "modB", "5");
  ins.run("tm2", g, "u1", "b", new Date(now - day).toISOString(), "modB", "4");
  ins.run("tm3", g, "u1", "c", new Date(now - day).toISOString(), "modB", "");
  const t = teamActivity(db, g, now);
  assert.deepEqual(t.map((m) => m.mod), ["modB", "modA"]);
  assert.equal(t[1].total, 2);
  assert.deepEqual(t[1].kinds, { warn: 1, ban: 1, note: 1 });
  assert.equal(t[0].tickets, 3);
  assert.equal(t[0].rating, 4.5);
  assert.equal(t[0].rated, 2);
});

test("backup: the bot's settings back in place from a backup, cleaned as any save", async () => {
  const { botSettings, saveBotSettings } = await import("../lib/botstore.js");
  const { botServer, saveBotServer } = await import("../lib/botserver.js");
  const db = getDb();
  saveBotServer(db, { tickets: { ...botServer(db).tickets, canned: [{ title: "Avant", text: "texte" }] } });
  const backup = JSON.parse(JSON.stringify({ kind: "vct-bot-backup", version: 1, settings: botSettings(db), server: botServer(db) }));
  saveBotServer(db, { tickets: { ...botServer(db).tickets, canned: [] } });
  assert.deepEqual(botServer(db).tickets.canned, []);
  // what the restore action does
  saveBotSettings(db, backup.settings);
  saveBotServer(db, { ...backup.server, modules: { ...backup.server.modules, polls: "pas un booléen" } });
  assert.equal(botServer(db).tickets.canned[0].title, "Avant");
  assert.equal(typeof botServer(db).modules.polls, "boolean", "a wrong value is cleaned, as on any save");
});
