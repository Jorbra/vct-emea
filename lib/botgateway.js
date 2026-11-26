// The bot's live connection to Discord (the "gateway"): what happens on the server (messages sent, changed or deleted,
// members arriving, leaving or changing, bans, AutoMod's actions) comes here and goes to lib/botserver.js handleEvent
// (moderation log, welcome and goodbye, role on arrival, anti-flood). Opened once by the site's server when it starts
// (instrumentation.js), only with the bot's token and only for the server chosen in the editor.
//
// Discord asks for two "privileged" intents to be turned on in its developer portal (Bot tab): Server Members (arrivals,
// departures, nickname and role changes) and Message Content (the text of changed or deleted messages, anti-flood). Without
// them, Discord closes the connection with code 4014: the bot then connects again without them, and the editor says which
// parts are off.
import { discord, botReady, botToken } from "./botapi.js";

const GUILDS = 1 << 0;
const MEMBERS = 1 << 1; // privileged
const MODERATION = 1 << 2;
const MESSAGES = 1 << 9;
const CONTENT = 1 << 15; // privileged
const AUTOMOD_EXEC = 1 << 21;
export const FULL_INTENTS = GUILDS | MEMBERS | MODERATION | MESSAGES | CONTENT | AUTOMOD_EXEC;
export const BASIC_INTENTS = GUILDS | MODERATION | MESSAGES | AUTOMOD_EXEC;

/** The state shown in the editor: { on, since, intents, privileged, error, events }. */
export const gatewayState = () => globalThis.__vctGateway || { on: false, since: "", intents: 0, privileged: false, error: botReady() ? "Pas encore démarrée (elle démarre quelques secondes après le serveur du site)." : "Pas de jeton du bot sur ce serveur du site.", events: 0 };

