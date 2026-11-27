// The bot on its server, beyond the commands: the settings the editor sets (moderation log, welcome and goodbye, automatic
// moderation, tickets), Discord's own AutoMod rules built from them, what the bot does with the server's events (received
// by lib/botgateway.js), and the timed work (polls, giveaways, reminders, idle tickets) done by the minute task.
// Pure builders first (tests), then the work with Discord.

const snowflake = (v) => (/^\d{5,25}$/.test(String(v || "")) ? String(v) : "");
const ids = (list, max) => (Array.isArray(list) ? [...new Set(list.map(snowflake).filter(Boolean))].slice(0, max) : []);
const text = (v, max) => String(v ?? "").slice(0, max);
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const int = (v, min, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

import { MODULES, cleanEmbed, cleanRules, fillVars, moduleOn } from "./botdash.js";
import { countMember } from "./botactivity.js";

export const LOG_KINDS = ["messages", "members", "bans", "nicknames", "roles", "timeouts", "bot", "automod"];

/** The server settings, with their defaults: nothing is on until the editor turns it on. */
export function botServer(db) {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'bot_server'").get();
  let s = {};
  try { s = row ? JSON.parse(row.value) : {}; } catch { /* defaults */ }
  return cleanServer(s);
}

/** Only known fields, ids as Discord writes them, texts and numbers within bounds. */
export function cleanServer(s = {}) {
  const w = s.welcome || {};
  const g = s.goodbye || {};
  const a = s.automod || {};
  const t = s.tickets || {};
  const words = (Array.isArray(a.words) ? a.words : String(a.words || "").split(/[\n,;]/)).map((x) => String(x).trim().toLowerCase().slice(0, 60)).filter(Boolean);
  // a ticket subject: its name, the staff role it pings (else the tickets' role), and whether a form asks for details first
  const cats = (Array.isArray(t.categories) ? t.categories : String(t.categories || "").split(/[\n;]/))
    .map((x) => (typeof x === "string" ? { name: x } : x || {}))
    .map((x) => ({ name: String(x.name || "").trim().slice(0, 40), role: snowflake(x.role), form: bool(x.form, true) }))
    .filter((x) => x.name);
  const m = s.moderation || {};
  const ar = s.arrival || {};
  const p = t.panel || {};
  const lines = (v, max, len) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x) => String(x).trim().slice(0, len)).filter(Boolean).slice(0, max);
  return {
    logChannel: snowflake(s.logChannel),
    logs: Object.fromEntries(LOG_KINDS.map((k) => [k, bool(s.logs && s.logs[k], true)])),
    welcome: { on: bool(w.on, false), channel: snowflake(w.channel), text: text(w.text || "Bienvenue {user} sur **{server}** ! Tu es notre {membercount}e membre.", 1000), role: snowflake(w.role) },
    goodbye: { on: bool(g.on, false), channel: snowflake(g.channel), text: text(g.text || "**{user.name}** a quitté le serveur.", 1000) },
    automod: {
      invites: bool(a.invites, false),
      wordsOn: bool(a.wordsOn, false),
      words: [...new Set(words)].slice(0, 300),
      mentions: int(a.mentions, 0, 50, 0),
      spam: bool(a.spam, false),
      flood: { on: bool(a.flood && a.flood.on, false), count: int(a.flood && a.flood.count, 3, 20, 6), seconds: int(a.flood && a.flood.seconds, 2, 60, 8) },
      action: ["block", "timeout"].includes(a.action) ? a.action : "block",
      timeoutMin: int(a.timeoutMin, 1, 10080, 10),
      warn: bool(a.warn, false),
      exemptRoles: ids(a.exemptRoles, 20),
      exemptChannels: ids(a.exemptChannels, 50),
    },
    tickets: {
      staffRole: snowflake(t.staffRole),
      categories: cats.length ? cats.slice(0, 10) : ["Support", "Signalement", "Partenariat"].map((name) => ({ name, role: "", form: true })),
      inactiveDays: int(t.inactiveDays, 0, 60, 0),
      transcript: bool(t.transcript, true),
      maxOpen: int(t.maxOpen, 1, 5, 1),
      dmOnClose: bool(t.dmOnClose, true),
      rating: bool(t.rating, true),
      // the answers the team writes often, picked in a ticket's reply box in the editor (20 at most)
      canned: (Array.isArray(t.canned) ? t.canned : []).map((c) => ({ title: text(c && c.title, 60), text: text(c && c.text, 1800) })).filter((c) => c.title && c.text).slice(0, 20),
      // the panel as the editor's embed builder makes it (title, text, colour, image, fields)
      panel: { ...cleanEmbed(p, { color: "#ff4655" }), title: text(p.title || "🎫 Besoin d'aide ?", 200), text: text(p.text || "Choisis ou clique : une discussion privée s'ouvre avec l'équipe du serveur.", 1500) },
    },
    moderation: {
      reasons: lines(m.reasons, 25, 100).length ? lines(m.reasons, 25, 100) : ["Spam", "Insultes ou propos haineux", "Publicité non autorisée", "Contenu inapproprié", "Hors sujet répété"],
      dm: bool(m.dm, true),
      appeal: text(m.appeal ?? "Pour contester, ouvre un ticket sur le serveur ou écris à l'équipe de modération.", 500),
      warnExpireDays: int(m.warnExpireDays, 0, 365, 0),
      escalation: (Array.isArray(m.escalation) ? m.escalation : []).map((r) => ({ count: int(r && r.count, 1, 50, 3), action: ["timeout", "kick", "ban"].includes(r && r.action) ? r.action : "timeout", duration: text((r && r.duration) || "1h", 10) })).slice(0, 5).sort((a, b) => a.count - b.count),
      confirm: bool(m.confirm, true),
      lockdownChannels: ids(m.lockdownChannels, 50),
      reportChannel: snowflake(m.reportChannel),
    },
    // the modules the editor turns on or off (all on by default), the rules per command, the embeds saved for /embed
    modules: Object.fromEntries(MODULES.map((x) => [x.key, bool(s.modules && s.modules[x.key], true)])),
    commandRules: cleanRules(s.commandRules),
    embeds: (Array.isArray(s.embeds) ? s.embeds : []).map((e) => cleanEmbed(e, { name: "" })).filter((e) => e.name && (e.title || e.text)).slice(0, 20),
    arrival: {
      image: bool(ar.image, false),
      dm: { on: bool(ar.dm && ar.dm.on, false), text: text((ar.dm && ar.dm.text) || "Bienvenue sur **{server}** ! Lis le règlement et présente-toi : bon jeu 👋", 1500) },
      verify: { role: snowflake(ar.verify && ar.verify.role), delay: int(ar.verify && ar.verify.delay, 0, 3600, 0), panel: cleanEmbed((ar.verify && ar.verify.panel) || {}, { title: "📜 Règlement", text: "Lis le règlement du serveur, puis clique sur le bouton pour accéder aux salons.", color: "#ff4655" }) },
      newAccount: { days: int(ar.newAccount && ar.newAccount.days, 0, 365, 0), quarantine: bool(ar.newAccount && ar.newAccount.quarantine, false), role: snowflake(ar.newAccount && ar.newAccount.role) },
      raid: { on: bool(ar.raid && ar.raid.on, false), joins: int(ar.raid && ar.raid.joins, 3, 100, 10), seconds: int(ar.raid && ar.raid.seconds, 5, 600, 30), lock: bool(ar.raid && ar.raid.lock, false), pingRole: snowflake(ar.raid && ar.raid.pingRole) },
      invites: bool(ar.invites, false),
      counter: { channel: snowflake(ar.counter && ar.counter.channel), template: text((ar.counter && ar.counter.template) || "👥 Membres : {nombre}", 90) },
    },
  };
}

