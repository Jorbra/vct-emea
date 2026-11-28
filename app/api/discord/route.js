import { NextResponse, after } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { COMMANDS, answerButtons, answerCommand, autocomplete, findTeam, helpMessage, pronosticMessage, verifyDiscord, voterName } from "../../../lib/discordbot.js";
import { compareTeams } from "../../../lib/playerstats.js";
import { addReminder } from "../../../lib/more.js";
import { answerQuestion, gameRanking, guildUsers, makeQuestion, noteGuildUser, questionMessage, setFanRole } from "../../../lib/botextra.js";
import { botReady as tokenSet } from "../../../lib/botapi.js";
import { allMatches } from "../../../lib/matchlist.js";
import { botReady, editOriginal } from "../../../lib/botapi.js";
import { botSettings, countUse, dbCooldowns, discordVoter, followsOf, toggleFollow, useLinkCode } from "../../../lib/botstore.js";
import { openForPrediction, savePredictionFor } from "../../../lib/community.js";
import { seasonRanking } from "../../../lib/fans.js";
import { readFreeAgents } from "../../../lib/lft.js";
import { readItems } from "../../../lib/lpstore.js";
import { siteHref, teamSlug } from "../../../lib/paths.js";
import { sitePlayers } from "../../../lib/playerstats.js";
import { recapOf } from "../../../lib/recap.js";
import { readTeamInfo } from "../../../lib/teamfetch.js";
import { siteTeams } from "../../../lib/teams.js";
import { detailsOf, extraStats, mapCard, readDetails, tournamentStats } from "../../../lib/tstats.js";
import { EVENTS } from "../../../lib/bracket.js";
import { powerRanking } from "../../../lib/round6.js";
import { communityTiers, seasonHonours, teamChances, tierTeams } from "../../../lib/round8.js";
import { quizQuestions, quizRanking, weekOf, weeklyQuiz } from "../../../lib/round6.js";
import { pickSplit, playersInForm } from "../../../lib/round10.js";
import { matchPreview } from "../../../lib/round11.js";
import { agentTiers, ratingByMap } from "../../../lib/round13.js";
import { agentPage, roleLeaders } from "../../../lib/agentpage.js";
import { podiumBy, radarFor } from "../../../lib/radar24.js";
import { similarPlayers, teamRadarFor } from "../../../lib/radar25.js";
import { styleAnswer } from "../../../lib/botstyle.js";
import { motmSeason } from "../../../lib/fans.js";
import { ratings as r8ratings } from "../../../lib/r8data.js";
import { winChance } from "../../../lib/proba26.js";
import { MOD_NAMES, closeTicket, openTicket, runModCommand } from "../../../lib/botmod.js";
import { MOD2_NAMES, claimTicket, handleButton, runMod2Command } from "../../../lib/botmod2.js";
import { MOD3_NAMES, closeForm, contextMenu, durationSuggestions, formValues, modalSubmit, rateTicket, reasonSuggestions, runMod3Command, takePending, ticketForm, verifyClick } from "../../../lib/botmod3.js";
import { gatewayState } from "../../../lib/botgateway.js";
import { reopenTicket } from "../../../lib/botmod.js";
import { botServer, postLog } from "../../../lib/botserver.js";
import { discord, postFile } from "../../../lib/botapi.js";
import { logBot } from "../../../lib/botstore.js";
import { checkRule, dress, expandInteraction, moduleRefusal, templateSuggestions } from "../../../lib/botdash.js";

// the delays between two uses of a command (the editor's rules), in memory: "command:user" → last use
const cooldowns = (globalThis.__botCooldowns ||= new Map());

// the server commands whose answer everyone in the channel sees; the others answer the moderator alone
const MOD_PUBLIC = ["serverinfo", "userinfo", "slowmode", "lock", "unlock"];

/** What the server commands need: the server settings, and a way to write in the moderation log channel. */
function serverDeps(db, settings, now) {
  const server = botServer(db);
  const notify = (text) => postLog(discord, server, { kind: "bot", title: "🛡️ Action du bot", lines: [text], at: now });
  // the server's name, for the private messages: known from the live connection (lib/botgateway.js)
  const guildName = gatewayState().guildName || "";
  return { db, discord, lang: settings.lang, logBot, now, server, notify, postFile, guildName };
}

/** A button that changes the message it is on: "thinking…" on it at once (type 6), then the message replaced. */
function laterUpdate(i, work) {
  after(async () => {
    let out;
    try { out = await work(); } catch (e) { out = { content: `❌ ${e.message}` }; }
    const { public: _shown, ...payload } = dress(out || { content: "?" });
    await editOriginal(i.application_id, i.token, { components: [], ...payload }).catch((e) => console.log(`[bot] answer: ${e.message}`));
  });
  return NextResponse.json({ type: 6 });
}

const SERVER_CMDS = [...MOD_NAMES, ...MOD2_NAMES, ...MOD3_NAMES];

