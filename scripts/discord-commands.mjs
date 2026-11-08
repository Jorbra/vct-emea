// Registers the bot's slash commands with Discord, once (and again after a change to lib/discordbot.js).
// Run on your computer: node scripts/discord-commands.mjs — it asks for the bot's token (Developer Portal > Bot > Reset Token).
// The token is never written anywhere: it is only sent to Discord.
import readline from "node:readline/promises";
import { COMMANDS } from "../lib/discordbot.js";

// the site's Discord application (public, not a secret); DISCORD_APP_ID can name another
const app = process.env.DISCORD_APP_ID || "1568777907721994240";
let token = (process.env.DISCORD_BOT_TOKEN || "").trim();
if (!token) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  token = (await rl.question("Colle le token du bot (onglet Bot > Reinitialiser le token), puis Entree : ")).trim();
  rl.close();
}
// a bot's token has three parts separated by dots; the "client secret" of the OAuth2 page has none
if (token.split(".").length !== 3) {
  console.log("Ce n'est pas un token de bot. Il se trouve dans l'onglet Bot > Reinitialiser le token (pas le \"Secret du client\" de la page OAuth2).");
  process.exit(1);
}
const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
console.log(res.ok
  ? `OK: ${COMMANDS.map((c) => "/" + c.name).join(", ")} enregistrees. Tape / dans un salon de ton serveur.`
  : res.status === 401 ? "Discord refuse ce token (401) : reinitialise-le dans l'onglet Bot et recommence." : `Discord a repondu ${res.status} : ${await res.text()}`);
