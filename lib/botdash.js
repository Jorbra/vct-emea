// The bot's organisation, as the well-known server bots do it: commands grouped under one name (/warn add|remove|clear|list,
// /role add|remove, /ticket open|close|…), "modules" the editor turns on or off, rules per command (roles and channels
// allowed or refused, a delay between two uses, who sees the answer), answers dressed the same way (a colour per kind),
// /help with a menu, and the variables of the messages the editor writes ({user}, {server}, {membercount}…).
// Pure functions: the route (app/api/discord/route.js), the editor (app/api/bot/route.js) and the tests use them.

// ---- commands grouped under one name ----

/**
 * The groups: the name Discord shows → { subcommand: the command that does it (lib/botmod.js, botmod2.js) }.
 * The subcommands keep the options, checks and log of the commands they stand for.
 */
export const GROUPS = {
  warn: { perm: "1099511627776", description: "Avertissements : ajouter, retirer, effacer, voir", subs: { add: "warn", remove: "unwarn", clear: "clearwarns", list: "warnings" } },
  role: { perm: "268435456", description: "Donner ou retirer un rôle à un membre", subs: { add: "addrole", remove: "removerole" } },
  ticket: { perm: "", description: "Tickets : ouvrir, fermer, ajouter, retirer, renommer, prendre en charge, priorité, panneau", subs: { open: "ticket", close: "close", add: "add", remove: "remove", rename: "rename", claim: "claim", priority: "priority", panel: "ticketpanel" } },
};
// the French descriptions of the subcommands, shorter than those of the commands they stand for
const SUB_DESC = {
  "warn add": "Avertir un membre (gardé dans son dossier)", "warn remove": "Retirer un avertissement par son numéro de cas", "warn clear": "Effacer tous les avertissements d'un membre", "warn list": "Voir les avertissements d'un membre",
  "role add": "Donner un rôle à un membre", "role remove": "Retirer un rôle à un membre",
  "ticket open": "Ouvrir un ticket avec l'équipe", "ticket close": "Fermer ce ticket (avec une raison)", "ticket add": "Ajouter un membre à ce ticket", "ticket remove": "Retirer un membre de ce ticket",
  "ticket rename": "Renommer ce ticket", "ticket claim": "Prendre ce ticket en charge", "ticket priority": "Changer la priorité de ce ticket", "ticket panel": "Poser le panneau d'ouverture des tickets",
};
// the commands still registered under their own name too, as Ticket Tool does (/close in a ticket)
export const ALIASES = ["close"];
// the site's /role (best players of a role) takes another name, /role being the moderators' now
export const RENAMED_SITE = { meilleurs: "role" };
// what each old command became: for the editor's table and the proposal
export const OLD_TO_NEW = {
  warn: "/warn add", warnings: "/warn list", unwarn: "/warn remove", clearwarns: "/warn clear",
  addrole: "/role add", removerole: "/role remove",
  ticket: "/ticket open", add: "/ticket add", remove: "/ticket remove", rename: "/ticket rename", claim: "/ticket claim", priority: "/ticket priority", ticketpanel: "/ticket panel",
  role: "/meilleurs",
};

/** The commands Discord is given: the grouped ones in place of those they stand for, the site's /role as /meilleurs. Pure. */
export function groupCommands(flat) {
  const byName = new Map(flat.map((c) => [c.name, c]));
  const grouped = new Set(Object.values(GROUPS).flatMap((g) => Object.values(g.subs)));
  const out = [];
  for (const c of flat) {
    if (grouped.has(c.name) && !ALIASES.includes(c.name)) continue;
    if (c.name === "role" && !c.type) { out.push({ ...c, name: "meilleurs" }); continue; }
    out.push(c);
  }
  for (const [name, g] of Object.entries(GROUPS)) {
    const options = Object.entries(g.subs).filter(([, inner]) => byName.has(inner)).map(([sub, inner]) => ({
      type: 1, name: sub, description: SUB_DESC[`${name} ${sub}`] || byName.get(inner).description,
      options: byName.get(inner).options || [],
    }));
    if (!options.length) continue;
    out.push({ name, description: g.description, ...(g.perm ? { default_member_permissions: g.perm } : {}), contexts: [0], options });
  }
  return out;
}

