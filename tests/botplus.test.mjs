// The bot's third set (lib/botmod3.js and what it changes): moderation, tickets and new members, with a pretend Discord.
import test from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db.js";
import { P, closeTicket, openTicket, reopenTicket, runModCommand } from "../lib/botmod.js";
import { botTimers } from "../lib/botmod2.js";
import {
  activeWarns, canRename, contextMenu, counterName, durationSuggestions, firstReply, formatDuration, isRaid, lockChannels, modalSubmit, onArrival,
  parseDuration, purgeFilter, rateTicket, reasonSuggestions, runMod3Command, takePending, ticketStats, transcriptHtml, updateCounter, usedInvite,
  verifyClick, welcomeCardUrl, welcomeSig,
} from "../lib/botmod3.js";
import { cleanServer, handleEvent, makeMemory } from "../lib/botserver.js";

const ROLES = [{ id: "G", position: 0 }, { id: "mod", position: 5 }, { id: "vip", position: 3 }, { id: "admin", position: 8 }];
function fakeDiscord(extra = () => undefined) {
  const calls = [];
  let n = 0;
  const fn = async (method, path, body, opts = {}) => {
    calls.push({ method, path, body, reason: opts.reason || "" });
    const x = extra(method, path, body);
    if (x !== undefined) return x;
    if (method === "GET" && /\/roles$/.test(path)) return ROLES;
    if (method === "GET" && /^\/guilds\/G$/.test(path)) return { owner_id: "o", name: "VCT" };
    if (method === "POST" && path === "/users/@me/channels") return { id: "dm" };
    if (method === "POST" && /\/threads$/.test(path)) return { id: `T${++n}` };
    if (method === "POST" && /\/messages$/.test(path)) return { id: `msg${++n}` };
    return {};
  };
  return { fn, calls };
}
const ALL = String(P.MODERATE | P.KICK | P.BAN | P.MANAGE_MESSAGES | P.MANAGE_CHANNELS | P.MANAGE_ROLES | P.MANAGE_GUILD | P.MANAGE_THREADS);
const ix = (name, options, { perms = ALL, roles = ["mod"], resolved = {}, channel = "C", userId = "m" } = {}) => ({
  guild_id: "G", channel_id: channel, member: { user: { id: userId, username: "modo" }, roles, permissions: perms },
  data: { name, options: Object.entries(options).map(([k, v]) => ({ name: k, value: v })), resolved },
});
const tgt = (id, roles) => ({ users: { [id]: { id, username: `u${id}` } }, members: { [id]: { roles } } });
const snowflakeAt = (ms) => String((BigInt(ms) - 1420070400000n) << 22n);

test("durations and preset reasons: read as written, suggested while typing", () => {
  assert.deepEqual(["10m", "2h", "1d", "1w", "1h30m", "90s", "15", "2 h", "abc", "", "0m"].map(parseDuration), [600, 7200, 86400, 604800, 5400, 90, 900, 7200, null, null, null]);
  assert.deepEqual([600, 7200, 90000, 604800, 5400].map(formatDuration), ["10 min", "2 h", "1 j 1 h", "1 sem", "1 h 30 min"]);
  assert.deepEqual(durationSuggestions("3d").map((x) => x.value), ["3d"]);
  assert.equal(durationSuggestions("").length, 7);
  assert.equal(durationSuggestions("1")[0].name, "1h (1 h)".replace("1h (1 h)", durationSuggestions("1")[0].name)); // what was typed is unreadable alone: the presets
  assert.deepEqual(reasonSuggestions("spa", ["Spam", "Insultes"]).map((x) => x.value), ["spa", "Spam"]);
  assert.deepEqual(reasonSuggestions("", ["Spam", "Insultes"]).map((x) => x.value), ["Spam", "Insultes"]);
});

