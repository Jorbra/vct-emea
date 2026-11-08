import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { APP_ID, botGuilds, botReady, discord, guildChannels, guildRoles, postMessage, registerCommands } from "../../../lib/botapi.js";
import { botSettings, botUsage, saveBotSettings } from "../../../lib/botstore.js";
import { botTest, pinnedEmbed, updatePinned } from "../../../lib/botnotify.js";
import { getState } from "../../../lib/db.js";
import { COMMANDS } from "../../../lib/discordbot.js";
import { EVENT_NAMES } from "../../../lib/paths.js";
import { badRequest, currentEditor, readBody, unauthorised } from "../../../lib/session.js";

export const dynamic = "force-dynamic";

/** Editors only. GET: the bot's settings, its use, and the servers, channels and roles to pick from. */
export async function GET(req) {
  if (!(await currentEditor())) return unauthorised();
  const db = getDb();
  const settings = botSettings(db);
  const guild = new URL(req.url).searchParams.get("guild") || settings.guild;
  const out = {
    settings, usage: botUsage(db), commands: COMMANDS.map((c) => ({ name: c.name, description: c.description })), events: EVENT_NAMES,
    pinPreview: pinnedEmbed(getState(db), settings.lang), registered: null,
    token: botReady(), publicKey: /^[0-9a-f]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY || ""), guilds: [], channels: [], roles: [], error: "",
  };
  if (out.token) {
    try {
      out.guilds = await botGuilds();
      // which commands Discord has: those missing need "Register the commands"
      try { out.registered = (await discord("GET", `/applications/${APP_ID}/commands`)).map((c) => c.name); } catch { out.registered = null; }
      const g = guild || (out.guilds.length === 1 ? out.guilds[0].id : "");
      if (g) [out.channels, out.roles] = await Promise.all([guildChannels(g), guildRoles(g)]);
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
  if (b.action === "announce") {
    const s = (await import("../../../lib/botstore.js")).botSettings(db);
    const text = String(b.text || "").trim().slice(0, 1900);
    const channel = /^\d{5,25}$/.test(String(b.channel || "")) ? String(b.channel) : s.channel;
    if (!botReady()) return NextResponse.json({ error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." }, { status: 409 });
    if (!channel) return NextResponse.json({ error: "Choose a channel first." }, { status: 400 });
    if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
    const mention = b.mention && s.role ? `<@&${s.role}> ` : "";
    try {
      await postMessage(channel, b.embed ? { content: mention || undefined, embeds: [{ description: text, color: 0xff4655, title: String(b.title || "").slice(0, 200) || undefined }], allowed_mentions: { parse: [], roles: mention ? [s.role] : [] } } : { content: mention + text, allowed_mentions: { parse: [], roles: mention ? [s.role] : [] } });
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
