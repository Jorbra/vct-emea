// What the bot posts by itself, as the editor set it: match announcements in a channel (with a role mentioned), private messages to
// those following a team, a pinned message kept up to date with the day's matches, transfers and news. Needs DISCORD_BOT_TOKEN.
import crypto from "node:crypto";
import { botReady, editMessage, pinMessage, postMessage, sendDm, startThread } from "./botapi.js";
import { botSettings, followersOf, logBot, saveDmChannel, sendOnce, takeDueScheduled } from "./botstore.js";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES } from "./paths.js";

const SITE = () => (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://vct-emea.vercel.app");
const idOf = (a) => String(a.url || "").split("/").pop();

/** The bot posts in a channel when one is chosen in the editor and its token is set. */
export const botPosts = (settings) => botReady() && !!settings.channel;

/** A match of the last rounds: where the role is mentioned when "final rounds only" is chosen. */
export const isFinalRound = (a) => a.event === "kickoff" || /^(qf|sf|gf|third|f|uf|lf|ubf|lbf)[-\d]|final/i.test(idOf(a));

/**
 * The announcements the editor wants, as Discord messages: [{ content, embeds?, allowed_mentions }].
 * lines(a) writes one announcement. Pure, for the tests.
 */
export function botMessages(fresh, settings, lines, groupMessages) {
  const wanted = fresh.filter((a) => settings.events[a.event] !== false && (a.kind === "result" ? settings.announce.result : settings.announce.start));
  if (!wanted.length) return [];
  const starts = wanted.filter((a) => a.kind !== "result");
  const mention = settings.role && settings.roleWhen !== "none" && starts.some((a) => settings.roleWhen === "all" || isFinalRound(a));
  const out = groupMessages(wanted.map(lines)).map((content, k) => ({
    content: k === 0 && mention ? `<@&${settings.role}> ${content}` : content,
    allowed_mentions: { parse: [], roles: k === 0 && mention ? [settings.role] : [] },
  }));
  const results = wanted.filter((a) => a.kind === "result");
  if (settings.announce.image && results.length && results.length <= 10) {
    out.push({ embeds: results.map((a) => ({ title: `${a.a} ${a.sa}–${a.sb} ${a.b}`, url: SITE() + a.url, color: 0xff4655, image: { url: `${SITE()}/api/og${a.url.replace(/^\/match/, "")}?v=${a.sa}-${a.sb}` } })), allowed_mentions: { parse: [] } });
  }
  return out;
}

/** Which matches get their own thread when they start: [announcement], 10 at most a round. Pure. */
export function threadStarts(fresh, settings) {
  if (settings.threads === "none") return [];
  return fresh.filter((a) => a.kind === "live" && settings.events[a.event] !== false && (settings.threads === "all" || isFinalRound(a))).slice(0, 10);
}

/** Posts the announcements: starts in the main channel (a thread for the chosen ones), results in theirs when one is chosen. */
export async function botAnnounce(db, fresh, lines, groupMessages) {
  const settings = botSettings(db);
  if (!botPosts(settings)) return 0;
  const threaded = new Set(threadStarts(fresh, settings).map((a) => a.key));
  const rest = fresh.filter((a) => !threaded.has(a.key));
  const results = settings.resultChannel ? rest.filter((a) => a.kind === "result") : [];
  const main = settings.resultChannel ? rest.filter((a) => a.kind !== "result") : rest;
  let n = 0;
  const send = async (channel, list) => {
    for (const m of botMessages(list, settings, lines, groupMessages)) {
      if (n++) await new Promise((r) => setTimeout(r, 1100));
      await postMessage(channel, m);
    }
  };
  // the fans' roles of the teams that start, on the server chosen in the editor
  if (settings.auto.fanRoles && settings.guild) {
    const { fanRolesFor } = await import("./botextra.js");
    const roles = fanRolesFor(db, settings.guild, main.filter((a) => a.kind === "live").flatMap((a) => a.teams || []));
    if (roles.length) {
      const msgs = botMessages(main, settings, lines, groupMessages);
      if (msgs.length) {
        msgs[0] = { ...msgs[0], content: `${roles.map((r) => `<@&${r}>`).join(" ")} ${msgs[0].content}`, allowed_mentions: { parse: [], roles: [...new Set([...(msgs[0].allowed_mentions.roles || []), ...roles])] } };
        for (const msg of msgs) { if (n++) await new Promise((r) => setTimeout(r, 1100)); await postMessage(settings.channel, msg); }
        main.length = 0;
      }
    }
  }
  await send(settings.channel, main);
  if (results.length) await send(settings.resultChannel, results);
  // a match of its own, with a thread for the talk
  for (const a of fresh.filter((x) => threaded.has(x.key))) {
    const [msg] = botMessages([a], settings, lines, groupMessages);
    if (!msg) continue;
    if (n++) await new Promise((r) => setTimeout(r, 1100));
    const posted = await postMessage(settings.channel, msg);
    try {
      const th = await startThread(settings.channel, posted.id, `${a.a} vs ${a.b}`);
      const { kvGet, kvSet } = await import("./round6.js");
      const store = kvGet(db, "bot_threads", {});
      store[`${a.event}:${idOf(a)}`] = { id: (th && th.id) || posted.id, maps: 0, done: false, at: new Date().toISOString() };
      kvSet(db, "bot_threads", store);
    } catch (e) { logBot(db, "thread", e.message, false); }
  }
  if (n) logBot(db, "annonces", `${fresh.length} annonce(s) publiée(s)`);
  return n;
}

const parisParts = (now) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: p.weekday };
};

