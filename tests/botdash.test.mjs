// The bot's dashboard and organisation (lib/botdash.js, lib/botadmin.js): grouped commands, modules, rules per command,
// answers dressed by kind, /help's menu, message variables, embeds built in the editor, the sanctions' and tickets' tables.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { P, runModCommand } from "../lib/botmod.js";
import { runMod2Command } from "../lib/botmod2.js";
import { runMod3Command } from "../lib/botmod3.js";
import { cleanServer, handleEvent, makeMemory, postLog } from "../lib/botserver.js";
import { ALL_COMMANDS, COMMANDS, helpMessage } from "../lib/discordbot.js";
import {
  COLORS, GROUPS, MODULES, OLD_TO_NEW, checkRule, cleanEmbed, cleanRules, dress, expandInteraction, fillVars, groupCommands, kindOf,
  moduleOf, moduleRefusal, moduleState, permName, shownName, templateSuggestions, toDiscordEmbed,
} from "../lib/botdash.js";
import { activeOf, filterLog, listCases, listTickets, revokeCase, setCaseReason, ticketTranscript } from "../lib/botadmin.js";
import { addSanction } from "../lib/botserver.js";
import { logBot } from "../lib/botstore.js";

const ROLES = [{ id: "G", position: 0 }, { id: "mod", position: 5 }, { id: "vip", position: 3 }];
function fakeDiscord() {
  const calls = [];
  const fn = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, reason: opts.reason || "" });
    if (method === "GET" && /\/roles$/.test(path)) return ROLES;
    if (method === "GET" && /^\/guilds\/G$/.test(path)) return { owner_id: "o" };
    if (method === "POST" && /\/messages$/.test(path)) return { id: "msg" };
    return {};
  };
  return { fn, calls };
}
const ALL = String(P.MODERATE | P.KICK | P.BAN | P.MANAGE_MESSAGES | P.MANAGE_ROLES | P.MANAGE_GUILD | P.MANAGE_THREADS);
const sub = (group, name, options = {}, extra = {}) => ({
  type: 2, guild_id: "G", channel_id: "C", member: { user: { id: "m", username: "modo" }, roles: ["mod"], permissions: ALL },
  data: { name: group, options: [{ type: 1, name, options: Object.entries(options).map(([k, v]) => ({ name: k, value: v })) }], ...extra },
});

test("grouped commands: /warn, /role and /ticket with subcommands, /close kept, /role of the site becomes /meilleurs", () => {
  const names = COMMANDS.map((c) => c.name);
  assert.ok(COMMANDS.length <= 100 && COMMANDS.length < ALL_COMMANDS.length);
  for (const gone of ["warnings", "unwarn", "clearwarns", "addrole", "removerole", "ticketpanel", "claim", "priority", "rename"]) assert.ok(!names.includes(gone), gone);
  for (const kept of ["warn", "role", "ticket", "close", "meilleurs", "help", "aide", "kick", "ban", "tempban"]) assert.ok(names.includes(kept), kept);
  const warn = COMMANDS.find((c) => c.name === "warn");
  assert.deepEqual(warn.options.map((o) => o.name), ["add", "remove", "clear", "list"]);
  assert.equal(warn.default_member_permissions, String(P.MODERATE));
  const ticket = COMMANDS.find((c) => c.name === "ticket");
  assert.equal(ticket.default_member_permissions, undefined); // everyone opens a ticket: each subcommand checks its right
  assert.deepEqual(ticket.options.map((o) => o.name), ["open", "close", "add", "remove", "rename", "claim", "priority", "panel"]);
  assert.ok(ticket.options.find((o) => o.name === "open").options.find((o) => o.name === "subject").autocomplete);
  for (const c of COMMANDS) for (const o of c.options || []) if (o.type === 1) for (const x of o.options || []) assert.match(x.name, /^[a-z0-9_-]{1,32}$/);
  assert.equal(COMMANDS.find((c) => c.name === "meilleurs").options[0].name, "role");
  assert.equal(OLD_TO_NEW.addrole, "/role add");
  assert.equal(shownName("clearwarns"), "warn clear");
  assert.equal(shownName("close"), "close");
  assert.equal(groupCommands([{ name: "kick", description: "x" }]).length, 1);
  assert.deepEqual(Object.keys(GROUPS), ["warn", "role", "ticket"]);
});

