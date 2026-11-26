// The bot's server commands (lib/botmod.js): permissions, role order, and what is asked of Discord, with a pretend Discord.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { MOD_COMMANDS, P, canActOn, canGiveRole, closeTicket, hasPerm, openTicket, purgeable, runModCommand, ticketName, topPosition } from "../lib/botmod.js";
import { COMMANDS } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const ROLES = [{ id: "g", position: 0 }, { id: "mod", position: 5 }, { id: "vip", position: 3 }, { id: "admin", position: 8 }, { id: "botrole", position: 9, managed: true }];

test("server commands: registered, can be turned off, each one for the members with its permission", () => {
  for (const c of MOD_COMMANDS) {
    assert.ok(COMMANDS.some((x) => x.name === c.name), c.name);
    assert.ok(BOT_COMMANDS.includes(c.name), c.name);
    assert.deepEqual(c.contexts, [0]);
    // a required option never after an optional one (Discord refuses the list)
    const req = (c.options || []).map((o) => !!o.required);
    assert.deepEqual(req, [...req].sort((x, y) => Number(y) - Number(x)), c.name);
  }
  const open = MOD_COMMANDS.filter((c) => !c.default_member_permissions).map((c) => c.name);
  assert.deepEqual(open, ["serveur", "membre", "ticket", "fermer"]);
});

test("permissions and the order of roles: a moderator never acts on someone at or above them", () => {
  assert.equal(hasPerm(String(P.KICK), P.KICK), true);
  assert.equal(hasPerm(String(P.MANAGE_MESSAGES), P.BAN), false);
  assert.equal(hasPerm(String(P.ADMIN), P.BAN), true);
  assert.equal(hasPerm("not a number", P.BAN), false);
  assert.equal(topPosition(["vip", "mod"], ROLES), 5);
  assert.equal(topPosition([], ROLES), 0);
  const base = { modId: "m", modRoles: ["mod"], ownerId: "o", roles: ROLES };
  assert.equal(canActOn({ ...base, targetId: "t", targetRoles: ["vip"] }), "");
  assert.equal(canActOn({ ...base, targetId: "t", targetRoles: ["mod"] }), "higher");
  assert.equal(canActOn({ ...base, targetId: "t", targetRoles: ["admin"] }), "higher");
  assert.equal(canActOn({ ...base, targetId: "m", targetRoles: [] }), "self");
  assert.equal(canActOn({ ...base, targetId: "o", targetRoles: [] }), "owner");
  assert.equal(canActOn({ ...base, modId: "o", targetId: "t", targetRoles: ["admin"] }), "");
  assert.equal(canGiveRole({ ...base, roleId: "vip" }), "");
  assert.equal(canGiveRole({ ...base, roleId: "admin" }), "higher");
  assert.equal(canGiveRole({ ...base, roleId: "mod" }), "higher");
  assert.equal(canGiveRole({ ...base, roleId: "botrole", modId: "o" }), "managed");
  assert.equal(canGiveRole({ ...base, roleId: "nope" }), "unknown");
});

test("helpers: a ticket's name, the messages /purge may delete", () => {
  assert.equal(ticketName("Zéphyr_42", "Problème de rôle !"), "ticket-zephyr-42-probleme-de-role");
  assert.equal(ticketName("", ""), "ticket-membre");
  const now = Date.parse("2026-11-26T12:00:00Z");
  const msgs = [
    { id: "1", timestamp: "2026-11-26T11:00:00Z", author: { id: "a" } },
    { id: "2", timestamp: "2026-11-26T10:00:00Z", author: { id: "b" }, pinned: true },
    { id: "3", timestamp: "2026-11-25T10:00:00Z", author: { id: "b" } },
    { id: "4", timestamp: "2026-11-01T10:00:00Z", author: { id: "a" } }, // over 14 days
  ];
  assert.deepEqual(purgeable(msgs, { count: 10, now }), ["1", "3"]);
  assert.deepEqual(purgeable(msgs, { count: 10, author: "b", now }), ["3"]);
  assert.deepEqual(purgeable(msgs, { count: 1, now }), ["1"]);
});

/** A pretend Discord: records each call, answers what the commands read. */
function fakeDiscord() {
  const calls = [];
  let threads = 0;
  const fn = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, reason: opts.reason || "" });
    if (method === "GET" && /\/roles$/.test(path)) return ROLES;
    if (method === "GET" && /^\/guilds\/G\??/.test(path) && !path.includes("/channels")) return { owner_id: "o", name: "Serveur test", roles: ROLES, approximate_member_count: 42 };
    if (method === "GET" && /\/channels\/C\/messages/.test(path)) return [{ id: "m1", timestamp: new Date().toISOString(), author: { id: "x" } }, { id: "m2", timestamp: new Date().toISOString(), author: { id: "y" } }];
    if (method === "GET" && path === "/channels/C") return { permission_overwrites: [{ id: "G", allow: "0", deny: "1024" }] };
    if (method === "POST" && path === "/users/@me/channels") return { id: "dm1" };
    if (method === "POST" && /\/threads$/.test(path)) return { id: `T${++threads}` };
    return {};
  };
  return { fn, calls };
}
const interaction = (name, options, { perms = String(P.MODERATE | P.KICK | P.BAN | P.MANAGE_MESSAGES | P.MANAGE_CHANNELS | P.MANAGE_ROLES | P.MANAGE_GUILD), roles = ["mod"], resolved = {} } = {}) => ({
  guild_id: "G", channel_id: "C", member: { user: { id: "m", username: "modo" }, roles, permissions: perms },
  data: { name, options: Object.entries(options).map(([k, v]) => ({ name: k, value: v })), resolved },
});
const target = (id, roles) => ({ users: { [id]: { id, username: `u${id}` } }, members: { [id]: { roles } } });