/**
 * An interaction as the command it stands for: /warn add user:x → warn user:x, /meilleurs → role. Also for the suggestions
 * while typing (the option being typed sits in the subcommand). Returns the interaction itself when nothing changes. Pure.
 */
export function expandInteraction(i) {
  const d = i && i.data;
  if (!d || d.type === 2 || d.type === 3) return i;
  if (RENAMED_SITE[d.name]) return { ...i, data: { ...d, name: RENAMED_SITE[d.name] } };
  const g = GROUPS[d.name];
  const sub = g && (d.options || [])[0];
  if (!g || !sub || sub.type !== 1 || !g.subs[sub.name]) return i;
  return { ...i, data: { ...d, name: g.subs[sub.name], options: sub.options || [], group: d.name, sub: sub.name } };
}

/** The name a command is shown under ("/warn add", "/meilleurs", "/kick"). */
export function shownName(inner) {
  for (const [name, g] of Object.entries(GROUPS)) for (const [sub, x] of Object.entries(g.subs)) if (x === inner && !ALIASES.includes(inner)) return `${name} ${sub}`;
  if (inner === "role") return "meilleurs";
  return inner;
}

// ---- modules ----

/**
 * The modules the editor shows as cards: their commands (the inner names) and buttons, and what they need from Discord.
 * needs: permission bits names (lib/botperms.js P), intents: "members" (Server Members) or "content" (Message Content).
 */
export const MODULES = [
  { key: "moderation", icon: "🛡️", name: "Modération", text: "Avertir, exclure, expulser, bannir, purger, verrouiller : avec numéro de cas, raisons proposées et message privé au membre.", commands: ["warn", "warnings", "unwarn", "clearwarns", "modlogs", "note", "case", "reason", "timeout", "kick", "ban", "tempban", "unban", "purge", "slowmode", "lock", "unlock", "lockdown", "nick", "move", "mute", "disconnect", "addrole", "removerole", "Warn", "Timeout 10 min", "Modlogs", "Supprimer et avertir", "Signaler au staff"], needs: ["KICK", "BAN", "MODERATE", "MANAGE_MESSAGES", "MANAGE_ROLES", "MANAGE_CHANNELS"] },
  { key: "automod", icon: "🤖", name: "Modération automatique", text: "Les règles AutoMod de Discord (invitations, mots interdits, mentions, spam) et l'anti-flood du bot.", commands: [], needs: ["MANAGE_GUILD"], intents: ["content"] },
  { key: "logs", icon: "📒", name: "Journal", text: "Messages modifiés ou supprimés, arrivées et départs, sanctions, pseudos et rôles, dans un salon de l'équipe.", commands: [], needs: [], intents: ["members", "content"] },
  { key: "welcome", icon: "👋", name: "Bienvenue & arrivées", text: "Message et image de bienvenue, message privé, rôle d'arrivée, comptes récents, anti-raid, invitations, compteur.", commands: [], needs: ["MANAGE_ROLES"], intents: ["members"] },
  { key: "verify", icon: "✅", name: "Vérification", text: "Un bouton « J'accepte le règlement » qui donne le rôle d'accès aux salons.", commands: ["verifypanel"], buttons: ["vf"], needs: ["MANAGE_ROLES"] },
  { key: "tickets", icon: "🎫", name: "Tickets", text: "Une discussion privée avec l'équipe : sujets, formulaire, prise en charge, transcription, note de satisfaction.", commands: ["ticket", "close", "add", "remove", "rename", "priority", "claim", "ticketpanel"], buttons: ["tk", "tr"], needs: ["MANAGE_THREADS"] },
  { key: "buttonroles", icon: "🎭", name: "Rôles à boutons", text: "Un message où chacun prend ou rend un rôle d'un clic.", commands: ["buttonroles"], buttons: ["rb"], needs: ["MANAGE_ROLES"] },
  { key: "announce", icon: "📣", name: "Annonces du site et des matchs", text: "Débuts et résultats des matchs, rappels, résumé du soir, message épinglé, annonces écrites ici, messages mis en forme.", commands: ["announce", "embed"], needs: [] },
  { key: "polls", icon: "📊", name: "Sondages & concours", text: "Sondages à boutons et tirages au sort, fermés tout seuls à la fin.", commands: ["poll", "giveaway"], buttons: ["pv", "gv"], needs: [] },
];

