// The bot's second set of server commands: a member's file (sanctions, notes), nickname and voice moderation, more for
// tickets (add, remove, rename, priority, claim), and the server's life (role buttons, embeds, polls, reminders, giveaways).
// Same rules as lib/botmod.js: each command for the members with its permission, checked again here; never on a member at
// or above the moderator's highest role; every action in Discord's audit log and the bot's log.
import { P, canActOn, hasPerm } from "./botmod.js";
import { addSanction, sanctionsOf } from "./botserver.js";

export const P2 = { MUTE: 1n << 22n, MOVE: 1n << 24n, NICK: 1n << 27n };

const USER = 6;
const ROLE = 8;
const CHANNEL = 7;
const STR = 3;
const INT = 4;
const perm = (bit) => String(bit);
const member = (description = "Le membre") => ({ type: USER, name: "user", description, required: true });
const DURATIONS = [{ name: "10 minutes", value: 600 }, { name: "30 minutes", value: 1800 }, { name: "1 heure", value: 3600 }, { name: "6 heures", value: 21600 }, { name: "1 jour", value: 86400 }, { name: "3 jours", value: 259200 }, { name: "1 semaine", value: 604800 }];
const PRIORITIES = [["basse", "🟢"], ["normale", "🔵"], ["haute", "🟠"], ["urgente", "🔴"]];

export const MOD2_COMMANDS = [
  // a member's file
  { name: "modlogs", description: "Le dossier d'un membre : avertissements, exclusions, expulsions, bans et notes", default_member_permissions: perm(P.MODERATE), options: [member()] },
  { name: "note", description: "Ajouter une note privée de modération au dossier d'un membre", default_member_permissions: perm(P.MODERATE), options: [member(), { type: STR, name: "text", description: "La note (vue seulement par l'équipe)", required: true, max_length: 400 }] },
  { name: "unwarn", description: "Retirer un avertissement par son numéro (voir /modlogs)", default_member_permissions: perm(P.MODERATE), options: [{ type: INT, name: "id", description: "Le numéro de l'avertissement", required: true, min_value: 1 }] },
  { name: "clearwarns", description: "Effacer tous les avertissements d'un membre", default_member_permissions: perm(P.MODERATE), options: [member()] },
  // nickname and voice
  { name: "nick", description: "Changer le surnom d'un membre (vide : le remettre à zéro)", default_member_permissions: perm(P2.NICK), options: [member(), { type: STR, name: "nickname", description: "Le nouveau surnom", required: false, max_length: 32 }] },
  { name: "move", description: "Déplacer un membre vers un autre salon vocal", default_member_permissions: perm(P2.MOVE), options: [member(), { type: CHANNEL, name: "channel", description: "Le salon vocal", required: true, channel_types: [2, 13] }] },
  { name: "mute", description: "Couper ou rendre le micro d'un membre en vocal", default_member_permissions: perm(P2.MUTE), options: [member(), { type: INT, name: "action", description: "Couper ou rendre", required: true, choices: [{ name: "Couper", value: 1 }, { name: "Rendre", value: 0 }] }] },
  { name: "disconnect", description: "Déconnecter un membre du salon vocal", default_member_permissions: perm(P2.MOVE), options: [member()] },
  // tickets (inside the ticket)
  { name: "add", description: "Ajouter un membre au ticket où tu es", default_member_permissions: perm(P.MANAGE_THREADS), options: [member()] },
  { name: "remove", description: "Retirer un membre du ticket où tu es", default_member_permissions: perm(P.MANAGE_THREADS), options: [member()] },
  { name: "rename", description: "Renommer le ticket où tu es", default_member_permissions: perm(P.MANAGE_THREADS), options: [{ type: STR, name: "name", description: "Le nouveau nom", required: true, max_length: 80 }] },
  { name: "priority", description: "La priorité du ticket où tu es", default_member_permissions: perm(P.MANAGE_THREADS), options: [{ type: STR, name: "level", description: "Le niveau", required: true, choices: PRIORITIES.map(([p, e]) => ({ name: `${e} ${p}`, value: p })) }] },
  { name: "claim", description: "Prendre en charge le ticket où tu es (« Je m'en occupe »)", default_member_permissions: perm(P.MANAGE_THREADS) },
  // the server's life
  { name: "buttonroles", description: "Poser un message où les membres prennent ou rendent des rôles d'un clic", default_member_permissions: perm(P.MANAGE_ROLES), options: [
    { type: ROLE, name: "role1", description: "Premier rôle", required: true }, { type: ROLE, name: "role2", description: "Deuxième rôle", required: false }, { type: ROLE, name: "role3", description: "Troisième rôle", required: false },
    { type: ROLE, name: "role4", description: "Quatrième rôle", required: false }, { type: ROLE, name: "role5", description: "Cinquième rôle", required: false },
    { type: STR, name: "title", description: "Le titre", required: false, max_length: 200 }, { type: STR, name: "text", description: "Le texte (\\n pour aller à la ligne)", required: false, max_length: 1500 },
    { type: CHANNEL, name: "channel", description: "Le salon (celui-ci par défaut)", required: false, channel_types: [0, 5] }] },
  { name: "embed", description: "Publier un message mis en forme (titre, texte, couleur, image)", default_member_permissions: perm(P.MANAGE_MESSAGES), options: [
    { type: STR, name: "text", description: "Le texte (\\n pour aller à la ligne)", required: true, max_length: 3500 }, { type: STR, name: "title", description: "Le titre", required: false, max_length: 250 },
    { type: STR, name: "color", description: "La couleur, comme #ff4655", required: false, max_length: 7 }, { type: STR, name: "image", description: "L'adresse d'une image (https://…)", required: false, max_length: 500 },
    { type: CHANNEL, name: "channel", description: "Le salon (celui-ci par défaut)", required: false, channel_types: [0, 5] }] },
  { name: "poll", description: "Un sondage à boutons (2 à 5 choix), fermé tout seul à la fin", default_member_permissions: perm(P.MANAGE_MESSAGES), options: [
    { type: STR, name: "question", description: "La question", required: true, max_length: 250 }, { type: STR, name: "choices", description: "Les choix séparés par ; (2 à 5)", required: true, max_length: 400 },
    { type: INT, name: "duration", description: "Combien de temps", required: true, choices: DURATIONS }] },
  { name: "remindme", description: "Un message privé de rappel, plus tard", options: [{ type: STR, name: "text", description: "De quoi te rappeler", required: true, max_length: 300 }, { type: INT, name: "in", description: "Dans combien de temps", required: true, choices: DURATIONS }] },
  { name: "giveaway", description: "Un concours : les membres participent d'un bouton, tirage au sort à la fin", default_member_permissions: perm(P.MANAGE_GUILD), options: [
    { type: STR, name: "prize", description: "Ce qui est à gagner", required: true, max_length: 200 }, { type: INT, name: "duration", description: "Combien de temps", required: true, choices: DURATIONS },
    { type: INT, name: "winners", description: "Nombre de gagnants (1 par défaut)", required: false, min_value: 1, max_value: 10 }] },
].map((c) => ({ ...c, contexts: [0] }));

