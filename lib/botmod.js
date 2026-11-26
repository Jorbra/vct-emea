// The bot's server commands: moderation (warn, time out, kick, ban, clear messages, slow mode, lock a channel), server
// management (roles, announcements, server and member cards) and tickets (a private thread with the staff, opened from a
// button). Discord shows each command only to the members with its permission; the bot checks it again, and a moderator
// can never act on someone at or above their own highest role, nor give a role at or above it (Discord itself only checks
// the bot's own role). Pure helpers first (tests), then the calls to Discord.

import { addSanction } from "./botserver.js";

// Discord's permission bits
export const P = {
  KICK: 1n << 1n, BAN: 1n << 2n, ADMIN: 1n << 3n, MANAGE_CHANNELS: 1n << 4n, MANAGE_GUILD: 1n << 5n, SEND: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n, MANAGE_ROLES: 1n << 28n, MANAGE_THREADS: 1n << 34n, SEND_IN_THREADS: 1n << 38n, MODERATE: 1n << 40n,
};

/**
 * What the bot needs on a server for all its commands: read and post (with links, files, reactions), and for the server
 * commands kick, ban, time out, delete messages, change channels and roles, open private threads (tickets); the server's
 * AutoMod rules (manage the server), nicknames, and voice (mute, move, disconnect).
 */