test("moderation: warn (kept, told in private), time out, kick refused above one's role, bans with the reason in the audit log", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  let r = await runModCommand(interaction("avertir", { membre: "t1", raison: "spam" }, { resolved: target("t1", ["vip"]) }), deps);
  assert.match(r.content, /averti \(1 avertissement en tout\)/);
  assert.ok(d.calls.some((c) => c.path === "/channels/dm1/messages" && /spam/.test(c.body.content)));
  r = await runModCommand(interaction("avertissements", { membre: "t1" }, { resolved: target("t1", ["vip"]) }), deps);
  assert.match(r.content, /spam — <@m>/);
  r = await runModCommand(interaction("exclure", { membre: "t1", duree: 600, raison: "calme" }, { resolved: target("t1", ["vip"]) }), deps);
  assert.match(r.content, /exclu pour 10 minutes/);
  const patch = d.calls.find((c) => c.method === "PATCH" && c.path === "/guilds/G/members/t1");
  assert.ok(patch.body.communication_disabled_until);
  assert.match(patch.reason, /modo \(m\) : calme/);
  r = await runModCommand(interaction("expulser", { membre: "t2" }, { resolved: target("t2", ["admin"]) }), deps);
  assert.match(r.content, /rôle égal ou supérieur/);
  assert.ok(!d.calls.some((c) => c.method === "DELETE" && c.path === "/guilds/G/members/t2"));
  r = await runModCommand(interaction("bannir", { membre: "t3", messages: 86400 }, { resolved: { users: { t3: { id: "t3", username: "gone" } } } }), deps);
  assert.match(r.content, /banni/);
  assert.equal(d.calls.find((c) => c.method === "PUT" && c.path === "/guilds/G/bans/t3").body.delete_message_seconds, 86400);
  // without the permission, nothing is asked of Discord
  const before = d.calls.length;
  r = await runModCommand(interaction("bannir", { membre: "t4" }, { perms: String(P.MANAGE_MESSAGES), resolved: target("t4", []) }), deps);
  assert.match(r.content, /pas la permission/);
  assert.equal(d.calls.length, before);
});

test("server management: purge, lock keeps the channel's other rules, roles only below one's own", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  let r = await runModCommand(interaction("purge", { nombre: 10 }), deps);
  assert.match(r.content, /2 messages effacés/);
  assert.deepEqual(d.calls.find((c) => c.path === "/channels/C/messages/bulk-delete").body.messages, ["m1", "m2"]);
  r = await runModCommand(interaction("verrouiller", {}), deps);
  const put = d.calls.find((c) => c.method === "PUT" && c.path === "/channels/C/permissions/G");
  assert.equal(BigInt(put.body.deny), 1024n | P.SEND | P.SEND_IN_THREADS); // the rule already there (1024) stays
  r = await runModCommand(interaction("roledonner", { membre: "t1", role: "admin" }, { resolved: target("t1", []) }), deps);
  assert.match(r.content, /égal ou supérieur au tien/);
  r = await runModCommand(interaction("roledonner", { membre: "t1", role: "vip" }, { resolved: target("t1", []) }), deps);
  assert.ok(d.calls.some((c) => c.method === "PUT" && c.path === "/guilds/G/members/t1/roles/vip"));
});

test("tickets: one open at a time per member, a private thread, closed by its author or the staff only", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  const user = { id: "u9", username: "Alice" };
  let r = await openTicket({ ...deps, guild: "G", channel: "C", user, subject: "Accès", role: "staff" });
  assert.match(r.content, /<#T1>/);
  const thread = d.calls.find((c) => c.path === "/channels/C/threads");
  assert.equal(thread.body.type, 12);
  assert.equal(thread.body.name, "ticket-alice-acces");
  assert.ok(d.calls.some((c) => c.path === "/channels/T1/thread-members/u9"));
  r = await openTicket({ ...deps, guild: "G", channel: "C", user, subject: "Encore" });
  assert.match(r.content, /déjà un ticket ouvert/);
  r = await closeTicket({ ...deps, guild: "G", thread: "T1", user: { id: "intrus" }, permissions: "0" });
  assert.match(r.content, /Seuls l'auteur/);
  r = await closeTicket({ ...deps, guild: "G", thread: "T1", user, permissions: "0" });
  assert.equal(r.content, "🔒 Ticket fermé.");
  assert.deepEqual(d.calls.find((c) => c.method === "PATCH" && c.path === "/channels/T1").body, { archived: true, locked: true });
  // closed: a new one may be opened
  r = await openTicket({ ...deps, guild: "G", channel: "C", user });
  assert.match(r.content, /est ouvert/);
});
