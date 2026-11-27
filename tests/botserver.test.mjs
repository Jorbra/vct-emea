// The bot's second set of server commands, its server settings, AutoMod rules, the server's events and the timed work
// (lib/botmod2.js, lib/botserver.js), with a pretend Discord: no token, no real server.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { P, closeTicket, openTicket } from "../lib/botmod.js";
import { MOD2_COMMANDS, P2, botTimers, buildTranscript, claimTicket, colorOf, drawWinners, handleButton, parseChoices, pollResults, powerfulRole, runMod2Command } from "../lib/botmod2.js";
import { INVITE_REGEX, addSanction, automodRules, cleanServer, fillTemplate, handleEvent, isFlood, makeMemory, syncAutomod } from "../lib/botserver.js";
import { ALL_COMMANDS as COMMANDS, COMMANDS as REGISTERED } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";

const ROLES = [{ id: "G", position: 0, permissions: "0" }, { id: "mod", position: 5, permissions: String(P.MODERATE) }, { id: "vip", position: 3, permissions: "0" }, { id: "admin", position: 8, permissions: String(P.ADMIN) }, { id: "helper", position: 2, permissions: String(P.MANAGE_MESSAGES) }];

function fakeDiscord(extra = () => undefined) {
  const calls = [];
  let n = 0;
  const fn = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, reason: opts.reason || "" });
    const x = extra(method, path, body);
    if (x !== undefined) return x;
    if (method === "GET" && /\/roles$/.test(path)) return ROLES;
    if (method === "GET" && /^\/guilds\/G$/.test(path)) return { owner_id: "o" };
    if (method === "POST" && path === "/users/@me/channels") return { id: "dm" };
    if (method === "POST" && /\/messages$/.test(path)) return { id: `msg${++n}` };
    if (method === "POST" && /\/threads$/.test(path)) return { id: `T${++n}` };
    return {};
  };
  return { fn, calls };
}
const ALL = String(P.MODERATE | P.MANAGE_MESSAGES | P.MANAGE_ROLES | P.MANAGE_GUILD | P.MANAGE_THREADS | P2.NICK | P2.MOVE | P2.MUTE);
const ix = (name, options, { perms = ALL, roles = ["mod"], resolved = {}, channel = "C", userId = "m" } = {}) => ({
  guild_id: "G", channel_id: channel, member: { user: { id: userId, username: "modo" }, roles, permissions: perms },
  data: { name, options: Object.entries(options).map(([k, v]) => ({ name: k, value: v })), resolved },
});
const tgt = (id, roles) => ({ users: { [id]: { id, username: `u${id}` } }, members: { [id]: { roles } } });

test("the second set of commands: registered, can be turned off, required options first, servers only", () => {
  for (const c of MOD2_COMMANDS) {
    assert.ok(COMMANDS.some((x) => x.name === c.name), c.name);
    assert.ok(BOT_COMMANDS.includes(c.name), c.name);
    const req = (c.options || []).map((o) => !!o.required);
    assert.deepEqual(req, [...req].sort((x, y) => Number(y) - Number(x)), c.name);
    assert.deepEqual(c.contexts, [0]);
  }
  assert.ok(REGISTERED.length <= 100, "Discord takes 100 commands at most");
  assert.deepEqual(MOD2_COMMANDS.filter((c) => !c.default_member_permissions).map((c) => c.name), ["remindme"]);
});