export const BOT_RIGHTS = String((1n << 6n) | (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | P.KICK | P.BAN | P.MANAGE_CHANNELS | P.MANAGE_GUILD | P.MANAGE_MESSAGES | P.MANAGE_ROLES | P.MANAGE_THREADS | (1n << 36n) | P.SEND_IN_THREADS | P.MODERATE | (1n << 22n) | (1n << 24n) | (1n << 27n));

const USER = 6;
const ROLE = 8;
const CHANNEL = 7;
const STR = 3;
const INT = 4;
const perm = (bit) => String(bit);
const member = (description = "Le membre") => ({ type: USER, name: "user", description, required: true });
const reason = (required = false) => ({ type: STR, name: "reason", description: "La raison (écrite dans le journal du serveur)", required, max_length: 300 });

/** The commands, as Discord registers them (only in servers, each one for the members with its permission). */
export const MOD_COMMANDS = [
  { name: "warn", description: "Avertir un membre (gardé dans son dossier, il reçoit un message privé)", default_member_permissions: perm(P.MODERATE), options: [member(), reason(true)] },
  { name: "warnings", description: "Le dossier d'un membre : ses avertissements", default_member_permissions: perm(P.MODERATE), options: [member()] },
  { name: "timeout", description: "Rendre un membre muet un temps (ou lever l'exclusion)", default_member_permissions: perm(P.MODERATE), options: [member(), { type: INT, name: "duration", description: "Combien de temps", required: true, choices: [{ name: "1 minute", value: 60 }, { name: "5 minutes", value: 300 }, { name: "10 minutes", value: 600 }, { name: "1 heure", value: 3600 }, { name: "1 jour", value: 86400 }, { name: "1 semaine", value: 604800 }, { name: "Lever l'exclusion", value: 0 }] }, reason()] },
  { name: "kick", description: "Expulser un membre du serveur (il peut revenir avec une invitation)", default_member_permissions: perm(P.KICK), options: [member(), reason()] },
  { name: "ban", description: "Bannir un membre du serveur", default_member_permissions: perm(P.BAN), options: [member(), reason(), { type: INT, name: "delete_messages", description: "Effacer aussi ses messages récents", required: false, choices: [{ name: "Aucun", value: 0 }, { name: "Dernière heure", value: 3600 }, { name: "Dernières 24 h", value: 86400 }, { name: "7 derniers jours", value: 604800 }] }] },
  { name: "unban", description: "Lever le bannissement d'un utilisateur", default_member_permissions: perm(P.BAN), options: [{ type: STR, name: "user_id", description: "L'identifiant Discord de l'utilisateur", required: true, max_length: 20 }, reason()] },
  { name: "purge", description: "Effacer les derniers messages du salon (de moins de 14 jours)", default_member_permissions: perm(P.MANAGE_MESSAGES), options: [{ type: INT, name: "amount", description: "Combien (2 à 100)", required: true, min_value: 2, max_value: 100 }, { type: USER, name: "user", description: "Seulement les messages de ce membre", required: false }] },
  { name: "slowmode", description: "Mode lent du salon : une attente entre deux messages (0 pour l'enlever)", default_member_permissions: perm(P.MANAGE_CHANNELS), options: [{ type: INT, name: "seconds", description: "Secondes entre deux messages (0 à 21600)", required: true, min_value: 0, max_value: 21600 }] },
  { name: "lock", description: "Verrouiller le salon : plus personne ne peut y écrire, sauf l'équipe", default_member_permissions: perm(P.MANAGE_CHANNELS), options: [reason()] },
  { name: "unlock", description: "Rouvrir le salon verrouillé", default_member_permissions: perm(P.MANAGE_CHANNELS) },
  { name: "addrole", description: "Donner un rôle à un membre", default_member_permissions: perm(P.MANAGE_ROLES), options: [member(), { type: ROLE, name: "role", description: "Le rôle", required: true }] },
  { name: "removerole", description: "Retirer un rôle à un membre", default_member_permissions: perm(P.MANAGE_ROLES), options: [member(), { type: ROLE, name: "role", description: "Le rôle", required: true }] },
  { name: "announce", description: "Publier une annonce mise en forme dans un salon", default_member_permissions: perm(P.MANAGE_GUILD), options: [{ type: CHANNEL, name: "channel", description: "Le salon", required: true, channel_types: [0, 5] }, { type: STR, name: "message", description: "Le texte (\\n pour aller à la ligne)", required: true, max_length: 1800 }, { type: STR, name: "title", description: "Un titre", required: false, max_length: 200 }, { type: ROLE, name: "mention", description: "Un rôle à prévenir", required: false }] },
  { name: "serverinfo", description: "La carte du serveur : membres, salons, rôles, boosts" },
  { name: "userinfo", description: "La carte d'un membre : arrivée, compte, rôles", options: [{ ...member(), required: false }] },
  { name: "ticketpanel", description: "Poser le bouton « Ouvrir un ticket » dans un salon", default_member_permissions: perm(P.MANAGE_GUILD), options: [{ type: CHANNEL, name: "channel", description: "Le salon (celui-ci par défaut)", required: false, channel_types: [0] }, { type: ROLE, name: "staff_role", description: "Le rôle de l'équipe qui répond aux tickets", required: false }, { type: STR, name: "text", description: "Le texte au-dessus du bouton", required: false, max_length: 500 }] },
  { name: "ticket", description: "Ouvrir un ticket : une discussion privée avec l'équipe du serveur", options: [{ type: STR, name: "subject", description: "En quelques mots", required: false, max_length: 80 }] },
  { name: "close", description: "Fermer le ticket où tu es" },
].map((c) => ({ ...c, contexts: [0] })); // servers only, never in private messages

export const MOD_NAMES = MOD_COMMANDS.map((c) => c.name);

/** Has a member (permissions as Discord sends them: a number in a string) this permission? An administrator has them all. */
export function hasPerm(permissions, bit) {
  let p;
  try { p = BigInt(permissions || 0); } catch { return false; }
  return (p & P.ADMIN) === P.ADMIN || (p & bit) === bit;
}

/** The position of a member's highest role (0: none). roles: the guild's [{ id, position }]. */
export function topPosition(memberRoles, roles) {
  const pos = new Map((roles || []).map((r) => [r.id, r.position]));
  return Math.max(0, ...(memberRoles || []).map((id) => pos.get(id) || 0));
}

/**
 * May the moderator act on the target? Not on themself, not on the server's owner, and only on someone strictly below
 * their highest role (the owner may act on anyone). Returns "" or the reason why not.
 */
export function canActOn({ modId, modRoles, targetId, targetRoles, ownerId, roles }) {
  if (modId === targetId) return "self";
  if (targetId === ownerId) return "owner";
  if (modId === ownerId) return "";
  return topPosition(modRoles, roles) > topPosition(targetRoles, roles) ? "" : "higher";
}

/** May the moderator give or take this role? Only below their own highest role, and never a role managed by an app. */
export function canGiveRole({ modId, modRoles, ownerId, roles, roleId }) {
  const role = (roles || []).find((r) => r.id === roleId);
  if (!role) return "unknown";
  if (role.managed) return "managed";
  if (modId === ownerId) return "";
  return topPosition(modRoles, roles) > role.position ? "" : "higher";
}

/** A ticket thread's name: "ticket-pseudo" plus a few letters of the subject, in what Discord accepts. */
export function ticketName(username, subject = "") {
  const clean = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ["ticket", clean(username).slice(0, 24) || "membre", clean(subject).slice(0, 40)].filter(Boolean).join("-").slice(0, 90);
}

/** "\n" typed in a slash command's text becomes a new line. */
export const multiline = (s) => String(s || "").replace(/\\n/g, "\n");

/** The ids of the messages that /purge may delete: the newest first, under 14 days old (Discord's limit), of one author if given. */
export function purgeable(messages, { count, author = "", now = Date.now() }) {
  const limit = now - 14 * 86400000 + 60000;
  return (messages || [])
    .filter((m) => Date.parse(m.timestamp) > limit && !m.pinned && (!author || (m.author && m.author.id === author)))
    .slice(0, count)
    .map((m) => m.id);
}

const DURATION = { 60: "1 minute", 300: "5 minutes", 600: "10 minutes", 3600: "1 heure", 86400: "1 jour", 604800: "1 semaine" };
const DURATION_EN = { 60: "1 minute", 300: "5 minutes", 600: "10 minutes", 3600: "1 hour", 86400: "1 day", 604800: "1 week" };

// ---- Discord ----

const roleCache = new Map(); // guild -> { at, roles, owner } for a minute: a command does not ask Discord every time

async function guildRolesAndOwner(discord, guild) {
  const kept = roleCache.get(guild);
  if (kept && Date.now() - kept.at < 60000) return kept;
  const [roles, g] = await Promise.all([discord("GET", `/guilds/${guild}/roles`), discord("GET", `/guilds/${guild}`)]);
  const out = { at: Date.now(), roles: roles.map((r) => ({ id: r.id, position: r.position, managed: !!r.managed, name: r.name })), owner: g.owner_id, g };
  roleCache.set(guild, out);
  return out;
}

/** What Discord's error means for the person who asked. */
function failText(e, L) {
  if (e && (e.code === 50013 || e.status === 403)) return L("❌ Le bot n'a pas le droit de faire ça ici : donne-lui la permission, et place son rôle au-dessus de celui du membre.", "❌ The bot is not allowed to do this here: give it the permission, and put its role above the member's.");
  if (e && e.code === 10007) return L("❌ Ce membre n'est plus sur le serveur.", "❌ This member is no longer on the server.");
  if (e && e.code === 10026) return L("❌ Cet utilisateur n'est pas banni.", "❌ This user is not banned.");
  return L(`❌ Discord a refusé : ${(e && e.message) || "erreur"}`, `❌ Discord refused: ${(e && e.message) || "error"}`);
}

const NOT_ALLOWED = {
  self: ["Tu ne peux pas faire ça sur toi-même.", "You cannot do this to yourself."],
  owner: ["Impossible sur le propriétaire du serveur.", "Not on the server's owner."],
  higher: ["Ce membre a un rôle égal ou supérieur au tien.", "This member's role is equal to or above yours."],
};

/**
 * Runs one of the server commands. i: Discord's interaction; deps: { db, discord, lang, logBot, now, site }. Returns the message
 * to show (to the moderator only, unless said otherwise): { content, embeds?, components?, public? }.
 */
export async function runModCommand(i, deps) {
  const { db, discord, lang = "fr", logBot = () => {}, now = Date.now() } = deps;
  const L = (fr, en) => (lang === "en" ? en : fr);
  const name = i.data.name;
  const guild = i.guild_id;
  if (!guild) return { content: L("Cette commande ne marche que sur un serveur.", "This command only works in a server.") };
  const opts = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
  const resolved = i.data.resolved || {};
  const mod = i.member || {};
  const modUser = mod.user || {};
  const def = MOD_COMMANDS.find((c) => c.name === name);
  if (def && def.default_member_permissions && !hasPerm(mod.permissions, BigInt(def.default_member_permissions))) {
    return { content: L("Tu n'as pas la permission pour cette commande.", "You do not have the permission for this command.") };
  }
  const tag = (u) => (u ? u.global_name || u.username || u.id : "?");
  const why = String(opts.reason || "").trim();
  const audit = `${tag(modUser)} (${modUser.id}) : ${why || L("sans raison donnée", "no reason given")}`;
  // the bot's log, and the moderation log channel when the editor chose one (lib/botserver.js)
  const log = (text) => {
    try { logBot(db, "moderation", `${name} · ${text}`, true, now); } catch { /* the log is a convenience */ }
    if (deps.notify) Promise.resolve(deps.notify(`**/${name}** par <@${modUser.id}> · ${text}`)).catch(() => {});
  };

  // a member given as an option, and whether the moderator may act on them
  const target = () => {
    const id = String(opts.user || "");
    return { id, user: (resolved.users || {})[id], member: (resolved.members || {})[id] };
  };
  const checkTarget = async (t) => {
    if (!t.member) return L("❌ Ce membre n'est pas sur le serveur.", "❌ This member is not on the server.");
    const { roles, owner } = await guildRolesAndOwner(discord, guild);
    const no = canActOn({ modId: modUser.id, modRoles: mod.roles, targetId: t.id, targetRoles: t.member.roles, ownerId: owner, roles });
    return no ? `❌ ${L(...NOT_ALLOWED[no])}` : "";
  };

  try {
    if (name === "warn") {
      const t = target();
      const no = await checkTarget(t);
      if (no) return { content: no };
      addSanction(db, { guild, user: t.id, kind: "warn", mod: modUser.id, reason: why, at: now });
      const n = db.prepare("SELECT COUNT(*) AS n FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'warn'").get(guild, t.id).n;
      let dm = true;
      try {
        const ch = await discord("POST", "/users/@me/channels", { recipient_id: t.id });
        await discord("POST", `/channels/${ch.id}/messages`, { content: L(`⚠️ Tu as reçu un avertissement sur **${deps.guildName || "le serveur"}** : ${why}`, `⚠️ You received a warning on **${deps.guildName || "the server"}**: ${why}`), allowed_mentions: { parse: [] } });
      } catch { dm = false; }
      log(`${tag(t.user)} averti (${n}) : ${why}`);
      return { content: L(`⚠️ **${tag(t.user)}** est averti (${n} avertissement${n > 1 ? "s" : ""} en tout).${dm ? "" : " Il n'accepte pas les messages privés : il n'a pas été prévenu."}`, `⚠️ **${tag(t.user)}** is warned (${n} warning${n > 1 ? "s" : ""} in all).${dm ? "" : " They do not accept private messages: they were not told."}`) };
    }
    if (name === "warnings") {
      const t = target();
      const rows = db.prepare("SELECT id, mod, reason, at FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'warn' ORDER BY id DESC LIMIT 15").all(guild, t.id);
      if (!rows.length) return { content: L(`✅ **${tag(t.user)}** n'a aucun avertissement.`, `✅ **${tag(t.user)}** has no warning.`) };
      return { content: `📁 **${tag(t.user)}** · ${rows.length}\n${rows.map((r) => `• #${r.id} · <t:${Math.floor(Date.parse(r.at) / 1000)}:d> ${r.reason} — <@${r.mod}>`).join("\n")}` };
    }
    if (name === "timeout") {
      const t = target();
      const no = await checkTarget(t);
      if (no) return { content: no };
      const secs = Number(opts.duration) || 0;
      const until = secs ? new Date(now + secs * 1000).toISOString() : null;
      await discord("PATCH", `/guilds/${guild}/members/${t.id}`, { communication_disabled_until: until }, { reason: audit });
      addSanction(db, { guild, user: t.id, kind: secs ? "timeout" : "untimeout", mod: modUser.id, reason: why, at: now, until: until || "" });
      log(`${tag(t.user)} ${secs ? `exclu ${DURATION[secs] || `${secs} s`}` : "exclusion levée"}${why ? ` : ${why}` : ""}`);
      return { content: secs ? L(`🔇 **${tag(t.user)}** est exclu pour ${DURATION[secs] || `${secs} s`} (jusqu'à <t:${Math.floor((now + secs * 1000) / 1000)}:t>).`, `🔇 **${tag(t.user)}** is timed out for ${DURATION_EN[secs] || `${secs} s`} (until <t:${Math.floor((now + secs * 1000) / 1000)}:t>).`) : L(`🔊 L'exclusion de **${tag(t.user)}** est levée.`, `🔊 **${tag(t.user)}**'s time-out is lifted.`) };
    }
    if (name === "kick") {
      const t = target();
      const no = await checkTarget(t);
      if (no) return { content: no };
      await discord("DELETE", `/guilds/${guild}/members/${t.id}`, null, { reason: audit });
      addSanction(db, { guild, user: t.id, kind: "kick", mod: modUser.id, reason: why, at: now });
      log(`${tag(t.user)} expulsé${why ? ` : ${why}` : ""}`);
      return { content: L(`👢 **${tag(t.user)}** est expulsé du serveur.`, `👢 **${tag(t.user)}** is kicked from the server.`) };
    }
    if (name === "ban") {
      const t = target();
      // someone who already left can still be banned; one still here must be below the moderator
      if (t.member) { const no = await checkTarget(t); if (no) return { content: no }; }
      if (t.id === modUser.id) return { content: `❌ ${L(...NOT_ALLOWED.self)}` };
      await discord("PUT", `/guilds/${guild}/bans/${t.id}`, { delete_message_seconds: Number(opts.delete_messages) || 0 }, { reason: audit });
      addSanction(db, { guild, user: t.id, kind: "ban", mod: modUser.id, reason: why, at: now });
      log(`${tag(t.user)} banni${why ? ` : ${why}` : ""}`);
      return { content: L(`🔨 **${tag(t.user)}** est banni du serveur.`, `🔨 **${tag(t.user)}** is banned from the server.`) };
    }
    if (name === "unban") {
      const id = String(opts.user_id || "").replace(/\D/g, "");
      if (!id) return { content: L("❌ Donne l'identifiant Discord (des chiffres).", "❌ Give the Discord id (digits).") };
      await discord("DELETE", `/guilds/${guild}/bans/${id}`, null, { reason: audit });
      addSanction(db, { guild, user: id, kind: "unban", mod: modUser.id, reason: why, at: now });
      log(`${id} débanni${why ? ` : ${why}` : ""}`);
      return { content: L(`✅ <@${id}> n'est plus banni.`, `✅ <@${id}> is no longer banned.`) };
    }
    if (name === "purge") {
      const count = Math.max(2, Math.min(100, Number(opts.amount) || 0));
      const author = String(opts.user || "");
      const list = await discord("GET", `/channels/${i.channel_id}/messages?limit=100`);
      const ids = purgeable(list, { count, author, now });
      if (!ids.length) return { content: L("Rien à effacer (Discord ne laisse pas effacer en masse les messages de plus de 14 jours).", "Nothing to delete (Discord does not bulk-delete messages over 14 days old).") };
      if (ids.length === 1) await discord("DELETE", `/channels/${i.channel_id}/messages/${ids[0]}`, null, { reason: audit });
      else await discord("POST", `/channels/${i.channel_id}/messages/bulk-delete`, { messages: ids }, { reason: audit });
      log(`${ids.length} messages effacés dans <#${i.channel_id}>`);
      return { content: L(`🧹 ${ids.length} message${ids.length > 1 ? "s" : ""} effacé${ids.length > 1 ? "s" : ""}.`, `🧹 ${ids.length} message${ids.length > 1 ? "s" : ""} deleted.`) };
    }
    if (name === "slowmode") {
      const s = Math.max(0, Math.min(21600, Number(opts.seconds) || 0));
      await discord("PATCH", `/channels/${i.channel_id}`, { rate_limit_per_user: s }, { reason: audit });
      log(`mode lent ${s} s dans <#${i.channel_id}>`);
      return { content: s ? L(`🐢 Mode lent : ${s} s entre deux messages.`, `🐢 Slow mode: ${s} s between messages.`) : L("🐇 Mode lent enlevé.", "🐇 Slow mode off."), public: true };
    }
    if (name === "lock" || name === "unlock") {
      const lock = name === "lock";
      const ch = await discord("GET", `/channels/${i.channel_id}`);
      // the @everyone rule of the channel (its id is the server's), with sending messages allowed again or refused
      const old = (ch.permission_overwrites || []).find((o) => o.id === guild) || { allow: "0", deny: "0" };
      let allow = BigInt(old.allow || 0);
      let deny = BigInt(old.deny || 0);
      const bits = P.SEND | P.SEND_IN_THREADS;
      if (lock) { deny |= bits; allow &= ~bits; } else { deny &= ~bits; }
      await discord("PUT", `/channels/${i.channel_id}/permissions/${guild}`, { type: 0, allow: String(allow), deny: String(deny) }, { reason: audit });
      log(`${lock ? "verrouillé" : "déverrouillé"} <#${i.channel_id}>${why ? ` : ${why}` : ""}`);
      return { content: lock ? L(`🔒 Salon verrouillé${why ? ` : ${why}` : ""}.`, `🔒 Channel locked${why ? `: ${why}` : ""}.`) : L("🔓 Salon rouvert.", "🔓 Channel unlocked."), public: true };
    }
    if (name === "addrole" || name === "removerole") {
      const t = target();
      if (!t.member) return { content: L("❌ Ce membre n'est pas sur le serveur.", "❌ This member is not on the server.") };
      const roleId = String(opts.role || "");
      const { roles, owner } = await guildRolesAndOwner(discord, guild);
      const no = canGiveRole({ modId: modUser.id, modRoles: mod.roles, ownerId: owner, roles, roleId });
      if (no) return { content: no === "managed" ? L("❌ Ce rôle est géré par une application : impossible de le donner.", "❌ This role is managed by an app: it cannot be given.") : no === "higher" ? L("❌ Ce rôle est égal ou supérieur au tien.", "❌ This role is equal to or above yours.") : L("❌ Rôle inconnu.", "❌ Unknown role.") };
      const give = name === "addrole";
      await discord(give ? "PUT" : "DELETE", `/guilds/${guild}/members/${t.id}/roles/${roleId}`, null, { reason: audit });
      const rn = (roles.find((r) => r.id === roleId) || {}).name || roleId;
      log(`${tag(t.user)} ${give ? "+" : "−"} ${rn}`);
      return { content: give ? L(`✅ **${tag(t.user)}** a maintenant le rôle **${rn}**.`, `✅ **${tag(t.user)}** now has the **${rn}** role.`) : L(`✅ **${tag(t.user)}** n'a plus le rôle **${rn}**.`, `✅ **${tag(t.user)}** no longer has the **${rn}** role.`) };
    }
    if (name === "announce") {
      const channel = String(opts.channel || "");
      const role = String(opts.mention || "");
      await discord("POST", `/channels/${channel}/messages`, {
        content: role ? `<@&${role}>` : undefined,
        embeds: [{ title: opts.title ? String(opts.title) : undefined, description: multiline(opts.message), color: 0xff4655, footer: { text: tag(modUser) }, timestamp: new Date(now).toISOString() }],
        allowed_mentions: { parse: [], roles: role ? [role] : [] },
      });
      log(`annonce dans <#${channel}>${opts.title ? ` : ${opts.title}` : ""}`);
      return { content: L(`📣 Annonce publiée dans <#${channel}>.`, `📣 Announcement posted in <#${channel}>.`) };
    }
    if (name === "serverinfo") {
      const g = await discord("GET", `/guilds/${guild}?with_counts=true`);
      const chans = await discord("GET", `/guilds/${guild}/channels`).catch(() => []);
      const created = Math.floor(Number((BigInt(guild) >> 22n) + 1420070400000n) / 1000);
      return {
        public: true,
        embeds: [{
          title: g.name, color: 0xff4655, thumbnail: g.icon ? { url: `https://cdn.discordapp.com/icons/${guild}/${g.icon}.png?size=128` } : undefined,
          fields: [
            { name: L("Membres", "Members"), value: String(g.approximate_member_count ?? "?"), inline: true },
            { name: L("En ligne", "Online"), value: String(g.approximate_presence_count ?? "?"), inline: true },
            { name: L("Créé", "Created"), value: `<t:${created}:D>`, inline: true },
            { name: L("Salons", "Channels"), value: String(chans.filter((c) => c.type !== 4).length), inline: true },
            { name: L("Rôles", "Roles"), value: String(Math.max(0, (g.roles || []).length - 1)), inline: true },
            { name: "Boosts", value: `${g.premium_subscription_count || 0} (${L("niveau", "level")} ${g.premium_tier || 0})`, inline: true },
            { name: L("Propriétaire", "Owner"), value: `<@${g.owner_id}>`, inline: true },
          ],
        }],
      };
    }
    if (name === "userinfo") {
      const id = String(opts.user || modUser.id);
      const m = opts.user ? (resolved.members || {})[id] : mod;
      const u = opts.user ? (resolved.users || {})[id] : modUser;
      if (!m) return { content: L("❌ Ce membre n'est pas sur le serveur.", "❌ This member is not on the server.") };
      const created = Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);
      const warns = db.prepare("SELECT COUNT(*) AS n FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'warn'").get(guild, id).n;
      const showWarns = hasPerm(mod.permissions, P.MODERATE);
      return {
        public: true,
        embeds: [{
          title: tag(u), color: 0xff4655, thumbnail: u && u.avatar ? { url: `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128` } : undefined,
          fields: [
            { name: L("Arrivé sur le serveur", "Joined the server"), value: m.joined_at ? `<t:${Math.floor(Date.parse(m.joined_at) / 1000)}:R>` : "?", inline: true },
            { name: L("Compte créé", "Account created"), value: `<t:${created}:D>`, inline: true },
            { name: L("Rôles", "Roles"), value: (m.roles || []).length ? m.roles.slice(0, 15).map((r) => `<@&${r}>`).join(" ") : "—" },
            ...(showWarns ? [{ name: L("Avertissements", "Warnings"), value: String(warns), inline: true }] : []),
          ],
        }],
      };
    }
    if (name === "ticketpanel") {
      const channel = String(opts.channel || i.channel_id);
      const role = String(opts.staff_role || (deps.server && deps.server.tickets.staffRole) || "");
      // with several kinds of tickets (editor, Discord bot, Server), a list to pick one; else a single button
      const cats = (deps.server && deps.server.tickets.categories) || [];
      const pick = cats.length > 1
        ? [{ type: 1, components: [{ type: 3, custom_id: `tk|cat|${role}`, placeholder: L("Ouvrir un ticket : choisis le sujet", "Open a ticket: pick the subject"), options: cats.map((c, k) => ({ label: c.slice(0, 100), value: String(k), emoji: { name: "🎫" } })) }] }]
        : [{ type: 1, components: [{ type: 2, style: 1, label: L("Ouvrir un ticket", "Open a ticket"), emoji: { name: "🎫" }, custom_id: `tk|open|${role}` }] }];
      await discord("POST", `/channels/${channel}/messages`, {
        embeds: [{ title: L("🎫 Besoin d'aide ?", "🎫 Need help?"), description: opts.text ? multiline(opts.text) : L("Choisis ou clique : une discussion privée s'ouvre avec l'équipe du serveur.", "Pick or click: a private conversation opens with the server's team."), color: 0xff4655 }],
        components: pick,
        allowed_mentions: { parse: [] },
      });
      log(`panneau de tickets dans <#${channel}>`);
      return { content: L(`🎫 Le bouton des tickets est posé dans <#${channel}>.`, `🎫 The ticket button is in <#${channel}>.`) };
    }
    if (name === "ticket") return openTicket({ ...deps, guild, channel: i.channel_id, user: modUser, subject: String(opts.subject || ""), role: (deps.server && deps.server.tickets.staffRole) || "" });
    if (name === "close") return closeTicket({ ...deps, guild, thread: i.channel_id, user: modUser, permissions: mod.permissions });
  } catch (e) {
    try { logBot(db, "moderation", `${name} · ${e.message}`, false, now); } catch { /* none */ }
    return { content: failText(e, L) };
  }
  return { content: "?" };
}

/** Opens a ticket: a private thread in the channel, with the member and the staff's role (pinged once), one at a time per member. */
export async function openTicket({ db, discord, lang = "fr", logBot = () => {}, now = Date.now(), guild, channel, user, subject = "", role = "", category = "", notify = async () => {} }) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const open = db.prepare("SELECT thread FROM bot_tickets WHERE guild = ? AND user = ? AND closed = ''").get(guild, user.id);
  if (open) return { content: L(`Tu as déjà un ticket ouvert : <#${open.thread}>`, `You already have an open ticket: <#${open.thread}>`) };
  try {
    const thread = await discord("POST", `/channels/${channel}/threads`, { name: ticketName(user.global_name || user.username, category || subject), type: 12, invitable: false, auto_archive_duration: 10080 });
    await discord("PUT", `/channels/${thread.id}/thread-members/${user.id}`);
    await discord("POST", `/channels/${thread.id}/messages`, {
      content: `<@${user.id}>${role ? ` <@&${role}>` : ""}`,
      embeds: [{ title: L("🎫 Ticket ouvert", "🎫 Ticket open") + (category ? ` · ${category}` : ""), description: (subject ? `**${subject}**\n\n` : "") + L("Explique ta demande ici : l'équipe va te répondre. Ce fil n'est visible que par toi et l'équipe.", "Explain your request here: the team will answer. Only you and the team can see this thread."), color: 0xff4655 }],
      components: [{ type: 1, components: [{ type: 2, style: 4, label: L("Fermer le ticket", "Close the ticket"), emoji: { name: "🔒" }, custom_id: "tk|close" }, { type: 2, style: 2, label: L("Je m'en occupe", "I'm on it"), emoji: { name: "🙋" }, custom_id: "tk|claim" }] }],
      allowed_mentions: { users: [user.id], roles: role ? [role] : [] },
    });
    db.prepare("INSERT INTO bot_tickets (thread, guild, user, subject, opened, category) VALUES (?, ?, ?, ?, ?, ?)").run(thread.id, guild, user.id, String(subject).slice(0, 80), new Date(now).toISOString(), String(category).slice(0, 40));
    try { logBot(db, "ticket", `ouvert par ${user.username || user.id}${category ? ` · ${category}` : ""}${subject ? ` : ${subject}` : ""}`, true, now); } catch { /* none */ }
    await notify(`🎫 Ticket ouvert par <@${user.id}>${category ? ` · ${category}` : ""} : <#${thread.id}>`);
    return { content: L(`🎫 Ton ticket est ouvert : <#${thread.id}>`, `🎫 Your ticket is open: <#${thread.id}>`) };
  } catch (e) {
    return { content: failText(e, L) };
  }
}

