// The bot dashboard's activity and members' files (lib/botactivity.js): arrivals and departures counted per day, the
// last 30 days against the 30 before, a member's file, the uses of each command as the editor shows it.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { addSanction, cleanServer, handleEvent, makeMemory } from "../lib/botserver.js";
import { commandUsage, countMember, createdAt, memberFile, memberId, serverActivity } from "../lib/botactivity.js";
import { countUse, fillBot } from "../lib/botstore.js";

const NOW = Date.parse("2030-06-15T12:00:00Z");
const DAY = 86400000;
const G = "777000000000000001";

test("activity: arrivals and departures counted by the server's events, the bots left out", async () => {
  const db = getDb();
  const server = cleanServer({});
  const deps = { db, discord: async () => ({}), server, guild: G, memory: makeMemory(), now: NOW };
  await handleEvent("GUILD_MEMBER_ADD", { guild_id: G, user: { id: "111111111111111111", username: "a" }, roles: [] }, deps);
  await handleEvent("GUILD_MEMBER_ADD", { guild_id: G, user: { id: "111111111111111112", username: "b" }, roles: [] }, deps);
  await handleEvent("GUILD_MEMBER_ADD", { guild_id: G, user: { id: "111111111111111113", username: "bot", bot: true }, roles: [] }, deps);
  await handleEvent("GUILD_MEMBER_REMOVE", { guild_id: G, user: { id: "111111111111111111", username: "a" } }, deps);
  const a = serverActivity(db, G, NOW);
  assert.equal(a.days.length, 30);
  assert.equal(a.days[29].day, "2030-06-15");
  assert.deepEqual([a.days[29].joins, a.days[29].leaves], [2, 1]);
  assert.equal(a.counted, "2030-06-15");
  // another server's events are not counted here
  countMember(db, "777000000000000002", "join", NOW);
  assert.equal(serverActivity(db, G, NOW).totals.joins, 2);
});

test("activity: the last 30 days against the 30 before, sanctions without notes, tickets, commands", () => {
  const db = getDb();
  fillBot(db);
  countMember(db, G, "join", NOW - 40 * DAY);
  addSanction(db, { guild: G, user: "222222222222222221", kind: "warn", mod: "m", reason: "spam", at: NOW - 2 * DAY });
  addSanction(db, { guild: G, user: "222222222222222221", kind: "note", mod: "m", reason: "à surveiller", at: NOW - DAY });
  addSanction(db, { guild: G, user: "222222222222222222", kind: "ban", mod: "m", reason: "raid", at: NOW - 45 * DAY });
  db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened) VALUES (?, ?, ?, ?, ?)").run("T1", G, "222222222222222221", "Aide", new Date(NOW - 3 * DAY).toISOString());
  countUse(db, "warn", "u1", NOW - DAY);
  countUse(db, "warn", "u1", NOW - DAY);
  countUse(db, "pronostic-clic", "u1", NOW - DAY); // a click is not a command
  const a = serverActivity(db, G, NOW);
  assert.equal(a.totals.sanctions, 1, "the note is not a sanction");
  assert.equal(a.before.sanctions, 1);
  assert.equal(a.before.joins, 1);
  assert.equal(a.totals.tickets, 1);
  assert.equal(a.totals.commands, 2);
  assert.deepEqual(a.recentCases.slice(0, 3).map((c) => c.kind), ["ban", "note", "warn"], "newest case first");
  assert.equal(a.recentTickets[0].subject, "Aide");
});

