// The bot's third set: what makes the server commands easier and safer to use. Readable durations (10m, 2h, 1d, 1w), a case
// number for each sanction with /case and /reason, preset reasons, a private message to the member, automatic escalation,
// a button to confirm a ban or kick, /tempban, filters for /purge, /lockdown, right-click menus on members and messages;
// for tickets a form, a closing reason, reopening, a rating and their numbers; for new members a welcome picture, a private
// welcome, verification, new accounts, anti-raid, invites and a member counter. Pure helpers first (tests), then Discord.
import crypto from "node:crypto";
import { P, canActOn, hasPerm } from "./botperms.js";
import { addSanction } from "./botserver.js";
import { fillVars, permName, toDiscordEmbed } from "./botdash.js";

const USER = 6;
const CHANNEL = 7;
const STR = 3;
const INT = 4;
const BOOL = 5;
const perm = (bit) => String(bit);

// ---- durations ----

const UNITS = { s: 1, sec: 1, m: 60, min: 60, h: 3600, d: 86400, j: 86400, w: 604800, sem: 604800 };

/** "10m", "2h", "1d", "1w", "1h30m", "90s" -> seconds; a bare number is minutes. null when unreadable. */
export function parseDuration(s) {
  const t = String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t) * 60;
  let total = 0;
  let rest = t;
  for (const m of t.matchAll(/(\d+)(sem|sec|min|[smhdjw])/g)) { total += Number(m[1]) * UNITS[m[2]]; rest = rest.replace(m[0], ""); }
  return rest === "" && total > 0 ? total : null;
}

/** 600 -> "10 min", 7200 -> "2 h", 90000 -> "1 j 1 h", 604800 -> "1 sem". */
export function formatDuration(sec) {
  let n = Math.round(Number(sec) || 0);
  if (n <= 0) return "0";
  const parts = [];
  for (const [k, v] of [["sem", 604800], ["j", 86400], ["h", 3600], ["min", 60], ["s", 1]]) {
    if (n >= v) { parts.push(`${Math.floor(n / v)} ${k}`); n %= v; }
  }
  return parts.slice(0, 2).join(" ");
}

/** What the duration field suggests while typing: what was typed (when readable) and the usual ones. */
export function durationSuggestions(typed, presets = ["10m", "30m", "1h", "6h", "1d", "3d", "1w"]) {
  const t = String(typed || "").trim();
  const own = parseDuration(t);
  const list = [...(own ? [t] : []), ...presets.filter((p) => !t || p.startsWith(t.toLowerCase()))];
  return [...new Set(list)].slice(0, 25).map((v) => ({ name: `${v} (${formatDuration(parseDuration(v))})`, value: v }));
}

/** The preset reasons the reason field suggests, those containing what was typed first; what was typed stays possible. */
export function reasonSuggestions(typed, reasons) {
  const t = String(typed || "").trim();
  const low = t.toLowerCase();
  const list = [...(t ? [t] : []), ...reasons.filter((r) => !low || r.toLowerCase().includes(low))];
  return [...new Set(list)].slice(0, 25).map((r) => ({ name: r.slice(0, 100), value: r.slice(0, 100) }));
}

// ---- cases, warnings, escalation ----

/** The warnings still counting: those of the last `days` days (all of them when 0). */
export function activeWarns(db, guild, user, days = 0, now = Date.now()) {
  const since = days > 0 ? new Date(now - days * 86400000).toISOString() : "";
  return db.prepare("SELECT id, at FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'warn' AND at >= ?").all(guild, user, since);
}

/** The escalation step reached at exactly `count` warnings, or null. rules: [{ count, action, duration }]. */
export const escalationFor = (rules, count) => (rules || []).find((r) => r.count === count) || null;

export const caseOf = (db, guild, id) => db.prepare("SELECT * FROM bot_sanctions WHERE guild = ? AND id = ?").get(guild, Number(id)) || null;

const ACTION_FR = { warn: "averti", timeout: "exclu", kick: "expulsé", ban: "banni", tempban: "banni temporairement", unban: "débanni" };
const ICON = { warn: "⚠️", timeout: "🔇", kick: "👢", ban: "🔨", tempban: "⏳", unban: "✅", untimeout: "🔊", note: "📝" };

/** The private message to a member about a sanction: what, why, how long, the case, and how to appeal. */
export function sanctionDmText({ action, guildName = "le serveur", reason = "", duration = 0, caseId = 0, appeal = "" }) {
  return [
    `${ICON[action] || "ℹ️"} Tu as été **${ACTION_FR[action] || action}** sur **${guildName}**.`,
    reason ? `Raison : ${reason}` : "",
    duration ? `Durée : ${formatDuration(duration)}` : "",
    caseId ? `Cas #${caseId}` : "",
    appeal ? `\n${appeal}` : "",
  ].filter(Boolean).join("\n");
}

/** Sends that message (before a kick or ban: afterwards the bot can no longer write to them). true when it went through. */
export async function sendSanctionDm(deps, userId, fields) {
  const { discord, server } = deps;
  if (server && server.moderation && !server.moderation.dm) return false;
  try {
    const ch = await discord("POST", "/users/@me/channels", { recipient_id: userId });
    await discord("POST", `/channels/${ch.id}/messages`, { content: sanctionDmText({ ...fields, appeal: server ? server.moderation.appeal : "" }), allowed_mentions: { parse: [] } });
    return true;
  } catch { return false; }
}