test("a subcommand runs as the command it stands for, with its checks", async () => {
  const x = expandInteraction(sub("warn", "add", { user: "w9", reason: "Spam" }, { resolved: { users: { w9: { id: "w9", username: "w9" } }, members: { w9: { roles: ["vip"] } } } }));
  assert.equal(x.data.name, "warn");
  assert.equal(x.data.group, "warn");
  assert.deepEqual(x.data.options.map((o) => o.name), ["user", "reason"]);
  assert.equal(x.data.resolved.users.w9.id, "w9");
  assert.equal(expandInteraction({ data: { name: "meilleurs", options: [{ name: "role", value: "Duelist" }] } }).data.name, "role");
  const menu = { data: { name: "Warn", type: 2 } };
  assert.equal(expandInteraction(menu), menu);
  // typing in a subcommand: the focused option is found once expanded
  const typing = expandInteraction({ type: 4, data: { name: "warn", options: [{ type: 1, name: "add", options: [{ name: "reason", value: "sp", focused: true }] }] } });
  assert.ok(typing.data.options.find((o) => o.focused));
  const db = getDb();
  const d = fakeDiscord();
  const r = await runModCommand(x, { db, discord: d.fn, server: cleanServer({}), lang: "fr" });
  assert.match(r.content, /cas #\d+/);
  // /ticket panel still needs « Gérer le serveur »
  const noRight = expandInteraction(sub("ticket", "panel", {}));
  noRight.member.permissions = "0";
  assert.match((await runModCommand(noRight, { db, discord: d.fn, server: cleanServer({}), lang: "fr" })).content, /Permission manquante : il te faut « Gérer le serveur »/);
  assert.equal(permName(String(P.BAN)), "Bannir des membres");
});

test("modules: a module off refuses its commands and buttons, its card says what is missing", () => {
  const server = cleanServer({ modules: { tickets: false } });
  assert.equal(server.modules.moderation, true);
  assert.match(moduleRefusal(server, "ticket"), /module \*\*Tickets\*\* est désactivé/);
  assert.match(moduleRefusal(server, "tk"), /Tickets/);
  assert.equal(moduleRefusal(server, "kick"), "");
  assert.equal(moduleRefusal(server, "score"), "");
  assert.equal(moduleOf("Warn").key, "moderation");
  const mod = MODULES.find((m) => m.key === "moderation");
  assert.equal(moduleState(mod, { server, perms: String(P.KICK), P }).state, "missing");
  assert.match(moduleState(mod, { server, perms: String(P.KICK), P }).why, /Bannir des membres/);
  assert.equal(moduleState(mod, { server, perms: String(P.ADMIN), P }).state, "setup"); // no log channel yet
  assert.equal(moduleState(mod, { server: cleanServer({ logChannel: "123456789" }), perms: String(P.ADMIN), P }).state, "ready");
  assert.equal(moduleState(MODULES.find((m) => m.key === "tickets"), { server, P }).state, "off");
  assert.match(moduleState(MODULES.find((m) => m.key === "welcome"), { server, gateway: { on: true, privileged: false }, P }).why, /Server Members/);
  assert.equal(moduleState(MODULES.find((m) => m.key === "announce"), { server, settings: {}, P }).state, "setup");
});

test("rules per command: roles and channels allowed or refused, a delay, managers pass", () => {
  const rules = cleanRules({ kick: { allowRoles: ["123456789"], cooldown: 30, visibility: "public" }, score: { denyChannels: ["999999999"] }, empty: {}, "bad name!": { cooldown: 5 } });
  assert.deepEqual(Object.keys(rules), ["kick", "score"]);
  const map = new Map();
  const i = (roles, channel = "C", permissions = "0") => ({ channel_id: channel, member: { user: { id: "u" }, roles, permissions } });
  assert.match(checkRule(rules.kick, i(["x"]), map, 0, "kick"), /réservée à : <@&123456789>/);
  assert.equal(checkRule(rules.kick, i(["123456789"]), map, 1000, "kick"), "");
  assert.match(checkRule(rules.kick, i(["123456789"]), map, 5000, "kick"), /Attends encore un peu : tu pourras la refaire <t:31:R>/);
  assert.equal(checkRule(rules.kick, i(["123456789"]), map, 32000, "kick"), "");
  assert.match(checkRule(rules.score, i([], "999999999"), map, 0, "score"), /pas utilisable dans ce salon/);
  assert.match(checkRule(rules.score, { channel_id: "T", channel: { parent_id: "999999999" }, member: { user: { id: "u" }, roles: [] } }, map, 0, "score"), /pas utilisable/);
  assert.equal(checkRule(rules.score, i([], "999999999", String(P.MANAGE_GUILD)), map, 0, "score"), ""); // the managers pass
  assert.equal(checkRule(undefined, i([]), map), "");
  assert.equal(rules.kick.visibility, "public");
});

test("answers: a colour per kind, the case number as a field, buttons left alone", () => {
  assert.equal(kindOf("❌ Ce membre a un rôle égal ou supérieur au tien."), "error");
  assert.equal(kindOf("🔨 **x** est banni du serveur (cas #4)."), "sanction");
  assert.equal(kindOf("🧹 3 messages effacés."), "success");
  const e = dress({ content: "👢 **x** est expulsé du serveur (cas #12).", public: true }, 1700000000000);
  assert.equal(e.embeds[0].color, COLORS.sanction);
  assert.deepEqual(e.embeds[0].fields[0], { name: "Cas", value: "#12", inline: true });
  assert.equal(e.embeds[0].fields[1].value, "<t:1700000000:R>");
  assert.equal(e.public, true);
  assert.equal(dress({ content: "❌ Non." }).embeds[0].color, COLORS.error);
  const confirm = { content: "Sûr ?", components: [{ type: 1 }] };
  assert.equal(dress(confirm), confirm);
});

test("/help: categories in a menu, each command with its description and an example", () => {
  const home = helpMessage("fr", [], -1, "https://vct.example");
  const menu = home.components[0].components[0];
  assert.equal(menu.custom_id, "hp");
  assert.ok(menu.options.length >= 6 && menu.options.length <= 25);
  const k = menu.options.findIndex((o) => /Modération/.test(o.label));
  const mod = helpMessage("fr", [], k).embeds[0].description;
  assert.match(mod, /\*\*\/warn add\*\* · Avertir un membre/);
  assert.match(mod, /↳ `\/warn add user:@membre reason:Spam`/);
  assert.match(mod, /↳ `\/timeout user:@membre duration:1h reason:Spam`/);
  const t = menu.options.findIndex((o) => /Tickets/.test(o.label));
  assert.match(helpMessage("fr", [], t).embeds[0].description, /\*\*\/ticket close\*\*/);
  assert.equal(helpMessage("fr", ["warn"], k).embeds[0].description.includes("/warn add"), false);
  assert.match(home.embeds[0].description, /vct\.example/);
});

test("message variables and embeds built in the editor", () => {
  const v = { userId: "42", name: "Alice", guild: "VCT EMEA", count: 1234, inviter: "7" };
  assert.equal(fillVars("{user} ({user.name}, {user.id}) sur {server} : {membercount}e, invité par {inviter}", v).replace(/\s/g, " "), "<@42> (Alice, 42) sur VCT EMEA : 1 234e, invité par <@7>");
  assert.equal(fillVars("{membre} {pseudo} {serveur} {nombre}", v).replace(/\s/g, " "), "<@42> Alice VCT EMEA 1 234");
  assert.equal(fillVars("par {inviter}", {}), "par —");
  const e = cleanEmbed({ name: "Règlement", title: "Règles de {server}", text: "Ligne 1\\nLigne 2", color: "00FF00", image: "http://x", fields: [{ name: "1", value: "Respect", inline: true }, { name: "", value: "vide" }] });
  assert.equal(e.color, "#00ff00");
  assert.equal(e.image, "");
  assert.equal(e.fields.length, 1);
  const out = toDiscordEmbed(e, { guild: "VCT" });
  assert.deepEqual(out, { title: "Règles de VCT", description: "Ligne 1\nLigne 2", color: 0x00ff00, fields: [{ name: "1", value: "Respect", inline: true }] });
  const server = cleanServer({ embeds: [e, { name: "", title: "x" }, { name: "vide" }] });
  assert.equal(server.embeds.length, 1);
  assert.deepEqual(templateSuggestions("règ", server.embeds), [{ name: "Règlement", value: "Règlement" }]);
  assert.equal(cleanServer({}).arrival.verify.panel.title, "📜 Règlement");
});

test("/embed with a template, /verifypanel with the editor's panel", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({ embeds: [{ name: "Règlement", title: "Règles", text: "Soyez sympas", color: "#123456", fields: [{ name: "1", value: "Respect" }] }], arrival: { verify: { role: "555555555", panel: { title: "Bienvenue", text: "Clique", color: "#00ff00" } } } });
  const deps = { db, discord: d.fn, server, lang: "fr", guildName: "VCT" };
  const x = { guild_id: "G", channel_id: "C", member: { user: { id: "m" }, roles: ["mod"], permissions: ALL }, data: { name: "embed", options: [{ name: "template", value: "règlement" }] } };
  assert.match((await runMod2Command(x, deps)).content, /« Règlement » publié/);
  const posted = d.calls.find((c) => c.method === "POST" && c.path === "/channels/C/messages").body.embeds[0];
  assert.deepEqual(posted, { title: "Règles", description: "Soyez sympas", color: 0x123456, fields: [{ name: "1", value: "Respect", inline: false }] });
  assert.match((await runMod2Command({ ...x, data: { name: "embed", options: [{ name: "template", value: "inconnu" }] } }, deps)).content, /Modèle inconnu/);
  assert.match((await runMod2Command({ ...x, data: { name: "embed", options: [] } }, deps)).content, /Écris le texte, ou choisis un modèle/);
  await runMod3Command({ ...x, data: { name: "verifypanel", options: [] } }, { ...deps, notify: async () => {}, logBot: () => {} });
  const panel = d.calls.filter((c) => c.method === "POST").pop().body;
  assert.equal(panel.embeds[0].title, "Bienvenue");
  assert.equal(panel.embeds[0].color, 0x00ff00);
});