export const MOD2_NAMES = MOD2_COMMANDS.map((c) => c.name);

// ---- pure helpers ----

/** "Oui ; Non ; Peut-être" -> ["Oui", "Non", "Peut-être"]: 2 to 5 different choices, or null. */
export function parseChoices(s) {
  const list = [...new Set(String(s || "").split(";").map((x) => x.trim().slice(0, 80)).filter(Boolean))];
  return list.length >= 2 && list.length <= 5 ? list : null;
}

/** A poll's counts and shares: [{ choice, n, pct }] in the choices' order. */
export function pollResults(options, votes) {
  const total = votes.length;
  return options.map((choice, k) => {
    const n = votes.filter((v) => v.choice === k).length;
    return { choice, n, pct: total ? Math.round((n / total) * 100) : 0 };
  });
}

const bar = (pct) => "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));

/** A poll's message: the question, a bar per choice, its buttons (taken away once closed). */
export function pollMessage(poll, votes, closed = false) {
  const options = JSON.parse(poll.options);
  const res = pollResults(options, votes);
  const ends = Math.floor(Date.parse(poll.ends) / 1000);
  const best = Math.max(...res.map((r) => r.n));
  return {
    embeds: [{
      title: `📊 ${poll.question}`,
      description: res.map((r) => `${closed && r.n === best && best > 0 ? "🏆 " : ""}**${r.choice}**\n\`${bar(r.pct)}\` ${r.pct}% · ${r.n}`).join("\n\n"),
      color: 0xff4655,
      footer: { text: `${votes.length} vote${votes.length > 1 ? "s" : ""}` },
      ...(closed ? {} : { fields: [{ name: "Fin", value: `<t:${ends}:R>` }] }),
    }],
    components: closed ? [] : [{ type: 1, components: options.map((o, k) => ({ type: 2, style: 2, label: o.slice(0, 80), custom_id: `pv|${poll.id}|${k}` })) }],
    allowed_mentions: { parse: [] },
  };
}

