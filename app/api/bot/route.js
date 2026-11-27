import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { BOT_RIGHTS } from "../../../lib/botmod.js";
import { botServer, saveBotServer, syncAutomod } from "../../../lib/botserver.js";
import { gatewayState } from "../../../lib/botgateway.js";
import { ticketStats } from "../../../lib/botmod3.js";
import { APP_ID, botGuilds, botReady, discord, guildChannels, guildRoles, postMessage, registerCommands } from "../../../lib/botapi.js";
import { botLog, botSettings, botUsage, cancelScheduled, logBot, saveBotSettings, scheduleAnnouncement, scheduledList } from "../../../lib/botstore.js";
import { botTest, pinnedEmbed, updatePinned } from "../../../lib/botnotify.js";
import { getState } from "../../../lib/db.js";
import { COMMANDS, HELP_GROUPS } from "../../../lib/discordbot.js";
import { GROUPS, OLD_TO_NEW, RENAMED_SITE, cleanEmbed, cleanRules, toDiscordEmbed } from "../../../lib/botdash.js";
import { botPermissions, filterLog, listCases, listTickets, revokeCase, setCaseReason, ticketTranscript, userNames } from "../../../lib/botadmin.js";
import { postLog } from "../../../lib/botserver.js";

/** The commands by category for the editor's "Commands" page: [{ label, list: [{ name, description, subs, perm }] }]. */
function commandCategories() {
  const inner = (c) => (GROUPS[c.name] ? Object.values(GROUPS[c.name].subs) : [RENAMED_SITE[c.name] || c.name]);
  const shown = COMMANDS.map((c) => ({ name: c.name, description: c.description, type: c.type || 1, perm: c.default_member_permissions || "", subs: (c.options || []).filter((o) => o.type === 1).map((o) => ({ name: o.name, description: o.description })), inner: inner(c) }));
  const cats = HELP_GROUPS.map(([label, , names]) => ({ label, list: shown.filter((c) => c.type === 1 && c.inner.some((n) => names.includes(n))) })).filter((g) => g.list.length);
  const rest = shown.filter((c) => c.type === 1 && !cats.some((g) => g.list.includes(c)));
  if (rest.length) cats.push({ label: "➕ Autres", list: rest });
  cats.push({ label: "🖱️ Clic droit", list: shown.filter((c) => c.type !== 1) });
  return cats;
}
import { EVENT_NAMES } from "../../../lib/paths.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

/** An example of what the bot posts, made with a real match: { content?, embeds?, poll? }. */
async function sampleOf(db, kind, lang) {
  const { allMatches } = await import("../../../lib/matchlist.js");
  const { alertText, announcements } = await import("../../../lib/discord.js");
  const { dailyEmbed } = await import("../../../lib/botnotify.js");
  const { liveEmbed, pollPayload } = await import("../../../lib/botextra.js");
  const state = getState(db);
  const all = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name);
  const done = all.filter((m) => m.sa != null).sort((x, y) => (y.at || "").localeCompare(x.at || ""))[0];
  const next = all.filter((m) => m.sa == null).sort((x, y) => (x.at || "9").localeCompare(y.at || "9"))[0] || done;
  const base = (m) => ({ teams: [], url: `/match/${m.event}/${m.id}`, event: m.event, a: m.a.name, b: m.b.name, bo: m.bo });
  if (kind === "start" && next) return { content: alertText({ ...base(next), kind: "live" }, lang) };
  if (kind === "result" && done) return { content: alertText({ ...base(done), kind: "result", sa: done.sa, sb: done.sb, note: done.note || null }, lang) };
  if (kind === "reminder" && next) return { content: `⏰ ${lang === "en" ? "In 15 min" : "Dans 15 min"} : **${next.a.name}** vs **${next.b.name}** · ${next.event}` };
  if (kind === "daily") { const e = dailyEmbed(state, lang, done && done.at ? new Date(done.at).getTime() : Date.now()); return e ? { embeds: [e] } : null; }
  if (kind === "live" && (next || done)) { const m = next || done; return { embeds: [liveEmbed(m, { a: 1, b: 0, maps: [{ map: "Lotus", a: 13, b: 9, done: true }, { map: "Bind", a: 7, b: 5 }] }, lang)] }; }
  if (kind === "poll" && next) { const at = new Date(Date.now() + 2 * 3600000).toISOString(); return pollPayload({ ...next, at }, lang); }
  void announcements;
  return null;
}