/** The matches starting in 10 to 20 minutes, with both teams: [match]. Pure. */
export function dueReminders(state, now = Date.now()) {
  return allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null && !m.live && m.at && new Date(m.at).getTime() - now > 10 * 60000 && new Date(m.at).getTime() - now <= 20 * 60000);
}

/** What the bot does by itself each round: scheduled announcements, reminders, the evening summary, the weekly ranking. */
export async function botRegular(db, state, now = Date.now(), { ranking } = {}) {
  if (!botReady()) return;
  const settings = botSettings(db);
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  for (const s of takeDueScheduled(db, now)) {
    try { await postMessage(s.channel, s.payload); logBot(db, "programmée", s.label); } catch (e) { logBot(db, "programmée", `${s.label} : ${e.message}`, false); }
  }
  // /rappel: each one by private message, 15 minutes before
  const { takeDueReminders } = await import("./more.js");
  for (const r of takeDueReminders(db, now).slice(0, 30)) {
    try { await sendDm(r.user, { content: L(`⏰ Dans 15 min : **${r.label}** · <t:${Math.floor(new Date(r.at).getTime() / 1000)}:t>\n${SITE()}/match/${r.event}/${r.id}`, `⏰ In 15 min: **${r.label}** · <t:${Math.floor(new Date(r.at).getTime() / 1000)}:t>\n${SITE()}/match/${r.event}/${r.id}`), allowed_mentions: { parse: [] } }); } catch (e) { if (e.code !== 50007) logBot(db, "rappel MP", e.message, false); }
  }
  if (!settings.channel) return;
  const extra = await import("./botextra.js");
  // the recap of an event that has just ended
  if (settings.auto.recap) {
    const { recapOf } = await import("./recap.js");
    const { readDetails } = await import("./tstats.js");
    for (const ev of ["q1", "q2", "trq1", "trq2", "meq1", "meq2", "naq1", "naq2"]) {
      const r = state.qualifiers && state.qualifiers[ev] ? recapOf(state, readDetails(db, ev), ev) : null;
      if (!r || !r.done || !sendOnce(db, `recap:${ev}:${r.qualified.map((q) => q.team.name).join("|")}`, now)) continue;
      const embed = {
        title: L(`Récap · ${EVENT_NAMES[ev]}`, `Recap · ${EVENT_NAMES[ev]}`), url: `${SITE()}/recap/${ev}`, color: 0xc9f03c,
        fields: [
          { name: L("Qualifiés", "Qualified"), value: r.qualified.map((q) => `**${q.team.name}**`).join(", ") },
          r.top.length ? { name: L("Meilleurs joueurs", "Best players"), value: r.top.slice(0, 3).map((p, k) => `${k + 1}. **${p.name}** (${p.team}) · ${p.r != null ? p.r.toFixed(2) : "–"}`).join("\n") } : null,
          r.bigGames.length ? { name: L("Plus gros match", "Biggest game"), value: `**${r.bigGames[0].name}** ${r.bigGames[0].acs} ACS` } : null,
        ].filter(Boolean),
        image: { url: `${SITE()}/api/og/bracket/${ev}?v=${r.played}` },
      };
      try { await postMessage(settings.channel, { embeds: [embed] }); logBot(db, "récap", EVENT_NAMES[ev]); } catch (e) { logBot(db, "récap", e.message, false); }
    }
  }
  try { await extra.liveMessages(db, state, settings, now); } catch (e) { logBot(db, "direct", e.message, false); }
  try { await pronoDms(db, state, now); } catch (e) { logBot(db, "rappel prono", e.message, false); }
  if (settings.auto.games && p0(now).hour >= 9) { try { await dailyGamesPost(db, settings, now); } catch (e) { logBot(db, "jeux", e.message, false); } }
  if (settings.auto.weekRecap && p0(now).weekday === "Mon" && p0(now).hour >= 11) { try { await weekRecapPost(db, settings, now); } catch (e) { logBot(db, "récap semaine", e.message, false); } }
  if (settings.auto.teamWeek && p0(now).weekday === "Mon" && p0(now).hour >= 12) { try { await teamWeekPost(db, state, settings, now); } catch (e) { logBot(db, "équipe type", e.message, false); } }
  if (settings.auto.tiers && settings.guild && p0(now).hour >= 10) { try { await predictorTiers(db, state, settings, now); } catch (e) { logBot(db, "rangs", e.message, false); } }
  if (settings.auto.motd) { try { await predictionOfTheDay(db, state, settings, now); } catch (e) { logBot(db, "prono du jour", e.message, false); } }
  if (settings.auto.qualified) { try { await qualifiedPosts(db, state, settings, now); } catch (e) { logBot(db, "qualifiés", e.message, false); } }
  if (settings.auto.threadMaps) { try { await threadMaps(db, state, settings, now); } catch (e) { logBot(db, "fil", e.message, false); } }
  if (settings.auto.closeMatch) { try { const { closeMatchPosts } = await import("./livebot.js"); await closeMatchPosts(db, state, settings, now); } catch (e) { logBot(db, "match serré", e.message, false); } }
  if (settings.auto.oracle && settings.guild && p0(now).weekday === "Mon" && p0(now).hour >= 10) { try { await weeklyOracle(db, state, settings, now); } catch (e) { logBot(db, "oracle", e.message, false); } }
  if (settings.auto.polls) {
    for (const m of extra.pollMatches(state, now).filter((x) => settings.events[x.event] !== false).slice(0, 5)) {
      if (!sendOnce(db, `poll:${m.event}:${m.id}:${m.at}`, now)) continue;
      try { await postMessage(settings.channel, extra.pollPayload(m, settings.lang, now)); logBot(db, "sondage", `${m.a.name} vs ${m.b.name}`); } catch (e) { logBot(db, "sondage", e.message, false); }
    }
  }
  if (settings.auto.reminder) {
    const due = dueReminders(state, now).filter((m) => settings.events[m.event] !== false && sendOnce(db, `rem:${m.event}:${m.id}:${m.at}`, now));
    if (due.length) {
      const a = due.map((m) => ({ event: m.event, url: `/match/${m.event}/${m.id}` }));
      const mention = settings.role && settings.roleWhen !== "none" && a.some((x) => settings.roleWhen === "all" || isFinalRound(x));
      const lines = due.slice(0, 20).map((m) => `⏰ ${L("Dans 15 min", "In 15 min")} : **${m.a.name}** vs **${m.b.name}** · ${EVENT_NAMES[m.event] || m.event} · <t:${Math.floor(new Date(m.at).getTime() / 1000)}:t>`);
      try {
        await postMessage(settings.channel, { content: (mention ? `<@&${settings.role}> ` : "") + lines.join("\n"), allowed_mentions: { parse: [], roles: mention ? [settings.role] : [] } });
        logBot(db, "rappel", `${due.length} match(s) dans 15 min`);
      } catch (e) { logBot(db, "rappel", e.message, false); }
    }
  }
  const p = parisParts(now);
  if (settings.auto.daily && p.hour >= 22 && sendOnce(db, `daily:${p.day}`, now)) {
    const embed = dailyEmbed(state, settings.lang, now);
    if (embed) {
      try { await postMessage(settings.resultChannel || settings.channel, { embeds: [embed] }); logBot(db, "résumé", p.day); } catch (e) { logBot(db, "résumé", e.message, false); }
    }
  }
  if (settings.auto.weekly && p.weekday === "Mon" && p.hour >= 10 && sendOnce(db, `weekly:${p.day}`, now) && ranking) {
    const top = ranking().slice(0, 10);
    if (top.length) {
      const lines = top.map((r, k) => `${["🥇", "🥈", "🥉"][k] || `${k + 1}.`} **${r.name}** · ${r.points} pts (${r.good}/${r.total})`);
      try {
        await postMessage(settings.channel, { embeds: [{ title: L("Classement des pronostics de la semaine", "This week's prediction ranking"), description: lines.join("\n"), color: 0xff4655, url: `${SITE()}/predictions`, footer: { text: L("Joue avec /pronostic", "Play with /pronostic") } }] });
        logBot(db, "hebdo", p.day);
      } catch (e) { logBot(db, "hebdo", e.message, false); }
    }
  }
}