/** Is a module on? (on by default, so nothing changes for a server set up before the modules) */
export const moduleOn = (server, key) => !(server && server.modules && server.modules[key] === false);

/** The module a command (inner name) or a button (its prefix) belongs to, or null. */
export function moduleOf(nameOrButton) {
  return MODULES.find((m) => m.commands.includes(nameOrButton) || (m.buttons || []).includes(nameOrButton)) || null;
}

/** The refusal when the command's module is off, else "". */
export function moduleRefusal(server, nameOrButton) {
  const m = moduleOf(nameOrButton);
  return m && !moduleOn(server, m.key) ? `❌ Le module **${m.name}** est désactivé sur ce serveur (éditeur du site → bot → ${m.name}).` : "";
}

/**
 * A module's state for its card: "off", "missing" (a right or an intent the bot lacks: said in why), "setup" (something to
 * choose first) or "ready". perms: the bot's permissions on the server (a number in a string, or null when unknown);
 * gateway: { on, privileged }. Pure.
 */
export function moduleState(m, { server, settings = {}, perms = null, gateway = {}, P }) {
  if (!moduleOn(server, m.key)) return { state: "off", why: "" };
  const missing = [];
  if (perms != null && P) {
    let p = 0n;
    try { p = BigInt(perms); } catch { /* none */ }
    const admin = (p & P.ADMIN) === P.ADMIN;
    for (const n of m.needs || []) if (!admin && P[n] && (p & P[n]) !== P[n]) missing.push(PERM_NAMES[n] || n);
  }
  if ((m.intents || []).length && gateway.on && gateway.privileged === false) missing.push(m.intents.includes("members") ? "intent Server Members" : "intent Message Content");
  if (missing.length) return { state: "missing", why: `Il manque : ${missing.join(", ")}` };
  const s = server || {};
  const setup = {
    moderation: () => (!s.logChannel ? "Choisis le salon du journal pour garder une trace des sanctions." : ""),
    automod: () => (s.automod && !s.automod.invites && !s.automod.wordsOn && !s.automod.mentions && !s.automod.spam && !(s.automod.flood && s.automod.flood.on) ? "Aucune règle activée." : ""),
    logs: () => (!s.logChannel ? "Choisis le salon du journal." : ""),
    welcome: () => (s.welcome && s.welcome.on && !s.welcome.channel ? "Choisis le salon de bienvenue." : s.welcome && !s.welcome.on && !(s.goodbye && s.goodbye.on) && !(s.arrival && s.arrival.dm && s.arrival.dm.on) && !(s.welcome && s.welcome.role) ? "Rien d'activé pour l'instant." : ""),
    verify: () => (!(s.arrival && s.arrival.verify && s.arrival.verify.role) ? "Choisis le rôle d'accès." : ""),
    tickets: () => (!(s.tickets && s.tickets.staffRole) && !((s.tickets && s.tickets.categories) || []).some((c) => c.role) ? "Choisis le rôle de l'équipe qui répond." : ""),
    buttonroles: () => "",
    announce: () => (!settings.channel ? "Choisis le salon des annonces." : ""),
    polls: () => "",
  }[m.key];
  const why = setup ? setup() : "";
  return why ? { state: "setup", why } : { state: "ready", why: "" };
}

// the permissions in French, as Discord's server settings name them
export const PERM_NAMES = {
  KICK: "Expulser des membres", BAN: "Bannir des membres", ADMIN: "Administrateur", MANAGE_CHANNELS: "Gérer les salons", MANAGE_GUILD: "Gérer le serveur",
  SEND: "Envoyer des messages", MANAGE_MESSAGES: "Gérer les messages", MANAGE_ROLES: "Gérer les rôles", MANAGE_THREADS: "Gérer les fils",
  SEND_IN_THREADS: "Envoyer des messages dans les fils", MODERATE: "Exclure temporairement des membres", MOVE: "Déplacer des membres", MUTE: "Rendre muets des membres", NICK: "Gérer les pseudos",
};
const BITS = { 2n: "KICK", 4n: "BAN", 8n: "ADMIN", 16n: "MANAGE_CHANNELS", 32n: "MANAGE_GUILD", 8192n: "MANAGE_MESSAGES", 268435456n: "MANAGE_ROLES", 17179869184n: "MANAGE_THREADS", 1099511627776n: "MODERATE", 16777216n: "MOVE", 4194304n: "MUTE", 134217728n: "NICK" };
/** The French name of a permission given as Discord writes it ("2" → « Expulser des membres »). */
export const permName = (bits) => PERM_NAMES[BITS[BigInt(bits || 0)]] || "la permission nécessaire";