/** A server command or ticket button: "thinking…" at once (Discord waits 3 s at most), the answer once Discord has done it. */
function later(i, visible, work) {
  after(async () => {
    let out;
    try { out = await work(); } catch (e) { out = { content: `❌ ${e.message}` }; }
    const { public: _shown, ...payload } = dress(out || { content: "?" });
    await editOriginal(i.application_id, i.token, payload).catch((e) => console.log(`[bot] answer: ${e.message}`));
  });
  return NextResponse.json({ type: 5, data: visible ? {} : { flags: 64 } });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EMEA_REGION = /europe|emea|turkey|türkiye|middle east|mena|cis|africa/i;
const ephemeral = (data) => NextResponse.json({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] }, ...data } });
// a refusal (module off, a rule of the editor, a command turned off): a red card only the author sees
const refuse = (text) => ephemeral(dress({ content: text }));

/** What the commands read, each part only when asked. */
function context(db, lang, now) {
  const memo = {};
  const once = (k, f) => () => (k in memo ? memo[k] : (memo[k] = f()));
  const state = once("state", () => getState(db));
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return {
    lang, now, site: host ? `https://${host}` : "https://vct-emea.vercel.app", state,
    teams: once("teams", () => siteTeams(state())),
    players: once("players", () => sitePlayers(state())),
    stats: (ev = "") => tournamentStats(state(), readDetails(db, ev)),
    extra: (ev = "") => extraStats(state(), readDetails(db, ev)),
    mapCard: (name, ev = "") => mapCard(state(), readDetails(db, ev), name),
    agentTiers: (map) => agentTiers(readDetails(db, ""), map),
    motm: () => motmSeason(db, 10),
    roles: () => roleLeaders(db),
    agentPage: (name) => agentPage(name, db),
    byMap: (slug) => ratingByMap(readDetails(db, ""), slug),
    details: (event, id) => detailsOf(db, event, id),
    h2h: (a, b) => compareTeams(state(), a, b),
    teamInfo: (slug) => readTeamInfo()[slug] || null,
    ranking: () => seasonRanking(db, state(), { limit: 10, now }),
    power: once("power", () => powerRanking(state(), now)),
    chances: (name) => { const { rating } = r8ratings(); return teamChances(state(), rating, name); },
    proba: (a, b, bo) => { const rows = powerRanking(state(), Date.now(), { min: 1 }); const find = (q) => { const s = teamSlug(q); return rows.find((t) => t.slug === s) || rows.find((t) => t.slug.startsWith(s)) || null; }; const ta = find(a), tb = find(b); if (!ta || !tb || ta.slug === tb.slug) return null; const c = winChance(new Map([[ta.slug, ta.rating], [tb.slug, tb.rating]]), ta.name, tb.name, bo); return c && { ...c, nameA: ta.name, nameB: tb.name }; },
    quiz: () => { const w = weekOf(now); return { questions: quizQuestions(weeklyQuiz(state(), w)), best: quizRanking(db, w, 3) }; },
    honours: () => seasonHonours(state(), powerRanking(state(), now)),
    form: () => playersInForm(state(), tournamentStats(state(), readDetails(db, ""))),
    podium: (stat) => podiumBy(tournamentStats(state(), readDetails(db, "")).players, stat),
    radar: (q) => radarFor(tournamentStats(state(), readDetails(db, "")).players, q),
    teamRadar: (q) => teamRadarFor(tournamentStats(state(), readDetails(db, "")), q),
    similar: (q) => { const pl = tournamentStats(state(), readDetails(db, "")).players; const x = radarFor(pl, q); if (!x) return null; const me = pl.find((p) => p.slug === x.slug); return { name: x.name, slug: x.slug, list: similarPlayers(pl, me) }; },
    preview: (m) => matchPreview(state(), m, { players: tournamentStats(state(), readDetails(db, "")).players, picks: pickSplit(db, m) }),
    tiers: () => { const t = tierTeams(state()); return { teams: t, ...communityTiers(db, t) }; },
    guild: "",
    recap: (ev) => (EVENTS.includes(ev) ? recapOf(state(), readDetails(db, ev), ev) : null),
    eventHref: (ev) => siteHref(ev),
    isOpen: (m) => openForPrediction(m, now),
    mvp: (event, id) => {
      const d = detailsOf(db, event, id);
      const best = ((d && d.all) || []).filter((r) => r.acs != null).sort((a, b) => b.acs - a.acs)[0];
      return best ? `${best.name} (${best.acs} ACS)` : "";
    },
    lft: () => {
      const ours = new Set(siteTeams(state()).map((t) => teamSlug(t.name)));
      const info = readTeamInfo();
      return readFreeAgents(readItems("lft"), (team) => ours.has(teamSlug(team)) || EMEA_REGION.test((info[teamSlug(team)] && info[teamSlug(team)].region) || "")).list;
    },
  };
}

const picksOf = (db, hash) => Object.fromEntries(db.prepare("SELECT event, id, pick FROM predictions WHERE hash = ?").all(hash).map((r) => [`${r.event}:${r.id}`, r.pick]));

// Discord's calls for the bot (its "Interactions Endpoint URL"). Needs DISCORD_PUBLIC_KEY.
// The editor may say, per command, that its answer is seen by everyone or by its author only: applied here to the first answer
// (a message, or "thinking…", which the answer then follows).
export async function POST(req) {
  const box = { visibility: "default" };
  const res = await handle(req, box);
  if (box.visibility === "default" || !res || res.status !== 200) return res;
  try {
    const j = await res.clone().json();
    if (j.type !== 4 && j.type !== 5) return res;
    const data = { ...(j.data || {}) };
    const flags = Number(data.flags || 0);
    data.flags = box.visibility === "private" ? flags | 64 : flags & ~64;
    return NextResponse.json({ ...j, data });
  } catch { return res; }
}