const p0 = (now) => parisParts(now);

/** Monday noon: the team of the week, the best player per role. */
async function teamWeekPost(db, state, settings, now) {
  const p = parisParts(now);
  if (!sendOnce(db, `teamweek:${p.day}`, now)) return;
  const { teamOfWeek } = await import("./round11.js");
  const { readDetails } = await import("./tstats.js");
  const t = teamOfWeek(state, readDetails(db, ""), now);
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const ROLE = { duelist: L("Duelliste", "Duelist"), initiator: L("Initiateur", "Initiator"), controller: L("Contrôleur", "Controller"), sentinel: L("Sentinelle", "Sentinel"), flex: "Flex" };
  const lines = Object.entries(ROLE).filter(([k]) => t[k]).map(([k, n]) => `**${n}** · ${t[k].name} · ${t[k].r.toFixed(2)} (${t[k].maps} ${L("cartes", "maps")})`);
  if (!lines.length) return;
  await postMessage(settings.channel, { embeds: [{ title: L("🌟 L'équipe type de la semaine", "🌟 The team of the week"), description: lines.join("\n"), url: `${SITE()}/stats`, color: 0xc9f03c, footer: { text: L("Meilleur rating par rôle sur les 7 derniers jours (2 cartes au moins)", "Best rating per role over the last 7 days (2 maps at least)") } }] });
  logBot(db, "équipe type", p.day);
}