// ---- rules per command ----

const snowflakes = (v, max) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => /^\d{5,25}$/.test(x)))].slice(0, max);

/** Only the known fields of each command's rule; the rules that change nothing are dropped. Pure. */
export function cleanRules(raw) {
  const out = {};
  for (const [name, r] of Object.entries(raw && typeof raw === "object" ? raw : {}).slice(0, 150)) {
    if (!/^[\w -]{1,32}$/.test(name) || !r || typeof r !== "object") continue;
    const rule = {
      allowRoles: snowflakes(r.allowRoles, 25), denyRoles: snowflakes(r.denyRoles, 25),
      allowChannels: snowflakes(r.allowChannels, 50), denyChannels: snowflakes(r.denyChannels, 50),
      cooldown: Math.max(0, Math.min(86400, Math.round(Number(r.cooldown) || 0))),
      visibility: ["public", "private"].includes(r.visibility) ? r.visibility : "default",
    };
    if (rule.allowRoles.length || rule.denyRoles.length || rule.allowChannels.length || rule.denyChannels.length || rule.cooldown || rule.visibility !== "default") out[name] = rule;
  }
  return out;
}

/**
 * May this member use this command here, now? i: the interaction (member roles and permissions, channel); cooldowns: a Map
 * "command:user" → last use (ms), updated when allowed. Members who can manage the server pass every rule, as with the
 * well-known bots. Returns "" or the refusal. Pure but for the map.
 */
export function checkRule(rule, i, cooldowns, now = Date.now(), name = "") {
  if (!rule) return "";
  const member = i.member || {};
  let p = 0n;
  try { p = BigInt(member.permissions || 0); } catch { /* none */ }
  if ((p & 8n) === 8n || (p & 32n) === 32n) return "";
  const roles = member.roles || [];
  const channel = String(i.channel_id || "");
  const parent = String((i.channel && i.channel.parent_id) || "");
  const inList = (list) => list.includes(channel) || (parent && list.includes(parent));
  if (rule.denyRoles.length && roles.some((r) => rule.denyRoles.includes(r))) return "❌ Ton rôle ne permet pas d'utiliser cette commande.";
  if (rule.allowRoles.length && !roles.some((r) => rule.allowRoles.includes(r))) return `❌ Cette commande est réservée à : ${rule.allowRoles.map((r) => `<@&${r}>`).join(", ")}.`;
  if (rule.denyChannels.length && inList(rule.denyChannels)) return "❌ Cette commande n'est pas utilisable dans ce salon.";
  if (rule.allowChannels.length && !inList(rule.allowChannels)) return `❌ Cette commande s'utilise dans : ${rule.allowChannels.map((c) => `<#${c}>`).join(", ")}.`;
  if (rule.cooldown) {
    const user = (member.user && member.user.id) || (i.user && i.user.id) || "";
    const key = `${name}:${user}`;
    const last = cooldowns.get(key);
    if (last != null && now - last < rule.cooldown * 1000) return `⏳ Attends encore un peu : tu pourras la refaire <t:${Math.ceil((last + rule.cooldown * 1000) / 1000)}:R>.`;
    cooldowns.set(key, now);
    if (cooldowns.size > 5000) cooldowns.delete(cooldowns.keys().next().value);
  }
  return "";
}

// ---- answers dressed the same way ----

export const COLORS = { success: 0x57f287, error: 0xed4245, sanction: 0xf0b232, info: 0x5865f2, wait: 0xfee75c };
const SANCTION = /^(⚠️|🔇|👢|🔨|⏳🔨)/u;