test("helpers: choices, results, winners, powerful roles, colours, transcript", () => {
  assert.deepEqual(parseChoices("Oui ; Non ; Oui"), ["Oui", "Non"]);
  assert.equal(parseChoices("Seul"), null);
  assert.equal(parseChoices("a;b;c;d;e;f"), null);
  assert.deepEqual(pollResults(["A", "B"], [{ choice: 0 }, { choice: 0 }, { choice: 1 }]).map((r) => [r.n, r.pct]), [[2, 67], [1, 33]]);
  const seq = [0.9, 0.1, 0.5];
  assert.deepEqual(drawWinners(["a", "b", "c", "a"], 2, () => seq.shift()), ["c", "a"]);
  assert.deepEqual(drawWinners([], 3), []);
  assert.equal(powerfulRole("0"), false);
  assert.equal(powerfulRole(String(P.ADMIN)), true);
  assert.equal(powerfulRole(String(P.MANAGE_MESSAGES | (1n << 11n))), true);
  assert.equal(colorOf("#00ff00"), 0x00ff00);
  assert.equal(colorOf("rouge"), 0xff4655);
  const t = buildTranscript([{ timestamp: "2026-11-26T10:05:00Z", author: { username: "b" }, content: "réponse" }, { timestamp: "2026-11-26T10:00:00Z", author: { username: "a" }, content: "bonjour\nà tous", attachments: [{ url: "https://x/f.png" }] }], { name: "T1" });
  assert.match(t, /\[2026-11-26 10:00\] a : bonjour ⏎ à tous \[https:\/\/x\/f\.png\]\n\[2026-11-26 10:05\] b : réponse$/);
});

test("server settings: bounds kept, AutoMod rules built from them", () => {
  const s = cleanServer({ automod: { invites: true, wordsOn: true, words: "Arnaque, ARNAQUE\nspam*", mentions: 99, spam: true, action: "timeout", timeoutMin: 30, exemptRoles: ["123456", "x"] }, logChannel: "987654321", logs: { messages: false } });
  assert.deepEqual(s.automod.words, ["arnaque", "spam*"]);
  assert.equal(s.automod.mentions, 50);
  assert.deepEqual(s.automod.exemptRoles, ["123456"]);
  assert.equal(s.logs.messages, false);
  assert.equal(s.logs.automod, true);
  assert.deepEqual(s.tickets.categories.map((c) => c.name), ["Support", "Signalement", "Partenariat"]);
  assert.deepEqual(cleanServer({ tickets: { categories: ["Aide", { name: "Partenariat", role: "123456789", form: false }] } }).tickets.categories, [{ name: "Aide", role: "", form: true }, { name: "Partenariat", role: "123456789", form: false }]);
  const rules = automodRules(s);
  assert.deepEqual(rules.map((r) => [r.name, r.trigger_type]), [["VCT · invitations", 1], ["VCT · mots interdits", 1], ["VCT · mentions de masse", 5], ["VCT · spam", 3]]);
  assert.deepEqual(rules[0].trigger_metadata.regex_patterns, [INVITE_REGEX]);
  assert.deepEqual(rules[0].actions.map((x) => x.type), [1, 2, 3]); // block, tell the log channel, time out
  assert.equal(rules[0].actions[2].metadata.duration_seconds, 1800);
  assert.deepEqual(rules[3].actions.map((x) => x.type), [1, 2]); // Discord's spam rule cannot time out
  assert.ok(new RegExp(INVITE_REGEX).test("viens sur discord.gg/abc-123"));
  assert.ok(!new RegExp(INVITE_REGEX).test("discord.com/channels/1/2"));
  assert.equal(fillTemplate("Salut {membre} ({pseudo}) sur {serveur}, {nombre}e", { userId: "9", name: "Zoé", guild: "VCT", count: 42 }), "Salut <@9> (Zoé) sur VCT, 42e");
});

test("AutoMod sync: the bot's own rules made, changed or removed, the server's other rules never touched", async () => {
  const d = fakeDiscord((method, path) => (method === "GET" && path === "/guilds/G/auto-moderation/rules"
    ? [{ id: "1", name: "VCT · invitations" }, { id: "2", name: "VCT · spam" }, { id: "3", name: "Règle des modos" }] : undefined));
  const r = await syncAutomod(d.fn, "G", cleanServer({ automod: { invites: true, mentions: 5 } }));
  assert.deepEqual(r, { made: 1, changed: 1, removed: 1 });
  assert.ok(d.calls.some((c) => c.method === "PATCH" && c.path === "/guilds/G/auto-moderation/rules/1" && c.body.trigger_type === undefined));
  assert.ok(d.calls.some((c) => c.method === "POST" && c.body && c.body.name === "VCT · mentions de masse"));
  assert.ok(d.calls.some((c) => c.method === "DELETE" && c.path === "/guilds/G/auto-moderation/rules/2"));
  assert.ok(!d.calls.some((c) => /rules\/3$/.test(c.path)));
});