test("modules off on the server's events: no welcome, no log, no flood check", async () => {
  const d = fakeDiscord();
  const server = cleanServer({ logChannel: "111111111", welcome: { on: true, channel: "222222222" }, automod: { flood: { on: true, count: 3, seconds: 5 } }, modules: { welcome: false, logs: false, automod: false } });
  const done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: { id: "333333333333333333", username: "new" }, roles: [] }, { db: getDb(), discord: d.fn, server, guild: "G", memory: makeMemory(), now: Date.now() });
  assert.deepEqual(done, []);
  assert.equal(await postLog(d.fn, server, { kind: "members", title: "x" }), false);
  const memory = makeMemory();
  for (let k = 0; k < 4; k++) await handleEvent("MESSAGE_CREATE", { guild_id: "G", id: `m${k}`, channel_id: "C", author: { id: "a" }, content: "x" }, { db: getDb(), discord: d.fn, server, guild: "G", memory, now: 1000 + k });
  assert.equal(d.calls.length, 0);
  // the welcome with {inviter} when the module is on
  const on = cleanServer({ welcome: { on: true, channel: "222222222", text: "Salut {user}, invité par {inviter}" } });
  const d2 = fakeDiscord();
  await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: { id: "333333333333333333", username: "new" }, roles: [] }, { db: getDb(), discord: d2.fn, server: on, guild: "G", memory: makeMemory(), now: Date.now() });
  assert.equal(d2.calls.find((c) => c.path === "/channels/222222222/messages").body.content, "Salut <@333333333333333333>, invité par —");
});

