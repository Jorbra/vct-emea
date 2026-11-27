// What the bot's dashboard in the editor reads and does beyond the settings (app/api/bot/route.js): the sanctions' table
// (search, a case's reason changed, a sanction revoked), the tickets' list and transcripts, the log with filters, the
// bot's own permissions on the server (for the modules' states), the names of the members the tables show.
import { addSanction } from "./botserver.js";
import { failText } from "./botfail.js";

const KINDS = ["warn", "timeout", "kick", "ban", "tempban", "unban", "note"];

/**
 * The sanctions of the server, newest first, filtered: q (a member's or moderator's id or name, a reason's words, "#12"),
 * kind, from / to (dates "2026-11-01"). names: id → name, to search by name too. Returns at most `limit` rows. Pure but for db.
 */
export function listCases(db, guild, { q = "", kind = "", from = "", to = "", limit = 200 } = {}, names = {}) {
  const rows = db.prepare("SELECT id, user, kind, mod, reason, at, until, done FROM bot_sanctions WHERE guild = ? ORDER BY id DESC LIMIT 2000").all(guild);
  const query = String(q || "").trim().toLowerCase();
  const num = (query.match(/^#?(\d{1,9})$/) || [])[1];
  return rows.filter((r) => {
    if (kind && r.kind !== kind) return false;
    if (from && r.at < from) return false;
    if (to && r.at.slice(0, 10) > to) return false;
    if (!query) return true;
    if (num && String(r.id) === num) return true;
    return [r.user, r.mod, r.reason, names[r.user] || "", names[r.mod] || ""].some((x) => String(x).toLowerCase().includes(query));
  }).slice(0, limit).map((r) => ({ ...r, active: activeOf(r) }));
}

/** Is this sanction still running? (a time-out or temporary ban not over, a ban not lifted) */
export function activeOf(r, now = Date.now()) {
  if (r.kind === "ban") return !r.done;
  if ((r.kind === "timeout" || r.kind === "tempban") && r.until) return !r.done && Date.parse(r.until) > now;
  return r.kind === "warn";
}

/** A case's reason, changed from the editor. Returns { ok, message } or { ok: false, error }. */
export function setCaseReason(db, guild, id, reason, who = "éditeur") {
  const r = db.prepare("SELECT id FROM bot_sanctions WHERE guild = ? AND id = ?").get(guild, Number(id));
  if (!r) return { ok: false, error: `Pas de cas n°${id} sur ce serveur.` };
  const text = String(reason || "").trim().slice(0, 400);
  if (!text) return { ok: false, error: "Écris la nouvelle raison." };
  db.prepare("UPDATE bot_sanctions SET reason = ? WHERE id = ?").run(`${text} (modifiée par ${who})`.slice(0, 400), r.id);
  return { ok: true, message: `Raison du cas #${r.id} modifiée.` };
}

/**
 * Revokes a sanction from the editor: a ban or temporary ban lifted, a time-out lifted, a warning removed (as /warn remove).
 * The reason is written in Discord's audit log, the act in the bot's log and the moderation log channel.
 * deps: { db, discord, guild, who, logBot, notify }. Returns { ok, message } or { ok: false, error }.
 */
export async function revokeCase(deps, id) {
  const { db, discord, guild, who = "éditeur", logBot = () => {}, notify = async () => {}, now = Date.now() } = deps;
  const r = db.prepare("SELECT * FROM bot_sanctions WHERE guild = ? AND id = ?").get(guild, Number(id));
  if (!r) return { ok: false, error: `Pas de cas n°${id} sur ce serveur.` };
  const audit = `Cas #${r.id} révoqué depuis l'éditeur du site par ${who}`;
  try {
    if (r.kind === "warn") {
      db.prepare("DELETE FROM bot_sanctions WHERE id = ?").run(r.id);
    } else if (r.kind === "ban" || r.kind === "tempban") {
      if (r.done) return { ok: false, error: "Ce bannissement est déjà levé." };
      await discord("DELETE", `/guilds/${guild}/bans/${r.user}`, null, { reason: audit });
      db.prepare("UPDATE bot_sanctions SET done = ? WHERE id = ?").run(new Date(now).toISOString(), r.id);
      addSanction(db, { guild, user: r.user, kind: "unban", mod: "editor", reason: audit, at: now });
    } else if (r.kind === "timeout") {
      if (r.done || !r.until || Date.parse(r.until) <= now) return { ok: false, error: "Cette exclusion est déjà finie." };
      await discord("PATCH", `/guilds/${guild}/members/${r.user}`, { communication_disabled_until: null }, { reason: audit });
      db.prepare("UPDATE bot_sanctions SET done = ? WHERE id = ?").run(new Date(now).toISOString(), r.id);
    } else {
      return { ok: false, error: "Ce type de sanction ne se révoque pas (une expulsion est déjà faite ; une note se garde)." };
    }
  } catch (e) {
    if (e && e.code === 10026) return { ok: false, error: "Discord : cet utilisateur n'est plus banni." };
    if (e && (e.code === 50013 || e.status === 403)) return { ok: false, error: "Discord refuse : le bot n'a pas la permission, ou son rôle est sous celui du membre." };
    return { ok: false, error: failText(e) };
  }
  const what = { warn: "avertissement retiré", ban: "bannissement levé", tempban: "bannissement temporaire levé", timeout: "exclusion levée" }[r.kind];
  try { logBot(db, "moderation", `cas #${r.id} · ${what} (<@${r.user}>) depuis l'éditeur`, true, now); } catch { /* the log is a convenience */ }
  await Promise.resolve(notify(`**Éditeur du site** (${who}) · cas #${r.id} : ${what} pour <@${r.user}>`)).catch(() => {});
  return { ok: true, message: `Cas #${r.id} : ${what}.` };
}

/** The tickets, newest first: state "open" | "closed" | "", q (subject, author, category). Without their transcripts. */
export function listTickets(db, guild, { state = "", q = "", limit = 200 } = {}, names = {}) {
  const query = String(q || "").trim().toLowerCase();
  return db.prepare("SELECT thread, user, subject, opened, closed, category, priority, claimed, reason, first_reply, rating, details, length(transcript) AS size FROM bot_tickets WHERE guild = ? ORDER BY opened DESC LIMIT 2000").all(guild)
    .filter((t) => (state === "open" ? !t.closed : state === "closed" ? !!t.closed : true))
    .filter((t) => !query || [t.subject, t.category, t.user, names[t.user] || "", t.details].some((x) => String(x || "").toLowerCase().includes(query)))
    .slice(0, limit);
}

export const ticketTranscript = (db, guild, thread) => (db.prepare("SELECT transcript FROM bot_tickets WHERE guild = ? AND thread = ?").get(guild, String(thread)) || {}).transcript || "";

/** The bot's log, filtered: kind, errors only, words. */
export function filterLog(db, { kind = "", errors = false, q = "", limit = 300 } = {}) {
  const query = String(q || "").trim().toLowerCase();
  return db.prepare("SELECT at, kind, text, ok FROM bot_log ORDER BY id DESC LIMIT 3000").all()
    .filter((r) => (!kind || r.kind === kind) && (!errors || !r.ok) && (!query || r.text.toLowerCase().includes(query)))
    .slice(0, limit).map((r) => ({ ...r, ok: !!r.ok }));
}

const nameCache = (globalThis.__botNames ||= new Map()); // id → { name, at }

/** The names of members shown in the tables (Discord, kept an hour; 30 asked at most per call). Never throws. */
export async function userNames(discord, ids) {
  const out = {};
  const wanted = [...new Set(ids.filter((x) => /^\d{5,25}$/.test(String(x))))];
  let asked = 0;
  for (const id of wanted) {
    const kept = nameCache.get(id);
    if (kept && Date.now() - kept.at < 3600000) { out[id] = kept.name; continue; }
    if (asked >= 30) continue;
    asked += 1;
    try {
      const u = await discord("GET", `/users/${id}`);
      const name = u.global_name || u.username || id;
      nameCache.set(id, { name, at: Date.now() });
      out[id] = name;
    } catch { /* unknown */ }
  }
  return out;
}

/** The bot's permissions on the server (a number in a string): its roles' and @everyone's, all of them for an administrator. */
export async function botPermissions(discord, guild, botId) {
  const [member, roles] = await Promise.all([discord("GET", `/guilds/${guild}/members/${botId}`), discord("GET", `/guilds/${guild}/roles`)]);
  let p = 0n;
  for (const r of roles) if (r.id === guild || (member.roles || []).includes(r.id)) p |= BigInt(r.permissions || 0);
  return String(p);
}

export { KINDS as CASE_KINDS };

/**
 * A sanction given from the editor (a member's file): "warn" (with the escalation the settings ask for, as /warn add),
 * "timeout" (duration "10m", "2h", "1d"; 28 days at most), "untimeout", "kick" or "ban" (deleteDays: their messages of the
 * last 0, 1 or 7 days removed). A kick or ban needs a reason; the private message goes before, while the bot can still write. The member gets the usual private message, the
 * act goes to the bot's log and the moderation log channel, and the audit log says it came from the site.
 * deps: { db, discord, server, guild, who, logBot, notify, guildName }. Returns { ok, message } or { ok: false, error }.
 */
export async function editorSanction(deps, { user, kind, reason = "", duration = "", deleteDays = 0 }) {
  const { db, discord, guild, who = "éditeur", logBot = () => {}, notify = async () => {}, now = Date.now() } = deps;
  const { afterWarn, formatDuration, parseDuration, sendSanctionDm } = await import("./botmod3.js");
  if (!/^\d{5,25}$/.test(String(user || ""))) return { ok: false, error: "Membre inconnu." };
  const why = String(reason || "").trim().slice(0, 300);
  const audit = `${why || "Sans raison"} · depuis l'éditeur du site par ${who}`.slice(0, 400);
  const stamp = why ? `${why} (${who}, depuis le site)` : `(${who}, depuis le site)`;
  try {
    if (kind === "warn") {
      if (!why) return { ok: false, error: "Écris la raison de l'avertissement." };
      const caseId = addSanction(db, { guild, user, kind: "warn", mod: "editor", reason: stamp, at: now });
      await sendSanctionDm(deps, user, { action: "warn", guildName: deps.guildName, reason: why, caseId });
      const step = await afterWarn({ ...deps, now }, guild, user);
      try { logBot(db, "moderation", `<@${user}> averti depuis l'éditeur (cas #${caseId}) : ${why}`, true, now); } catch { /* none */ }
      await Promise.resolve(notify(`**Éditeur du site** (${who}) · ⚠️ avertissement pour <@${user}> (cas #${caseId}) : ${why}`)).catch(() => {});
      return { ok: true, message: `⚠️ Avertissement donné (cas #${caseId}).${step ? ` ${step.replace(/\*\*/g, "")}` : ""}` };
    }
    if (kind === "timeout" || kind === "untimeout") {
      const secs = kind === "untimeout" ? 0 : parseDuration(String(duration || "").trim().toLowerCase());
      if (secs === null || (kind === "timeout" && !secs)) return { ok: false, error: "Durée illisible : écris par exemple 10m, 2h ou 1d." };
      if (secs > 2419200) return { ok: false, error: "Discord limite une exclusion à 28 jours." };
      const until = secs ? new Date(now + secs * 1000).toISOString() : null;
      await discord("PATCH", `/guilds/${guild}/members/${user}`, { communication_disabled_until: until }, { reason: audit });
      const caseId = addSanction(db, { guild, user, kind: secs ? "timeout" : "untimeout", mod: "editor", reason: stamp, at: now, until: until || "" });
      if (secs) await sendSanctionDm(deps, user, { action: "timeout", guildName: deps.guildName, reason: why, duration: secs, caseId });
      const what = secs ? `exclu ${formatDuration(secs)}` : "exclusion levée";
      try { logBot(db, "moderation", `<@${user}> ${what} depuis l'éditeur (cas #${caseId})${why ? ` : ${why}` : ""}`, true, now); } catch { /* none */ }
      await Promise.resolve(notify(`**Éditeur du site** (${who}) · ${secs ? "🔇" : "🔊"} <@${user}> ${what} (cas #${caseId})${why ? ` : ${why}` : ""}`)).catch(() => {});
      return { ok: true, message: secs ? `🔇 Membre exclu ${formatDuration(secs)} (cas #${caseId}).` : `🔊 Exclusion levée (cas #${caseId}).` };
    }
    if (kind === "kick" || kind === "ban") {
      if (!why) return { ok: false, error: `Écris la raison ${kind === "ban" ? "du bannissement" : "de l'expulsion"}.` };
      const caseId = addSanction(db, { guild, user, kind, mod: "editor", reason: stamp, at: now });
      // the member is told first: once out, the bot can no longer write to them
      await sendSanctionDm(deps, user, { action: kind, guildName: deps.guildName, reason: why, caseId });
      try {
        if (kind === "kick") await discord("DELETE", `/guilds/${guild}/members/${user}`, null, { reason: `${audit} (cas #${caseId})` });
        else await discord("PUT", `/guilds/${guild}/bans/${user}`, { delete_message_seconds: [0, 1, 7].includes(Number(deleteDays)) ? Number(deleteDays) * 86400 : 0 }, { reason: `${audit} (cas #${caseId})` });
      } catch (e) {
        // Discord refused: the case is taken back, nothing was done
        db.prepare("DELETE FROM bot_sanctions WHERE id = ?").run(caseId);
        throw e;
      }
      const what = kind === "ban" ? "banni" : "expulsé";
      try { logBot(db, "moderation", `<@${user}> ${what} depuis l'éditeur (cas #${caseId}) : ${why}`, true, now); } catch { /* none */ }
      await Promise.resolve(notify(`**Éditeur du site** (${who}) · ${kind === "ban" ? "🔨" : "👢"} <@${user}> ${what} (cas #${caseId}) : ${why}`)).catch(() => {});
      return { ok: true, message: `${kind === "ban" ? "🔨 Membre banni" : "👢 Membre expulsé"} (cas #${caseId}).` };
    }
    return { ok: false, error: "Action inconnue." };
  } catch (e) {
    return { ok: false, error: failText(e) };
  }
}