test("server events: welcome with its role, goodbye, changed and deleted messages logged with their text, nickname and roles", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({ logChannel: "900000001", welcome: { on: true, channel: "900000002", role: "444444444", text: "Bienvenue {membre} !" }, goodbye: { on: true, channel: "900000002" } });
  const memory = makeMemory();
  const deps = { db, discord: d.fn, server, guild: "G", memory, now: Date.parse("2026-11-26T12:00:00Z"), guildName: "VCT" };
  const u = { id: "111111111111111111", username: "zoe" };
  let done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: u, roles: [] }, deps);
  assert.deepEqual(done, ["log:members", "welcome", "autorole"]);
  assert.equal(d.calls.find((c) => c.path === "/channels/900000002/messages").body.content, `Bienvenue <@${u.id}> !`);
  await handleEvent("MESSAGE_CREATE", { guild_id: "G", id: "m1", channel_id: "C", author: u, content: "avant" }, deps);
  done = await handleEvent("MESSAGE_UPDATE", { guild_id: "G", id: "m1", channel_id: "C", author: u, content: "après" }, deps);
  assert.deepEqual(done, ["log:messages"]);
  const edit = d.calls.filter((c) => c.path === "/channels/900000001/messages").pop().body.embeds[0];
  assert.match(edit.description, /\*\*Avant\*\*\n> avant/);
  assert.match(edit.description, /\*\*Après\*\*\n> après/);
  await handleEvent("MESSAGE_DELETE", { guild_id: "G", id: "m1", channel_id: "C" }, deps);
  assert.match(d.calls.filter((c) => c.path === "/channels/900000001/messages").pop().body.embeds[0].description, /> après/);
  done = await handleEvent("GUILD_MEMBER_UPDATE", { guild_id: "G", user: u, nick: "Zozo", roles: ["vip", "helper"] }, deps);
  assert.deepEqual(done, ["log:nicknames", "log:roles"]);
  done = await handleEvent("GUILD_MEMBER_REMOVE", { guild_id: "G", user: u }, deps);
  assert.deepEqual(done, ["log:members", "goodbye"]);
  // another server's events are none of its business
  assert.deepEqual(await handleEvent("GUILD_MEMBER_ADD", { guild_id: "OTHER", user: u }, deps), []);
  // a kind of entry turned off is not written
  const quiet = { ...deps, server: cleanServer({ logChannel: "900000001", logs: { members: false } }) };
  assert.deepEqual(await handleEvent("GUILD_MEMBER_REMOVE", { guild_id: "G", user: u }, quiet), []);
});

test("anti-flood: too many messages too fast are deleted, their author timed out and warned; exempt roles left alone", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({ logChannel: "900000001", automod: { flood: { on: true, count: 3, seconds: 5 }, action: "timeout", timeoutMin: 5, warn: true, exemptRoles: ["123456"] } });
  const memory = makeMemory();
  const u = { id: "222222222222222222", username: "spam" };
  const t0 = Date.parse("2026-11-26T12:00:00Z");
  assert.equal(isFlood([0, 1000, 2000], 3, 5), true);
  assert.equal(isFlood([0, 1000, 9000], 3, 5), false);
  let done = [];
  for (let k = 0; k < 3; k++) done = await handleEvent("MESSAGE_CREATE", { guild_id: "G", id: `f${k}`, channel_id: "C", author: u, content: "aaa" }, { db, discord: d.fn, server, guild: "G", memory, now: t0 + k * 1000 });
  assert.deepEqual(done, ["flood:delete", "flood:timeout", "flood:warn", "log:automod"]);
  assert.deepEqual(d.calls.find((c) => c.path === "/channels/C/messages/bulk-delete").body.messages, ["f0", "f1", "f2"]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM bot_sanctions WHERE user = ? AND kind = 'warn'").get(u.id).n, 1);
  const vip = { id: "333333333333333333", username: "vip" };
  for (let k = 0; k < 5; k++) done = await handleEvent("MESSAGE_CREATE", { guild_id: "G", id: `v${k}`, channel_id: "C", author: vip, member: { roles: ["123456"] }, content: "x" }, { db, discord: d.fn, server, guild: "G", memory, now: t0 + k * 100 });
  assert.deepEqual(done, []);
});