/** Editors only. GET: the bot's settings, its use, and the servers, channels and roles to pick from. */
export async function GET(req) {
  if (!(await currentEditor())) return unauthorised();
  const db = getDb();
  const settings = botSettings(db);
  const guild = new URL(req.url).searchParams.get("guild") || settings.guild;
  const out = {
    settings, usage: botUsage(db), commands: COMMANDS.map((c) => ({ name: c.name, description: c.description })), events: EVENT_NAMES,
    pinPreview: pinnedEmbed(getState(db), settings.lang), registered: null, log: botLog(db), scheduled: scheduledList(db),
    // the link that gives the bot the rights its server commands need (lib/botmod.js), on a server it is already in too
    invite: `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot%20applications.commands&permissions=${BOT_RIGHTS}`,
    // the server settings (moderation log, welcome, AutoMod, tickets) and the live connection's state (lib/botgateway.js)
    server: botServer(db), gateway: gatewayState(), ticketStats: ticketStats(db),
    // the dashboard: the commands by category, what the former ones became, the bot's permissions on the server (modules' states)
    commandCats: commandCategories(), oldToNew: OLD_TO_NEW, botPerms: null,
    token: botReady(), publicKey: /^[0-9a-f]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY || ""), guilds: [], channels: [], roles: [], error: "",
  };
  if (out.token) {
    try {
      out.guilds = await botGuilds();
      // which commands Discord has: those missing need "Register the commands"
      try { out.registered = (await discord("GET", `/applications/${APP_ID}/commands`)).map((c) => c.name); } catch { out.registered = null; }
      const g = guild || (out.guilds.length === 1 ? out.guilds[0].id : "");
      if (g) [out.channels, out.roles] = await Promise.all([guildChannels(g), guildRoles(g)]);
      if (g) { try { out.botPerms = await botPermissions(discord, g, APP_ID); } catch { out.botPerms = null; } }
      out.guild = g;
    } catch (e) {
      out.error = e.status === 401 ? "Discord refuses the token on Vercel: reset it in the Bot tab and put the new one in DISCORD_BOT_TOKEN." : e.message;
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}

/** POST { action: "save", ...settings } | { action: "test" } | { action: "register" }. */
export async function POST(req) {
  if (!(await currentEditor())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.action === "test") {
    const r = await botTest(db);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.status });
  }
  if (b.action === "sample" || b.action === "testkind") {
    const s = (await import("../../../lib/botstore.js")).botSettings(db);
    const sample = await sampleOf(db, String(b.kind || "start"), s.lang);
    if (!sample) return NextResponse.json({ error: "No match to make this example with yet." }, { status: 404 });
    if (b.action === "sample") return NextResponse.json({ ok: true, sample });
    if (!botReady() || !s.channel) return NextResponse.json({ error: "Choose a channel first." }, { status: 400 });
    try {
      const payload = sample.poll ? { poll: sample.poll } : { content: sample.content ? `[TEST] ${sample.content}` : "[TEST]", embeds: sample.embeds || [], allowed_mentions: { parse: [] } };
      await postMessage(s.channel, payload);
      logBot(db, "test", String(b.kind));
      return NextResponse.json({ ok: true, message: "Test message sent." });
    } catch (e) {
      return NextResponse.json({ error: `Discord: ${e.message}` }, { status: 502 });
    }
  }
  if (b.action === "unschedule") return reply(cancelScheduled(db, b.id));
  // ---- the dashboard's pages ----
  const guildOf = () => (b.guild && /^\d{5,25}$/.test(String(b.guild)) ? String(b.guild) : (botSettings(db).guild || ""));
  const namesFor = async (ids) => (botReady() ? userNames(discord, ids) : {});
  if (b.action === "cases") {
    const guild = guildOf();
    const raw = listCases(db, guild, { kind: b.kind, from: b.from, to: b.to, limit: 2000 });
    const names = await namesFor(raw.slice(0, 200).flatMap((r) => [r.user, r.mod]));
    return NextResponse.json({ ok: true, cases: listCases(db, guild, { q: b.q, kind: b.kind, from: b.from, to: b.to }, names), names });
  }
  if (b.action === "case-reason") {
    const me = await currentEditor();
    const r = setCaseReason(db, guildOf(), b.id, b.reason, me.who || "éditeur");
    if (r.ok) logBot(db, "moderation", `cas #${b.id} · raison modifiée depuis l'éditeur`);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (b.action === "case-revoke") {
    if (!botReady()) return NextResponse.json({ error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." }, { status: 409 });
    const me = await currentEditor();
    const server = botServer(db);
    const r = await revokeCase({ db, discord, guild: guildOf(), who: me.who || "éditeur", logBot, notify: (text) => postLog(discord, server, { kind: "bot", title: "🛡️ Action depuis l'éditeur", lines: [text], at: Date.now() }) }, b.id);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (b.action === "tickets") {
    const guild = guildOf();
    const all = listTickets(db, guild, { state: b.state });
    const names = await namesFor(all.slice(0, 150).flatMap((t) => [t.user, t.claimed]));
    return NextResponse.json({ ok: true, tickets: listTickets(db, guild, { state: b.state, q: b.q }, names), names, stats: ticketStats(db) });
  }
  if (b.action === "ticket") return NextResponse.json({ ok: true, transcript: ticketTranscript(db, guildOf(), b.thread) });
  if (b.action === "log") return NextResponse.json({ ok: true, log: filterLog(db, { kind: b.kind, errors: !!b.errors, q: b.q }), kinds: db.prepare("SELECT DISTINCT kind FROM bot_log ORDER BY kind").all().map((r) => r.kind) });
  // the "Commands" page: which are on, and each one's rules
  if (b.action === "commands") {
    const settings = saveBotSettings(db, { disabled: Array.isArray(b.disabled) ? b.disabled : undefined }).settings;
    const server = saveBotServer(db, { commandRules: cleanRules(b.rules) });
    return NextResponse.json({ ok: true, message: "Commandes enregistrées.", settings, server });
  }
  // a module's switch on the home page
  if (b.action === "module") {
    const cur = botServer(db);
    const next = saveBotServer(db, { modules: { ...cur.modules, [String(b.key)]: !!b.on } });
    // AutoMod: the bot's rules taken away or put back at once
    if (b.key === "automod" && botReady() && botSettings(db).guild) { try { await syncAutomod(discord, botSettings(db).guild, next); } catch { /* said on the next save */ } }
    return NextResponse.json({ ok: true, message: `Module ${b.on ? "activé" : "désactivé"}.`, server: next });
  }
  if (b.action === "announce") {
    const s = (await import("../../../lib/botstore.js")).botSettings(db);
    const text = String(b.text || "").trim().slice(0, 1900);
    const channel = /^\d{5,25}$/.test(String(b.channel || "")) ? String(b.channel) : s.channel;
    if (!botReady()) return NextResponse.json({ error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." }, { status: 409 });
    if (!channel) return NextResponse.json({ error: "Choose a channel first." }, { status: 400 });
    if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
    const mention = b.mention && s.role ? `<@&${s.role}> ` : "";
    // the embed built in the editor (title, text, colour, image, fields), {server} filled in
    const embed = b.embed ? toDiscordEmbed(cleanEmbed({ title: b.title, text, color: b.color, image: b.image, fields: b.fields }), { guild: gatewayState().guildName || "" }) : null;
    const payload = embed ? { content: mention || undefined, embeds: [embed], allowed_mentions: { parse: [], roles: mention ? [s.role] : [] } } : { content: mention + text.replace(/{server}/g, gatewayState().guildName || ""), allowed_mentions: { parse: [], roles: mention ? [s.role] : [] } };
    if (b.at) {
      const me = await currentEditor();
      return reply(scheduleAnnouncement(db, { at: b.at, channel, payload, label: (String(b.title || "") || text).slice(0, 120), who: me.who || "main" }));
    }
    try {
      logBot(db, "annonce", (String(b.title || "") || text).slice(0, 120));
      await postMessage(channel, payload);
      return NextResponse.json({ ok: true, message: "Announcement sent." });
    } catch (e) {
      return NextResponse.json({ error: e.code === 50013 || e.code === 50001 ? "The bot cannot post in this channel: give it the right to see the channel and send messages." : `Discord: ${e.message}` }, { status: 502 });
    }
  }
  if (b.action === "pin-now") {
    if (!botReady()) return NextResponse.json({ error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." }, { status: 409 });
    globalThis.__botPinAt = 0;
    db.prepare("UPDATE kv SET value = json_set(value, '$.hash', '') WHERE key = 'bot_pin'").run();
    try {
      const done = await updatePinned(db, getState(db));
      return NextResponse.json({ ok: true, message: done ? "Pinned message updated." : "Choose the pinned message's channel first." });
    } catch (e) {
      return NextResponse.json({ error: `Discord: ${e.message}` }, { status: 502 });
    }
  }
  // the server settings: saved, then Discord's AutoMod rules put in line with them
  if (b.action === "server") {
    const next = saveBotServer(db, b.server || {});
    const guild = (await import("../../../lib/botstore.js")).botSettings(db).guild;
    if (!botReady() || !guild) return NextResponse.json({ ok: true, message: "Réglages du serveur enregistrés (les règles AutoMod seront posées une fois le bot et le serveur choisis).", server: next });
    try {
      const r = await syncAutomod(discord, guild, next);
      return NextResponse.json({ ok: true, message: `Réglages du serveur enregistrés. AutoMod : ${r.made} règle(s) créée(s), ${r.changed} mise(s) à jour, ${r.removed} retirée(s).`, server: next });
    } catch (e) {
      return NextResponse.json({ ok: true, message: `Réglages enregistrés, mais Discord refuse les règles AutoMod : ${e.message} (le bot a-t-il le droit « Gérer le serveur » ?)`, server: next });
    }
  }
  if (b.action === "register") {
    if (!botReady()) return NextResponse.json({ error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." }, { status: 409 });
    try {
      await registerCommands(COMMANDS);
      return NextResponse.json({ ok: true, message: "Commands registered." });
    } catch (e) {
      return NextResponse.json({ error: `Discord: ${e.message}` }, { status: 502 });
    }
  }
  return NextResponse.json(saveBotSettings(db, b));
}
