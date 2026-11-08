// Discord's API with the bot's token (DISCORD_BOT_TOKEN on Vercel): posting, editing, pinning, private messages, and what the
// editor picks from (servers, channels, roles). Without the token, everything here answers "not set" and nothing is sent.
export const APP_ID = process.env.DISCORD_APP_ID || "1568777907721994240";
const API = "https://discord.com/api/v10";

export const botToken = () => String(process.env.DISCORD_BOT_TOKEN || "").trim();
export const botReady = () => botToken().split(".").length === 3;

/** One call; a 429 waits once (2 seconds at most), then gives up. Throws with Discord's code on an error. */
export async function discord(method, path, body, { token = botToken(), auth = "Bot" } = {}) {
  const go = () => fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `${auth} ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), "User-Agent": "DiscordBot (https://vct-emea.vercel.app, 1.0)" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  let res = await go();
  if (res.status === 429) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 1, 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await go();
  }
  if (res.status === 204) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error((j && j.message) || `Discord ${res.status}`), { status: res.status, code: j && j.code });
  return j;
}

export const postMessage = (channel, payload) => discord("POST", `/channels/${channel}/messages`, { allowed_mentions: { parse: [] }, ...payload });
export const editMessage = (channel, id, payload) => discord("PATCH", `/channels/${channel}/messages/${id}`, payload);
export const pinMessage = (channel, id) => discord("PUT", `/channels/${channel}/pins/${id}`);

/** A private message: the conversation is opened (or found) first. Returns its channel's id, kept by the caller. */
export async function sendDm(userId, payload, known = "") {
  const channel = known || (await discord("POST", "/users/@me/channels", { recipient_id: userId })).id;
  await postMessage(channel, payload);
  return channel;
}

/** For the editor's lists: the servers the bot is in, and a server's text channels and roles. */
export async function botGuilds() {
  return (await discord("GET", "/users/@me/guilds")).map((g) => ({ id: g.id, name: g.name }));
}
export async function guildChannels(guild) {
  return (await discord("GET", `/guilds/${guild}/channels`)).filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, name: c.name }));
}
export async function guildRoles(guild) {
  return (await discord("GET", `/guilds/${guild}/roles`)).filter((r) => r.name !== "@everyone" && !r.managed).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name }));
}

/** The slash commands, registered from the editor (the same as scripts/discord-commands.mjs). */
export const registerCommands = (commands) => discord("PUT", `/applications/${APP_ID}/commands`, commands);

/** The answer to a command that said "thinking…" first: no bot token needed, the interaction's own token is used. */
export const editOriginal = (appId, interactionToken, payload) => discord("PATCH", `/webhooks/${appId}/${interactionToken}/messages/@original`, { allowed_mentions: { parse: [] }, ...payload }, { token: "" });