test("warn: a case number, a private message with the reason and how to appeal, escalation, warnings that expire", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({ moderation: { appeal: "Ouvre un ticket pour contester.", escalation: [{ count: 2, action: "timeout", duration: "1h" }, { count: 3, action: "kick" }], warnExpireDays: 30 } });
  const deps = { db, discord: d.fn, server, lang: "fr", guildName: "VCT EMEA" };
  let r = await runModCommand(ix("warn", { user: "w1", reason: "Spam" }, { resolved: tgt("w1", ["vip"]) }), deps);
  assert.match(r.content, /cas #(\d+), 1 avertissement en cours/);
  const dm = d.calls.find((c) => c.path === "/channels/dm/messages").body.content;
  assert.match(dm, /averti\*\* sur \*\*VCT EMEA\*\*/);
  assert.match(dm, /Raison : Spam\nCas #\d+\n\nOuvre un ticket pour contester\./);
  r = await runModCommand(ix("warn", { user: "w1", reason: "Spam" }, { resolved: tgt("w1", ["vip"]) }), deps);
  assert.match(r.content, /Escalade automatique : 2 avertissements : exclu 1 h/);
  assert.ok(d.calls.some((c) => c.method === "PATCH" && c.path === "/guilds/G/members/w1" && c.body.communication_disabled_until));
  r = await runModCommand(ix("warn", { user: "w1", reason: "Spam" }, { resolved: tgt("w1", ["vip"]) }), deps);
  assert.match(r.content, /3 avertissements : expulsé/);
  // the order matters: the private message goes before the kick (afterwards the bot cannot write to them)
  const kick = d.calls.findIndex((c) => c.method === "DELETE" && c.path === "/guilds/G/members/w1");
  const lastDm = d.calls.map((c, k) => (c.path === "/channels/dm/messages" ? k : -1)).filter((k) => k >= 0).pop();
  assert.ok(kick > lastDm);
  // a warning older than 30 days no longer counts
  db.prepare("INSERT INTO bot_sanctions (guild, user, kind, mod, reason, at) VALUES ('G', 'w2', 'warn', 'm', 'vieux', '2020-01-01T00:00:00Z')").run();
  assert.equal(activeWarns(db, "G", "w2", 30).length, 0);
  assert.equal(activeWarns(db, "G", "w2", 0).length, 1);
});

test("ban and kick: confirmed by a button by the same moderator only; the member is told before", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({});
  const deps = { db, discord: d.fn, server, lang: "fr" };
  const i = ix("ban", { user: "b1", reason: "Triche" }, { resolved: tgt("b1", ["vip"]) });
  let r = await runModCommand(i, deps);
  assert.match(r.content, /Bannir \*\*ub1\*\* \(Triche\) \?/);
  const id = r.components[0].components[0].custom_id.split("|")[1];
  assert.ok(!d.calls.some((c) => c.method === "PUT" && /bans/.test(c.path)));
  assert.equal(takePending(db, id, "someone-else"), null);
  const payload = takePending(db, id, "m");
  assert.equal(payload.data.name, "ban");
  assert.equal(takePending(db, id, "m"), null); // once only
  r = await runModCommand({ ...i, ...payload }, { ...deps, confirmed: true });
  assert.match(r.content, /banni du serveur \(cas #\d+\)/);
  const ban = d.calls.findIndex((c) => c.method === "PUT" && c.path === "/guilds/G/bans/b1");
  const dmAt = d.calls.findIndex((c) => c.path === "/channels/dm/messages");
  assert.ok(dmAt >= 0 && dmAt < ban);
  assert.match(d.calls[ban].reason, /cas #\d+/);
});

test("tempban: banned until the end, then unbanned by the minute task, once, even after a restart", async () => {
  const db = getDb();
  const d = fakeDiscord();
  const t0 = Date.parse("2026-11-26T12:00:00Z");
  const deps = { db, discord: d.fn, server: cleanServer({ moderation: { confirm: false } }), lang: "fr", now: t0 };
  let r = await runMod3Command(ix("tempban", { user: "tb1", duration: "2h", reason: "Flood" }, { resolved: tgt("tb1", ["vip"]) }), deps);
  assert.match(r.content, /banni pour 2 h/);
  assert.equal(d.calls.filter((c) => c.method === "PUT" && c.path === "/guilds/G/bans/tb1").length, 1);
  r = await runMod3Command(ix("tempban", { user: "tb2", duration: "bientôt" }, { resolved: tgt("tb2", []) }), deps);
  assert.match(r.content, /Durée illisible/);
  let done = await botTimers({ db, discord: d.fn, server: deps.server, now: t0 + 3600000 });
  assert.ok(!done.some((x) => x.startsWith("unban")));
  done = await botTimers({ db, discord: d.fn, server: deps.server, now: t0 + 3 * 3600000 });
  assert.ok(done.some((x) => x.startsWith("unban:")));
  assert.ok(d.calls.some((c) => c.method === "DELETE" && c.path === "/guilds/G/bans/tb1"));
  done = await botTimers({ db, discord: d.fn, server: deps.server, now: t0 + 4 * 3600000 });
  assert.ok(!done.some((x) => x.startsWith("unban")));
});

test("cases: seen by number, their reason corrected; /purge filters; /lockdown keeps each channel's other rules", async () => {
  const db = getDb();
  const d = fakeDiscord((m, p) => (m === "GET" && /^\/channels\/L\d$/.test(p) ? { permission_overwrites: [{ id: "G", allow: "0", deny: "1024" }] } : undefined));
  const deps = { db, discord: d.fn, server: cleanServer({ moderation: { lockdownChannels: ["111111", "222222"] } }), lang: "fr" };
  const id = Number(db.prepare("INSERT INTO bot_sanctions (guild, user, kind, mod, reason, at) VALUES ('G', 'c1', 'kick', 'm', 'avant', ?)").run(new Date().toISOString()).lastInsertRowid);
  let r = await runMod3Command(ix("case", { id }), deps);
  assert.match(r.embeds[0].title, new RegExp(`Cas #${id} · expulsé`));
  r = await runMod3Command(ix("reason", { id, reason: "après" }), deps);
  assert.match(r.content, /raison corrigée/);
  assert.equal(db.prepare("SELECT reason FROM bot_sanctions WHERE id = ?").get(id).reason, "après");
  const now = Date.now();
  const at = new Date(now - 60000).toISOString();
  const msgs = [
    { id: "1", timestamp: at, author: { id: "a" }, content: "regarde https://x.y" },
    { id: "2", timestamp: at, author: { id: "bot", bot: true }, content: "annonce" },
    { id: "3", timestamp: at, author: { id: "a" }, content: "photo", attachments: [{ filename: "a.png", content_type: "image/png" }] },
    { id: "4", timestamp: at, author: { id: "b" }, content: "Gros MOT ici" },
  ];
  assert.deepEqual(purgeFilter(msgs, { count: 10, links: true, now }), ["1"]);
  assert.deepEqual(purgeFilter(msgs, { count: 10, bots: true, now }), ["2"]);
  assert.deepEqual(purgeFilter(msgs, { count: 10, images: true, now }), ["3"]);
  assert.deepEqual(purgeFilter(msgs, { count: 10, contains: "gros mot", now }), ["4"]);
  assert.deepEqual(purgeFilter(msgs, { count: 10, author: "a", links: true, now }), ["1"]);
  const done = await lockChannels(d.fn, "G", ["L1", "L2"], true, "test");
  assert.deepEqual(done, ["L1", "L2"]);
  assert.equal(BigInt(d.calls.find((c) => c.path === "/channels/L1/permissions/G").body.deny), 1024n | (1n << 11n) | (1n << 38n));
  r = await runMod3Command(ix("lockdown", { action: "lock" }), { ...deps, server: cleanServer({}) });
  assert.match(r.content, /Aucun salon choisi/);
});

test("right-click menus: Warn asks the reason, Timeout 10 min, report to the staff, delete and warn (never above one's rank)", async () => {
  const db = getDb();
  const d = fakeDiscord((m, p) => {
    if (m === "GET" && p === "/guilds/G/members/r1") return { user: { id: "r1", username: "ur1" }, roles: ["vip"] };
    if (m === "GET" && p === "/channels/C/messages/M1") return { id: "M1", author: { id: "r1" }, content: "message douteux" };
    return undefined;
  });
  const server = cleanServer({ moderation: { reportChannel: "333333" } });
  const deps = { db, discord: d.fn, server, lang: "fr" };
  const menu = (name, type, target, resolved = {}, perms = ALL) => ({ guild_id: "G", channel_id: "C", member: { user: { id: "m", username: "modo" }, roles: ["mod"], permissions: perms }, data: { name, type, target_id: target, resolved } });
  let r = contextMenu(menu("Warn", 2, "r1"), deps);
  assert.equal(r.modal.type, 9);
  assert.equal(r.modal.data.custom_id, "md|warn|r1");
  let out = await modalSubmit({ ...menu("Warn", 2, "r1"), data: { custom_id: "md|warn|r1", components: [{ components: [{ custom_id: "reason", value: "Spam" }] }] } }, deps);
  assert.match(out.content, /averti \(cas/);
  r = contextMenu(menu("Timeout 10 min", 2, "r1", tgt("r1", ["vip"])), deps);
  out = await r.later();
  assert.match(out.content, /exclu pour 10 min/);
  // a report: anyone, sent to the staff's channel with the message's text
  r = contextMenu(menu("Signaler au staff", 3, "M1", {}, "0"), deps);
  assert.equal(r.modal.data.custom_id, "md|report|C|M1");
  out = await modalSubmit({ ...menu("x", 3, "M1", {}, "0"), data: { custom_id: "md|report|C|M1", components: [{ components: [{ custom_id: "why", value: "insulte" }] }] } }, deps);
  assert.match(out.content, /signalé à l'équipe/);
  const rep = d.calls.find((c) => c.path === "/channels/333333/messages").body.embeds[0];
  assert.match(rep.description, /message douteux[\s\S]*insulte/);
  // delete and warn: on someone above, nothing happens
  const msg = { M2: { id: "M2", author: { id: "boss", username: "boss" }, content: "x" } };
  r = contextMenu(menu("Supprimer et avertir", 3, "M2", { messages: msg, members: { boss: { roles: ["admin"] } } }), deps);
  out = await r.later();
  assert.match(out.content, /égal ou supérieur/);
  assert.ok(!d.calls.some((c) => c.method === "DELETE" && c.path === "/channels/C/messages/M2"));
  const msg3 = { M3: { id: "M3", author: { id: "r1", username: "ur1" }, content: "pub" } };
  r = contextMenu(menu("Supprimer et avertir", 3, "M3", { messages: msg3, members: { r1: { roles: ["vip"] } } }), deps);
  out = await r.later();
  assert.match(out.content, /averti/);
  assert.ok(d.calls.some((c) => c.method === "DELETE" && c.path === "/channels/C/messages/M3"));
  // without the permission, no form
  r = contextMenu(menu("Warn", 2, "r1", {}, "0"), deps);
  assert.match((await r.later()).content, /Permission manquante : il te faut « /);
});

test("tickets: limit per member, the subject's staff role pinged, closing with a reason, a rating, reopening, numbers for the editor", async () => {
  const db = getDb();
  const opened = "2026-11-26T10:00:00.000Z";
  const d = fakeDiscord((m, p) => {
    if (m === "GET" && /^\/channels\/T\d+\/messages/.test(p)) return [
      { id: "3", timestamp: "2026-11-26T10:30:00Z", author: { id: "staff1", username: "staff" }, content: "Je regarde <b>ça</b>" },
      { id: "2", timestamp: "2026-11-26T10:05:00Z", author: { id: "bot", bot: true }, content: "Bienvenue" },
      { id: "1", timestamp: "2026-11-26T10:01:00Z", author: { id: "k1", username: "kim" }, content: "Bonjour <script>alert(1)</script>" },
    ];
    return undefined;
  });
  const server = cleanServer({ logChannel: "900000001", tickets: { maxOpen: 2, categories: [{ name: "Signalement", role: "777777" }] } });
  const files = [];
  const deps = { db, discord: d.fn, server, lang: "fr", now: Date.parse(opened), postFile: async (...a) => { files.push(a); return {}; } };
  const kim = { id: "k1", username: "Kim" };
  let r = await openTicket({ ...deps, guild: "G", channel: "C", user: kim, category: "Signalement", catRole: "777777", subject: "Insultes", details: "Dans #general" });
  const thread = /<#(T\d+)>/.exec(r.content)[1];
  const hello = d.calls.find((c) => c.path === `/channels/${thread}/messages`).body;
  assert.match(hello.content, /<@&777777> va te répondre/);
  assert.deepEqual(hello.allowed_mentions.roles, ["777777"]);
  assert.match(hello.embeds[0].description, /\*\*Insultes\*\*\n\nDans #general/);
  r = await openTicket({ ...deps, guild: "G", channel: "C", user: kim });
  assert.match(r.content, /est ouvert/);
  r = await openTicket({ ...deps, guild: "G", channel: "C", user: kim });
  assert.match(r.content, /déjà 2 tickets ouverts/);
  r = await closeTicket({ ...deps, guild: "G", thread, user: { id: "staff1", username: "staff" }, permissions: String(P.MANAGE_THREADS), reason: "Réglé", guildName: "VCT" });
  assert.equal(r.content, "🔒 Ticket fermé.");
  const closing = d.calls.filter((c) => c.path === `/channels/${thread}/messages`).pop().body;
  assert.match(closing.content, /fermé par <@staff1> · Réglé/);
  assert.equal(closing.components[0].components[0].custom_id, "tk|reopen");
  const dm = d.calls.filter((c) => c.path === "/channels/dm/messages").pop().body;
  assert.match(dm.content, /Insultes.*sur \*\*VCT\*\* est fermé : Réglé/);
  assert.deepEqual(dm.components[0].components.map((b) => b.custom_id), [1, 2, 3, 4, 5].map((n) => `tr|${thread}|${n}`));
  // the transcript: a page, the text made safe
  assert.match(files[0][2], /\.html$/);
  assert.match(files[0][3], /Bonjour &lt;script&gt;/);
  assert.ok(!/<script>alert/.test(files[0][3]));
  // the first answer came 30 minutes after the opening
  assert.equal(db.prepare("SELECT first_reply FROM bot_tickets WHERE thread = ?").get(thread).first_reply, String(30 * 60000));
  assert.equal(rateTicket(db, thread, "intrus", 5).type, 4);
  assert.equal(rateTicket(db, thread, "k1", 4).type, 7);
  rateTicket(db, thread, "k1", 1); // a second click does not change it
  assert.equal(db.prepare("SELECT rating FROM bot_tickets WHERE thread = ?").get(thread).rating, "4");
  const st = ticketStats(db, Date.parse("2026-11-27T00:00:00Z"));
  assert.equal(st.firstReplyMin, 30);
  assert.equal(st.rating, 4);
  assert.equal(st.byCategory.Signalement, 1);
  r = await reopenTicket({ ...deps, guild: "G", thread, user: { id: "x" }, permissions: "0" });
  assert.match(r.content, /Seuls l'auteur/);
  r = await reopenTicket({ ...deps, guild: "G", thread, user: kim, permissions: "0" });
  assert.match(r.content, /rouvert/);
  assert.deepEqual(d.calls.filter((c) => c.method === "PATCH" && c.path === `/channels/${thread}`).pop().body, { archived: false, locked: false });
  assert.equal(firstReply([], "k1", opened), null);
  assert.match(transcriptHtml([], { name: "<x>" }), /Ticket &lt;x&gt;/);
});

test("new members: a recent account in quarantine (no arrival role), a raid noticed once, private welcome, who invited them", async () => {
  const db = getDb();
  const now = Date.parse("2026-11-26T12:00:00Z");
  const d = fakeDiscord((m, p) => (m === "GET" && p === "/guilds/G/invites" ? [{ code: "abc", uses: 4, inviter: { id: "inv1" } }, { code: "zzz", uses: 1 }] : undefined));
  const server = cleanServer({
    logChannel: "900000001", welcome: { role: "555555" },
    moderation: { lockdownChannels: ["111111"] },
    arrival: { dm: { on: true, text: "Salut {pseudo}, bienvenue sur {serveur}" }, newAccount: { days: 7, quarantine: true, role: "666666" }, raid: { on: true, joins: 3, seconds: 30, lock: true, pingRole: "888888" }, invites: true },
  });
  const memory = makeMemory();
  memory.invites = { abc: 3, zzz: 1 };
  const deps = { db, discord: d.fn, server, guild: "G", memory, now, guildName: "VCT" };
  const young = { id: snowflakeAt(now - 2 * 86400000), username: "neuf" };
  let done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: young, roles: [] }, deps);
  assert.ok(done.includes("fresh") && done.includes("quarantine") && done.includes("dm") && done.includes("invite"));
  assert.ok(!done.includes("autorole"));
  assert.ok(d.calls.some((c) => c.method === "PUT" && c.path === `/guilds/G/members/${young.id}/roles/666666`));
  assert.match(d.calls.find((c) => c.path === "/channels/dm/messages").body.content, /Salut neuf, bienvenue sur VCT/);
  const logs = d.calls.filter((c) => c.path === "/channels/900000001/messages").map((c) => c.body.embeds ? c.body.embeds[0].description : c.body.content).join("\n");
  assert.match(logs, /invité par <@inv1> \(code `abc`\)/);
  // an older account: the arrival role, no quarantine
  const old = { id: snowflakeAt(now - 400 * 86400000), username: "ancien" };
  done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: old, roles: [] }, { ...deps, now: now + 1000 });
  assert.ok(done.includes("autorole") && !done.includes("fresh"));
  // the third arrival in 30 s: a raid, the staff pinged and the channels locked; the fourth does not alert again
  done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: { id: snowflakeAt(now - 500 * 86400000), username: "c" }, roles: [] }, { ...deps, now: now + 2000 });
  assert.ok(done.includes("raid") && done.includes("raid:lock"));
  assert.match(d.calls.filter((c) => c.path === "/channels/900000001/messages").pop().body.content, /<@&888888> 🚨 \*\*Raid possible\*\* : 3 arrivées/);
  done = await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: { id: snowflakeAt(now - 500 * 86400000) + "1", username: "d" }, roles: [] }, { ...deps, now: now + 3000 });
  assert.ok(!done.includes("raid"));
  assert.equal(isRaid([0, 10000, 20000], 3, 30), true);
  assert.equal(isRaid([0, 10000, 40000], 3, 30), false);
  assert.deepEqual(usedInvite({ a: 1 }, [{ code: "a", uses: 1 }, { code: "b", uses: 1 }]), { code: "b", inviter: null });
  assert.ok(onArrival);
});