test("the sanctions' table: search, reason changed, revoked from the editor", async () => {
  const db = getDb();
  const g = "GDASH";
  const now = Date.now();
  const w = addSanction(db, { guild: g, user: "100000001", kind: "warn", mod: "200000001", reason: "Spam répété", at: now - 5000 });
  const b = addSanction(db, { guild: g, user: "100000002", kind: "ban", mod: "200000001", reason: "Raid", at: now - 4000 });
  const t = addSanction(db, { guild: g, user: "100000003", kind: "timeout", mod: "200000002", reason: "Insultes", at: now - 3000, until: new Date(now + 3600000).toISOString() });
  assert.deepEqual(listCases(db, g, {}).map((r) => r.id), [t, b, w]);
  assert.deepEqual(listCases(db, g, { q: `#${b}` }).map((r) => r.id), [b]);
  assert.deepEqual(listCases(db, g, { q: "alice" }, { 100000001: "Alice" }).map((r) => r.id), [w]);
  assert.deepEqual(listCases(db, g, { kind: "timeout" }).map((r) => r.id), [t]);
  assert.deepEqual(listCases(db, g, { q: "insultes" }).map((r) => r.id), [t]);
  assert.equal(listCases(db, g, { to: "2000-01-01" }).length, 0);
  assert.equal(activeOf({ kind: "timeout", until: new Date(now - 1).toISOString() }, now), false);
  assert.match(setCaseReason(db, g, b, "Raid organisé", "alice").message, /modifiée/);
  assert.match(listCases(db, g, { q: `#${b}` })[0].reason, /^Raid organisé \(modifiée par alice\)$/);
  assert.equal(setCaseReason(db, g, 999999, "x").ok, false);
  const d = fakeDiscord();
  const notes = [];
  const deps = { db, discord: d.fn, guild: g, who: "alice", logBot, notify: async (x) => notes.push(x), now };
  assert.match((await revokeCase(deps, b)).message, /bannissement levé/);
  const unban = d.calls.find((c) => c.method === "DELETE");
  assert.equal(unban.path, `/guilds/${g}/bans/100000002`);
  assert.match(unban.reason, new RegExp(`Cas #${b} révoqué depuis l'éditeur du site par alice`));
  assert.equal((await revokeCase(deps, b)).ok, false); // already lifted
  assert.match((await revokeCase(deps, t)).message, /exclusion levée/);
  assert.deepEqual(d.calls.find((c) => c.method === "PATCH").body, { communication_disabled_until: null });
  assert.match((await revokeCase(deps, w)).message, /avertissement retiré/);
  assert.equal(listCases(db, g, { kind: "warn" }).length, 0);
  assert.ok(listCases(db, g, { kind: "unban" }).length === 1);
  assert.equal(notes.length, 3);
  // Discord refusing: said plainly
  const k = addSanction(db, { guild: g, user: "100000004", kind: "ban", mod: "m", at: now });
  const refusing = async () => { const e = new Error("Missing Permissions"); e.code = 50013; throw e; };
  assert.match((await revokeCase({ ...deps, discord: refusing }, k)).error, /n'a pas la permission/);
  assert.match((await revokeCase(deps, addSanction(db, { guild: g, user: "1", kind: "kick", mod: "m", at: now }))).error, /ne se révoque pas/);
});

test("the tickets' list, a transcript, the log with filters", () => {
  const db = getDb();
  const ins = db.prepare("INSERT OR REPLACE INTO bot_tickets (thread, guild, user, subject, opened, closed, category, transcript, rating, claimed) VALUES (?, 'GT', ?, ?, ?, ?, ?, ?, ?, ?)");
  ins.run("T100", "u1", "Compte bloqué", "2026-11-01T10:00:00Z", "", "Support", "", "", "");
  ins.run("T101", "u2", "Partenariat", "2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z", "Partenariat", "alice : bonjour", "5", "s1");
  assert.deepEqual(listTickets(db, "GT", {}).map((t) => t.thread), ["T101", "T100"]);
  assert.deepEqual(listTickets(db, "GT", { state: "open" }).map((t) => t.thread), ["T100"]);
  assert.deepEqual(listTickets(db, "GT", { q: "bob" }, { u2: "Bob" }).map((t) => t.thread), ["T101"]);
  assert.equal(listTickets(db, "GT", {})[0].transcript, undefined);
  assert.equal(ticketTranscript(db, "GT", "T101"), "alice : bonjour");
  logBot(db, "moderation", "kick · test du journal filtré", true);
  logBot(db, "erreur", "Discord a refusé (test)", false);
  assert.ok(filterLog(db, { kind: "moderation", q: "journal filtré" }).length >= 1);
  assert.ok(filterLog(db, { errors: true }).every((r) => !r.ok));
});