/**
 * After a warning: the escalation the settings ask for at this number of active warnings (time-out, kick or ban), done by the
 * bot and written in the member's file. Returns the line to add to the answer, or "".
 */
export async function afterWarn(deps, guild, userId) {
  const { db, discord, server, now = Date.now() } = deps;
  if (!server) return "";
  const n = activeWarns(db, guild, userId, server.moderation.warnExpireDays, now).length;
  const step = escalationFor(server.moderation.escalation, n);
  if (!step) return "";
  const why = `Escalade automatique : ${n} avertissements`;
  try {
    if (step.action === "timeout") {
      const secs = Math.min(2419200, parseDuration(step.duration) || 3600);
      await discord("PATCH", `/guilds/${guild}/members/${userId}`, { communication_disabled_until: new Date(now + secs * 1000).toISOString() }, { reason: why });
      const id = addSanction(db, { guild, user: userId, kind: "timeout", mod: "auto", reason: why, at: now, until: new Date(now + secs * 1000).toISOString() });
      await sendSanctionDm(deps, userId, { action: "timeout", guildName: deps.guildName, reason: why, duration: secs, caseId: id });
      return `⚙️ ${why} : exclu ${formatDuration(secs)} (cas #${id}).`;
    }
    const id = addSanction(db, { guild, user: userId, kind: step.action, mod: "auto", reason: why, at: now });
    await sendSanctionDm(deps, userId, { action: step.action, guildName: deps.guildName, reason: why, caseId: id });
    if (step.action === "kick") await discord("DELETE", `/guilds/${guild}/members/${userId}`, null, { reason: why });
    else await discord("PUT", `/guilds/${guild}/bans/${userId}`, { delete_message_seconds: 0 }, { reason: why });
    return `⚙️ ${why} : ${step.action === "kick" ? "expulsé" : "banni"} (cas #${id}).`;
  } catch {
    return `⚠️ ${why} : l'action automatique a échoué (droits ou rôle du bot).`;
  }
}

// ---- purge ----

const LINK = /https?:\/\/\S+/i;