async function handle(req, box) {
  const body = await req.text();
  if (!verifyDiscord(process.env.DISCORD_PUBLIC_KEY, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"), body)) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  let i;
  try { i = JSON.parse(body); } catch { return new NextResponse("Bad request", { status: 400 }); }
  // the name Discord shows (/warn, /ticket…), then the interaction as the command it stands for (/warn add → warn)
  const topName = (i.data && i.data.name) || "";
  if (i.type === 2 || i.type === 4) i = expandInteraction(i);
  if (i.type === 1) return NextResponse.json({ type: 1 }); // Discord checking the address
  const db = getDb();
  const now = Date.now();
  const settings = botSettings(db);
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const ctx = context(db, settings.lang, now);
  const user = (i.member && i.member.user) || i.user || {};

  // suggestions while typing
  if (i.type === 4) {
    // the server commands: the preset reasons (editor), readable durations
    if (i.data && SERVER_CMDS.includes(i.data.name)) {
      const focused = (i.data.options || []).find((o) => o.focused) || {};
      const server = botServer(db);
      if (focused.name === "template") return NextResponse.json({ type: 8, data: { choices: templateSuggestions(focused.value, server.embeds) } });
      if (i.data.name === "ticket" && focused.name === "subject") return NextResponse.json({ type: 8, data: { choices: server.tickets.categories.filter((c) => !focused.value || c.name.toLowerCase().includes(String(focused.value).toLowerCase())).map((c) => ({ name: c.name, value: c.name })).slice(0, 25) } });
      const choices = focused.name === "reason" ? reasonSuggestions(focused.value, botServer(db).moderation.reasons) : ["duration", "in"].includes(focused.name) ? durationSuggestions(focused.value) : [];
      return NextResponse.json({ type: 8, data: { choices } });
    }
    return NextResponse.json({ type: 8, data: { choices: autocomplete(i, ctx) } });
  }

  // a form sent back (Discord "modal"): a right-click menu's, a ticket's opening or closing form
  if (i.type === 5) {
    if (!tokenSet() || !i.guild_id) return ephemeral({ content: L("Indisponible ici.", "Not available here.") });
    const deps = serverDeps(db, settings, now);
    const [kind, what, a, b] = String((i.data && i.data.custom_id) || "").split("|");
    if (kind === "md") return later(i, false, () => modalSubmit(i, deps));
    if (kind === "tk" && what === "form") {
      const cat = deps.server.tickets.categories[Number(a)] || {};
      const v = formValues(i);
      return later(i, false, () => openTicket({ ...deps, guild: i.guild_id, channel: i.channel_id, user, role: String(b || "").replace(/\D/g, ""), category: cat.name || "", catRole: cat.role || "", subject: v.subject, details: v.details }));
    }
    if (kind === "tk" && what === "closeform") return later(i, false, () => closeTicket({ ...deps, guild: i.guild_id, thread: i.channel_id, user, permissions: i.member && i.member.permissions, reason: formValues(i).reason }));
    return ephemeral({ content: "?" });
  }

  // a prediction button
  if (i.type === 3) {
    const [kind, event, id, side] = String((i.data && i.data.custom_id) || "").split("|");
    // /help's menu: the chosen category in place
    if (kind === "hp") {
      const { flags: _f, ...data } = helpMessage(settings.lang, settings.disabled, Number(((i.data && i.data.values) || [])[0]), ctx.site);
      return NextResponse.json({ type: 7, data });
    }
    // /lier confirmed by a member whose roles open the editor (lib/accountdiscord.js)
    if (kind === "al") {
      const { linkAccount } = await import("../../../lib/accountdiscord.js");
      const done = linkAccount(db, event, { id: user.id, name: (i.member && i.member.nick) || user.global_name || user.username }, now);
      if (done) logBot(db, "moderation", `/lier : compte du site ${done} lié à un membre qui a accès à l'éditeur`);
      return NextResponse.json({ type: 7, data: { components: [], content: done ? L(`✅ Ton Discord est lié au compte du site **${done}**. Ce compte a maintenant l'accès que tes rôles donnent. Si ce n'est pas le tien, va sur Mon compte pour le délier, ou préviens le compte principal du site.`, `✅ Your Discord is linked to the site account **${done}**. That account now has the access your roles give.`) : L("Code inconnu ou trop vieux. Prends-en un nouveau sur la page Mon compte du site.", "Unknown or expired code. Get a new one on the site's My account page.") } });
    }
    const off = moduleRefusal(botServer(db), kind);
    if (off) return refuse(off);
    // a ticket's rating, in a private message (no server here): tr|<thread>|<stars>
    if (kind === "tr") return NextResponse.json(rateTicket(db, event, user.id, Number(id)));
    // a ban or kick confirmed (or not) by the moderator who asked: cf|<number>|yes|no
    if (kind === "cf") {
      const payload = takePending(db, event, user.id, now);
      if (!payload) return NextResponse.json({ type: 7, data: { content: L("Cette confirmation n'est plus valable (5 minutes, ou pas la tienne).", "This confirmation is no longer valid."), components: [] } });
      if (id !== "yes") return NextResponse.json({ type: 7, data: { content: L("Annulé.", "Cancelled."), components: [] } });
      const deps = { ...serverDeps(db, settings, now), confirmed: true };
      const again = { ...i, guild_id: payload.guild_id, channel_id: payload.channel_id, member: payload.member, data: payload.data };
      return laterUpdate(i, () => (MOD3_NAMES.includes(payload.data.name) ? runMod3Command(again, deps) : runModCommand(again, deps)));
    }
    // "J'accepte le règlement": the access role
    if (kind === "vf") {
      if (!tokenSet() || !i.guild_id) return ephemeral({ content: L("Indisponible ici.", "Not available here.") });
      return later(i, false, () => verifyClick(i, serverDeps(db, settings, now)));
    }
    // role buttons, poll votes, giveaway entries (lib/botmod2.js)
    if (["rb", "pv", "gv"].includes(kind)) {
      if (!tokenSet() || !i.guild_id) return ephemeral({ content: L("Indisponible ici.", "Not available here.") });
      if (kind === "rb") return later(i, false, async () => { const r = await handleButton(i, serverDeps(db, settings, now)); return r.data; });
      return NextResponse.json(await handleButton(i, serverDeps(db, settings, now)));
    }
    // a ticket's buttons: tk|open|<staff role> on the panel, tk|close in the ticket
    if (kind === "tk") {
      if (!tokenSet() || !i.guild_id) return ephemeral({ content: L("Les tickets ne marchent pas ici (bot non configuré).", "Tickets do not work here (bot not set up).") });
      const deps = serverDeps(db, settings, now);
      // the panel's button (tk|open|<role>) or a subject picked in its list (tk|cat|<role>, the subject's number in the values):
      // the subject's form first when it asks for one, else the ticket at once
      if (event === "open" || event === "cat") {
        const k = event === "cat" ? Number(((i.data && i.data.values) || [])[0]) : 0;
        const cats = deps.server.tickets.categories;
        const cat = (event === "cat" || cats.length === 1 ? cats[k] : null) || {};
        const role = String(id || "").replace(/\D/g, "");
        if (cat.form || (event === "open" && !cats.length)) return NextResponse.json(ticketForm(cat.name ? k : 0, role, cat.name || ""));
        return later(i, false, () => openTicket({ ...deps, guild: i.guild_id, channel: i.channel_id, user, role, category: cat.name || "", catRole: cat.role || "" }));
      }
      if (event === "reopen") return later(i, false, () => reopenTicket({ ...deps, guild: i.guild_id, thread: i.channel_id, user, permissions: i.member && i.member.permissions }));
      if (event === "claim") return later(i, false, () => claimTicket({ ...deps, guild: i.guild_id, thread: i.channel_id, user, permissions: i.member && i.member.permissions }));
      // closing: a form asks the reason (it may stay empty)
      if (event === "close") return NextResponse.json(closeForm());
      return ephemeral({ content: "?" });
    }
    // follow a team from an answer's button
    if (kind === "f") {
      const t = findTeam(ctx.teams(), event);
      if (!t) return ephemeral({ content: L("Équipe inconnue.", "Unknown team.") });
      const on = toggleFollow(db, user.id, teamSlug(t.name), t.name, now);
      countUse(db, "suivre-bouton", user.id, now);
      if (on !== null && settings.auto.fanRoles && tokenSet() && i.guild_id) after(() => setFanRole(db, i.guild_id, user.id, t.name, on).catch((e) => console.log(`[bot] role: ${e.message}`)));
      return ephemeral({ content: on === null ? L("20 équipes au plus.", "20 teams at most.") : on ? L(`🔔 Tu suis **${t.name}** : début et résultat de ses matchs en message privé.`, `🔔 You follow **${t.name}**: its match starts and results in private messages.`) : L(`🔕 Tu ne suis plus **${t.name}**.`, `🔕 You no longer follow **${t.name}**.`) });
    }
    // refresh a live answer in place
    if (kind === "r") {
      const fake = { ...i, data: { name: event, options: id ? [{ name: "equipe", value: id }] : [] } };
      return NextResponse.json({ type: 7, data: answerButtons(event, fake, answerCommand(event, fake, ctx), ctx.site, settings.lang) });
    }
    // the guessing game's answer
    if (kind === "q") {
      countUse(db, "devine-reponse", user.id, now);
      return NextResponse.json({ type: 7, data: answerQuestion(db, user.id, user.global_name || user.username || "?", i.message || {}, Number(event), Number(id), settings.lang, now) });
    }
    // a vote in a site poll relayed here: sp|<poll>|<answer>
    if (kind === "sp") {
      const { votePoll } = await import("../../../lib/round8.js");
      const r = votePoll(db, { id: Number(event), voter: `d:${user.id}`, choice: Number(id) }, now);
      if (!r.ok) return ephemeral({ content: r.error === "This poll is closed." ? L("Ce sondage est fermé.", "This poll is closed.") : L("Vote impossible.", "Vote refused.") });
      const p = r.poll;
      return ephemeral({ content: L(`🗳️ Vote enregistré : **${p.options[Number(id)]}**\n`, `🗳️ Vote saved: **${p.options[Number(id)]}**\n`) + p.options.map((o, k) => `${o} · ${p.total ? Math.round((p.counts[k] / p.total) * 100) : 0}%`).join("\n") });
    }
    if (kind !== "p") return ephemeral({ content: "?" });
    const hash = discordVoter(db, user.id, process.env.SESSION_SECRET);
    const state = ctx.state();
    const m = state && (await import("../../../lib/matchlist.js")).allMatches(state).find((x) => x.event === event && x.id === id);
    if (!m || !m.a || !m.b) return ephemeral({ content: L("Match inconnu.", "Unknown match.") });
    const pick = side === "a" ? m.a.name : m.b.name;
    let r = savePredictionFor(db, state, { hash, name: voterName("", user), event, id, pick }, now);
    for (let k = 0; !r.ok && r.status === 409 && /taken/.test(r.error) && k < 5; k++) {
      r = savePredictionFor(db, state, { hash, name: `${voterName("", user).slice(0, 15)} ${Math.floor(Math.random() * 9000) + 1000}`, event, id, pick }, now);
    }
    if (!r.ok) return ephemeral({ content: L(r.status === 409 ? "Les pronostics de ce match sont fermés." : "Ce pronostic n'a pas pu être enregistré.", r.status === 409 ? "This match is closed for predictions." : "This prediction could not be saved.") });
    countUse(db, "pronostic-clic", user.id, now);
    return NextResponse.json({ type: 7, data: pronosticMessage(ctx, picksOf(db, hash)) });
  }

  if (i.type !== 2 || !i.data) return ephemeral({ content: "?" });
  const name = i.data.name;
  if (settings.disabled.includes(name) || settings.disabled.includes(topName)) return refuse(L("❌ Cette commande est désactivée sur ce serveur.", "❌ This command is turned off here."));
  // the module the command belongs to, and the editor's rules for it (roles, channels, delay, who sees the answer)
  {
    const server = botServer(db);
    const off = moduleRefusal(server, name);
    if (off) return refuse(off);
    const rule = server.commandRules[topName];
    const no = checkRule(rule, i, dbCooldowns(db, cooldowns), now, topName);
    if (no) return refuse(no);
    if (rule) box.visibility = rule.visibility;
  }
  // a right-click menu on a member or a message (lib/botmod3.js)
  if (i.data.type === 2 || i.data.type === 3) {
    if (!tokenSet() || !i.guild_id) return ephemeral({ content: L("Indisponible ici.", "Not available here.") });
    countUse(db, name, user.id, now);
    const r = contextMenu(i, serverDeps(db, settings, now));
    return r.modal ? NextResponse.json(r.modal) : later(i, false, r.later);
  }
  if (MOD3_NAMES.includes(name)) {
    if (!tokenSet()) return ephemeral({ content: L("Cette commande a besoin du jeton du bot (réglages du serveur du site).", "This command needs the bot's token.") });
    countUse(db, name, user.id, now);
    return later(i, name === "lockdown", () => runMod3Command(i, serverDeps(db, settings, now)));
  }
  // moderation, server management and tickets (lib/botmod.js)
  if (MOD_NAMES.includes(name)) {
    if (!tokenSet()) return ephemeral({ content: L("Cette commande a besoin du jeton du bot (réglages du serveur du site).", "This command needs the bot's token (the site's server settings).") });
    countUse(db, name, user.id, now);
    return later(i, MOD_PUBLIC.includes(name), () => runModCommand(i, serverDeps(db, settings, now)));
  }
  if (MOD2_NAMES.includes(name)) {
    if (!tokenSet()) return ephemeral({ content: L("Cette commande a besoin du jeton du bot (réglages du serveur du site).", "This command needs the bot's token (the site's server settings).") });
    countUse(db, name, user.id, now);
    return later(i, ["add", "remove", "rename", "priority"].includes(name), () => runMod2Command(i, serverDeps(db, settings, now)));
  }
  countUse(db, name, user.id, now);
  noteGuildUser(db, i.guild_id, user.id, now);
  ctx.guild = i.guild_id || "";
  const opt = (n) => { const o = (i.data.options || []).find((x) => x.name === n); return o ? String(o.value ?? "") : ""; };

  if (name === "rappel") {
    const [ev, mid] = opt("match").split(":");
    const m = (await import("../../../lib/matchlist.js")).allMatches(ctx.state()).find((x) => x.event === ev && x.id === mid);
    if (!m || !m.a || !m.b) return ephemeral({ content: L("Choisis un match dans la liste.", "Pick a match from the list.") });
    const r = addReminder(db, user.id, m, now);
    if (!r.ok) return ephemeral({ content: L(r.error === "20 reminders at most." ? "20 rappels au plus." : "Ce match n'a pas d'horaire à venir.", r.error) });
    return ephemeral({ content: L(`⏰ C'est noté : un message privé 15 minutes avant **${m.a.name} vs ${m.b.name}** (<t:${Math.floor(new Date(m.at).getTime() / 1000)}:f>).`, `⏰ Done: a private message 15 minutes before **${m.a.name} vs ${m.b.name}** (<t:${Math.floor(new Date(m.at).getTime() / 1000)}:f>).`) + (tokenSet() ? "" : L("\n(Les messages privés partiront dès que le bot sera branché sur le site.)", "\n(Private messages start once the bot is plugged into the site.)")) });
  }
  if (name === "devine") {
    const q = makeQuestion(ctx.state(), ctx.stats().players, settings.lang);
    return q ? NextResponse.json({ type: 4, data: questionMessage(q, settings.lang) }) : ephemeral({ content: L("Pas encore assez de matchs pour jouer.", "Not enough matches to play yet.") });
  }
  if (name === "classementjeu") {
    const rows = gameRanking(db).map((r, k) => `${["🥇", "🥈", "🥉"][k] || `${k + 1}.`} **${r.name}** · ${r.points} pts (${r.played} ${L("questions", "questions")})`);
    return NextResponse.json({ type: 4, data: { embeds: [{ title: L("Classement du mini-jeu", "Guessing game ranking"), description: rows.join("\n") || L("Personne n'a encore joué : `/devine`.", "Nobody played yet: `/devine`."), color: 0xc9f03c }], allowed_mentions: { parse: [] } } });
  }
  if (name === "classement" && opt("portee") === "serveur" && i.guild_id) {
    const hashes = guildUsers(db, i.guild_id).map((u) => discordVoter(db, u, process.env.SESSION_SECRET));
    const rows = seasonRanking(db, ctx.state(), { limit: 10, now, only: hashes }).map((r, k) => `${["🥇", "🥈", "🥉"][k] || `${k + 1}.`} **${r.name}** · ${r.points} pts (${r.good}/${r.total})`);
    return NextResponse.json({ type: 4, data: { embeds: [{ title: L("Pronostics · classement de ce serveur", "Predictions · this server's ranking"), description: rows.join("\n") || L("Personne de ce serveur n'a encore pronostiqué : `/pronostic`.", "Nobody here has predicted yet: `/pronostic`."), color: 0xff4655 }], allowed_mentions: { parse: [] } } });
  }
  if (name === "aide" || name === "help") return NextResponse.json({ type: 4, data: helpMessage(settings.lang, settings.disabled, -1, ctx.site) });
  if (name === "mesprono") {
    const hash = discordVoter(db, user.id, process.env.SESSION_SECRET);
    const me = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
    if (!me) return ephemeral({ content: L("Tu n'as pas encore pronostiqué. Essaie `/pronostic`, ou `/lier` si tu joues déjà sur le site.", "You haven't predicted yet. Try `/pronostic`, or `/lier` if you already play on the site.") });
    const all = seasonRanking(db, ctx.state(), { limit: 100000, now, withHash: true });
    const k = all.findIndex((r) => r.hash === hash);
    const r = all[k];
    const byId = new Map(allMatches(ctx.state()).map((m) => [`${m.event}:${m.id}`, m]));
    const recent = db.prepare("SELECT event, id, pick FROM predictions WHERE hash = ? ORDER BY rowid DESC LIMIT 8").all(hash).map((p) => {
      const m = byId.get(`${p.event}:${p.id}`);
      if (!m || !m.a || !m.b) return null;
      const res = !m.win ? "⏳" : (m.win === "a" ? m.a.name : m.b.name) === p.pick ? "✅" : "❌";
      return `${res} ${m.a.name} vs ${m.b.name} → **${p.pick}**`;
    }).filter(Boolean);
    return ephemeral({ embeds: [{ title: `${me.name}${r ? ` · #${k + 1} / ${all.length}` : ""}`, color: 0xff4655, url: `${ctx.site}/p/${encodeURIComponent(me.name)}`,
      description: [r ? L(`**${r.points}** points · ${r.good}/${r.total} bons · série max ${r.streak}`, `**${r.points}** points · ${r.good}/${r.total} right · best streak ${r.streak}`) : L("Pas encore de résultat.", "No result yet."), "", ...recent].join("\n") }] });
  }
  if (name === "profil") {
    const hash = discordVoter(db, user.id, process.env.SESSION_SECRET);
    const me = db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash);
    if (!me) return ephemeral({ content: L("Pas encore de carte : pronostique avec `/pronostic`, ou `/lier` si tu joues déjà sur le site.", "No card yet: predict with `/pronostic`, or `/lier` if you already play on the site.") });
    const { achievements } = await import("../../../lib/round7.js");
    const { fantasyData } = await import("../../../lib/gamedata.js");
    const got = achievements(db, ctx.state(), hash, (await fantasyData()).points).filter((a) => a.got);
    return NextResponse.json({ type: 4, data: { embeds: [{ title: me.name, url: `${ctx.site}/p/${encodeURIComponent(me.name)}`, color: 0xc9f03c, description: got.length ? `🏅 ${got.map((a) => a.name).join(" · ")}` : L("Pas encore de succès : joue aux jeux du jour, au quiz et à la fantasy.", "No achievement yet: play the daily games, the quiz and the fantasy."), image: { url: `${ctx.site}/api/card/${encodeURIComponent(me.name)}?v=${Math.floor(now / 600000)}` } }] } });
  }
  if (name === "fantasy") {
    const hash = discordVoter(db, user.id, process.env.SESSION_SECRET);
    const { fantasyRanking, fantasyOfHash, teamPoints, weekStart } = await import("../../../lib/round7.js");
    const { fantasyData } = await import("../../../lib/gamedata.js");
    const { pool, points } = await fantasyData();
    const team = fantasyOfHash(db, hash);
    if (!Object.keys(team.slots).length) return ephemeral({ content: L(`Pas encore d'équipe fantasy : compose-la sur ${ctx.site}/fantasy (avec \`/lier\` pour jouer sous ton nom du site).`, `No fantasy team yet: build it at ${ctx.site}/fantasy (use \`/lier\` to play under your site name).`) });
    const bySlug = new Map(pool.map((p) => [p.slug, p]));
    const all = fantasyRanking(db, points, { limit: 100000, withHash: true });
    const k = all.findIndex((r) => r.hash === hash);
    const lines = Object.entries(team.slots).map(([role, s]) => `**${(bySlug.get(s.slug) || { name: s.slug }).name}** (${role}) · ${teamPoints({ slots: { x: s }, past: [] }, points)} pts`);
    return ephemeral({ embeds: [{ title: L("Ton équipe fantasy", "Your fantasy team"), url: `${ctx.site}/fantasy`, color: 0xc9f03c, description: lines.join("\n"), fields: [{ name: L("Cette semaine", "This week"), value: `${teamPoints(team, points, weekStart(now))} pts`, inline: true }, { name: L("Saison", "Season"), value: `${teamPoints(team, points)} pts${k >= 0 ? ` · #${k + 1}/${all.length}` : ""}`, inline: true }] }] });
  }
  if (name === "rappelprono") {
    const { kvGet, kvSet } = await import("../../../lib/round6.js");
    const list = kvGet(db, "bot_prono_dm", []);
    const on = !list.includes(user.id);
    kvSet(db, "bot_prono_dm", on ? [...list, user.id].slice(-5000) : list.filter((u) => u !== user.id));
    return ephemeral({ content: on ? L("🔔 C'est noté : je t'enverrai un message privé quand des matchs arrivent dans les 3 heures et que tu ne les as pas pronostiqués. Refais `/rappelprono` pour arrêter.", "🔔 Noted: I'll DM you when matches start within 3 hours and you haven't predicted them. Run `/rappelprono` again to stop.") : L("🔕 Rappels de pronostic arrêtés.", "🔕 Prediction reminders stopped.") });
  }
  // the editor opened from Discord (lib/staffaccess.js): a link for this member alone, if one of their roles opens it
  if (name === "editeur") {
    const { levelFor, makeStaffCode, readAccess } = await import("../../../lib/staffaccess.js");
    if (!i.guild_id || i.guild_id !== settings.guild) return ephemeral({ content: L("Tape cette commande sur le serveur du site.", "Use this command on the site's server.") });
    const access = readAccess(db);
    const level = levelFor(access, (i.member && i.member.roles) || []);
    if (!level) return ephemeral({ content: access.editor.length || access.moderator.length ? L("Aucun de tes rôles n'ouvre l'éditeur du site.", "None of your roles opens the site's editor.") : L("Aucun rôle n'ouvre encore l'éditeur : le compte principal du site les choisit dans le tableau de bord du bot (Réglages).", "No role opens the editor yet: the site's main account picks them in the bot's dashboard (Settings).") });
    const displayName = (i.member && i.member.nick) || user.global_name || user.username || user.id;
    const code = makeStaffCode(db, { id: user.id, name: displayName, level }, now);
    // the address Discord reached the bot at is the site's own
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    const site = host ? `${(req.headers.get("x-forwarded-proto") || "https").split(",")[0]}://${host}` : ctx.site;
    logBot(db, "moderation", `/editeur : lien de connexion donné à ${displayName} (${level === "editor" ? "éditeur" : "modérateur"})`);
    return ephemeral({
      content: level === "editor"
        ? L("🔑 Ton lien pour ouvrir l'éditeur du site. Il ne marche qu'une fois, pendant 10 minutes : ne le partage pas. Ton accès dure tant que tu as le rôle.", "🔑 Your link to open the site's editor. It works once, for 10 minutes: do not share it. Your access lasts as long as you have the role.")
        : L("🔑 Ton lien pour ouvrir le tableau de bord du bot (membres, sanctions, tickets). Il ne marche qu'une fois, pendant 10 minutes : ne le partage pas.", "🔑 Your link to open the bot's dashboard (members, sanctions, tickets). It works once, for 10 minutes: do not share it."),
      components: [{ type: 1, components: [{ type: 2, style: 5, label: L("Ouvrir l'éditeur", "Open the editor"), url: `${site}/api/staff-login?code=${code}` }] }],
    });
  }
  if (name === "lier") {
    // a code from the account page: the site account and this Discord account tied (lib/accountdiscord.js)
    const { accountOfCode, linkAccount } = await import("../../../lib/accountdiscord.js");
    const account = accountOfCode(db, opt("code"), now);
    if (account) {
      const { levelFor, readAccess } = await import("../../../lib/staffaccess.js");
      const level = i.guild_id && i.guild_id === settings.guild ? levelFor(readAccess(db), (i.member && i.member.roles) || []) : "";
      // the roles open the editor: the account will have it too, so a code someone else gave would hand it to them
      if (level) {
        return ephemeral({
          content: L(`⚠️ Ce code lie ton Discord au compte du site **${account}**. Tes rôles ouvrent l'éditeur : ce compte y aura accès lui aussi. Confirme seulement si **${account}** est bien ton compte, et jamais pour un code donné par quelqu'un d'autre.`, `⚠️ This code ties your Discord to the site account **${account}**. Your roles open the editor: that account will have it too. Confirm only if **${account}** is your own account, never for a code someone else gave you.`),
          components: [{ type: 1, components: [{ type: 2, style: 4, label: L(`C'est mon compte : lier ${account}`, `It's my account: link ${account}`).slice(0, 80), custom_id: `al|${String(opt("code")).trim().toUpperCase().slice(0, 12)}` }] }],
        });
      }
      const done = linkAccount(db, opt("code"), { id: user.id, name: (i.member && i.member.nick) || user.global_name || user.username }, now);
      return ephemeral({ content: L(`✅ Ton Discord est lié au compte du site **${done}**, pour de bon (tu peux le délier sur la page Mon compte). Tes pronostics sur Discord comptent pour ce compte.`, `✅ Your Discord is linked to the site account **${done}**: your Discord predictions count for it, and the My account page shows it.`) });
    }
    const who = useLinkCode(db, user.id, opt("code"), now);
    return ephemeral({ content: who ? L(`✅ C'est fait : tes pronostics Discord comptent maintenant pour **${who}**.`, `✅ Done: your Discord predictions now count for **${who}**.`) : L("Code inconnu ou trop vieux. Prends-en un nouveau sur la page Pronostics du site (il dure 15 minutes).", "Unknown or expired code. Get a new one on the site's Predictions page (it lasts 15 minutes).") });
  }
  if (name === "suivre") {
    if (!opt("equipe")) {
      const list = followsOf(db, user.id);
      return ephemeral({ content: list.length ? L(`Tu suis : ${list.map((f) => `**${f.name}**`).join(", ")}. Refais \`/suivre\` avec une équipe pour l'enlever.`, `You follow: ${list.map((f) => `**${f.name}**`).join(", ")}. Run \`/suivre\` with a team to remove it.`) : L("Tu ne suis aucune équipe. Essaie `/suivre equipe:Fnatic`.", "You follow no team. Try `/suivre equipe:Fnatic`.") });
    }
    const { findTeam } = await import("../../../lib/discordbot.js");
    const t = findTeam(ctx.teams(), opt("equipe"));
    if (!t) return ephemeral({ content: L("Équipe inconnue.", "Unknown team.") });
    const on = toggleFollow(db, user.id, teamSlug(t.name), t.name, now);
    if (on === null) return ephemeral({ content: L("20 équipes au plus.", "20 teams at most.") });
    // the team's fans' role, when the editor turned it on
    if (settings.auto.fanRoles && tokenSet() && i.guild_id) after(() => setFanRole(db, i.guild_id, user.id, t.name, on).catch((e) => console.log(`[bot] role: ${e.message}`)));
    const note = botReady() ? "" : L("\n(Les messages privés seront envoyés dès que le bot sera branché sur le site.)", "\n(Private messages start once the bot is plugged into the site.)");
    return ephemeral({ content: (on ? L(`🔔 Tu recevras en message privé le début et le résultat des matchs de **${t.name}**. Garde tes messages privés ouverts pour ce serveur.`, `🔔 You'll get **${t.name}**'s match starts and results in private messages. Keep private messages open for this server.`) : L(`🔕 Tu ne suis plus **${t.name}**.`, `🔕 You no longer follow **${t.name}**.`)) + note });
  }
  if (name === "pronostic") {
    const hash = discordVoter(db, user.id, process.env.SESSION_SECRET);
    const given = opt("nom");
    if (given && !db.prepare("SELECT 1 FROM voters WHERE hash = ?").get(hash)) {
      const n = voterName(given, user);
      if (db.prepare("SELECT 1 FROM voters WHERE name = ?").get(n)) return ephemeral({ content: L(`Le nom **${n}** est déjà pris. Si c'est le tien sur le site, utilise \`/lier\` avec le code de la page Pronostics.`, `**${n}** is taken. If it's yours on the site, use \`/lier\` with the code from the Predictions page.`) });
      db.prepare("INSERT INTO voters (hash, name, created) VALUES (?, ?, ?)").run(hash, n, new Date(now).toISOString());
    }
    return NextResponse.json({ type: 4, data: pronosticMessage(ctx, picksOf(db, hash)) });
  }
  if (!COMMANDS.some((c) => c.name === name)) return ephemeral({ content: "?" });
  // the others read more: "thinking…" now, the answer right after
  after(async () => {
    let payload;
    try { payload = answerButtons(name, i, styleAnswer(answerCommand(name, i, ctx), ctx.site, settings.lang), ctx.site, settings.lang); } catch (e) { console.log(`[bot] ${name}: ${e.message}`); payload = { content: L("Oups, une erreur. Réessaie dans un instant.", "Oops, an error. Try again in a moment.") }; }
    try { await editOriginal(i.application_id, i.token, payload); } catch (e) { console.log(`[bot] reply: ${e.message}`); }
  });
  return NextResponse.json({ type: 5 });
}