export function saveBotServer(db, raw) {
  const next = cleanServer({ ...botServer(db), ...raw });
  db.prepare("INSERT INTO kv (key, value) VALUES ('bot_server', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
  return next;
}

/** {user} (a mention), {user.name}, {server}, {membercount}, {inviter}, and the former {membre}, {pseudo}, {serveur}, {nombre}, in a welcome or goodbye text (lib/botdash.js). */
export function fillTemplate(tpl, { userId = "", name = "", guild = "", count = "", inviter = "" }) {
  return fillVars(tpl, { userId, name, guild, count, inviter });
}
// ---- Discord's own automatic moderation (AutoMod), built from the settings ----

export const RULE_PREFIX = "VCT · ";
// an invitation to another server: discord.gg/…, discord.com/invite/…, discordapp.com/invite/…
export const INVITE_REGEX = "(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+";

/**
 * The AutoMod rules the settings ask for: [{ name, event_type, trigger_type, trigger_metadata, actions, enabled, exempt_roles,
 * exempt_channels }]. Discord blocks the message itself; it can also tell the log channel and time the author out.
 */
export function automodRules(server) {
  const a = server.automod;
  const actions = (timeoutOk, message) => {
    const out = [{ type: 1, metadata: { custom_message: message.slice(0, 150) } }];
    if (server.logChannel && server.logs.automod) out.push({ type: 2, metadata: { channel_id: server.logChannel } });
    if (timeoutOk && a.action === "timeout") out.push({ type: 3, metadata: { duration_seconds: Math.min(2419200, a.timeoutMin * 60) } });
    return out;
  };
  const base = { event_type: 1, enabled: true, exempt_roles: a.exemptRoles, exempt_channels: a.exemptChannels };
  const rules = [];
  if (a.invites) rules.push({ ...base, name: `${RULE_PREFIX}invitations`, trigger_type: 1, trigger_metadata: { regex_patterns: [INVITE_REGEX] }, actions: actions(true, "Les invitations vers d'autres serveurs ne sont pas autorisées ici.") });
  if (a.wordsOn && a.words.length) rules.push({ ...base, name: `${RULE_PREFIX}mots interdits`, trigger_type: 1, trigger_metadata: { keyword_filter: a.words.slice(0, 1000) }, actions: actions(true, "Ce message contient un mot interdit sur ce serveur.") });
  if (a.mentions > 0) rules.push({ ...base, name: `${RULE_PREFIX}mentions de masse`, trigger_type: 5, trigger_metadata: { mention_total_limit: a.mentions, mention_raid_protection_enabled: true }, actions: actions(true, "Trop de mentions dans un seul message.") });
  if (a.spam) rules.push({ ...base, name: `${RULE_PREFIX}spam`, trigger_type: 3, actions: actions(false, "Ce message ressemble à du spam.") });
  return rules;
}

/**
 * Puts the server's AutoMod rules in line with the settings: the bot's own rules (their name starts with "VCT · ") are made,
 * changed or removed; the server's other rules are never touched. Returns { made, changed, removed }.
 */
export async function syncAutomod(discord, guild, server) {
  // the module turned off: the bot's rules are taken away
  const want = moduleOn(server, "automod") ? automodRules(server) : [];
  const have = (await discord("GET", `/guilds/${guild}/auto-moderation/rules`)).filter((r) => String(r.name || "").startsWith(RULE_PREFIX));
  const out = { made: 0, changed: 0, removed: 0 };
  for (const r of want) {
    const old = have.find((h) => h.name === r.name);
    if (old) {
      const { trigger_type: _t, ...patch } = r; // a rule's trigger cannot be changed
      await discord("PATCH", `/guilds/${guild}/auto-moderation/rules/${old.id}`, patch, { reason: "Réglages du bot (éditeur du site)" });
      out.changed += 1;
    } else {
      await discord("POST", `/guilds/${guild}/auto-moderation/rules`, r, { reason: "Réglages du bot (éditeur du site)" });
      out.made += 1;
    }
  }
  for (const h of have) {
    if (want.some((r) => r.name === h.name)) continue;
    await discord("DELETE", `/guilds/${guild}/auto-moderation/rules/${h.id}`, null, { reason: "Réglages du bot (éditeur du site)" });
    out.removed += 1;
  }
  return out;
}

// ---- the moderation log channel ----

const COLORS = { messages: 0x5aa9ff, members: 0x3fb950, bans: 0xff4655, nicknames: 0xe8c33c, roles: 0xa371f7, timeouts: 0xf0883e, bot: 0xc9f03c, automod: 0xff7b8a };

/** An entry of the moderation log: { kind, title, lines, user } -> the message Discord gets (nobody pinged). */
export function logEntry({ kind, title, lines = [], user = null, at = Date.now() }) {
  return {
    embeds: [{
      title: String(title).slice(0, 250),
      description: lines.filter(Boolean).join("\n").slice(0, 3900),
      color: COLORS[kind] || 0x888888,
      ...(user ? { author: { name: String(user.name || user.id).slice(0, 80), ...(user.avatar ? { icon_url: user.avatar } : {}) }, footer: { text: `ID ${user.id}` } } : {}),
      timestamp: new Date(at).toISOString(),
    }],
    allowed_mentions: { parse: [] },
  };
}

/** Posts an entry in the log channel when that kind of entry is on. Never throws. */
export async function postLog(discord, server, entry) {
  if (!server.logChannel || !server.logs[entry.kind] || !moduleOn(server, "logs")) return false;
  try { await discord("POST", `/channels/${server.logChannel}/messages`, logEntry(entry)); return true; } catch { return false; }
}

// ---- the server's events (from the gateway) ----

const avatarOf = (u) => (u && u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : "");
const nameOf = (u) => (u ? u.global_name || u.username || u.id : "?");
const quote = (s) => (s ? `> ${String(s).slice(0, 900).replace(/\n/g, "\n> ")}` : "*(sans texte)*");

/**
 * The bot's memory of the last messages (their text, for the log when one is changed or deleted: Discord does not say what a
 * deleted message said) and of each member's nickname and roles. In memory only, never written anywhere.
 */
export function makeMemory(max = 5000) {
  const messages = new Map();
  const members = new Map();
  const recent = new Map(); // user -> times of their last messages (flood)
  return {
    messages, members, recent,
    keep(m) { messages.set(m.id, m); if (messages.size > max) messages.delete(messages.keys().next().value); },
  };
}

/** Too many messages too fast? times: the author's message times (ms), newest last. */
export function isFlood(times, count, seconds) {
  if (times.length < count) return false;
  return times[times.length - 1] - times[times.length - count] <= seconds * 1000;
}

/**
 * Does what one gateway event asks: the log entry, the welcome or goodbye, the role given on arrival, the flood check.
 * deps: { db, discord, server, guild, memory, now, botId, guildName, memberCount }. Returns what was done, for the tests.
 */
export async function handleEvent(type, d, deps) {
  const { discord, server, guild, memory, now = Date.now(), botId = "" } = deps;
  if (!d || (d.guild_id && d.guild_id !== guild)) return [];
  const done = [];
  const log = async (entry) => { if (await postLog(discord, server, { ...entry, at: now })) done.push(`log:${entry.kind}`); };
  const user = (u) => (u ? { id: u.id, name: nameOf(u), avatar: avatarOf(u) } : null);

  if (type === "MESSAGE_CREATE") {
    if (!d.author || d.author.bot || d.webhook_id) return done;
    memory.keep({ id: d.id, channel: d.channel_id, author: d.author, content: d.content || "", files: (d.attachments || []).map((x) => x.url) });
    const f = server.automod.flood;
    if (f.on && moduleOn(server, "automod") && !server.automod.exemptChannels.includes(d.channel_id) && !(d.member && (d.member.roles || []).some((r) => server.automod.exemptRoles.includes(r)))) {
      const times = [...(memory.recent.get(d.author.id) || []), now].slice(-20);
      memory.recent.set(d.author.id, times);
      if (isFlood(times, f.count, f.seconds)) {
        memory.recent.set(d.author.id, []);
        // the burst is cleared, and its author warned or timed out as the settings say
        const burst = [...memory.messages.values()].filter((m) => m.author.id === d.author.id && m.channel === d.channel_id).slice(-f.count).map((m) => m.id);
        try {
          if (burst.length > 1) await discord("POST", `/channels/${d.channel_id}/messages/bulk-delete`, { messages: burst }, { reason: "Anti-flood" });
          else await discord("DELETE", `/channels/${d.channel_id}/messages/${d.id}`, null, { reason: "Anti-flood" });
          done.push("flood:delete");
        } catch { /* missing rights: the log says it anyway */ }
        if (server.automod.action === "timeout") {
          try { await discord("PATCH", `/guilds/${guild}/members/${d.author.id}`, { communication_disabled_until: new Date(now + server.automod.timeoutMin * 60000).toISOString() }, { reason: "Anti-flood" }); done.push("flood:timeout"); } catch { /* none */ }
        }
        if (server.automod.warn) { addSanction(deps.db, { guild, user: d.author.id, kind: "warn", mod: botId || "bot", reason: "Anti-flood (messages trop rapides)", at: now }); done.push("flood:warn"); }
        await log({ kind: "automod", title: "🌊 Anti-flood", user: user(d.author), lines: [`<#${d.channel_id}> · ${f.count} messages en moins de ${f.seconds} s`, server.automod.action === "timeout" ? `Exclu ${server.automod.timeoutMin} min` : "Messages supprimés"] });
      }
    }
    return done;
  }
  if (type === "MESSAGE_UPDATE") {
    const old = memory.messages.get(d.id);
    if (!d.author || d.author.bot || d.content === undefined || (old && old.content === d.content)) return done;
    if (old) memory.keep({ ...old, content: d.content });
    await log({ kind: "messages", title: "✏️ Message modifié", user: user(d.author), lines: [`<#${d.channel_id}> · [aller au message](https://discord.com/channels/${guild}/${d.channel_id}/${d.id})`, `**Avant**\n${old ? quote(old.content) : "*(inconnu : envoyé avant le démarrage du bot)*"}`, `**Après**\n${quote(d.content)}`] });
    return done;
  }
  if (type === "MESSAGE_DELETE") {
    const old = memory.messages.get(d.id);
    if (old && old.author && old.author.bot) return done;
    await log({ kind: "messages", title: "🗑️ Message supprimé", user: old ? user(old.author) : null, lines: [`<#${d.channel_id}>`, old ? quote(old.content) : "*(texte inconnu : envoyé avant le démarrage du bot)*", ...(old && old.files.length ? [`Fichiers : ${old.files.join(" ")}`] : [])] });
    memory.messages.delete(d.id);
    return done;
  }
  if (type === "MESSAGE_DELETE_BULK") {
    await log({ kind: "messages", title: "🧹 Messages supprimés en masse", lines: [`<#${d.channel_id}> · ${(d.ids || []).length} messages`] });
    return done;
  }
  if (type === "GUILD_MEMBER_ADD") {
    memory.members.set(d.user.id, { nick: d.nick || "", roles: d.roles || [] });
    if (d.user.bot) return done;
    countMember(deps.db, guild, "join", now);
    const created = Math.floor(Number((BigInt(d.user.id) >> 22n) + 1420070400000n) / 1000);
    await log({ kind: "members", title: "📥 Arrivée", user: user(d.user), lines: [`<@${d.user.id}>`, `Compte créé <t:${created}:R>`] });
    // a new account (quarantine), a raid, the private welcome, who invited them (lib/botmod3.js)
    if (!moduleOn(server, "welcome")) return done;
    const { onArrival, welcomeCardUrl } = await import("./botmod3.js");
    const extra = await onArrival(d, { ...deps, log });
    done.push(...extra);
    const quarantined = extra.includes("quarantine");
    if (server.welcome.on && server.welcome.channel) {
      try {
        const content = fillTemplate(server.welcome.text, { userId: d.user.id, name: nameOf(d.user), guild: deps.guildName || "", count: deps.memberCount || "", inviter: extra.inviter || "" });
        // the welcome picture, drawn by the site (app/api/welcomecard): avatar, name, "you are the 1 234th member"
        const image = server.arrival.image && deps.site ? welcomeCardUrl(deps.site, { name: nameOf(d.user), avatar: d.user.avatar ? `https://cdn.discordapp.com/avatars/${d.user.id}/${d.user.avatar}.png?size=256` : "", count: deps.memberCount || "", guild: deps.guildName || "" }, deps.secret) : "";
        await discord("POST", `/channels/${server.welcome.channel}/messages`, { content, ...(image ? { embeds: [{ image: { url: image }, color: 0xff4655 }] } : {}), allowed_mentions: { users: [d.user.id] } });
        done.push(image ? "welcome:image" : "welcome");
      } catch { /* missing rights */ }
    }
    // a member in quarantine waits for the staff: no arrival role
    if (server.welcome.role && !quarantined) {
      try { await discord("PUT", `/guilds/${guild}/members/${d.user.id}/roles/${server.welcome.role}`, null, { reason: "Rôle d'arrivée" }); done.push("autorole"); } catch { /* the bot's role is below it */ }
    }
    return done;
  }
  if (type === "GUILD_MEMBER_REMOVE") {
    memory.members.delete(d.user.id);
    if (d.user.bot) return done;
    countMember(deps.db, guild, "leave", now);
    await log({ kind: "members", title: "📤 Départ", user: user(d.user), lines: [`**${nameOf(d.user)}** a quitté le serveur`] });
    if (server.goodbye.on && server.goodbye.channel && moduleOn(server, "welcome")) {
      try {
        await discord("POST", `/channels/${server.goodbye.channel}/messages`, { content: fillTemplate(server.goodbye.text, { name: nameOf(d.user), guild: deps.guildName || "", count: deps.memberCount || "" }), allowed_mentions: { parse: [] } });
        done.push("goodbye");
      } catch { /* missing rights */ }
    }
    return done;
  }
  if (type === "GUILD_MEMBER_UPDATE") {
    const old = memory.members.get(d.user.id);
    memory.members.set(d.user.id, { nick: d.nick || "", roles: d.roles || [], until: d.communication_disabled_until || "" });
    if (!old) return done;
    if ((old.nick || "") !== (d.nick || "")) await log({ kind: "nicknames", title: "🏷️ Pseudo changé", user: user(d.user), lines: [`<@${d.user.id}>`, `${old.nick || "*(aucun)*"} → ${d.nick || "*(aucun)*"}`] });
    const added = (d.roles || []).filter((r) => !old.roles.includes(r));
    const removed = old.roles.filter((r) => !(d.roles || []).includes(r));
    if (added.length || removed.length) await log({ kind: "roles", title: "🎭 Rôles changés", user: user(d.user), lines: [`<@${d.user.id}>`, ...added.map((r) => `➕ <@&${r}>`), ...removed.map((r) => `➖ <@&${r}>`)] });
    const until = d.communication_disabled_until || "";
    if ((old.until || "") !== until && old.until !== undefined) {
      await log({ kind: "timeouts", title: until && Date.parse(until) > now ? "🔇 Membre exclu" : "🔊 Exclusion levée", user: user(d.user), lines: [`<@${d.user.id}>`, until && Date.parse(until) > now ? `Jusqu'à <t:${Math.floor(Date.parse(until) / 1000)}:f>` : ""] });
    }
    return done;
  }
  if (type === "GUILD_BAN_ADD" || type === "GUILD_BAN_REMOVE") {
    const ban = type === "GUILD_BAN_ADD";
    await log({ kind: "bans", title: ban ? "🔨 Membre banni" : "✅ Bannissement levé", user: user(d.user), lines: [`<@${d.user.id}>`] });
    return done;
  }
  if (type === "AUTO_MODERATION_ACTION_EXECUTION") {
    // a message blocked by one of the bot's AutoMod rules: a warning in the member's file, when the settings say so
    if (d.action && d.action.type === 1 && server.automod.warn) {
      addSanction(deps.db, { guild, user: d.user_id, kind: "warn", mod: botId || "bot", reason: `AutoMod : ${String(d.matched_keyword || d.matched_content || "règle du serveur").slice(0, 100)}`, at: now });
      done.push("automod:warn");
    }
    return done;
  }
  return done;
}

// ---- sanctions (warnings, time-outs, kicks, bans, notes) ----

/** One line of a member's file. kind: warn | timeout | kick | ban | unban | note. Returns its number. */
export function addSanction(db, { guild, user, kind, mod, reason = "", at = Date.now(), until = "" }) {
  if (!db) return 0;
  const r = db.prepare("INSERT INTO bot_sanctions (guild, user, kind, mod, reason, at, until) VALUES (?, ?, ?, ?, ?, ?, ?)").run(guild, user, kind, String(mod || ""), String(reason || "").slice(0, 400), new Date(at).toISOString(), until || "");
  return Number(r.lastInsertRowid || 0);
}
export const sanctionsOf = (db, guild, user, limit = 25) => db.prepare("SELECT id, kind, mod, reason, at, until FROM bot_sanctions WHERE guild = ? AND user = ? ORDER BY id DESC LIMIT ?").all(guild, user, limit);