/** The ids /purge deletes: newest first, under 14 days, not pinned, matching every filter given. */
export function purgeFilter(messages, { count, author = "", bots = false, contains = "", links = false, images = false, now = Date.now() }) {
  const limit = now - 14 * 86400000 + 60000;
  const needle = String(contains || "").toLowerCase();
  return (messages || [])
    .filter((m) => Date.parse(m.timestamp) > limit && !m.pinned)
    .filter((m) => !author || (m.author && m.author.id === author))
    .filter((m) => !bots || (m.author && m.author.bot))
    .filter((m) => !needle || String(m.content || "").toLowerCase().includes(needle))
    .filter((m) => !links || LINK.test(m.content || ""))
    .filter((m) => !images || (m.attachments || []).some((a) => /^image\//.test(a.content_type || "") || /\.(png|jpe?g|gif|webp)$/i.test(a.filename || "")) || (m.embeds || []).some((e) => e.image || e.thumbnail))
    .slice(0, count)
    .map((m) => m.id);
}

// ---- lockdown ----

/** Locks (no sending for @everyone) or opens again each channel chosen; the other rules of each channel stay. */
export async function lockChannels(discord, guild, channels, lock, reason) {
  const bits = (1n << 11n) | (1n << 38n);
  const done = [];
  for (const id of channels) {
    try {
      const ch = await discord("GET", `/channels/${id}`);
      const old = (ch.permission_overwrites || []).find((o) => o.id === guild) || { allow: "0", deny: "0" };
      let allow = BigInt(old.allow || 0);
      let deny = BigInt(old.deny || 0);
      if (lock) { deny |= bits; allow &= ~bits; } else { deny &= ~bits; }
      await discord("PUT", `/channels/${id}/permissions/${guild}`, { type: 0, allow: String(allow), deny: String(deny) }, { reason });
      done.push(id);
    } catch { /* a channel deleted or out of the bot's reach */ }
  }
  return done;
}

// ---- confirmation of a ban or kick ----

/** Keeps the command to run once confirmed (5 minutes), and returns its number. */
export function savePending(db, { guild, by, payload, now = Date.now() }) {
  db.prepare("DELETE FROM bot_pending WHERE at < ?").run(new Date(now - 600000).toISOString());
  return Number(db.prepare("INSERT INTO bot_pending (guild, by, payload, at) VALUES (?, ?, ?, ?)").run(guild, by, JSON.stringify(payload), new Date(now).toISOString()).lastInsertRowid);
}

/** The command kept, once: only for the moderator who asked, within 5 minutes. */
export function takePending(db, id, by, now = Date.now()) {
  const row = db.prepare("SELECT * FROM bot_pending WHERE id = ?").get(Number(id));
  if (!row || row.by !== by || now - Date.parse(row.at) > 300000) return null;
  db.prepare("DELETE FROM bot_pending WHERE id = ?").run(row.id);
  try { return JSON.parse(row.payload); } catch { return null; }
}

export const confirmMessage = (id, text) => ({
  content: text,
  components: [{ type: 1, components: [{ type: 2, style: 4, label: "Confirmer", custom_id: `cf|${id}|yes` }, { type: 2, style: 2, label: "Annuler", custom_id: `cf|${id}|no` }] }],
});

// ---- the third set of commands ----

const reasonOpt = (required = false) => ({ type: STR, name: "reason", description: "La raison (choisis-en une ou écris la tienne)", required, max_length: 300, autocomplete: true });

export const MOD3_COMMANDS = [
  { name: "tempban", description: "Bannir un membre pour un temps : il est débanni tout seul à la fin", default_member_permissions: perm(P.BAN), options: [{ type: USER, name: "user", description: "Le membre", required: true }, { type: STR, name: "duration", description: "Combien de temps : 1h, 1d, 1w…", required: true, autocomplete: true, max_length: 12 }, reasonOpt(), { type: INT, name: "delete_messages", description: "Effacer aussi ses messages récents", required: false, choices: [{ name: "Aucun", value: 0 }, { name: "Dernière heure", value: 3600 }, { name: "Dernières 24 h", value: 86400 }, { name: "7 derniers jours", value: 604800 }] }] },
  { name: "case", description: "Voir un cas de modération par son numéro", default_member_permissions: perm(P.MODERATE), options: [{ type: INT, name: "id", description: "Le numéro du cas", required: true, min_value: 1 }] },
  { name: "reason", description: "Corriger la raison d'un cas de modération", default_member_permissions: perm(P.MODERATE), options: [{ type: INT, name: "id", description: "Le numéro du cas", required: true, min_value: 1 }, { ...reasonOpt(true) }] },
  { name: "lockdown", description: "Verrouiller ou rouvrir d'un coup tous les salons choisis dans l'éditeur", default_member_permissions: perm(P.MANAGE_CHANNELS), options: [{ type: STR, name: "action", description: "Verrouiller ou rouvrir", required: true, choices: [{ name: "Verrouiller", value: "lock" }, { name: "Rouvrir", value: "unlock" }] }, reasonOpt()] },
  { name: "verifypanel", description: "Poser le bouton « J'accepte le règlement » qui donne l'accès au serveur", default_member_permissions: perm(P.MANAGE_GUILD), options: [{ type: CHANNEL, name: "channel", description: "Le salon (celui-ci par défaut)", required: false, channel_types: [0] }, { type: STR, name: "text", description: "Le règlement ou le texte au-dessus du bouton (\\n pour aller à la ligne)", required: false, max_length: 3500 }] },
  // right-click menus: on a member, on a message
  { name: "Warn", type: 2, default_member_permissions: perm(P.MODERATE) },
  { name: "Timeout 10 min", type: 2, default_member_permissions: perm(P.MODERATE) },
  { name: "Modlogs", type: 2, default_member_permissions: perm(P.MODERATE) },
  { name: "Signaler au staff", type: 3 },
  { name: "Supprimer et avertir", type: 3, default_member_permissions: perm(P.MANAGE_MESSAGES) },
].map((c) => ({ ...c, contexts: [0] }));

export const MOD3_NAMES = MOD3_COMMANDS.map((c) => c.name);
export const PURGE_FILTERS = [
  { type: BOOL, name: "bots", description: "Seulement les messages des bots", required: false },
  { type: STR, name: "contains", description: "Seulement les messages qui contiennent ce texte", required: false, max_length: 100 },
  { type: BOOL, name: "links", description: "Seulement les messages avec un lien", required: false },
  { type: BOOL, name: "images", description: "Seulement les messages avec une image", required: false },
];

const tag = (u) => (u ? u.global_name || u.username || u.id : "?");
const say = (content) => ({ content });

async function ownerAndRoles(discord, guild) {
  const [roles, g] = await Promise.all([discord("GET", `/guilds/${guild}/roles`), discord("GET", `/guilds/${guild}`)]);
  return { roles: roles.map((r) => ({ id: r.id, position: r.position })), owner: g.owner_id, name: g.name };
}

/** May this moderator act on that member? "" or why not. */
export async function checkTarget(discord, guild, mod, targetId, targetMember) {
  if (!targetMember) return "❌ Ce membre n'est pas sur le serveur.";
  const { roles, owner } = await ownerAndRoles(discord, guild);
  const no = canActOn({ modId: mod.user.id, modRoles: mod.roles, targetId, targetRoles: targetMember.roles, ownerId: owner, roles });
  return no === "self" ? "❌ Pas sur toi-même." : no === "owner" ? "❌ Impossible sur le propriétaire du serveur." : no ? "❌ Ce membre a un rôle égal ou supérieur au tien." : "";
}

/** Runs /tempban, /case, /reason, /lockdown, /verifypanel. deps: { db, discord, server, now, logBot, notify }. */
export async function runMod3Command(i, deps) {
  const { db, discord, server, now = Date.now(), logBot = () => {}, notify = async () => {} } = deps;
  const name = i.data.name;
  const guild = i.guild_id;
  const opts = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
  const resolved = i.data.resolved || {};
  const mod = i.member || {};
  const def = MOD3_COMMANDS.find((c) => c.name === name);
  if (!guild) return say("❌ Cette commande ne marche que sur un serveur.");
  if (def && def.default_member_permissions && !hasPerm(mod.permissions, BigInt(def.default_member_permissions))) return say(`❌ Permission manquante : il te faut « ${permName(def.default_member_permissions)} ».`);
  const audit = (why) => `${tag(mod.user)} (${mod.user.id})${why ? ` : ${why}` : ""}`;
  const log = async (text) => { try { logBot(db, "moderation", `${name} · ${text}`, true, now); } catch { /* none */ } await notify(`**/${name}** par <@${mod.user.id}> · ${text}`); };
  try {
    if (name === "tempban") {
      const id = String(opts.user || "");
      const secs = parseDuration(opts.duration);
      if (!secs) return say("❌ Durée illisible : écris par exemple 30m, 2h, 1d ou 1w.");
      const member = (resolved.members || {})[id];
      if (member) { const no = await checkTarget(discord, guild, mod, id, member); if (no) return say(no); }
      if (id === mod.user.id) return say("❌ Pas sur toi-même.");
      if (server && server.moderation.confirm && !deps.confirmed) {
        const pid = savePending(db, { guild, by: mod.user.id, payload: { guild_id: guild, channel_id: i.channel_id, member: mod, data: i.data }, now });
        return confirmMessage(pid, `⏳ Bannir **${tag((resolved.users || {})[id])}** pendant ${formatDuration(secs)} ? Il sera débanni tout seul à la fin.`);
      }
      const why = String(opts.reason || "").trim();
      const until = new Date(now + secs * 1000).toISOString();
      const caseId = addSanction(db, { guild, user: id, kind: "tempban", mod: mod.user.id, reason: why, at: now, until });
      await sendSanctionDm(deps, id, { action: "tempban", guildName: deps.guildName, reason: why, duration: secs, caseId });
      await discord("PUT", `/guilds/${guild}/bans/${id}`, { delete_message_seconds: Number(opts.delete_messages) || 0 }, { reason: audit(`${why || "sans raison"} (${formatDuration(secs)}, cas #${caseId})`) });
      await log(`<@${id}> banni ${formatDuration(secs)} (cas #${caseId})${why ? ` : ${why}` : ""}`);
      return say(`⏳ **${tag((resolved.users || {})[id])}** est banni pour ${formatDuration(secs)}, jusqu'à <t:${Math.floor(Date.parse(until) / 1000)}:f> (cas #${caseId}).`);
    }
    if (name === "case") {
      const c = caseOf(db, guild, opts.id);
      if (!c) return say(`❌ Pas de cas #${opts.id} sur ce serveur.`);
      return { embeds: [{ title: `${ICON[c.kind] || "📁"} Cas #${c.id} · ${ACTION_FR[c.kind] || c.kind}`, color: 0xff4655, fields: [
        { name: "Membre", value: `<@${c.user}>`, inline: true }, { name: "Par", value: c.mod === "auto" ? "Escalade automatique" : `<@${c.mod}>`, inline: true },
        { name: "Date", value: `<t:${Math.floor(Date.parse(c.at) / 1000)}:f>`, inline: true },
        ...(c.until ? [{ name: "Jusqu'à", value: `<t:${Math.floor(Date.parse(c.until) / 1000)}:f>${c.done ? " (levé)" : ""}`, inline: true }] : []),
        { name: "Raison", value: c.reason || "—" }] }] };
    }
    if (name === "reason") {
      const c = caseOf(db, guild, opts.id);
      if (!c) return say(`❌ Pas de cas #${opts.id} sur ce serveur.`);
      const why = String(opts.reason || "").trim().slice(0, 400);
      db.prepare("UPDATE bot_sanctions SET reason = ? WHERE id = ?").run(why, c.id);
      await log(`raison du cas #${c.id} : ${why}`);
      return say(`✏️ Cas #${c.id} : raison corrigée (« ${why} »).`);
    }
    if (name === "lockdown") {
      const list = (server && server.moderation.lockdownChannels) || [];
      if (!list.length) return say("❌ Aucun salon choisi : règle-les dans l'éditeur (Discord, onglet Serveur, Modération).");
      const lock = opts.action === "lock";
      const why = String(opts.reason || "").trim();
      const done = await lockChannels(discord, guild, list, lock, audit(why));
      await log(`${lock ? "verrouillage" : "réouverture"} de ${done.length} salon(s)${why ? ` : ${why}` : ""}`);
      for (const id of done) {
        try { await discord("POST", `/channels/${id}/messages`, { content: lock ? `🔒 Salon verrouillé par l'équipe${why ? ` : ${why}` : ""}.` : "🔓 Salon rouvert.", allowed_mentions: { parse: [] } }); } catch { /* none */ }
      }
      return say(`${lock ? "🔒" : "🔓"} ${done.length}/${list.length} salon(s) ${lock ? "verrouillé(s)" : "rouvert(s)"}.`);
    }
    if (name === "verifypanel") {
      if (!server || !server.arrival.verify.role) return say("❌ Choisis d'abord le rôle d'accès dans l'éditeur (Discord, onglet Serveur, Arrivée).");
      const channel = String(opts.channel || i.channel_id);
      await discord("POST", `/channels/${channel}/messages`, {
        // the panel written in the editor (title, text, colour, image, fields), or the text given with the command
        embeds: [{ ...toDiscordEmbed(server.arrival.verify.panel, { guild: deps.guildName || "" }), ...(opts.text ? { description: String(opts.text).replace(/\\n/g, "\n") } : {}) }],
        components: [{ type: 1, components: [{ type: 2, style: 3, label: "J'accepte le règlement", emoji: { name: "✅" }, custom_id: "vf|ok" }] }],
        allowed_mentions: { parse: [] },
      });
      await log(`bouton de vérification dans <#${channel}>`);
      return say(`✅ Bouton de vérification posé dans <#${channel}>.`);
    }
  } catch (e) {
    try { logBot(db, "moderation", `${name} · ${e.message}`, false, now); } catch { /* none */ }
    return say(e && (e.code === 50013 || e.status === 403) ? "❌ Le bot n'a pas le droit de faire ça ici : donne-lui la permission, et place son rôle au-dessus de celui du membre." : `❌ Discord a refusé : ${e.message}`);
  }
  return say("?");
}

// ---- right-click menus and their forms (Discord "modals") ----

export const modal = (custom_id, title, inputs) => ({ type: 9, data: { custom_id, title: title.slice(0, 45), components: inputs.map((x) => ({ type: 1, components: [{ type: 4, style: x.long ? 2 : 1, required: !!x.required, max_length: x.max || 300, ...x, long: undefined, max: undefined }] })) } });
/** The values typed in a form: { custom_id of each field: value }. */
export const formValues = (i) => Object.fromEntries(((i.data && i.data.components) || []).flatMap((row) => row.components || []).map((c) => [c.custom_id, String(c.value || "")]));

/**
 * A right-click menu: "Warn" (a form asks the reason), "Timeout 10 min", "Modlogs", "Signaler au staff" (a form asks what is
 * wrong), "Supprimer et avertir". Returns { modal } (answered at once) or { later: () => message } (answered after).
 */
export function contextMenu(i, deps) {
  const name = i.data.name;
  const target = i.data.target_id;
  const mod = i.member || {};
  const def = MOD3_COMMANDS.find((c) => c.name === name);
  if (def && def.default_member_permissions && !hasPerm(mod.permissions, BigInt(def.default_member_permissions))) return { later: async () => say(`❌ Permission manquante : il te faut « ${permName(def.default_member_permissions)} ».`) };
  if (name === "Warn") return { modal: modal(`md|warn|${target}`, "Avertir le membre", [{ custom_id: "reason", label: "Raison", required: true, max: 300, placeholder: (deps.server && deps.server.moderation.reasons[0]) || "" }]) };
  if (name === "Signaler au staff") return { modal: modal(`md|report|${i.channel_id}|${target}`, "Signaler ce message", [{ custom_id: "why", label: "Qu'est-ce qui ne va pas ?", required: false, long: true, max: 500 }]) };
  return { later: async () => {
    const { runModCommand } = await import("./botmod.js");
    const { runMod2Command } = await import("./botmod2.js");
    const resolved = i.data.resolved || {};
    if (name === "Timeout 10 min") return runModCommand({ ...i, data: { name: "timeout", options: [{ name: "user", value: target }, { name: "duration", value: "10m" }, { name: "reason", value: "Clic droit : exclusion de 10 min" }], resolved } }, deps);
    if (name === "Modlogs") return runMod2Command({ ...i, data: { name: "modlogs", options: [{ name: "user", value: target }], resolved } }, deps);
    if (name === "Supprimer et avertir") {
      const msg = (resolved.messages || {})[target];
      if (!msg) return say("❌ Message introuvable.");
      const author = msg.author || {};
      const member = (resolved.members || {})[author.id] || msg.member;
      const no = await checkTarget(deps.discord, i.guild_id, mod, author.id, member);
      if (no) return say(no);
      await deps.discord("DELETE", `/channels/${i.channel_id}/messages/${target}`, null, { reason: `${tag(mod.user)} (${mod.user.id}) : message supprimé` });
      return runModCommand({ ...i, data: { name: "warn", options: [{ name: "user", value: author.id }, { name: "reason", value: `Message supprimé : « ${String(msg.content || "").slice(0, 150)} »` }], resolved: { users: { [author.id]: author }, members: { [author.id]: member } } } }, deps);
    }
    return say("?");
  } };
}

/** A form sent back: md|warn|<user>, md|report|<channel>|<message>. Returns the message to answer. */
export async function modalSubmit(i, deps) {
  const [, kind, a, b] = String(i.data.custom_id || "").split("|");
  const v = formValues(i);
  const { discord, server, db, now = Date.now() } = deps;
  if (kind === "warn") {
    if (!hasPerm(i.member && i.member.permissions, P.MODERATE)) return say("Tu n'as pas la permission pour ça.");
    const member = await discord("GET", `/guilds/${i.guild_id}/members/${a}`).catch(() => null);
    const { runModCommand } = await import("./botmod.js");
    return runModCommand({ ...i, data: { name: "warn", options: [{ name: "user", value: a }, { name: "reason", value: v.reason }], resolved: member ? { users: { [a]: member.user }, members: { [a]: member } } : {} } }, deps);
  }
  if (kind === "report") {
    const to = server && (server.moderation.reportChannel || server.logChannel);
    if (!to) return say("Le signalement n'a pas pu être transmis : aucun salon n'est réglé pour l'équipe.");
    const msg = await discord("GET", `/channels/${a}/messages/${b}`).catch(() => null);
    const by = (i.member && i.member.user) || {};
    await discord("POST", `/channels/${to}/messages`, {
      embeds: [{ title: "🚩 Message signalé", color: 0xff4655, description: [msg ? `> ${String(msg.content || "*(sans texte)*").slice(0, 1000).replace(/\n/g, "\n> ")}` : "*(message supprimé depuis)*", v.why ? `\n**Pourquoi :** ${v.why}` : "", `\n[Aller au message](https://discord.com/channels/${i.guild_id}/${a}/${b})`].join(""), fields: [{ name: "Auteur", value: msg && msg.author ? `<@${msg.author.id}>` : "?", inline: true }, { name: "Signalé par", value: `<@${by.id}>`, inline: true }, { name: "Salon", value: `<#${a}>`, inline: true }], timestamp: new Date(now).toISOString() }],
      allowed_mentions: { parse: [] },
    });
    try { deps.logBot && deps.logBot(db, "moderation", `signalement de ${by.username || by.id}`, true, now); } catch { /* none */ }
    return say("🚩 Merci : le message est signalé à l'équipe.");
  }
  return say("?");
}

// ---- tickets ----

/** The opening form of a ticket: a subject and what it is about. */
export const ticketForm = (catIndex, role, catName) => modal(`tk|form|${catIndex}|${role || ""}`, `Ticket · ${catName || "Nouveau"}`, [
  { custom_id: "subject", label: "Sujet", required: true, max: 80, placeholder: "En quelques mots" },
  { custom_id: "details", label: "Explique ta demande", required: true, long: true, max: 1500 },
]);
export const closeForm = () => modal("tk|closeform", "Fermer le ticket", [{ custom_id: "reason", label: "Raison (facultatif)", required: false, long: true, max: 300 }]);

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A ticket's text as a page that opens in any browser: one block per message, avatars and pictures, oldest first. */
export function transcriptHtml(messages, { name = "", guild = "", opened = "", closedBy = "", reason = "" } = {}) {
  const rows = [...messages].reverse().map((m) => {
    const a = m.author || {};
    const avatar = a.avatar ? `https://cdn.discordapp.com/avatars/${a.id}/${a.avatar}.png?size=64` : "https://cdn.discordapp.com/embed/avatars/0.png";
    const files = (m.attachments || []).map((f) => (/^image\//.test(f.content_type || "") || /\.(png|jpe?g|gif|webp)$/i.test(f.filename || "") ? `<img class="pic" src="${esc(f.url)}" alt="">` : `<a href="${esc(f.url)}">${esc(f.filename || f.url)}</a>`)).join("");
    const embeds = (m.embeds || []).map((e) => `<div class="embed">${e.title ? `<b>${esc(e.title)}</b>` : ""}${e.description ? `<div>${esc(e.description).replace(/\n/g, "<br>")}</div>` : ""}</div>`).join("");
    return `<div class="msg"><img class="av" src="${esc(avatar)}" alt=""><div><div class="who">${esc(a.global_name || a.username || "?")}${a.bot ? ' <span class="bot">BOT</span>' : ""} <time>${esc(String(m.timestamp || "").slice(0, 16).replace("T", " "))}</time></div><div class="txt">${esc(m.content || "").replace(/\n/g, "<br>")}</div>${files}${embeds}</div></div>`;
  }).join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket ${esc(name)}</title><style>
body{margin:0;background:#16171a;color:#e8e8e6;font:15px/1.45 system-ui,sans-serif}header{padding:18px 24px;background:#0c0e13;border-bottom:3px solid #ff4655}
header h1{margin:0 0 4px;font-size:20px}header p{margin:2px 0;color:#9a9a98;font-size:13px}main{padding:12px 24px}.msg{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #26272b}
.av{width:36px;height:36px;border-radius:50%}.who{font-weight:700}.who time{font-weight:400;color:#9a9a98;font-size:12px;margin-left:6px}.bot{background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px}
.txt{white-space:normal;word-break:break-word}.pic{display:block;max-width:360px;margin-top:6px;border-radius:6px}.embed{margin-top:6px;padding:6px 10px;border-left:3px solid #ff4655;background:#1e1f23;border-radius:4px}a{color:#5aa9ff}
</style></head><body><header><h1>Ticket ${esc(name)}</h1><p>${esc(guild)}</p>${opened ? `<p>Ouvert : ${esc(opened.slice(0, 16).replace("T", " "))}</p>` : ""}${closedBy ? `<p>Fermé par : ${esc(closedBy)}${reason ? ` · ${esc(reason)}` : ""}</p>` : ""}<p>${messages.length} messages</p></header><main>
${rows}
</main></body></html>`;
}

/** How long the ticket waited for its first answer from someone other than its author (ms), or null. messages newest first. */
export function firstReply(messages, author, opened) {
  const t0 = Date.parse(opened);
  const first = [...messages].reverse().find((m) => m.author && !m.author.bot && m.author.id !== author && Date.parse(m.timestamp) >= t0);
  return first ? Date.parse(first.timestamp) - t0 : null;
}

/** The tickets' numbers for the editor: open, closed in the last 30 days, first answer time and rating, by subject. */
export function ticketStats(db, now = Date.now()) {
  const since = new Date(now - 30 * 86400000).toISOString();
  const open = db.prepare("SELECT COUNT(*) AS n FROM bot_tickets WHERE closed = ''").get().n;
  const closed = db.prepare("SELECT category, first_reply, rating FROM bot_tickets WHERE closed <> '' AND closed >= ?").all(since);
  const opened = db.prepare("SELECT COUNT(*) AS n FROM bot_tickets WHERE opened >= ?").get(since).n;
  const avg = (list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : null);
  const replies = closed.map((t) => Number(t.first_reply)).filter((x) => x > 0);
  const ratings = closed.map((t) => Number(t.rating)).filter((x) => x >= 1 && x <= 5);
  const by = {};
  for (const t of closed) by[t.category || "—"] = (by[t.category || "—"] || 0) + 1;
  return { open, opened30: opened, closed30: closed.length, firstReplyMin: replies.length ? Math.round(avg(replies) / 60000) : null, rating: ratings.length ? Math.round(avg(ratings) * 10) / 10 : null, ratings: ratings.length, byCategory: by };
}

/** The rating buttons sent to the member after a ticket is closed: tr|<thread>|1…5. */
export const ratingButtons = (thread) => [{ type: 1, components: [1, 2, 3, 4, 5].map((n) => ({ type: 2, style: n >= 4 ? 3 : 2, label: "★".repeat(n), custom_id: `tr|${thread}|${n}` })) }];

/** A rating clicked in a private message: kept once, by the ticket's author only. Returns the message's new look (type 7). */
export function rateTicket(db, thread, user, n) {
  const t = db.prepare("SELECT user, rating FROM bot_tickets WHERE thread = ?").get(thread);
  if (!t || t.user !== user || !(n >= 1 && n <= 5)) return { type: 4, data: { content: "Cette note n'est pas possible.", flags: 64 } };
  if (!t.rating) db.prepare("UPDATE bot_tickets SET rating = ? WHERE thread = ?").run(String(n), thread);
  return { type: 7, data: { content: `Merci pour ta note : ${"★".repeat(Number(t.rating || n))}${"☆".repeat(5 - Number(t.rating || n))}`, components: [] } };
}

// ---- new members ----

/** The welcome picture's address on the site, signed so that nobody else can make the site draw their own text. */
export function welcomeCardUrl(site, { name, avatar, count, guild }, secret) {
  const q = new URLSearchParams({ name: String(name).slice(0, 40), avatar: String(avatar || ""), n: String(count || ""), g: String(guild || "").slice(0, 60) });
  q.set("sig", welcomeSig(q, secret));
  return `${site}/api/welcomecard?${q}`;
}
export function welcomeSig(q, secret) {
  return crypto.createHmac("sha256", String(secret || "vct-welcome")).update(["name", "avatar", "n", "g"].map((k) => q.get(k) || "").join("|")).digest("base64url").slice(0, 22);
}

/** Too many arrivals in a short time? times: arrival times (ms), newest last. */
export const isRaid = (times, joins, seconds) => times.length >= joins && times[times.length - 1] - times[times.length - joins] <= seconds * 1000;

/** The invitation whose uses went up between two readings: { code, inviter } or null. before: { code: uses }. */
export function usedInvite(before, invites) {
  for (const inv of invites || []) if ((inv.uses || 0) > (before[inv.code] || 0)) return { code: inv.code, inviter: inv.inviter || null };
  return null;
}

/** A counter channel's name from its template ("👥 Membres : {nombre}"), 100 characters at most. */
export const counterName = (template, count) => String(template || "👥 Membres : {nombre}").replace(/\{nombre\}|\{membercount\}/g, Number(count || 0).toLocaleString("fr-FR")).slice(0, 100);
/** Discord lets a channel be renamed twice in 10 minutes: once every 6 minutes at most here. */
export const canRename = (lastAt, now) => !lastAt || now - lastAt >= 6 * 60000;

/**
 * "J'accepte le règlement": the access role, once the member has been on the server long enough (the delay set), and never
 * for a member in quarantine. Returns the message for them.
 */
export async function verifyClick(i, deps) {
  const { discord, server, now = Date.now() } = deps;
  const v = server && server.arrival.verify;
  const m = i.member || {};
  if (!v || !v.role) return say("La vérification n'est pas réglée sur ce serveur.");
  if ((m.roles || []).includes(v.role)) return say("✅ Tu as déjà accès au serveur.");
  const q = server.arrival.newAccount;
  if (q.quarantine && q.role && (m.roles || []).includes(q.role)) return say("⏳ Ton compte est récent : un membre de l'équipe va valider ton accès.");
  const since = Date.parse(m.joined_at || "");
  if (v.delay && Number.isFinite(since) && now - since < v.delay * 1000) return say(`⏳ Prends le temps de lire le règlement : réessaie dans ${formatDuration(Math.ceil((v.delay * 1000 - (now - since)) / 1000))}.`);
  try {
    await discord("PUT", `/guilds/${i.guild_id}/members/${m.user.id}/roles/${v.role}`, null, { reason: "Règlement accepté" });
  } catch {
    return say("❌ Le bot n'a pas pu te donner l'accès : préviens l'équipe.");
  }
  if (deps.notify) await deps.notify(`✅ <@${m.user.id}> a accepté le règlement`);
  return say("✅ Bienvenue : tu as maintenant accès au serveur !");
}

/**
 * What a new member's arrival asks beyond the welcome (lib/botserver.js handleEvent calls it): the private welcome, a new
 * account flagged (and quarantined), a raid noticed (staff told, channels locked), who invited them. Returns what was done.
 */
export async function onArrival(d, deps) {
  const { discord, server, guild, memory, now = Date.now(), log } = deps;
  const ar = server.arrival;
  const done = [];
  const age = now - Number((BigInt(d.user.id) >> 22n) + 1420070400000n);
  const fresh = ar.newAccount.days > 0 && age < ar.newAccount.days * 86400000;
  if (fresh) {
    await log({ kind: "members", title: "🆕 Compte récent", user: { id: d.user.id, name: d.user.global_name || d.user.username }, lines: [`<@${d.user.id}> · compte créé il y a ${formatDuration(Math.floor(age / 1000))}`, ar.newAccount.quarantine && ar.newAccount.role ? `Mis en quarantaine : <@&${ar.newAccount.role}>` : ""] });
    if (ar.newAccount.quarantine && ar.newAccount.role) {
      try { await discord("PUT", `/guilds/${guild}/members/${d.user.id}/roles/${ar.newAccount.role}`, null, { reason: "Compte récent : quarantaine" }); done.push("quarantine"); } catch { /* the bot's role is below */ }
    }
    done.push("fresh");
  }
  if (ar.raid.on) {
    const times = [...(memory.joins || []), now].filter((t) => now - t <= ar.raid.seconds * 1000).slice(-200);
    memory.joins = times;
    if (isRaid(times, ar.raid.joins, ar.raid.seconds) && (!memory.raidUntil || now > memory.raidUntil)) {
      memory.raidUntil = now + 10 * 60000; // one alert per 10 minutes
      const locked = ar.raid.lock && server.moderation.lockdownChannels.length ? await lockChannels(discord, guild, server.moderation.lockdownChannels, true, "Anti-raid : trop d'arrivées") : [];
      if (server.logChannel) {
        try {
          await discord("POST", `/channels/${server.logChannel}/messages`, { content: `${ar.raid.pingRole ? `<@&${ar.raid.pingRole}> ` : ""}🚨 **Raid possible** : ${times.length} arrivées en moins de ${ar.raid.seconds} s.${locked.length ? ` ${locked.length} salon(s) verrouillé(s) : \`/lockdown action:Rouvrir\` pour rouvrir.` : ""}`, allowed_mentions: { roles: ar.raid.pingRole ? [ar.raid.pingRole] : [] } });
        } catch { /* none */ }
      }
      done.push("raid");
      if (locked.length) done.push("raid:lock");
    }
  }
  if (ar.dm.on) {
    try {
      const ch = await discord("POST", "/users/@me/channels", { recipient_id: d.user.id });
      await discord("POST", `/channels/${ch.id}/messages`, { content: fillVars(ar.dm.text, { userId: d.user.id, name: d.user.global_name || d.user.username || "", guild: deps.guildName || "le serveur", count: deps.memberCount || "" }), allowed_mentions: { parse: [] } });
      done.push("dm");
    } catch { /* private messages closed */ }
  }
  if (ar.invites && memory.invites && !(memory.raidUntil && now < memory.raidUntil)) {
    try {
      const list = await discord("GET", `/guilds/${guild}/invites`);
      const used = usedInvite(memory.invites, list);
      if (used && used.inviter) done.inviter = used.inviter.id; // for {inviter} in the welcome
      memory.invites = Object.fromEntries(list.map((x) => [x.code, x.uses || 0]));
      await log({ kind: "members", title: "📨 Invitation", user: { id: d.user.id, name: d.user.global_name || d.user.username }, lines: [used ? `<@${d.user.id}> invité par ${used.inviter ? `<@${used.inviter.id}>` : "?"} (code \`${used.code}\`)` : `<@${d.user.id}> : invitation inconnue (lien personnalisé ou invitation à usage unique)`] });
      done.push("invite");
    } catch { /* no "manage the server" right */ }
  }
  return done;
}

/**
 * The member counter channel: its name from the template, changed when the count moved and Discord allows it (twice in
 * 10 minutes: here once every 6). state: { counterWanted, counterDone, counterAt }. Returns true when renamed.
 */
export async function updateCounter(discord, server, state, now = Date.now()) {
  const c = server && server.arrival.counter;
  if (!c || !c.channel || state.counterWanted == null || state.counterWanted === state.counterDone || !canRename(state.counterAt, now)) return false;
  const want = state.counterWanted;
  state.counterAt = now;
  try {
    await discord("PATCH", `/channels/${c.channel}`, { name: counterName(c.template, want) }, { reason: "Compteur de membres" });
    state.counterDone = want;
    return true;
  } catch { return false; }
}
