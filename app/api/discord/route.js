import { NextResponse, after } from "next/server";
import { getDb, getState } from "../../../lib/db.js";
import { COMMANDS, answerButtons, answerCommand, autocomplete, findTeam, helpMessage, pronosticMessage, verifyDiscord, voterName } from "../../../lib/discordbot.js";
import { compareTeams } from "../../../lib/playerstats.js";
import { addReminder } from "../../../lib/more.js";
import { answerQuestion, gameRanking, guildUsers, makeQuestion, noteGuildUser, questionMessage, setFanRole } from "../../../lib/botextra.js";
import { botReady as tokenSet } from "../../../lib/botapi.js";
import { allMatches } from "../../../lib/matchlist.js";
import { botReady, editOriginal } from "../../../lib/botapi.js";
import { botSettings, countUse, discordVoter, followsOf, toggleFollow, useLinkCode } from "../../../lib/botstore.js";
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

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EMEA_REGION = /europe|emea|turkey|türkiye|middle east|mena|cis|africa/i;
const ephemeral = (data) => NextResponse.json({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] }, ...data } });

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
    h2h: (a, b) => compareTeams(state(), a, b),
    teamInfo: (slug) => readTeamInfo()[slug] || null,
    ranking: () => seasonRanking(db, state(), { limit: 10, now }),
    power: once("power", () => powerRanking(state(), now)),
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
export async function POST(req) {
  const body = await req.text();
  if (!verifyDiscord(process.env.DISCORD_PUBLIC_KEY, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"), body)) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  let i;
  try { i = JSON.parse(body); } catch { return new NextResponse("Bad request", { status: 400 }); }
  if (i.type === 1) return NextResponse.json({ type: 1 }); // Discord checking the address
  const db = getDb();
  const now = Date.now();
  const settings = botSettings(db);
  const L = (fr, en) => (settings.lang === "en" ? en : fr);
  const ctx = context(db, settings.lang, now);
  const user = (i.member && i.member.user) || i.user || {};

  // suggestions while typing
  if (i.type === 4) return NextResponse.json({ type: 8, data: { choices: autocomplete(i, ctx) } });

  // a prediction button
  if (i.type === 3) {
    const [kind, event, id, side] = String((i.data && i.data.custom_id) || "").split("|");
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
  if (settings.disabled.includes(name)) return ephemeral({ content: L("Cette commande est désactivée sur ce serveur.", "This command is turned off here.") });
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
  if (name === "aide") return NextResponse.json({ type: 4, data: helpMessage(settings.lang, settings.disabled) });
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
  if (name === "lier") {
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
    try { payload = answerButtons(name, i, answerCommand(name, i, ctx), ctx.site, settings.lang); } catch (e) { console.log(`[bot] ${name}: ${e.message}`); payload = { content: L("Oups, une erreur. Réessaie dans un instant.", "Oops, an error. Try again in a moment.") }; }
    try { await editOriginal(i.application_id, i.token, payload); } catch (e) { console.log(`[bot] reply: ${e.message}`); }
  });
  return NextResponse.json({ type: 5 });
}
