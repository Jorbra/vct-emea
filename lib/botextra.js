// The bot, round 4: one message per live match kept up to date, polls before the big matches, fans' roles, a guessing game,
// each server's own prediction ranking, and the samples the dashboard shows.
import crypto from "node:crypto";
import { discord, editMessage, postMessage } from "./botapi.js";
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES, teamSlug } from "./paths.js";

const SITE = () => (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://vct-emea.vercel.app");
const WEIGHT = (id) => (/^gf|^third/.test(id) ? 6 : /^sf/.test(id) ? 5 : /^qf/.test(id) ? 4 : /^r16/.test(id) ? 3 : /^r32/.test(id) ? 2 : 1);
const kvGet = (db, key, fallback) => { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key); try { return r ? JSON.parse(r.value) : fallback; } catch { return fallback; } };
const kvSet = (db, key, value) => db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));

export function fillBotExtra(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS bot_games (user TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, played INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_guild_users (guild TEXT NOT NULL, user TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (guild, user));`);
}

// ---- 10. one message per live match, edited as it goes

/** A live match's message: its score, its maps, where it is played. Pure. */
export function liveEmbed(m, live, lang) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const s = live || {};
  const maps = (s.maps || []).filter((x) => x.a != null).map((x, i, all) => `${x.done || i < all.length - 1 ? "▪" : "▶"} ${x.map} **${x.a}–${x.b}**`).join("\n");
  const done = m.sa != null && m.sb != null;
  return {
    title: done ? `✅ ${m.a.name} ${m.sa}–${m.sb} ${m.b.name}` : `🔴 ${m.a.name} ${s.a ?? 0}–${s.b ?? 0} ${m.b.name}`,
    url: `${SITE()}/match/${m.event}/${m.id}`, color: done ? 0xc9f03c : 0xff4655,
    description: [`${EVENT_NAMES[m.event] || m.event}${m.bo ? ` · Bo${m.bo}` : ""}`, maps].filter(Boolean).join("\n"),
    footer: { text: done ? L("Match terminé", "Match over") : L("Mis à jour en direct", "Updated live") },
  };
}

/** Keeps a message per live match (6 at most, the latest rounds first) up to date; the result closes it. */
export async function liveMessages(db, state, settings, now = Date.now()) {
  if (!settings.auto.liveEdit || !settings.channel) return 0;
  const store = kvGet(db, "bot_livemsg", {});
  const all = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && settings.events[m.event] !== false);
  const live = all.filter((m) => m.live).sort((x, y) => WEIGHT(y.id) - WEIGHT(x.id)).slice(0, 6);
  let n = 0;
  for (const m of live) {
    const key = `${m.event}:${m.id}`;
    const embed = liveEmbed(m, (state.live[m.event] || {})[m.id], settings.lang);
    const hash = crypto.createHash("sha1").update(JSON.stringify(embed)).digest("hex");
    const cur = store[key];
    if (cur && cur.hash === hash) continue;
    try {
      if (cur) await editMessage(cur.channel, cur.id, { embeds: [embed] });
      else { const msg = await postMessage(settings.channel, { embeds: [embed] }); store[key] = { channel: settings.channel, id: msg.id }; }
      store[key].hash = hash;
      n++;
    } catch (e) {
      if (e.status === 404) delete store[key];
    }
  }
  // a match no longer live: its final score, then the message is left as it is
  for (const [key, cur] of Object.entries(store)) {
    const [event, id] = key.split(":");
    const m = all.find((x) => x.event === event && x.id === id);
    if (m && m.live) continue;
    if (m && m.sa != null) { try { await editMessage(cur.channel, cur.id, { embeds: [liveEmbed(m, null, settings.lang)] }); } catch { /* deleted */ } }
    delete store[key];
  }
  kvSet(db, "bot_livemsg", store);
  return n;
}

// ---- 11. a poll before the big matches

/** The matches worth a poll: a final round (or the Kickoff), both teams known, starting in the next 3 hours. Pure. */
export function pollMatches(state, now = Date.now()) {
  return allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null && !m.live && m.at
    && new Date(m.at).getTime() > now && new Date(m.at).getTime() - now <= 3 * 3600000 && (WEIGHT(m.id) >= 4 || m.event === "kickoff"));
}

/** Discord's own poll: its results show once it ends, when the match starts (one hour at least). Pure. */
export function pollPayload(m, lang, now = Date.now()) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  return {
    poll: {
      question: { text: L(`Qui gagne ${m.a.name} vs ${m.b.name} ?`, `Who wins ${m.a.name} vs ${m.b.name}?`).slice(0, 300) },
      answers: [{ poll_media: { text: m.a.name.slice(0, 55) } }, { poll_media: { text: m.b.name.slice(0, 55) } }],
      duration: Math.max(1, Math.min(768, Math.ceil((new Date(m.at).getTime() - now) / 3600000))),
      allow_multiselect: false,
    },
  };
}

// ---- 12. fans' roles

/** The role of a team's fans on a server, made the first time. Returns its id. */
export async function fanRole(db, guild, team) {
  const roles = kvGet(db, "bot_roles", {});
  const slug = teamSlug(team);
  if (roles[guild] && roles[guild][slug]) return roles[guild][slug];
  const role = await discord("POST", `/guilds/${guild}/roles`, { name: `Fan ${team}`.slice(0, 100), mentionable: true });
  roles[guild] = { ...(roles[guild] || {}), [slug]: role.id };
  kvSet(db, "bot_roles", roles);
  return role.id;
}

/** Gives (or takes back) a team's fans' role to a member. */
export async function setFanRole(db, guild, user, team, on) {
  const id = await fanRole(db, guild, team);
  await discord(on ? "PUT" : "DELETE", `/guilds/${guild}/members/${user}/roles/${id}`);
  return id;
}

/** The fans' roles to mention for these teams on a server: [roleId]. */
export function fanRolesFor(db, guild, teams) {
  const roles = (kvGet(db, "bot_roles", {})[guild]) || {};
  return [...new Set(teams.map((t) => roles[t]).filter(Boolean))];
}

// ---- 13. the guessing game

const shuffle = (list, seed) => {
  const out = [...list];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/**
 * A question: { text, choices: [name], answer: index }. Three kinds: a player from his numbers, a player's team, a past match's winner.
 * seed makes it the same in the tests. null when the site has too little to ask.
 */
export function makeQuestion(state, players, lang, seed = Math.floor(Math.random() * 233280)) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const pool = players.filter((p) => p.maps >= 4 && p.team);
  const done = allMatches(state).filter((m) => m.a && m.b && m.a.name && m.b.name && m.win && !m.note);
  const kinds = [pool.length >= 4 ? "stats" : "", pool.length >= 4 && new Set(pool.map((p) => p.team)).size >= 4 ? "team" : "", done.length ? "winner" : ""].filter(Boolean);
  if (!kinds.length) return null;
  const kind = kinds[seed % kinds.length];
  const pick = (list) => list[seed % list.length];
  if (kind === "winner") {
    const m = pick(done);
    const choices = [m.a.name, m.b.name];
    return { text: L(`Qui a gagné **${m.a.name}** contre **${m.b.name}** (${EVENT_NAMES[m.event] || m.event}) ?`, `Who won **${m.a.name}** against **${m.b.name}** (${EVENT_NAMES[m.event] || m.event})?`), choices, answer: m.win === "a" ? 0 : 1 };
  }
  const p = pick(pool);
  if (kind === "team") {
    const others = shuffle([...new Set(pool.map((x) => x.team))].filter((t) => t !== p.team), seed).slice(0, 3);
    const choices = shuffle([p.team, ...others], seed + 1);
    return { text: L(`Dans quelle équipe joue **${p.name}** ?`, `Which team does **${p.name}** play for?`), choices, answer: choices.indexOf(p.team) };
  }
  const others = shuffle(pool.filter((x) => x.slug !== p.slug), seed).slice(0, 3).map((x) => x.name);
  const choices = shuffle([p.name, ...others], seed + 2);
  const agents = (p.agents || []).slice(0, 2).map((a) => a.name.charAt(0).toUpperCase() + a.name.slice(1)).join(", ");
  return { text: L(`Qui a ces stats ? Rating **${Number(p.r).toFixed(2)}**, ACS **${p.acs}**, K/D **${Number(p.kd).toFixed(2)}**${agents ? `, joue ${agents}` : ""}`, `Who has these numbers? Rating **${Number(p.r).toFixed(2)}**, ACS **${p.acs}**, K/D **${Number(p.kd).toFixed(2)}**${agents ? `, plays ${agents}` : ""}`), choices, answer: choices.indexOf(p.name) };
}

/** The question as a message with its buttons (the answer travels in the buttons' ids, out of sight). */
export function questionMessage(q, lang) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const nonce = crypto.randomBytes(3).toString("hex");
  return {
    flags: 64,
    embeds: [{ title: L("Devine !", "Guess!"), description: q.text, color: 0xc9f03c, footer: { text: L("1 point par bonne réponse · /classementjeu", "1 point per right answer · /classementjeu") } }],
    components: [{ type: 1, components: q.choices.map((c, i) => ({ type: 2, style: 2, label: c.slice(0, 80), custom_id: `q|${q.answer}|${i}|${nonce}` })) }],
  };
}

/** An answer: counted, and the message shows the right one. */
export function answerQuestion(db, user, name, message, answer, chosen, lang, now = Date.now()) {
  const L = (fr, en) => (lang === "en" ? en : fr);
  const ok = answer === chosen;
  db.prepare("INSERT INTO bot_games (user, name, points, played, at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (user) DO UPDATE SET name = excluded.name, points = points + excluded.points, played = played + 1, at = excluded.at")
    .run(user, String(name).slice(0, 40), ok ? 1 : 0, new Date(now).toISOString());
  const me = db.prepare("SELECT points, played FROM bot_games WHERE user = ?").get(user);
  const rows = (message.components || []).map((row) => ({ ...row, components: row.components.map((b, i) => ({ ...b, disabled: true, style: i === answer ? 3 : i === chosen ? 4 : 2 })) }));
  const e = (message.embeds || [])[0] || {};
  return {
    embeds: [{ ...e, description: `${e.description || ""}\n\n${ok ? L("✅ Bonne réponse !", "✅ Right!") : L(`❌ Raté, c'était **${rows[0].components[answer].label}**.`, `❌ Wrong, it was **${rows[0].components[answer].label}**.`)} · ${L("Ton score", "Your score")} : **${me.points}/${me.played}**` }],
    components: rows,
  };
}

export const gameRanking = (db, limit = 10) => db.prepare("SELECT name, points, played FROM bot_games ORDER BY points DESC, played ASC, name LIMIT ?").all(limit);

// ---- 14. each server's own ranking: who used the bot there

export const noteGuildUser = (db, guild, user, now = Date.now()) => {
  if (guild && user) db.prepare("INSERT OR IGNORE INTO bot_guild_users (guild, user, at) VALUES (?, ?, ?)").run(guild, user, new Date(now).toISOString());
};
export const guildUsers = (db, guild) => db.prepare("SELECT user FROM bot_guild_users WHERE guild = ?").all(guild).map((r) => r.user);