test("members: an id from a mention, a link, a bare id; the account's date; the file", () => {
  assert.equal(memberId("<@222222222222222221>"), "222222222222222221");
  assert.equal(memberId("<@!222222222222222221>"), "222222222222222221");
  assert.equal(memberId("222222222222222221"), "222222222222222221");
  assert.equal(memberId("https://discord.com/users/222222222222222221"), "222222222222222221");
  assert.equal(memberId("pseudo"), "");
  assert.equal(createdAt("175928847299117063").slice(0, 10), "2016-04-30");
  assert.equal(createdAt("pas un id"), "");
  const db = getDb();
  addSanction(db, { guild: G, user: "222222222222222223", kind: "timeout", mod: "m", reason: "insultes", at: NOW - 60000, until: new Date(NOW + 3600000).toISOString() });
  addSanction(db, { guild: G, user: "222222222222222223", kind: "warn", mod: "m", reason: "spam", at: NOW - 120000 });
  db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened, closed) VALUES (?, ?, ?, ?, ?, ?)").run("T2", G, "222222222222222223", "Appel", new Date(NOW - DAY).toISOString(), new Date(NOW).toISOString());
  db.prepare("INSERT INTO bot_follows (user, team, name, at) VALUES (?, ?, ?, ?)").run("222222222222222223", "fnc", "FNATIC", new Date(NOW).toISOString());
  const f = memberFile(db, G, "222222222222222223", NOW);
  assert.deepEqual(f.counts, { timeout: 1, warn: 1 });
  assert.equal(f.sanctions[0].kind, "warn", "newest first");
  assert.deepEqual(f.active.map((r) => r.kind), ["timeout"], "a warning is in the file, not 'running'");
  assert.equal(f.tickets[0].subject, "Appel");
  assert.deepEqual(f.follows.map((x) => x.name), ["FNATIC"]);
  assert.deepEqual(memberFile(db, "777000000000000002", "222222222222222223", NOW).sanctions, [], "another server's file is apart");
});

test("commands: uses shown as the editor lists them, grouped commands summing their subcommands", () => {
  const db = getDb();
  const at = NOW + 400 * DAY; // a day no other test writes
  for (const [cmd, n] of [["warn", 2], ["unwarn", 1], ["warnings", 3], ["addrole", 1], ["role", 4], ["ticket", 2], ["close", 1], ["kick", 5]]) for (let k = 0; k < n; k++) countUse(db, cmd, "u", at);
  const u = commandUsage(db, at, 1);
  assert.equal(u.warn, 6);
  assert.equal(u.role, 1, "the moderators' /role: add and remove");
  assert.equal(u.meilleurs, 4, "the site's former /role");
  assert.equal(u.ticket, 3);
  assert.equal(u.close, 1);
  assert.equal(u.kick, 5);
  assert.equal(u.unwarn, undefined, "a former name is not shown");
});

test("member search: a case number leads to its member, and what the server knows of each member found", async () => {
  const { caseMember, memberBadges } = await import("../lib/botactivity.js");
  const db = getDb();
  fillBot(db);
  const S = "777000000000000009";
  const A = "333333333333333331";
  const B = "333333333333333332";
  addSanction(db, { guild: S, user: A, kind: "warn", mod: "m", reason: "spam", at: NOW - DAY });
  addSanction(db, { guild: S, user: A, kind: "warn", mod: "m", reason: "spam", at: NOW - DAY });
  addSanction(db, { guild: S, user: A, kind: "timeout", mod: "m", reason: "insultes", at: NOW - 60000, until: new Date(NOW + 3600000).toISOString() });
  addSanction(db, { guild: S, user: A, kind: "note", mod: "m", reason: "à surveiller", at: NOW });
  db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened) VALUES (?, ?, ?, ?, ?)").run("TS1", S, A, "Aide", new Date(NOW).toISOString());
  db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened, closed) VALUES (?, ?, ?, ?, ?, ?)").run("TS2", S, A, "Avant", new Date(NOW - DAY).toISOString(), new Date(NOW).toISOString());
  const id = db.prepare("SELECT id FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'timeout'").get(S, A).id;
  assert.equal(caseMember(db, S, `#${id}`), A);
  assert.equal(caseMember(db, S, `cas ${id}`), A);
  assert.equal(caseMember(db, S, "#999999"), "");
  assert.equal(caseMember(db, "777000000000000002", `#${id}`), "");
  assert.equal(caseMember(db, S, "Alice"), "");
  const b = memberBadges(db, S, [A, B, A], NOW);
  assert.deepEqual(b[A], { cases: 3, warns: 2, running: ["timeout"], tickets: 2, open: 1 });
  assert.deepEqual(b[B], { cases: 0, warns: 0, running: [], tickets: 0, open: 0 });
  assert.deepEqual(memberBadges(db, S, []), {});
});