/** Closes the ticket the command or button is in: its member or the staff (who can manage threads); archived and locked. */
export async function closeTicket({ db, discord, lang = "fr", logBot = () => {}, now = Date.now(), guild, thread, user, permissions, server = null, idle = false, postFile = null }) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const t = db.prepare("SELECT user, closed, opened, category, subject FROM bot_tickets WHERE thread = ? AND guild = ?").get(thread, guild);
  if (!t) return { content: L("Ce salon n'est pas un ticket.", "This channel is not a ticket.") };
  if (t.closed) return { content: L("Ce ticket est déjà fermé.", "This ticket is already closed.") };
  if (t.user !== user.id && !hasPerm(permissions, P.MANAGE_THREADS)) return { content: L("Seuls l'auteur du ticket et l'équipe peuvent le fermer.", "Only the ticket's author and the team can close it.") };
  try {
    await discord("POST", `/channels/${thread}/messages`, { content: idle ? L("🔒 Ticket fermé : pas de nouvelle réponse depuis longtemps.", "🔒 Ticket closed: no new answer for a long time.") : L(`🔒 Ticket fermé par <@${user.id}>.`, `🔒 Ticket closed by <@${user.id}>.`), allowed_mentions: { parse: [] } });
    // its text, kept with the ticket and sent to the moderation log channel (editor, Discord bot, Server)
    let transcript = "";
    if (server && server.tickets.transcript) {
      try {
        const { buildTranscript } = await import("./botmod2.js");
        const all = [];
        let before = "";
        for (let k = 0; k < 5; k++) {
          const page = await discord("GET", `/channels/${thread}/messages?limit=100${before ? `&before=${before}` : ""}`);
          all.push(...page);
          if (page.length < 100) break;
          before = page[page.length - 1].id;
        }
        transcript = buildTranscript(all, { name: thread, opened: t.opened, closedBy: idle ? "fermeture automatique" : user.username || user.id }).slice(0, 200000);
        if (server.logChannel && postFile) await postFile(server.logChannel, { content: `📄 Ticket <#${thread}> de <@${t.user}>${t.category ? ` · ${t.category}` : ""} fermé${idle ? " (inactif)" : ` par <@${user.id}>`}`, allowed_mentions: { parse: [] } }, `ticket-${thread}.txt`, transcript);
      } catch { /* the ticket closes anyway */ }
    }
    await discord("PATCH", `/channels/${thread}`, { archived: true, locked: true });
    db.prepare("UPDATE bot_tickets SET closed = ?, transcript = ? WHERE thread = ?").run(new Date(now).toISOString(), transcript, thread);
    try { logBot(db, "ticket", `fermé par ${user.username || user.id}`, true, now); } catch { /* none */ }
    return { content: L("🔒 Ticket fermé.", "🔒 Ticket closed.") };
  } catch (e) {
    return { content: failText(e, L) };
  }
}