test("a member's file: sanctions and notes listed, a warning removed by its number, all of them cleared", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  const w1 = addSanction(db, { guild: "G", user: "t5", kind: "warn", mod: "m", reason: "flood" });
  addSanction(db, { guild: "G", user: "t5", kind: "ban", mod: "m", reason: "triche" });
  let r = await runMod2Command(ix("note", { user: "t5", text: "à surveiller" }, { resolved: tgt("t5", []) }), deps);
  assert.match(r.content, /Note #\d+ ajoutée/);
  r = await runMod2Command(ix("modlogs", { user: "t5" }, { resolved: tgt("t5", []) }), deps);
  const text = r.embeds[0].description;
  assert.match(text, /📝 Note .*à surveiller/);
  assert.match(text, /🔨 Ban .*triche/);
  assert.match(r.embeds[0].footer.text, /1 avertissement\(s\) · 0 exclusion\(s\) · 0 expulsion\(s\) · 1 ban\(s\) · 1 note\(s\)/);
  r = await runMod2Command(ix("unwarn", { id: w1 }), deps);
  assert.match(r.content, new RegExp(`Avertissement n°${w1} retiré`));
  r = await runMod2Command(ix("unwarn", { id: w1 }), deps);
  assert.match(r.content, /Pas d'avertissement/);
  addSanction(db, { guild: "G", user: "t5", kind: "warn", mod: "m" });
  addSanction(db, { guild: "G", user: "t5", kind: "warn", mod: "m" });
  r = await runMod2Command(ix("clearwarns", { user: "t5" }, { resolved: tgt("t5", []) }), deps);
  assert.match(r.content, /2 avertissement\(s\) effacé/);
});

test("nickname and voice: done on members below, refused above, the reason in the audit log", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  let r = await runMod2Command(ix("nick", { user: "t6", nickname: "Calme" }, { resolved: tgt("t6", ["vip"]) }), deps);
  assert.match(r.content, /surnom « Calme »/);
  assert.equal(d.calls.find((c) => c.method === "PATCH" && c.path === "/guilds/G/members/t6").reason, "modo (m)");
  r = await runMod2Command(ix("mute", { user: "t6", action: 1 }, { resolved: tgt("t6", ["vip"]) }), deps);
  assert.deepEqual(d.calls.filter((c) => c.path === "/guilds/G/members/t6").pop().body, { mute: true });
  r = await runMod2Command(ix("move", { user: "t6", channel: "V2" }, { resolved: tgt("t6", ["vip"]) }), deps);
  assert.deepEqual(d.calls.filter((c) => c.path === "/guilds/G/members/t6").pop().body, { channel_id: "V2" });
  r = await runMod2Command(ix("disconnect", { user: "t6" }, { resolved: tgt("t6", ["vip"]) }), deps);
  assert.deepEqual(d.calls.filter((c) => c.path === "/guilds/G/members/t6").pop().body, { channel_id: null });
  const before = d.calls.length;
  r = await runMod2Command(ix("nick", { user: "t7", nickname: "x" }, { resolved: tgt("t7", ["admin"]) }), deps);
  assert.match(r.content, /égal ou supérieur/);
  r = await runMod2Command(ix("mute", { user: "t6", action: 1 }, { perms: String(P.MANAGE_MESSAGES), resolved: tgt("t6", []) }), deps);
  assert.match(r.content, /Permission manquante : il te faut « /);
  assert.equal(d.calls.filter((c) => c.method === "PATCH").length, d.calls.slice(0, before).filter((c) => c.method === "PATCH").length);
});