/** Once a day: the Bronze, Silver and Gold roles of the server's predictors, by their season points. */
async function predictorTiers(db, state, settings, now) {
  const p = parisParts(now);
  if (!sendOnce(db, `tiers:${settings.guild}:${p.day}`, now)) return;
  const { tierOf } = await import("./round11.js");
  const { kvGet, kvSet } = await import("./round6.js");
  const { guildUsers } = await import("./botextra.js");
  const { discordVoter } = await import("./botstore.js");
  const { seasonRanking } = await import("./fans.js");
  const { discord } = await import("./botapi.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const points = new Map(seasonRanking(db, state, { limit: 100000, now, withHash: true }).map((r) => [r.hash, r.points]));
  const store = kvGet(db, "bot_tiers", {});
  const g = store[settings.guild] || { roles: {}, members: {} };
  const NAMES = { gold: L("🥇 Pronostiqueur Or", "🥇 Gold predictor"), silver: L("🥈 Pronostiqueur Argent", "🥈 Silver predictor"), bronze: L("🥉 Pronostiqueur Bronze", "🥉 Bronze predictor") };
  const COLORS = { gold: 0xd4af37, silver: 0xb8b8b8, bronze: 0xcd7f32 };
  for (const k of Object.keys(NAMES)) if (!g.roles[k]) { const r = await discord("POST", `/guilds/${settings.guild}/roles`, { name: NAMES[k], color: COLORS[k], mentionable: false }); g.roles[k] = r.id; }
  let changed = 0;
  for (const user of guildUsers(db, settings.guild).slice(0, 200)) {
    const want = tierOf(points.get(discordVoter(db, user, process.env.SESSION_SECRET)) || 0);
    const had = g.members[user] || "";
    if (want === had) continue;
    try {
      if (had && g.roles[had]) await discord("DELETE", `/guilds/${settings.guild}/members/${user}/roles/${g.roles[had]}`);
      if (want) await discord("PUT", `/guilds/${settings.guild}/members/${user}/roles/${g.roles[want]}`);
      if (want) g.members[user] = want; else delete g.members[user];
      changed += 1;
    } catch { /* left the server */ }
    if (changed >= 40) break;
  }
  store[settings.guild] = g;
  kvSet(db, "bot_tiers", store);
  if (changed) logBot(db, "rangs", `${changed} rôle(s) mis à jour`);
}

/** Noon: the day's most awaited match with its two buttons; once it is played, its result and how many had it right. */
async function predictionOfTheDay(db, state, settings, now) {
  const { matchOfTheDay, pickSplit } = await import("./round10.js");
  const { openForPrediction } = await import("./community.js");
  const { kvGet, kvSet } = await import("./round6.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const p = parisParts(now);
  const posted = kvGet(db, "bot_motd", {});
  // yesterday's (or today's, already played): its result
  for (const [day, x] of Object.entries(posted)) {
    if (x.done) continue;
    const m = allMatches(state).find((y) => y.event === x.event && y.id === x.id);
    if (!m || m.sa == null || !m.win) continue;
    const s = pickSplit(db, m);
    const winner = m.win === "a" ? m.a.name : m.b.name;
    const right = m.win === "a" ? s.a : s.b;
    await postMessage(settings.channel, { embeds: [{ title: L(`🎯 Prono du jour : ${winner} gagne`, `🎯 Prediction of the day: ${winner} wins`), description: `**${m.a.name} ${m.sa}–${m.sb} ${m.b.name}**\n${s.total ? L(`${Math.round((right / s.total) * 100)} % l'avaient vu (${right}/${s.total})`, `${Math.round((right / s.total) * 100)}% saw it coming (${right}/${s.total})`) : ""}`, url: `${SITE()}/match/${m.event}/${m.id}`, color: 0xc9f03c }] });
    posted[day] = { ...x, done: true };
    kvSet(db, "bot_motd", posted);
  }
  if (p.hour < 12 || posted[p.day]) return;
  const m = matchOfTheDay(state, (x) => openForPrediction(x, now), now);
  if (!m) return;
  posted[p.day] = { event: m.event, id: m.id };
  for (const k of Object.keys(posted).sort().slice(0, -14)) delete posted[k];
  kvSet(db, "bot_motd", posted);
  await postMessage(settings.channel, {
    embeds: [{ title: L("🔮 Le prono du jour", "🔮 Prediction of the day"), description: `**${m.a.name}** vs **${m.b.name}** · ${EVENT_NAMES[m.event] || m.event}${m.bo ? ` · Bo${m.bo}` : ""}\n<t:${Math.floor(new Date(m.at).getTime() / 1000)}:F> (<t:${Math.floor(new Date(m.at).getTime() / 1000)}:R>)`, url: `${SITE()}/match/${m.event}/${m.id}`, color: 0xff4655, footer: { text: L("Clique sur le vainqueur : ça compte au classement du site", "Click the winner: it counts in the site's ranking") } }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: m.a.name.slice(0, 80), custom_id: `p|${m.event}|${m.id}|a` }, { type: 2, style: 1, label: m.b.name.slice(0, 80), custom_id: `p|${m.event}|${m.id}|b` }] }],
  });
  logBot(db, "prono du jour", `${m.a.name} vs ${m.b.name}`);
}

/** A picture for each team that has just qualified (once each). The first round only notes those already qualified. */
async function qualifiedPosts(db, state, settings, now) {
  const { qualifiedTeams } = await import("./round9.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const first = sendOnce(db, "qualified:started", now);
  for (const q of qualifiedTeams(state)) {
    if (!sendOnce(db, `qualified:${q.event}:${q.slug}`, now) || first) continue;
    await postMessage(settings.channel, { embeds: [{ title: L(`🎟️ ${q.team} est qualifié !`, `🎟️ ${q.team} qualifies!`), description: `${q.name} → **${q.to}**`, url: `${SITE()}/team/${q.slug}`, color: 0xc9f03c, image: { url: `${SITE()}/api/og/qualified?event=${q.event}&team=${q.slug}` } }] });
    logBot(db, "qualifiés", q.team);
  }
}

/** The site's latest open poll, posted in the bot's channel with a button per answer. */
export async function relayPoll(db) {
  const settings = botSettings(db);
  if (!botPosts(settings)) return false;
  const { currentPoll } = await import("./round8.js");
  const p = currentPoll(db);
  if (!p || !sendOnce(db, `poll-site:${p.id}`)) return false;
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const rows = [];
  for (let k = 0; k < p.options.length; k += 3) rows.push({ type: 1, components: p.options.slice(k, k + 3).map((o, j) => ({ type: 2, style: 1, label: o.slice(0, 80), custom_id: `sp|${p.id}|${k + j}` })) });
  await postMessage(settings.channel, { embeds: [{ title: `📊 ${p.question}`, url: SITE(), color: 0xc9f03c, description: L("Vote ici ou sur le site : les votes comptent ensemble.", "Vote here or on the site: the votes count together."), ...(p.closes ? { footer: { text: L("Fermeture", "Closes") }, timestamp: p.closes } : {}) }], components: rows });
  logBot(db, "sondage site", p.question.slice(0, 60));
  return true;
}

/** Morning: the games of the day, with yesterday's best. */
async function dailyGamesPost(db, settings, now) {
  const { dailyRanking, dayOf } = await import("./games.js");
  const today = dayOf(now);
  if (!sendOnce(db, `games:${today}`, now)) return;
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const yesterday = dayOf(now - 86400000);
  const names = { joueur: L("Joueur mystère", "Mystery player"), duel: L("Plus ou moins", "Higher or lower"), logo: L("Logo mystère", "Mystery logo"), agent: L("Agent mystère", "Mystery agent") };
  const fields = Object.entries(names).map(([g, n]) => { const top = dailyRanking(db, g, yesterday, 3); return top.length ? { name: `${n} · ${L("hier", "yesterday")}`, value: top.map((r, k) => `${["🥇", "🥈", "🥉"][k]} ${r.name} (${r.score})`).join("\n"), inline: true } : null; }).filter(Boolean);
  await postMessage(settings.channel, {
    embeds: [{ title: L("🎮 Les jeux du jour sont là", "🎮 Today's games are up"), url: `${SITE()}/jeux`, color: 0xc9f03c, description: L("Joueur mystère, plus ou moins, logo mystère : une partie chacun, à toi de jouer !", "Mystery player, higher or lower, mystery logo: one go each, your turn!"), fields }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: L("Jouer", "Play"), url: `${SITE()}/jeux` }] }],
  });
  logBot(db, "jeux", today);
}

/** Monday: the week's recap as a picture. */
async function weekRecapPost(db, settings, now) {
  const p = parisParts(now);
  if (!sendOnce(db, `weekrecap:${p.day}`, now)) return;
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  await postMessage(settings.channel, { embeds: [{ title: L("📅 Le récap de la semaine", "📅 The week's recap"), url: `${SITE()}/puissance`, color: 0xff4655, image: { url: `${SITE()}/api/og/week?d=${p.day}` } }] });
  logBot(db, "récap semaine", p.day);
}

/** Every hour: a DM to those who asked, for the matches starting soon they have not predicted (once a day each). */
export async function pronoDms(db, state, now = Date.now()) {
  const settings = botSettings(db);
  if (!botReady() || !settings.auto.pronoDm) return 0;
  const { kvGet } = await import("./round6.js");
  const pronoUsers = kvGet(db, "bot_prono_dm", []);
  if (!pronoUsers.length) return 0;
  const { pronoReminders } = await import("./round7.js");
  const { openForPrediction } = await import("./community.js");
  const { discordVoter } = await import("./botstore.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const day = parisParts(now).day;
  let n = 0;
  for (const r of pronoReminders(db, state, pronoUsers, (m) => openForPrediction(m, now), (u) => discordVoter(db, u, process.env.SESSION_SECRET), now).slice(0, 40)) {
    if (!sendOnce(db, `pdm:${r.user}:${day}`, now)) continue;
    const lines = r.matches.slice(0, 8).map((m) => `• **${m.a.name}** vs **${m.b.name}** · <t:${Math.floor(new Date(m.at).getTime() / 1000)}:R>`);
    try { await sendDm(r.user, { content: L(`🔮 Tu n'as pas encore pronostiqué :\n${lines.join("\n")}\nUtilise \`/pronostic\` ou ${SITE()}/predictions`, `🔮 You haven't predicted yet:\n${lines.join("\n")}\nUse \`/pronostic\` or ${SITE()}/predictions`), allowed_mentions: { parse: [] } }); n++; } catch (e) { if (e.code !== 50007) logBot(db, "rappel prono", e.message, false); }
  }
  if (n) logBot(db, "rappel prono", `${n} MP`);
  return n;
}

/** Each threaded match: the maps finished since the last round, then the result. Threads older than 2 days are let go. */
async function threadMaps(db, state, settings, now) {
  const { kvGet, kvSet, threadLines } = await import("./round6.js");
  const store = kvGet(db, "bot_threads", {});
  const all = allMatches(state);
  let changed = false;
  for (const [key, t] of Object.entries(store)) {
    const [event, id] = key.split(":");
    const m = all.find((x) => x.event === event && x.id === id);
    if (!m || t.done || now - new Date(t.at || 0).getTime() > 2 * 86400000) { delete store[key]; changed = true; continue; }
    const r = threadLines(m, (state.live[event] || {})[id], t, settings.lang);
    if (!r.lines.length) continue;
    try { await postMessage(t.id, { content: r.lines.join("\n") }); } catch (e) { if (e.status === 404 || e.status === 403) { delete store[key]; changed = true; continue; } throw e; }
    store[key] = { ...t, maps: r.maps, done: r.done };
    changed = true;
    if (r.done) { try { const { threadFinal } = await import("./botthread.js"); const extra = threadFinal(db, m, settings.lang); if (extra) await postMessage(t.id, { content: extra, allowed_mentions: { parse: [] } }); } catch { /* the thread's last word is a bonus */ } }
  }
  if (changed) kvSet(db, "bot_threads", store);
}

/** Monday: the server's best predictor of the last 7 days gets the "Oracle of the week" role, taken from last week's. */
async function weeklyOracle(db, state, settings, now) {
  const p = parisParts(now);
  if (!sendOnce(db, `oracle:${settings.guild}:${p.day}`, now)) return;
  const { kvGet, kvSet, oracleOf, weekPredictions } = await import("./round6.js");
  const { guildUsers } = await import("./botextra.js");
  const { discordVoter } = await import("./botstore.js");
  const { discord } = await import("./botapi.js");
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const members = guildUsers(db, settings.guild).map((user) => ({ user, hash: discordVoter(db, user, process.env.SESSION_SECRET) }));
  const best = oracleOf(weekPredictions(db, state, now), members);
  const saved = kvGet(db, "bot_oracle", {});
  const cur = saved[settings.guild] || {};
  let role = cur.role;
  if (!role) {
    const made = await discord("POST", `/guilds/${settings.guild}/roles`, { name: L("🔮 Oracle de la semaine", "🔮 Oracle of the week"), color: 0xc9a227, hoist: true, mentionable: false });
    role = made.id;
  }
  if (cur.holder && (!best || cur.holder !== best.user)) { try { await discord("DELETE", `/guilds/${settings.guild}/members/${cur.holder}/roles/${role}`); } catch { /* left the server */ } }
  if (best) await discord("PUT", `/guilds/${settings.guild}/members/${best.user}/roles/${role}`);
  saved[settings.guild] = { role, holder: best ? best.user : "" };
  kvSet(db, "bot_oracle", saved);
  if (!best) { logBot(db, "oracle", L("Personne n'a eu 2 bons pronostics cette semaine", "Nobody had 2 right picks this week")); return; }
  await postMessage(settings.channel, { content: L(`🔮 **Oracle de la semaine** : <@${best.user}> avec **${best.good}/${best.total}** bons pronostics ! Le rôle est à toi jusqu'à lundi prochain.`, `🔮 **Oracle of the week**: <@${best.user}> with **${best.good}/${best.total}** right picks! The role is yours until next Monday.`), allowed_mentions: { parse: [], users: [best.user] } });
  logBot(db, "oracle", `${best.good}/${best.total}`);
}

/** The evening summary: the day's results by event. null when no match was played. Pure. */
export function dailyEmbed(state, lang, now = Date.now()) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const day = parisParts(now).day;
  const done = allMatches(state).filter((m) => m.a && m.b && m.sa != null && m.at && parisParts(new Date(m.at).getTime()).day === day);
  if (!done.length) return null;
  const byEvent = {};
  for (const m of done) (byEvent[m.event] ||= []).push(`${m.win === "a" ? `**${m.a.name}**` : m.a.name} ${m.sa}–${m.sb} ${m.win === "b" ? `**${m.b.name}**` : m.b.name}`);
  return {
    title: L(`Résumé du jour · ${done.length} match(s)`, `Today's summary · ${done.length} match(es)`), color: 0xff4655, url: `${SITE()}/calendar`,
    image: { url: `${SITE()}/api/og/day?d=${day}` },
    fields: Object.entries(byEvent).slice(0, 10).map(([e, lines]) => ({ name: EVENT_NAMES[e] || e, value: clip(lines, 1000) })),
    timestamp: new Date(now).toISOString(),
  };
}

/** Private messages to those following a team with /suivre: a match starting and its result. 40 at most per round. */
export async function botDms(db, fresh, lines) {
  if (!botReady()) return 0;
  let sent = 0;
  for (const a of fresh.filter((x) => x.kind === "live" || x.kind === "result")) {
    for (const f of followersOf(db, a.teams || [])) {
      if (sent >= 40) return sent;
      try {
        const ch = await sendDm(f.user, { content: `${lines(a)}\n${SITE()}${a.url}`, allowed_mentions: { parse: [] } }, f.dm);
        if (ch !== f.dm) saveDmChannel(db, f.user, ch);
        sent++;
      } catch (e) {
        // closed private messages: nothing to do for this one
        if (e.code !== 50007) { console.log(`[bot-dm] ${e.message}`); logBot(db, "message privé", e.message, false); }
      }
    }
  }
  return sent;
}

const parisDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const unix = (iso) => Math.floor(new Date(iso).getTime() / 1000);

/** The pinned message's content: what is live, what is coming today, today's results. Pure. */
export function pinnedEmbed(state, lang, now = Date.now()) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const day = parisDay(new Date(now));
  const all = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name);
  const today = (m) => m.at && parisDay(new Date(m.at)) === day;
  const ev = (m) => EVENT_NAMES[m.event] || m.event;
  const live = all.filter((m) => m.live).map((m) => {
    const s = (state.live[m.event] || {})[m.id] || {};
    const maps = (s.maps || []).map((x) => `${x.map} ${x.a}–${x.b}`).join(", ");
    return `🔴 **${m.a.name} ${s.a ?? 0}–${s.b ?? 0} ${m.b.name}**${maps ? ` (${maps})` : ""} · ${ev(m)}`;
  });
  const coming = all.filter((m) => !m.live && m.sa == null && today(m) && new Date(m.at).getTime() > now - 3600000).sort((x, y) => x.at.localeCompare(y.at))
    .map((m) => `<t:${unix(m.at)}:t> · ${m.a.name} vs ${m.b.name} · ${ev(m)}`);
  const done = all.filter((m) => m.sa != null && today(m)).sort((x, y) => (y.at || "").localeCompare(x.at || ""))
    .map((m) => `✅ ${m.win === "a" ? `**${m.a.name}**` : m.a.name} ${m.sa}–${m.sb} ${m.win === "b" ? `**${m.b.name}**` : m.b.name}`);
  const fields = [
    live.length ? { name: L(`En direct (${live.length})`, `Live (${live.length})`), value: clip(live, 1000) } : null,
    coming.length ? { name: L(`À venir aujourd'hui (${coming.length})`, `Coming today (${coming.length})`), value: clip(coming, 1000) } : null,
    done.length ? { name: L(`Résultats du jour (${done.length})`, `Today's results (${done.length})`), value: clip(done, 1000) } : null,
  ].filter(Boolean);
  if (!fields.length) {
    const next = all.filter((m) => m.sa == null && m.at && new Date(m.at).getTime() > now).sort((x, y) => x.at.localeCompare(y.at))[0];
    fields.push({ name: L("Aujourd'hui", "Today"), value: next ? L(`Pas de match. Prochain : **${next.a.name}** vs **${next.b.name}** <t:${unix(next.at)}:R>`, `No match. Next: **${next.a.name}** vs **${next.b.name}** <t:${unix(next.at)}:R>`) : L("Pas de match.", "No match.") });
  }
  return { title: L("VCT EMEA · matchs du jour", "VCT EMEA · today's matches"), url: `${SITE()}/live`, color: 0xff4655, fields, footer: { text: L("Mis à jour automatiquement", "Updated automatically") }, timestamp: new Date(now).toISOString() };
}

