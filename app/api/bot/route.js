import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";
import { botGuilds, botReady, guildChannels, guildRoles, registerCommands } from "../../../lib/botapi.js";
import { botSettings, botUsage, saveBotSettings } from "../../../lib/botstore.js";
import { botTest } from "../../../lib/botnotify.js";
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
    token: botReady(), publicKey: /^[0-9a-f]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY || ""), guilds: [], channels: [], roles: [], error: "",
  };
  if (out.token) {
    try {
      out.guilds = await botGuilds();
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