test("tickets: a subject picked, add and remove a member, rename, priority, claim, transcript sent to the log on closing, idle ones closed", async () => {
  const db = getDb();
  const server = cleanServer({ logChannel: "900000001", tickets: { inactiveDays: 3 } });
  const files = [];
  const d = fakeDiscord((method, path) => {
    if (method === "GET" && /^\/channels\/T\d+\/messages/.test(path)) return [{ id: "z", timestamp: "2026-11-26T10:00:00Z", author: { username: "alice" }, content: "mon souci" }];
    if (method === "GET" && /^\/channels\/T\d+$/.test(path)) return { name: "ticket-alice-support", last_message_id: String(((BigInt(Date.parse("2026-11-01T00:00:00Z")) - 1420070400000n) << 22n)) };
    return undefined;
  });
  const deps = { db, discord: d.fn, lang: "fr", server, postFile: async (...a) => { files.push(a); return {}; } };
  const alice = { id: "a1", username: "Alice" };
  let r = await openTicket({ ...deps, guild: "G", channel: "C", user: alice, category: "Support", role: "staff" });
  const thread = /<#(T\d+)>/.exec(r.content)[1];
  assert.equal(d.calls.find((c) => /\/threads$/.test(c.path)).body.name, "ticket-alice-support");
  const first = d.calls.find((c) => c.path === `/channels/${thread}/messages`).body;
  assert.deepEqual(first.components[0].components.map((b) => b.custom_id), ["tk|close", "tk|claim"]);
  r = await runMod2Command(ix("add", { user: "b2" }, { channel: thread, resolved: tgt("b2", []) }), deps);
  assert.ok(d.calls.some((c) => c.method === "PUT" && c.path === `/channels/${thread}/thread-members/b2`));
  r = await runMod2Command(ix("remove", { user: "a1" }, { channel: thread, resolved: tgt("a1", []) }), deps);
  assert.match(r.content, /auteur du ticket ne peut pas/);
  r = await runMod2Command(ix("priority", { level: "urgente" }, { channel: thread }), deps);
  assert.equal(d.calls.filter((c) => c.method === "PATCH" && c.path === `/channels/${thread}`).pop().body.name, "🔴 ticket-alice-support");
  r = await runMod2Command(ix("rename", { name: "paiement" }, { channel: thread }), deps);
  assert.equal(d.calls.filter((c) => c.method === "PATCH" && c.path === `/channels/${thread}`).pop().body.name, "🔴 paiement");
  r = await claimTicket({ ...deps, guild: "G", thread, user: { id: "m" }, permissions: "0" });
  assert.match(r.content, /Seule l'équipe/);
  r = await claimTicket({ ...deps, guild: "G", thread, user: { id: "m" }, permissions: String(P.MANAGE_THREADS) });
  assert.match(r.content, /pris en charge/);
  r = await claimTicket({ ...deps, guild: "G", thread, user: { id: "m2" }, permissions: String(P.MANAGE_THREADS) });
  assert.match(r.content, /occupe déjà/);
  r = await closeTicket({ ...deps, guild: "G", thread, user: alice, permissions: "0" });
  assert.equal(r.content, "🔒 Ticket fermé.");
  assert.equal(files.length, 1);
  assert.equal(files[0][0], "900000001");
  assert.match(files[0][2], /\.html$/);
  assert.match(files[0][3], /<!doctype html>[\s\S]*alice[\s\S]*mon souci/);
  assert.match(db.prepare("SELECT transcript FROM bot_tickets WHERE thread = ?").get(thread).transcript, /mon souci/);
  // a ticket quiet for 25 days, with 3 days set: closed by the minute task
  r = await openTicket({ ...deps, guild: "G", channel: "C", user: { id: "c3", username: "Chloé" } });
  const idle = /<#(T\d+)>/.exec(r.content)[1];
  const done = await botTimers({ ...deps, now: Date.parse("2026-11-26T12:00:00Z"), closeTicket: (o) => closeTicket({ ...o, server, postFile: deps.postFile }) });
  assert.ok(done.includes(`idle:${idle}`));
  assert.ok(db.prepare("SELECT closed FROM bot_tickets WHERE thread = ?").get(idle).closed);
});

test("server life: role buttons only for harmless roles below one's own, a member takes and gives back a role", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const deps = { db, discord: d.fn, lang: "fr" };
  let r = await runMod2Command(ix("buttonroles", { role1: "vip", role2: "helper" }), deps);
  assert.match(r.content, /donne des pouvoirs/);
  r = await runMod2Command(ix("buttonroles", { role1: "admin" }), deps);
  assert.match(r.content, /pouvoirs|égal ou supérieur/);
  r = await runMod2Command(ix("buttonroles", { role1: "vip", title: "Rôles" }), deps);
  assert.match(r.content, /Message de rôles posé/);
  assert.deepEqual(d.calls.filter((c) => c.path === "/channels/C/messages").pop().body.components[0].components.map((b) => b.custom_id), ["rb|vip"]);
  // a click on a role button (Discord's role ids are numbers)
  const RID = "444444444";
  const d1 = fakeDiscord((m, p) => (m === "GET" && /\/roles$/.test(p) ? [{ id: RID, name: "VIP", permissions: "0" }] : undefined));
  const click = (roles) => ({ guild_id: "G", member: { user: { id: "u1" }, roles }, data: { custom_id: `rb|${RID}` } });
  r = await handleButton(click([]), { ...deps, discord: d1.fn });
  assert.match(r.data.content, /maintenant le rôle \*\*VIP\*\*/);
  assert.ok(d1.calls.some((c) => c.method === "PUT" && c.path === `/guilds/G/members/u1/roles/${RID}`));
  r = await handleButton(click([RID]), { ...deps, discord: d1.fn });
  assert.match(r.data.content, /n'as plus le rôle/);
  assert.ok(d1.calls.some((c) => c.method === "DELETE" && c.path === `/guilds/G/members/u1/roles/${RID}`));
  // a role given powers since the message was posted is refused at the click
  const d2 = fakeDiscord((m, p) => (m === "GET" && /\/roles$/.test(p) ? [{ id: RID, permissions: String(P.BAN) }] : undefined));
  r = await handleButton(click([]), { ...deps, discord: d2.fn });
  assert.match(r.data.content, /plus disponible/);
});

test("polls, giveaways and reminders: votes counted (one per member), closed and drawn by the minute task", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const t0 = Date.parse("2026-11-26T12:00:00Z");
  const deps = { db, discord: d.fn, lang: "fr", now: t0 };
  let r = await runMod2Command(ix("poll", { question: "Qui gagne ?", choices: "Fnatic ; Vitality", duration: "1h" }), deps);
  assert.match(r.content, /Sondage publié/);
  const poll = db.prepare("SELECT * FROM bot_polls ORDER BY id DESC").get();
  const vote = (user, k) => handleButton({ guild_id: "G", member: { user: { id: user } }, data: { custom_id: `pv|${poll.id}|${k}` } }, deps);
  await vote("u1", 0);
  await vote("u2", 1);
  r = await vote("u1", 1); // changes their vote
  assert.equal(r.type, 7);
  assert.match(r.data.embeds[0].description, /Vitality\*\*\n`██████████` 100% · 2/);
  r = await runMod2Command(ix("giveaway", { prize: "Un maillot", duration: "10m", winners: 1 }), deps);
  const gw = db.prepare("SELECT * FROM bot_giveaways ORDER BY id DESC").get();
  const join = (user) => handleButton({ guild_id: "G", member: { user: { id: user } }, data: { custom_id: `gv|${gw.id}` } }, deps);
  await join("u1");
  r = await join("u2");
  assert.equal(r.data.components[0].components[0].label, "Participer (2)");
  r = await runMod2Command(ix("remindme", { text: "regarder la finale", in: "10m" }, { userId: "u9" }), deps);
  assert.match(r.content, /message privé/);
  const done = await botTimers({ db, discord: d.fn, server: cleanServer({}), now: t0 + 2 * 3600000, rand: () => 0 });
  assert.ok(done.includes(`poll:${poll.id}`) && done.includes(`giveaway:${gw.id}`) && done.some((x) => x.startsWith("memo:")));
  const closed = d.calls.filter((c) => c.method === "PATCH" && c.path.endsWith(`/messages/${poll.message}`)).pop().body;
  assert.deepEqual(closed.components, []);
  assert.match(closed.embeds[0].description, /🏆 \*\*Vitality/);
  assert.deepEqual(JSON.parse(db.prepare("SELECT result FROM bot_giveaways WHERE id = ?").get(gw.id).result), ["u1"]);
  assert.ok(d.calls.some((c) => c.path === "/channels/dm/messages" && /regarder la finale/.test(c.body.content)));
  // closed: no more votes
  r = await vote("u3", 0);
  assert.match(r.data.content, /fermé/);
});