function clip(lines, max) {
  let out = "";
  for (const l of lines) {
    if ((out + "\n" + l).length > max - 20) return `${out}\n…`;
    out += (out ? "\n" : "") + l;
  }
  return out;
}

/** Keeps the pinned message up to date: at most once a minute, and only when it changed. */
export async function updatePinned(db, state, now = Date.now()) {
  const settings = botSettings(db);
  if (!botReady() || !settings.pinChannel) return false;
  if (now - (globalThis.__botPinAt || 0) < 60000) return false;
  globalThis.__botPinAt = now;
  const embed = pinnedEmbed(state, settings.lang, now);
  // the time in the footer changes each minute: the rest decides whether to edit
  const hash = crypto.createHash("sha1").update(JSON.stringify({ ...embed, timestamp: "" })).digest("hex");
  const row = db.prepare("SELECT value FROM kv WHERE key = 'bot_pin'").get();
  let pin = {};
  try { pin = row ? JSON.parse(row.value) : {}; } catch { /* a new one */ }
  if (pin.channel === settings.pinChannel && pin.hash === hash && pin.id) return false;
  const save = (p) => db.prepare("INSERT INTO kv (key, value) VALUES ('bot_pin', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(p));
  try {
    if (pin.channel === settings.pinChannel && pin.id) {
      await editMessage(pin.channel, pin.id, { embeds: [embed] });
      save({ ...pin, hash });
      return true;
    }
  } catch (e) {
    if (e.status !== 404) { console.log(`[bot-pin] ${e.message}`); logBot(db, "épinglé", e.message, false); return false; }
  }
  const msg = await postMessage(settings.pinChannel, { embeds: [embed] });
  save({ channel: settings.pinChannel, id: msg.id, hash });
  try { await pinMessage(settings.pinChannel, msg.id); } catch (e) { console.log(`[bot-pin] pin: ${e.message}`); }
  return true;
}

/** A free agent or a signing, when the editor wants transfers posted. events: from lft.js lftChanges. */
export async function botTransfers(db, events) {
  const settings = botSettings(db);
  if (!botPosts(settings) || !settings.announce.transfers || !events.length) return 0;
  const channel = settings.transferChannel || settings.channel;
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const lines = events.slice(0, 15).map((e) => (e.kind === "free" ? L(`🔓 **${e.name}** est libre (a quitté ${e.team})`, `🔓 **${e.name}** is a free agent (left ${e.team})`) : L(`✍️ **${e.name}** rejoint **${e.team}**`, `✍️ **${e.name}** joins **${e.team}**`)));
  await postMessage(channel, { content: lines.join("\n"), allowed_mentions: { parse: [] } });
  logBot(db, "transferts", `${lines.length} transfert(s)`);
  return lines.length;
}

/** A news article just published on the site. */
export async function botNews(db, news) {
  const settings = botSettings(db);
  if (!botPosts(settings) || !settings.announce.news || !news) return 0;
  logBot(db, "actualité", news.title);
  await postMessage(settings.channel, { embeds: [{ title: news.title, url: `${SITE()}/news/${news.id}`, description: String(news.body || "").slice(0, 400) + (String(news.body || "").length > 400 ? "…" : ""), color: 0xff4655 }], allowed_mentions: { parse: [] } });
  return 1;
}

/** The editor's "send a test message". */
export async function botTest(db) {
  const settings = botSettings(db);
  if (!botReady()) return { ok: false, status: 409, error: "The bot's token is not set on Vercel (DISCORD_BOT_TOKEN)." };
  if (!settings.channel) return { ok: false, status: 400, error: "Choose a channel first." };
  try {
    await postMessage(settings.channel, { content: settings.lang === "en" ? "✅ Test message from the VCT EMEA site: the bot can post here." : "✅ Message test du site VCT EMEA : le bot peut écrire ici.", allowed_mentions: { parse: [] } });
    return { ok: true, message: "Test message sent." };
  } catch (e) {
    return { ok: false, status: 502, error: e.code === 50013 || e.code === 50001 ? "The bot cannot post in this channel: give it the right to see the channel and send messages." : `Discord: ${e.message}` };
  }
}
