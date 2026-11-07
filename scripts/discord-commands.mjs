// Registers the bot's slash commands with Discord, once (and again after a change to lib/discordbot.js).
// Run on your computer: DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/discord-commands.mjs
// The token stays on your computer: it is only sent to Discord.
import { COMMANDS } from "../lib/discordbot.js";

const app = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!app || !token) {
  console.log("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN first (Discord Developer Portal > your application).");
  process.exit(1);
}
const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
console.log(res.ok ? `OK: ${COMMANDS.map((c) => "/" + c.name).join(", ")} registered.` : `Discord answered ${res.status}: ${await res.text()}`);
