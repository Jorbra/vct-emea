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
    try { await startThread(settings.channel, posted.id, `${a.a} vs ${a.b}`); } catch (e) { logBot(db, "thread", e.message, false); }
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
  if (!settings.channel) return;
  const extra = await import("./botextra.js");
  try { await extra.liveMessages(db, state, settings, now); } catch (e) { logBot(db, "direct", e.message, false); }
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