/** Starts the connection once per server process (a second call does nothing). */
export function startGateway({ getDb }) {
  if (globalThis.__vctGatewayStarted) return;
  globalThis.__vctGatewayStarted = true;
  const state = { on: false, since: "", intents: FULL_INTENTS, privileged: true, error: "", events: 0 };
  globalThis.__vctGateway = state;
  if (!botReady()) { state.error = "Pas de jeton du bot sur le serveur."; return; }
  if (typeof WebSocket !== "function") { state.error = "Ce serveur n'a pas de WebSocket intégré (Node 22 ou plus est nécessaire) : modération automatique par messages, journal et bienvenue désactivés."; return; }

  let ws = null;
  let beat = null;
  let seq = null;
  let acked = true;
  let session = "";
  let resumeUrl = "";
  let tries = 0;
  const memoryP = import("./botserver.js").then((m) => ({ mod: m, memory: m.makeMemory() }));

  const stop = () => { clearInterval(beat); beat = null; try { ws && ws.close(); } catch { /* closed */ } ws = null; };
  const again = (ms) => { stop(); state.on = false; setTimeout(connect, ms).unref?.(); };

  async function onEvent(type, d) {
    state.events += 1;
    const { mod, memory } = await memoryP;
    const db = getDb();
    const { botSettings } = await import("./botstore.js");
    const guild = botSettings(db).guild;
    if (!guild) return;
    const server = mod.botServer(db);
    // the server's name and member count for the welcome text: kept from GUILD_CREATE
    if (type === "GUILD_CREATE" && d.id === guild) { state.guildName = d.name; state.memberCount = d.member_count; for (const m of d.members || []) memory.members.set(m.user.id, { nick: m.nick || "", roles: m.roles || [], until: m.communication_disabled_until || "" }); return; }
    if (type === "GUILD_MEMBER_ADD" && d.guild_id === guild) state.memberCount = (state.memberCount || 0) + 1;
    if (type === "GUILD_MEMBER_REMOVE" && d.guild_id === guild) state.memberCount = Math.max(0, (state.memberCount || 1) - 1);
    // the same event seen by two servers of the site (during a deployment) is handled once
    const { sendOnce } = await import("./botstore.js");
    const key = `gw:${type}:${d.id || (d.user && d.user.id) || ""}:${d.edited_timestamp || d.joined_at || ""}:${Math.floor(Date.now() / 10000)}`;
    if (!["MESSAGE_CREATE"].includes(type) && !sendOnce(db, key)) return;
    await mod.handleEvent(type, d, { db, discord, server, guild, memory, botId: state.botId || "", guildName: state.guildName || "", memberCount: state.memberCount || "" });
  }

  function connect() {
    const url = `${resumeUrl || "wss://gateway.discord.gg"}/?v=10&encoding=json`;
    try { ws = new WebSocket(url); } catch (e) { state.error = e.message; again(30000); return; }
    ws.onmessage = (msg) => {
      let p;
      try { p = JSON.parse(typeof msg.data === "string" ? msg.data : Buffer.from(msg.data).toString()); } catch { return; }
      if (p.s != null) seq = p.s;
      if (p.op === 10) {
        // Hello: heartbeats at Discord's pace, then identify (or resume the session cut)
        clearInterval(beat);
        acked = true;
        beat = setInterval(() => {
          if (!acked) { again(2000); return; } // no answer to the last heartbeat: the connection is dead
          acked = false;
          try { ws.send(JSON.stringify({ op: 1, d: seq })); } catch { /* closing */ }
        }, p.d.heartbeat_interval);
        beat.unref?.();
        if (session && resumeUrl) ws.send(JSON.stringify({ op: 6, d: { token: botToken(), session_id: session, seq } }));
        else ws.send(JSON.stringify({ op: 2, d: { token: botToken(), intents: state.intents, properties: { os: "linux", browser: "vct-emea", device: "vct-emea" } } }));
      } else if (p.op === 11) {
        acked = true;
      } else if (p.op === 1) {
        try { ws.send(JSON.stringify({ op: 1, d: seq })); } catch { /* closing */ }
      } else if (p.op === 7) {
        again(1000); // Discord asks to connect again (and resume)
      } else if (p.op === 9) {
        session = ""; resumeUrl = "";
        again(3000 + Math.random() * 2000);
      } else if (p.op === 0) {
        if (p.t === "READY") {
          session = p.d.session_id; resumeUrl = p.d.resume_gateway_url || ""; state.botId = p.d.user && p.d.user.id;
          state.on = true; state.since = new Date().toISOString(); state.error = state.privileged ? "" : state.error; tries = 0;
          console.log(`[gateway] connected${state.privileged ? "" : " (without the privileged intents)"}`);
        } else if (p.t === "RESUMED") {
          state.on = true; tries = 0;
        } else {
          onEvent(p.t, p.d).catch((e) => console.log(`[gateway] ${p.t}: ${e.message}`));
        }
      }
    };
    ws.onclose = (ev) => {
      state.on = false;
      const code = ev && ev.code;
      if (code === 4014 && state.privileged) {
        // the privileged intents are not turned on in Discord's portal: again without them
        state.privileged = false; state.intents = BASIC_INTENTS; session = ""; resumeUrl = "";
        state.error = "Intents privilégiés non activés dans le portail Discord (Server Members, Message Content) : arrivées, départs, pseudos, rôles, textes des messages et anti-flood désactivés.";
        again(2000);
        return;
      }
      if ([4004, 4010, 4011, 4012, 4013].includes(code)) { state.error = `Discord refuse la connexion (code ${code}).`; stop(); return; } // token or settings wrong: no retry loop
      if ([4007, 4009].includes(code)) { session = ""; resumeUrl = ""; }
      tries += 1;
      again(Math.min(60000, 2000 * 2 ** Math.min(tries, 5)));
    };
    ws.onerror = () => { /* onclose follows */ };
  }
  connect();
}

/** For the tests and the editor: the gateway is not used when DISCORD_GATEWAY is "off". */
export const gatewayWanted = () => botReady() && process.env.DISCORD_GATEWAY !== "off";
export { discord as discordApi };