/** The kind of an answer from its text: an error, a sanction (it has a case number), a delay, or a success. */
export function kindOf(text) {
  const t = String(text || "").trim();
  if (/^❌/u.test(t)) return "error";
  if (/^⏳/u.test(t) && !/cas #/.test(t)) return "wait";
  if (SANCTION.test(t) || /\(cas #\d+/.test(t)) return "sanction";
  return "success";
}

/**
 * A command's answer as an embed of the kind's colour: the text as its description, the case number as a field, the time.
 * Answers that already have embeds or buttons (a confirmation, a list) are left as they are. Pure.
 */
export function dress(out, now = Date.now()) {
  if (!out || typeof out.content !== "string" || !out.content.trim() || (out.embeds && out.embeds.length) || (out.components && out.components.length)) return out;
  const kind = kindOf(out.content);
  const caseId = (out.content.match(/cas #(\d+)/) || [])[1];
  const titles = { error: "Impossible", wait: "Patiente un peu", sanction: "Sanction appliquée", success: "C'est fait" };
  const { content, ...rest } = out;
  return {
    ...rest,
    content: "",
    embeds: [{
      color: COLORS[kind],
      author: { name: titles[kind] },
      description: content.slice(0, 4000),
      ...(caseId ? { fields: [{ name: "Cas", value: `#${caseId}`, inline: true }, { name: "Quand", value: `<t:${Math.floor(now / 1000)}:R>`, inline: true }] } : {}),
      timestamp: new Date(now).toISOString(),
    }],
    allowed_mentions: { parse: [] },
  };
}

// ---- /help with a menu ----

// a plausible value for each option, for the examples
const SAMPLE = {
  user: "@membre", reason: "Spam", duration: "1h", in: "30m", id: "12", amount: "20", seconds: "10", channel: "#annonces", role: "@Membre", role1: "@Fnatic", role2: "@Vitality",
  text: "Bonjour à tous", title: "Annonce", message: "Finale ce soir !", subject: "Problème de compte", name: "support-alice", level: "haute", nickname: "Alice", question: "Qui gagne ?",
  choices: "Fnatic ; Vitality", prize: "Un maillot", winners: "1", equipe: "Fnatic", nom: "Fnatic", joueur: "Boaster", joueur1: "Boaster", joueur2: "Derke", equipe1: "Fnatic", equipe2: "Team Heretics",
  tournoi: "Stage 1", stat: "rating", agent: "Jett", agent1: "Jett", agent2: "Raze", code: "ABC123", match: "Fnatic vs Vitality", action: "lock", user_id: "123456789012345678", template: "Règlement",
  contains: "discord.gg", jour: "demain", region: "EMEA", format: "3", portee: "serveur", staff_role: "@Staff", delete_messages: "1", color: "#ff4655",
};
const example = (path, options) => `/${path}${(options || []).filter((o) => o.required || ["reason", "duration"].includes(o.name)).map((o) => ` ${o.name}:${SAMPLE[o.name] || "…"}`).join("")}`;

/**
 * /help: the categories as a menu (custom_id "hp"), the chosen one's commands with their description and an example.
 * groups: [[label, emoji, [names]]] (lib/discordbot.js HELP_GROUPS); commands: what Discord is given (grouped). Pure.
 */
export function helpPayload(commands, groups, { category = -1, disabled = [], color = 0xc9f03c, site = "" } = {}) {
  const shown = commands.filter((c) => !c.type && !disabled.includes(c.name));
  // a grouped command counts in the category of its first subcommand's inner name
  const innerOf = (c) => (GROUPS[c.name] ? Object.values(GROUPS[c.name].subs) : [RENAMED_SITE[c.name] || c.name]);
  const cats = groups.map(([label, names]) => ({ label, list: shown.filter((c) => innerOf(c).some((n) => names.includes(n))) })).filter((g) => g.list.length);
  const rest = shown.filter((c) => !cats.some((g) => g.list.includes(c)));
  if (rest.length) cats.push({ label: "➕ Autres", list: rest });
  const lines = (c) => (c.options || []).some((o) => o.type === 1)
    ? c.options.filter((o) => o.type === 1).map((s) => `**/${c.name} ${s.name}** · ${s.description}\n↳ \`${example(`${c.name} ${s.name}`, s.options)}\``)
    : [`**/${c.name}** · ${c.description}\n↳ \`${example(c.name, c.options)}\``];
  const cur = cats[category];
  const embed = cur
    ? { title: cur.label, description: cur.list.flatMap(lines).join("\n").slice(0, 4000), color, footer: { text: "Les options entre deux-points se remplissent avec les suggestions de Discord." } }
    : { title: "Commandes du bot", description: `Choisis une catégorie dans le menu ci-dessous.\n\n${cats.map((g) => `${g.label} · ${g.list.length} commande${g.list.length > 1 ? "s" : ""}`).join("\n")}${site ? `\n\nTout se règle sur ${site.replace(/^https?:\/\//, "")}.` : ""}`, color };
  return {
    flags: 64,
    embeds: [embed],
    components: [{ type: 1, components: [{ type: 3, custom_id: "hp", placeholder: "Choisis une catégorie", options: cats.slice(0, 25).map((g, k) => {
      const [emoji, ...words] = g.label.split(" ");
      return { label: words.join(" ").slice(0, 100) || g.label, value: String(k), emoji: { name: emoji }, description: `${g.list.length} commande${g.list.length > 1 ? "s" : ""}`, default: k === category };
    }) }] }],
  };
}

// ---- the variables of the messages written in the editor ----

/** The variables the editor offers, with what they become in the preview. */
export const VARIABLES = [
  ["{user}", "mentionne le membre", "@Alice"], ["{user.name}", "son pseudo", "Alice"], ["{user.id}", "son identifiant", "123456789012345678"],
  ["{server}", "le nom du serveur", "VCT EMEA"], ["{membercount}", "le nombre de membres", "1 234"], ["{inviter}", "qui l'a invité", "@Bob"],
];

/** {user}, {user.name}, {user.id}, {server}, {membercount}, {inviter}, and the former French ones ({membre}, {pseudo}, {serveur}, {nombre}). Pure. */
export function fillVars(tpl, { userId = "", name = "", guild = "", count = "", inviter = "" } = {}) {
  const n = count === "" || count == null ? "" : Number(count).toLocaleString("fr-FR");
  return String(tpl || "")
    .replace(/\{user\.name\}|\{pseudo\}/g, name)
    .replace(/\{user\.id\}/g, userId)
    .replace(/\{user\}|\{membre\}/g, userId ? `<@${userId}>` : name)
    .replace(/\{server\}|\{serveur\}/g, guild)
    .replace(/\{membercount\}|\{nombre\}/g, n)
    .replace(/\{inviter\}/g, inviter ? `<@${inviter}>` : "—");
}

// ---- embeds built in the editor (templates for /embed, the panels) ----

const hex = (c, dflt) => (/^#?[0-9a-f]{6}$/i.test(String(c || "")) ? `#${String(c).replace("#", "").toLowerCase()}` : dflt);
const url = (u) => (/^https:\/\/\S+$/i.test(String(u || "")) ? String(u).slice(0, 500) : "");
const str = (v, max) => String(v ?? "").slice(0, max);

/** One embed as the editor builds it: { name?, title, text, color, image, fields: [{ name, value, inline }] }. Pure. */
export function cleanEmbed(e = {}, dflt = {}) {
  return {
    ...(e.name !== undefined || dflt.name !== undefined ? { name: str(e.name ?? dflt.name, 40).trim() } : {}),
    title: str(e.title ?? dflt.title ?? "", 256),
    text: str(e.text ?? dflt.text ?? "", 4000),
    color: hex(e.color, dflt.color || "#ff4655"),
    image: url(e.image ?? dflt.image),
    fields: (Array.isArray(e.fields) ? e.fields : dflt.fields || []).map((f) => ({ name: str(f && f.name, 256).trim(), value: str(f && f.value, 1024).trim(), inline: !!(f && f.inline) })).filter((f) => f.name && f.value).slice(0, 10),
  };
}

/** The embed Discord is sent, variables filled. Pure. */
export function toDiscordEmbed(e, vars = {}) {
  const f = (s) => fillVars(s, vars);
  return {
    ...(e.title ? { title: f(e.title) } : {}),
    ...(e.text ? { description: f(e.text).replace(/\\n/g, "\n") } : {}),
    color: parseInt(String(e.color || "#ff4655").replace("#", ""), 16),
    ...(e.image ? { image: { url: e.image } } : {}),
    ...(e.fields && e.fields.length ? { fields: e.fields.map((x) => ({ name: f(x.name), value: f(x.value), inline: x.inline })) } : {}),
  };
}

/** Suggestions for /embed's template option: the editor's saved embeds whose name matches. */
export const templateSuggestions = (typed, list) => (list || []).filter((t) => !typed || t.name.toLowerCase().includes(String(typed).toLowerCase())).slice(0, 25).map((t) => ({ name: t.name, value: t.name }));