/** Draws n winners among the entries, each at most once. rand: () => [0, 1). */
export function drawWinners(entries, n, rand = Math.random) {
  const pool = [...new Set(entries)];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/** A giveaway's message: the prize, the end, the number of entries, the button (or the winners once drawn). */
export function giveawayMessage(gw, entries, winners = null) {
  const ends = Math.floor(Date.parse(gw.ends) / 1000);
  const done = winners !== null;
  return {
    embeds: [{
      title: `🎁 ${gw.prize}`,
      description: done
        ? (winners.length ? `Gagnant${winners.length > 1 ? "s" : ""} : ${winners.map((w) => `<@${w}>`).join(", ")}` : "Personne n'a participé.")
        : `Clique sur le bouton pour participer.\nFin <t:${ends}:R> · ${gw.winners} gagnant${gw.winners > 1 ? "s" : ""}`,
      color: done ? 0x3fb950 : 0xff4655,
      footer: { text: `${entries} participant${entries > 1 ? "s" : ""}` },
    }],
    components: done ? [] : [{ type: 1, components: [{ type: 2, style: 1, label: `Participer (${entries})`, emoji: { name: "🎉" }, custom_id: `gv|${gw.id}` }] }],
    allowed_mentions: { parse: [] },
  };
}

// a role that would give power if members took it themselves: never on a role button
const POWER = [P.ADMIN, P.MANAGE_GUILD, P.MANAGE_ROLES, P.MANAGE_CHANNELS, P.KICK, P.BAN, P.MANAGE_MESSAGES, P.MODERATE, P.MANAGE_THREADS, P2.MOVE, P2.MUTE, P2.NICK, 1n << 7n /* audit log */, 1n << 29n /* webhooks */, 1n << 17n /* @everyone */];
export const powerfulRole = (permissions) => { let p; try { p = BigInt(permissions || 0); } catch { return true; } return POWER.some((b) => (p & b) === b); };

/** A colour typed as #ff4655 or ff4655 -> its number, else the site's red. */
export const colorOf = (s) => (/^#?[0-9a-f]{6}$/i.test(String(s || "").trim()) ? parseInt(String(s).trim().replace("#", ""), 16) : 0xff4655);

/** The text of a ticket, kept when it closes: one line per message, oldest first. messages: Discord's, newest first. */
export function buildTranscript(messages, { name = "", opened = "", closedBy = "" } = {}) {
  const lines = [...messages].reverse().map((m) => {
    const who = (m.author && (m.author.global_name || m.author.username)) || "?";
    const files = (m.attachments || []).map((a) => ` [${a.url}]`).join("");
    const embeds = (m.embeds || []).map((e) => ` [${[e.title, e.description].filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 200)}]`).join("");
    return `[${String(m.timestamp || "").slice(0, 16).replace("T", " ")}] ${who} : ${(m.content || "").replace(/\r?\n/g, " ⏎ ")}${files}${embeds}`;
  });
  return [`Ticket ${name}`, opened ? `Ouvert : ${opened}` : "", closedBy ? `Fermé par : ${closedBy}` : "", `${messages.length} messages`, "", ...lines].filter((l, i) => l !== "" || i > 3).join("\n");
}

// ---- the commands ----

const roleCache = new Map();
async function rolesOf(discord, guild) {
  const kept = roleCache.get(guild);
  if (kept && Date.now() - kept.at < 60000) return kept;
  const [roles, g] = await Promise.all([discord("GET", `/guilds/${guild}/roles`), discord("GET", `/guilds/${guild}`)]);
  const out = { at: Date.now(), roles: roles.map((r) => ({ id: r.id, position: r.position, managed: !!r.managed, name: r.name, permissions: r.permissions })), owner: g.owner_id };
  roleCache.set(guild, out);
  return out;
}

function fail(e, L) {
  if (e && (e.code === 50013 || e.status === 403)) return L("❌ Le bot n'a pas le droit de faire ça ici : donne-lui la permission, et place son rôle au-dessus de celui du membre.", "❌ The bot is not allowed to do this here: give it the permission, and put its role above the member's.");
  if (e && e.code === 40032) return L("❌ Ce membre n'est pas dans un salon vocal.", "❌ This member is not in a voice channel.");
  if (e && e.code === 10007) return L("❌ Ce membre n'est plus sur le serveur.", "❌ This member is no longer on the server.");
  return L(`❌ Discord a refusé : ${(e && e.message) || "erreur"}`, `❌ Discord refused: ${(e && e.message) || "error"}`);
}

const KIND = { warn: "⚠️ Avertissement", timeout: "🔇 Exclusion", untimeout: "🔊 Exclusion levée", kick: "👢 Expulsion", ban: "🔨 Ban", unban: "✅ Ban levé", note: "📝 Note" };

/**
 * Runs one of the second set's commands. deps: { db, discord, lang, logBot, now, server, notify }: notify(text) writes the
 * action in the moderation log channel. Returns { content, embeds?, public? }.
 */
export async function runMod2Command(i, deps) {
  const { db, discord, lang = "fr", logBot = () => {}, now = Date.now(), notify = async () => {} } = deps;
  const L = (fr, en) => (lang === "en" ? en : fr);
  const name = i.data.name;
  const guild = i.guild_id;
  if (!guild) return { content: L("Cette commande ne marche que sur un serveur.", "This command only works in a server.") };
  const opts = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
  const resolved = i.data.resolved || {};
  const mod = i.member || {};
  const modUser = mod.user || {};
  const def = MOD2_COMMANDS.find((c) => c.name === name);
  if (def && def.default_member_permissions && !hasPerm(mod.permissions, BigInt(def.default_member_permissions))) {
    return { content: L("Tu n'as pas la permission pour cette commande.", "You do not have the permission for this command.") };
  }
  const tag = (u) => (u ? u.global_name || u.username || u.id : "?");
  const audit = (why = "") => `${tag(modUser)} (${modUser.id})${why ? ` : ${why}` : ""}`;
  const log = async (text) => {
    try { logBot(db, "moderation", `${name} · ${text}`, true, now); } catch { /* none */ }
    await notify(`**/${name}** par <@${modUser.id}> · ${text}`);
  };
  const target = () => { const id = String(opts.user || ""); return { id, user: (resolved.users || {})[id], member: (resolved.members || {})[id] }; };
  const below = async (t) => {
    if (!t.member) return L("❌ Ce membre n'est pas sur le serveur.", "❌ This member is not on the server.");
    const { roles, owner } = await rolesOf(discord, guild);
    const no = canActOn({ modId: modUser.id, modRoles: mod.roles, targetId: t.id, targetRoles: t.member.roles, ownerId: owner, roles });
    return no ? (no === "self" ? L("❌ Pas sur toi-même.", "❌ Not on yourself.") : no === "owner" ? L("❌ Impossible sur le propriétaire du serveur.", "❌ Not on the server's owner.") : L("❌ Ce membre a un rôle égal ou supérieur au tien.", "❌ This member's role is equal to or above yours.")) : "";
  };
  // the ticket the command is typed in (a thread the bot opened)
  const ticket = () => db.prepare("SELECT thread, user, subject, category, priority, claimed, closed FROM bot_tickets WHERE thread = ? AND guild = ?").get(i.channel_id, guild);

  try {
    if (name === "modlogs") {
      const t = target();
      const rows = sanctionsOf(db, guild, t.id);
      if (!rows.length) return { content: L(`✅ Le dossier de **${tag(t.user)}** est vide.`, `✅ **${tag(t.user)}**'s file is empty.`) };
      const count = (k) => rows.filter((r) => r.kind === k).length;
      return { embeds: [{ title: `📁 ${tag(t.user)}`, color: 0xff4655, description: rows.map((r) => `\`#${r.id}\` ${KIND[r.kind] || r.kind} · <t:${Math.floor(Date.parse(r.at) / 1000)}:d>${r.reason ? ` · ${r.reason}` : ""} — <@${r.mod}>`).join("\n").slice(0, 3900), footer: { text: `${count("warn")} avertissement(s) · ${count("timeout")} exclusion(s) · ${count("kick")} expulsion(s) · ${count("ban")} ban(s) · ${count("note")} note(s)` } }] };
    }
    if (name === "note") {
      const t = target();
      const n = addSanction(db, { guild, user: t.id, kind: "note", mod: modUser.id, reason: String(opts.text || ""), at: now });
      await log(`note #${n} sur <@${t.id}>`);
      return { content: L(`📝 Note #${n} ajoutée au dossier de **${tag(t.user)}**.`, `📝 Note #${n} added to **${tag(t.user)}**'s file.`) };
    }
    if (name === "unwarn") {
      const id = Number(opts.id);
      const row = db.prepare("SELECT user FROM bot_sanctions WHERE id = ? AND guild = ? AND kind = 'warn'").get(id, guild);
      if (!row) return { content: L(`❌ Pas d'avertissement n°${id} sur ce serveur.`, `❌ No warning #${id} on this server.`) };
      db.prepare("DELETE FROM bot_sanctions WHERE id = ?").run(id);
      await log(`avertissement #${id} de <@${row.user}> retiré`);
      return { content: L(`✅ Avertissement n°${id} retiré du dossier de <@${row.user}>.`, `✅ Warning #${id} removed from <@${row.user}>'s file.`) };
    }
    if (name === "clearwarns") {
      const t = target();
      const n = db.prepare("DELETE FROM bot_sanctions WHERE guild = ? AND user = ? AND kind = 'warn'").run(guild, t.id).changes;
      await log(`${n} avertissement(s) de <@${t.id}> effacé(s)`);
      return { content: L(`✅ ${n} avertissement(s) effacé(s) pour **${tag(t.user)}**.`, `✅ ${n} warning(s) cleared for **${tag(t.user)}**.`) };
    }
    if (name === "nick" || name === "move" || name === "mute" || name === "disconnect") {
      const t = target();
      const no = await below(t);
      if (no) return { content: no };
      const body = name === "nick" ? { nick: String(opts.nickname || "").trim() || null }
        : name === "move" ? { channel_id: String(opts.channel) }
        : name === "mute" ? { mute: Number(opts.action) === 1 }
        : { channel_id: null };
      await discord("PATCH", `/guilds/${guild}/members/${t.id}`, body, { reason: audit() });
      const what = name === "nick" ? (body.nick ? `surnom « ${body.nick} »` : "surnom remis à zéro") : name === "move" ? `déplacé vers <#${body.channel_id}>` : name === "mute" ? (body.mute ? "micro coupé" : "micro rendu") : "déconnecté du vocal";
      await log(`<@${t.id}> : ${what}`);
      return { content: `✅ **${tag(t.user)}** : ${what}.` };
    }
    if (["add", "remove", "rename", "priority", "claim"].includes(name)) {
      const tk = ticket();
      if (!tk) return { content: L("Cette commande se tape dans un ticket.", "Type this command inside a ticket.") };
      if (tk.closed) return { content: L("Ce ticket est fermé.", "This ticket is closed.") };
      if (name === "add" || name === "remove") {
        const t = target();
        if (name === "remove" && t.id === tk.user) return { content: L("❌ L'auteur du ticket ne peut pas en être retiré : ferme-le plutôt.", "❌ The ticket's author cannot be removed: close it instead.") };
        await discord(name === "add" ? "PUT" : "DELETE", `/channels/${tk.thread}/thread-members/${t.id}`);
        await log(`<@${t.id}> ${name === "add" ? "ajouté au" : "retiré du"} ticket <#${tk.thread}>`);
        return { content: name === "add" ? L(`✅ <@${t.id}> est ajouté au ticket.`, `✅ <@${t.id}> is added to the ticket.`) : L(`✅ <@${t.id}> est retiré du ticket.`, `✅ <@${t.id}> is removed from the ticket.`), public: true };
      }
      if (name === "rename" || name === "priority") {
        const priority = name === "priority" ? String(opts.level || "normale") : tk.priority;
        const emoji = (PRIORITIES.find(([p]) => p === priority) || [])[1] || "";
        const base = name === "rename" ? String(opts.name || "").trim().slice(0, 80) : (await discord("GET", `/channels/${tk.thread}`)).name.replace(/^[🟢🔵🟠🔴]\s?/u, "");
        await discord("PATCH", `/channels/${tk.thread}`, { name: `${emoji ? `${emoji} ` : ""}${base}`.slice(0, 100) }, { reason: audit() });
        if (name === "priority") db.prepare("UPDATE bot_tickets SET priority = ? WHERE thread = ?").run(priority, tk.thread);
        await log(name === "priority" ? `priorité ${priority} sur <#${tk.thread}>` : `ticket <#${tk.thread}> renommé « ${base} »`);
        return { content: name === "priority" ? L(`${emoji} Priorité : **${priority}**.`, `${emoji} Priority: **${priority}**.`) : L(`✅ Ticket renommé : **${base}**.`, `✅ Ticket renamed: **${base}**.`), public: true };
      }
      return claimTicket({ ...deps, guild, thread: tk.thread, user: modUser, permissions: mod.permissions });
    }
    if (name === "buttonroles") {
      const want = ["role1", "role2", "role3", "role4", "role5"].map((k) => String(opts[k] || "")).filter(Boolean);
      const { roles, owner } = await rolesOf(discord, guild);
      const top = Math.max(0, ...(mod.roles || []).map((id) => (roles.find((r) => r.id === id) || {}).position || 0));
      for (const id of want) {
        const r = roles.find((x) => x.id === id);
        if (!r) return { content: L("❌ Rôle inconnu.", "❌ Unknown role.") };
        if (r.managed || id === guild) return { content: L(`❌ **${r.name}** ne peut pas être distribué.`, `❌ **${r.name}** cannot be handed out.`) };
        if (powerfulRole(r.permissions)) return { content: L(`❌ **${r.name}** donne des pouvoirs de modération ou d'administration : pas en libre-service.`, `❌ **${r.name}** gives moderation or admin powers: not self-service.`) };
        if (modUser.id !== owner && r.position >= top) return { content: L(`❌ **${r.name}** est égal ou supérieur à ton rôle.`, `❌ **${r.name}** is equal to or above your role.`) };
      }
      const channel = String(opts.channel || i.channel_id);
      await discord("POST", `/channels/${channel}/messages`, {
        embeds: [{ title: String(opts.title || L("Choisis tes rôles", "Pick your roles")), description: String(opts.text || L("Clique sur un bouton pour prendre le rôle, encore une fois pour le rendre.", "Click a button to take the role, again to give it back.")).replace(/\\n/g, "\n"), color: 0xff4655 }],
        components: [{ type: 1, components: want.map((id) => ({ type: 2, style: 2, label: ((roles.find((r) => r.id === id) || {}).name || id).slice(0, 80), custom_id: `rb|${id}` })) }],
        allowed_mentions: { parse: [] },
      });
      await log(`rôles à boutons dans <#${channel}> : ${want.map((id) => `<@&${id}>`).join(" ")}`);
      return { content: L(`✅ Message de rôles posé dans <#${channel}>.`, `✅ Role message posted in <#${channel}>.`) };
    }
    if (name === "embed") {
      const channel = String(opts.channel || i.channel_id);
      const image = /^https:\/\/\S+$/i.test(String(opts.image || "")) ? String(opts.image) : "";
      await discord("POST", `/channels/${channel}/messages`, { embeds: [{ title: opts.title ? String(opts.title) : undefined, description: String(opts.text || "").replace(/\\n/g, "\n"), color: colorOf(opts.color), ...(image ? { image: { url: image } } : {}) }], allowed_mentions: { parse: [] } });
      await log(`message mis en forme dans <#${channel}>`);
      return { content: L(`✅ Publié dans <#${channel}>.`, `✅ Posted in <#${channel}>.`) };
    }
    if (name === "poll") {
      const options = parseChoices(opts.choices);
      if (!options) return { content: L("❌ Donne 2 à 5 choix différents, séparés par des ; (exemple : Oui ; Non).", "❌ Give 2 to 5 different choices, separated by ; (for example: Yes ; No).") };
      const ends = new Date(now + Number(opts.duration) * 1000).toISOString();
      const id = Number(db.prepare("INSERT INTO bot_polls (guild, channel, question, options, ends, by) VALUES (?, ?, ?, ?, ?, ?)").run(guild, i.channel_id, String(opts.question), JSON.stringify(options), ends, modUser.id).lastInsertRowid);
      const poll = db.prepare("SELECT * FROM bot_polls WHERE id = ?").get(id);
      const msg = await discord("POST", `/channels/${i.channel_id}/messages`, pollMessage(poll, []));
      db.prepare("UPDATE bot_polls SET message = ? WHERE id = ?").run(msg.id, id);
      await log(`sondage « ${poll.question} »`);
      return { content: L("📊 Sondage publié.", "📊 Poll posted.") };
    }
    if (name === "remindme") {
      const at = new Date(now + Number(opts.in) * 1000).toISOString();
      db.prepare("INSERT INTO bot_memos (user, channel, text, at) VALUES (?, ?, ?, ?)").run(modUser.id, i.channel_id, String(opts.text || "").slice(0, 300), at);
      return { content: L(`⏰ C'est noté : je t'enverrai un message privé <t:${Math.floor(Date.parse(at) / 1000)}:R>.`, `⏰ Noted: you will get a private message <t:${Math.floor(Date.parse(at) / 1000)}:R>.`) };
    }
    if (name === "giveaway") {
      const ends = new Date(now + Number(opts.duration) * 1000).toISOString();
      const winners = Math.max(1, Math.min(10, Number(opts.winners) || 1));
      const id = Number(db.prepare("INSERT INTO bot_giveaways (guild, channel, prize, winners, ends, by) VALUES (?, ?, ?, ?, ?, ?)").run(guild, i.channel_id, String(opts.prize), winners, ends, modUser.id).lastInsertRowid);
      const gw = db.prepare("SELECT * FROM bot_giveaways WHERE id = ?").get(id);
      const msg = await discord("POST", `/channels/${i.channel_id}/messages`, giveawayMessage(gw, 0));
      db.prepare("UPDATE bot_giveaways SET message = ? WHERE id = ?").run(msg.id, id);
      await log(`tirage « ${gw.prize} » (${winners} gagnant(s))`);
      return { content: L("🎁 Tirage lancé.", "🎁 Giveaway started.") };
    }
  } catch (e) {
    try { logBot(db, "moderation", `${name} · ${e.message}`, false, now); } catch { /* none */ }
    return { content: fail(e, L) };
  }
  return { content: "?" };
}

/** "I'm on it": a member of the staff takes a ticket; said in the ticket, kept with it. */
export async function claimTicket({ db, discord, lang = "fr", now = Date.now(), guild, thread, user, permissions, notify = async () => {} }) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  if (!hasPerm(permissions, P.MANAGE_THREADS)) return { content: L("Seule l'équipe peut prendre un ticket en charge.", "Only the team can take a ticket.") };
  const tk = db.prepare("SELECT claimed, closed FROM bot_tickets WHERE thread = ? AND guild = ?").get(thread, guild);
  if (!tk || tk.closed) return { content: L("Ce ticket n'est pas ouvert.", "This ticket is not open.") };
  if (tk.claimed) return { content: L(`<@${tk.claimed}> s'en occupe déjà.`, `<@${tk.claimed}> is already on it.`) };
  db.prepare("UPDATE bot_tickets SET claimed = ? WHERE thread = ?").run(user.id, thread);
  try { await discord("POST", `/channels/${thread}/messages`, { content: L(`🙋 <@${user.id}> s'occupe de ce ticket.`, `🙋 <@${user.id}> is on this ticket.`), allowed_mentions: { parse: [] } }); } catch { /* the answer says it */ }
  await notify(`🙋 <@${user.id}> prend en charge <#${thread}>`);
  return { content: L("🙋 Ticket pris en charge.", "🙋 Ticket taken."), public: false, at: now };
}

/**
 * A role button (rb|role), a poll's vote (pv|poll|choice), a giveaway's entry (gv|id). Returns Discord's answer:
 * { type: 4 (a message for the clicker), data } or { type: 7 (the message itself, updated), data }.
 */
export async function handleButton(i, deps) {
  const { db, discord, lang = "fr", now = Date.now(), notify = async () => {} } = deps;
  const L = (fr, en) => (lang === "en" ? en : fr);
  const user = (i.member && i.member.user) || i.user || {};
  const [kind, a, b] = String((i.data && i.data.custom_id) || "").split("|");
  const say = (content) => ({ type: 4, data: { flags: 64, content, allowed_mentions: { parse: [] } } });
  if (kind === "rb") {
    const roleId = String(a || "").replace(/\D/g, "");
    const roles = await discord("GET", `/guilds/${i.guild_id}/roles`);
    const r = roles.find((x) => x.id === roleId);
    // checked again at each click: a role may have been given powers since the message was posted
    if (!r || r.managed || powerfulRole(r.permissions)) return say(L("❌ Ce rôle n'est plus disponible ici.", "❌ This role is no longer available here."));
    const has = ((i.member && i.member.roles) || []).includes(roleId);
    try {
      await discord(has ? "DELETE" : "PUT", `/guilds/${i.guild_id}/members/${user.id}/roles/${roleId}`, null, { reason: "Rôle à bouton" });
    } catch (e) { return say(fail(e, L)); }
    await notify(`🎭 <@${user.id}> ${has ? "rend" : "prend"} <@&${roleId}> (bouton)`);
    return say(has ? L(`➖ Tu n'as plus le rôle **${r.name}**.`, `➖ You no longer have **${r.name}**.`) : L(`➕ Tu as maintenant le rôle **${r.name}**.`, `➕ You now have **${r.name}**.`));
  }
  if (kind === "pv") {
    const poll = db.prepare("SELECT * FROM bot_polls WHERE id = ?").get(Number(a));
    if (!poll || poll.closed || Date.parse(poll.ends) <= now) return say(L("Ce sondage est fermé.", "This poll is closed."));
    const choice = Number(b);
    if (!(choice >= 0 && choice < JSON.parse(poll.options).length)) return say("?");
    db.prepare("INSERT INTO bot_poll_votes (poll, user, choice) VALUES (?, ?, ?) ON CONFLICT (poll, user) DO UPDATE SET choice = excluded.choice").run(poll.id, user.id, choice);
    const votes = db.prepare("SELECT user, choice FROM bot_poll_votes WHERE poll = ?").all(poll.id);
    return { type: 7, data: pollMessage(poll, votes) };
  }
  if (kind === "gv") {
    const gw = db.prepare("SELECT * FROM bot_giveaways WHERE id = ?").get(Number(a));
    if (!gw || gw.closed || Date.parse(gw.ends) <= now) return say(L("Ce tirage est terminé.", "This giveaway is over."));
    const inIt = db.prepare("SELECT 1 FROM bot_giveaway_entries WHERE gw = ? AND user = ?").get(gw.id, user.id);
    if (inIt) db.prepare("DELETE FROM bot_giveaway_entries WHERE gw = ? AND user = ?").run(gw.id, user.id);
    else db.prepare("INSERT INTO bot_giveaway_entries (gw, user) VALUES (?, ?)").run(gw.id, user.id);
    const n = db.prepare("SELECT COUNT(*) AS n FROM bot_giveaway_entries WHERE gw = ?").get(gw.id).n;
    return { type: 7, data: giveawayMessage(gw, n) };
  }
  return say("?");
}

/**
 * The timed work, once a minute: polls and giveaways that end (results, winners drawn), reminders due, tickets idle for too
 * long (closed). deps: { db, discord, server, now, closeTicket, rand }. Returns what was done.
 */
export async function botTimers(deps) {
  const { db, discord, server, now = Date.now(), rand = Math.random } = deps;
  const iso = new Date(now).toISOString();
  const done = [];
  for (const poll of db.prepare("SELECT * FROM bot_polls WHERE closed = '' AND ends <= ? LIMIT 5").all(iso)) {
    db.prepare("UPDATE bot_polls SET closed = ? WHERE id = ?").run(iso, poll.id);
    const votes = db.prepare("SELECT user, choice FROM bot_poll_votes WHERE poll = ?").all(poll.id);
    try { if (poll.message) await discord("PATCH", `/channels/${poll.channel}/messages/${poll.message}`, pollMessage(poll, votes, true)); done.push(`poll:${poll.id}`); } catch { /* deleted message */ }
  }
  for (const gw of db.prepare("SELECT * FROM bot_giveaways WHERE closed = '' AND ends <= ? LIMIT 5").all(iso)) {
    const entries = db.prepare("SELECT user FROM bot_giveaway_entries WHERE gw = ?").all(gw.id).map((r) => r.user);
    const winners = drawWinners(entries, gw.winners, rand);
    db.prepare("UPDATE bot_giveaways SET closed = ?, result = ? WHERE id = ?").run(iso, JSON.stringify(winners), gw.id);
    try {
      if (gw.message) await discord("PATCH", `/channels/${gw.channel}/messages/${gw.message}`, giveawayMessage(gw, entries.length, winners));
      if (winners.length) await discord("POST", `/channels/${gw.channel}/messages`, { content: `🎉 ${winners.map((w) => `<@${w}>`).join(", ")} : bravo, vous gagnez **${gw.prize}** !`, allowed_mentions: { users: winners } });
      done.push(`giveaway:${gw.id}`);
    } catch { /* deleted message */ }
  }
  for (const m of db.prepare("SELECT * FROM bot_memos WHERE sent = '' AND at <= ? LIMIT 10").all(iso)) {
    db.prepare("UPDATE bot_memos SET sent = ? WHERE id = ?").run(iso, m.id);
    try {
      const ch = await discord("POST", "/users/@me/channels", { recipient_id: m.user });
      await discord("POST", `/channels/${ch.id}/messages`, { content: `⏰ Rappel : ${m.text}`, allowed_mentions: { parse: [] } });
      done.push(`memo:${m.id}`);
    } catch {
      // private messages closed: in the channel where it was asked
      try { if (m.channel) await discord("POST", `/channels/${m.channel}/messages`, { content: `⏰ <@${m.user}> : ${m.text}`, allowed_mentions: { users: [m.user] } }); } catch { /* none */ }
    }
  }
  // idle tickets: their last message older than the days set (checked at most once an hour each)
  const days = server && server.tickets.inactiveDays;
  if (days > 0 && deps.closeTicket) {
    const hourAgo = new Date(now - 3600000).toISOString();
    for (const t of db.prepare("SELECT thread, guild FROM bot_tickets WHERE closed = '' AND (checked = '' OR checked < ?) LIMIT 5").all(hourAgo)) {
      db.prepare("UPDATE bot_tickets SET checked = ? WHERE thread = ?").run(iso, t.thread);
      try {
        const ch = await discord("GET", `/channels/${t.thread}`);
        const last = ch.last_message_id ? Number((BigInt(ch.last_message_id) >> 22n) + 1420070400000n) : Date.parse(ch.thread_metadata && ch.thread_metadata.create_timestamp) || now;
        if (now - last > days * 86400000) {
          await deps.closeTicket({ db, discord, server, now, guild: t.guild, thread: t.thread, user: { id: "bot", username: "bot" }, permissions: String(P.MANAGE_THREADS), idle: true });
          done.push(`idle:${t.thread}`);
        }
      } catch { /* deleted thread */ }
    }
  }
  return done;
}