test("welcome picture: a signed address, refused when changed; verification; the member counter within Discord's limits", async () => {
  const url = welcomeCardUrl("https://site", { name: "Zoé", avatar: "https://cdn.discordapp.com/avatars/1/abc.png?size=256", count: 1234, guild: "VCT" }, "secret");
  const q = new URL(url).searchParams;
  assert.equal(q.get("sig"), welcomeSig(q, "secret"));
  q.set("name", "Autre texte");
  assert.notEqual(q.get("sig"), welcomeSig(q, "secret"));
  const db = getDb();
  const d = fakeDiscord();
  const server = cleanServer({ welcome: { on: true, channel: "444444" }, arrival: { image: true, verify: { role: "999999", delay: 300 }, newAccount: { quarantine: true, role: "666666" } } });
  await handleEvent("GUILD_MEMBER_ADD", { guild_id: "G", user: { id: snowflakeAt(Date.parse("2020-01-01")), username: "img", avatar: "abc" }, roles: [] }, { db, discord: d.fn, server, guild: "G", memory: makeMemory(), now: Date.now(), site: "https://site", secret: "s", memberCount: 50, guildName: "VCT" });
  assert.match(d.calls.find((c) => c.path === "/channels/444444/messages").body.embeds[0].image.url, /^https:\/\/site\/api\/welcomecard\?name=img&avatar=.*&n=50&g=VCT&sig=/);
  const now = Date.parse("2026-11-26T12:00:00Z");
  const click = (roles, joined) => ({ guild_id: "G", member: { user: { id: "v1" }, roles, joined_at: new Date(joined).toISOString() } });
  let r = await verifyClick(click([], now - 60000), { discord: d.fn, server, now });
  assert.match(r.content, /réessaie dans 4 min/);
  r = await verifyClick(click(["666666"], now - 3600000), { discord: d.fn, server, now });
  assert.match(r.content, /compte est récent/);
  r = await verifyClick(click([], now - 3600000), { discord: d.fn, server, now });
  assert.match(r.content, /accès au serveur/);
  assert.ok(d.calls.some((c) => c.method === "PUT" && c.path === "/guilds/G/members/v1/roles/999999"));
  // the counter: renamed, then not again within 6 minutes, then again
  assert.match(counterName("👥 {nombre} membres", 1234), /^👥 1\s234 membres$/u);
  const cs = cleanServer({ arrival: { counter: { channel: "121212", template: "👥 {nombre}" } } });
  const state = { counterWanted: 10 };
  assert.equal(await updateCounter(d.fn, cs, state, now), true);
  state.counterWanted = 11;
  assert.equal(await updateCounter(d.fn, cs, state, now + 60000), false);
  assert.equal(await updateCounter(d.fn, cs, state, now + 7 * 60000), true);
  assert.equal(d.calls.filter((c) => c.path === "/channels/121212").length, 2);
  assert.equal(canRename(0, now), true);
});
