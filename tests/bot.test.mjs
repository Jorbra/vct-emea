// The Discord bot: commands, autocomplete, predictions with buttons, follows, link codes, settings, what it posts.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb, setMatchTime } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { COMMANDS, answerCommand, autocomplete, findTeam, pronosticMessage, voterName } from "../lib/discordbot.js";
import { botSettings, botUsage, countUse, discordVoter, followersOf, makeLinkCode, saveBotSettings, toggleFollow, useLinkCode } from "../lib/botstore.js";
import { botMessages, isFinalRound, pinnedEmbed } from "../lib/botnotify.js";
import { savePrediction, savePredictionFor } from "../lib/community.js";
import { groupMessages } from "../lib/discord.js";
import { botCtx, cmd } from "./botctx.mjs";

const T = "e".repeat(40);

function played() {
  const db = openDb(":memory:");
  assert.equal(setQualifierTeams(db, "meq1", Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`).join("\n")).ok, true);
  assert.equal(saveQualifierScore(db, { event: "meq1", id: "r64-1", sa: 1, sb: 0 }).ok, true);
  setMatchTime(db, { event: "meq1", id: "r64-2", at: new Date(Date.now() + 3600000).toISOString() });
  return db;
}

test("the commands Discord is given: names, options, autocomplete", () => {
  const names = COMMANDS.map((c) => c.name);
  for (const n of ["score", "prochain", "classement", "equipe", "joueur", "bracket", "match", "live", "top", "lft", "suivre", "pronostic", "lier"]) assert.ok(names.includes(n), n);
  for (const c of COMMANDS) {
    assert.match(c.name, /^[a-z0-9_-]{1,32}$/);
    assert.ok(c.description.length <= 100, c.name);
    for (const o of c.options || []) assert.ok(o.description.length <= 100 && /^[a-z0-9_-]{1,32}$/.test(o.name), `${c.name}.${o.name}`);
  }
  const db = played();
  const ctx = botCtx(getState(db));
  assert.deepEqual(autocomplete(cmd("equipe", { nom: "team 3" }, { focused: "nom" }), ctx).map((c) => c.value), ["Team 3"]);
  assert.ok(autocomplete(cmd("bracket", { tournoi: "qualifier 1" }, { focused: "tournoi" }), ctx).some((c) => c.value === "q1"));
  assert.equal(findTeam(ctx.teams(), "team 2").name, "Team 2");
});

test("answers: team, match, top, live, lft, bracket, English", () => {
  const db = played();
  const ctx = botCtx(getState(db));
  const text = (r) => JSON.stringify(r);
  const team = answerCommand("equipe", cmd("equipe", { nom: "Team 1" }), ctx);
  assert.equal(team.embeds[0].title, "Team 1");
  assert.match(text(team), /Derniers résultats/);
  assert.match(text(answerCommand("match", cmd("match", { equipe: "Team 2" }), ctx)), /Team 1 1–0 Team 2/);
  assert.match(text(answerCommand("equipe", cmd("equipe", { nom: "Nobody" }), ctx)), /Aucune équipe/);
  const top = answerCommand("top", cmd("top", { stat: "acs" }), ctx);
  assert.match(top.embeds[0].description, /^1\. \*\*Beta\*\*/);
  assert.match(text(answerCommand("live", cmd("live"), ctx)), /Aucun match en cours/);
  assert.match(text(answerCommand("lft", cmd("lft"), ctx)), /Free/);
  assert.match(text(answerCommand("joueur", cmd("joueur", { nom: "alpha" }), ctx)), /Alpha · Team 1/);
  assert.match(text(answerCommand("bracket", cmd("bracket", { tournoi: "meq1" }), ctx)), /1\*\* \/ /);
  assert.match(text(answerCommand("live", cmd("live"), { ...ctx, lang: "en" })), /No match being played/);
});

test("predictions from Discord: buttons, a voter per Discord user, a name tied with a code", () => {
  const db = played();
  const state = getState(db);
  const ctx = botCtx(state);
  const msg = pronosticMessage(ctx, {});
  assert.equal(msg.flags, 64);
  assert.equal(msg.components[0].components[0].custom_id, "p|meq1|r64-2|a");
  const hash = discordVoter(db, "123456", "secret");
  assert.equal(hash, discordVoter(db, "123456", "secret"));
  assert.equal(savePredictionFor(db, state, { hash, name: voterName("", { id: "123456", username: "fan_42!" }), event: "meq1", id: "r64-2", pick: "Team 3" }).ok, true);
  assert.equal(db.prepare("SELECT name FROM voters WHERE hash = ?").get(hash).name, "fan_42");
  // the site's own name, tied by a code
  assert.equal(savePrediction(db, state, { token: T, name: "Site", event: "meq1", id: "r64-2", pick: "Team 4" }).ok, true);
  const siteHash = db.prepare("SELECT hash FROM voters WHERE name = 'Site'").get().hash;
  const code = makeLinkCode(db, siteHash);
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.equal(useLinkCode(db, "123456", "nope"), "");
  assert.equal(useLinkCode(db, "123456", code.toLowerCase()), "Site");
  assert.equal(useLinkCode(db, "123456", code), ""); // once
  assert.equal(discordVoter(db, "123456", "secret"), siteHash);
});

test("follows, use counts and settings", () => {
  const db = openDb(":memory:");
  assert.equal(toggleFollow(db, "u1", "fnatic", "Fnatic"), true);
  assert.deepEqual(followersOf(db, ["fnatic", "x"]).map((f) => f.user), ["u1"]);
  assert.equal(toggleFollow(db, "u1", "fnatic", "Fnatic"), false);
  countUse(db, "score", "u1");
  countUse(db, "score", "u2");
  const u = botUsage(db);
  assert.deepEqual([u.total, u.users], [2, 2]);
  assert.deepEqual(botSettings(db).announce, { start: true, result: true, image: true, transfers: false, news: true });
  const r = saveBotSettings(db, { channel: "123456789012", role: "bad", roleWhen: "final", lang: "en", disabled: ["top", "nope"], events: { gc: false } });
  assert.deepEqual([r.settings.channel, r.settings.role, r.settings.roleWhen, r.settings.lang, r.settings.disabled, r.settings.events.gc, r.settings.events.q1], ["123456789012", "", "final", "en", ["top"], false, true]);
});

test("what the bot posts: chosen kinds and events, the role on final rounds, pictures; the pinned message", () => {
  const settings = { announce: { start: true, result: false, image: true }, events: { q1: true, q2: false }, role: "999", roleWhen: "final" };
  const a = (kind, event, id) => ({ kind, event, url: `/match/${event}/${id}`, a: "A", b: "B", sa: 2, sb: 0, teams: [] });
  const line = (x) => `${x.kind} ${x.event} ${x.url}`;
  let out = botMessages([a("live", "q1", "r64-1"), a("live", "q2", "qf-1"), a("result", "q1", "r64-2")], settings, line, groupMessages);
  assert.equal(out.length, 1);
  assert.doesNotMatch(out[0].content, /999|q2|result/);
  out = botMessages([a("live", "q1", "sf-1")], settings, line, groupMessages);
  assert.match(out[0].content, /^<@&999> /);
  assert.deepEqual(out[0].allowed_mentions.roles, ["999"]);
  assert.equal(isFinalRound(a("live", "q1", "gf-1")), true);
  out = botMessages([a("result", "q1", "r64-2")], { ...settings, announce: { start: true, result: true, image: true } }, line, groupMessages);
  assert.equal(out.length, 2);
  assert.match(out[1].embeds[0].image.url, /\/api\/og\/q1\/r64-2/);
  const db = played();
  const e = pinnedEmbed(getState(db), "fr");
  assert.match(JSON.stringify(e), /À venir aujourd'hui|Résultats du jour|Pas de match/);
});

test("more commands: map, compare, head to head, agent, records, recap, schedule, help", async () => {
  const { helpMessage } = await import("../lib/discordbot.js");
  const { compareTeams } = await import("../lib/playerstats.js");
  const db = played();
  const state = getState(db);
  const card = { map: "Lotus", played: 4, diff: 5, overtime: 1, attack: 52, teams: [{ name: "Team 1", played: 2, won: 2 }], players: [{ name: "Alpha", r: 1.4, acs: 270 }] };
  const extra = { agents: [{ agent: "jett", name: "Jett", picks: 10, wins: 6, pct: 60, best: [{ name: "Alpha", r: 1.3 }] }], records: { acs: [{ name: "Alpha", value: 400, map: "Lotus" }], kills: [], long: [], blowout: [], comeback: [] } };
  const ctx = botCtx(state, { mapCard: () => card, extra: () => extra, h2h: (a, b) => compareTeams(state, a, b) });
  const text = (r) => JSON.stringify(r);
  assert.match(text(answerCommand("carte", cmd("carte", { nom: "lotus" }), ctx)), /Attaque \*\*52%\*\*/);
  assert.match(text(answerCommand("compare", cmd("compare", { joueur1: "alpha", joueur2: "beta" }), ctx)), /Alpha vs Beta/);
  assert.match(text(answerCommand("h2h", cmd("h2h", { equipe1: "Team 1", equipe2: "Team 2" }), ctx)), /Team 1 1 – 0 Team 2/);
  assert.match(text(answerCommand("agent", cmd("agent", { nom: "Jett" }), ctx)), /60%/);
  assert.match(text(answerCommand("records", cmd("records"), ctx)), /Alpha\*\* 400/);
  assert.match(text(answerCommand("recap", cmd("recap", { tournoi: "q1" }), ctx)), /Pas de récap/);
  assert.match(text(answerCommand("calendrier", cmd("calendrier", { jour: "week" }), ctx)), /7 prochains jours/);
  assert.equal(helpMessage("fr", ["top"]).embeds[0].fields.some((f) => f.value.includes("`/top`") || f.value.includes("`/top ")), false);
  assert.deepEqual(autocomplete(cmd("carte", { nom: "lo" }, { focused: "nom" }), ctx).map((c) => c.value), ["Lotus"]);
  assert.ok(autocomplete(cmd("compare", { joueur1: "team" }, { focused: "joueur1" }), ctx).length >= 0);
});

test("automatic posts, buttons, scheduled announcements, log", async () => {
  const { answerButtons } = await import("../lib/discordbot.js");
  const { dailyEmbed, dueReminders, threadStarts } = await import("../lib/botnotify.js");
  const { botLog, cancelScheduled, logBot, scheduleAnnouncement, scheduledList, sendOnce, takeDueScheduled } = await import("../lib/botstore.js");
  const db = played();
  setMatchTime(db, { event: "meq1", id: "r64-3", at: new Date(Date.now() + 15 * 60000).toISOString() });
  const state = getState(db);
  assert.deepEqual(dueReminders(state).map((m) => m.id), ["r64-3"]);
  assert.equal(sendOnce(db, "rem:x"), true);
  assert.equal(sendOnce(db, "rem:x"), false);
  setMatchTime(db, { event: "meq1", id: "r64-1", at: new Date().toISOString() });
  assert.match(JSON.stringify(dailyEmbed(getState(db), "fr")), /Résumé du jour · 1 match/);
  const a = (id) => ({ kind: "live", event: "q1", url: `/match/q1/${id}`, key: id });
  assert.deepEqual(threadStarts([a("r64-1"), a("sf-1")], { threads: "final", events: {} }).map((x) => x.key), ["sf-1"]);
  assert.equal(threadStarts([a("r64-1")], { threads: "none", events: {} }).length, 0);
  // buttons
  const withB = answerButtons("score", cmd("score", { equipe: "Team 1" }), { embeds: [{ url: "https://site.test/x" }] }, "https://site.test", "fr");
  assert.deepEqual(withB.components[0].components.map((b) => b.custom_id || b.url), ["https://site.test/x", "f|Team 1", "r|score|Team 1"]);
  // scheduled
  assert.equal(scheduleAnnouncement(db, { at: new Date(Date.now() - 3600000).toISOString(), channel: "1", payload: {}, label: "x" }).ok, false);
  assert.equal(scheduleAnnouncement(db, { at: new Date(Date.now() + 60000).toISOString(), channel: "123456", payload: { content: "hi" }, label: "Hi" }).ok, true);
  assert.equal(scheduledList(db).length, 1);
  assert.equal(takeDueScheduled(db).length, 0);
  const due = takeDueScheduled(db, Date.now() + 120000);
  assert.deepEqual(due.map((x) => x.payload.content), ["hi"]);
  assert.equal(takeDueScheduled(db, Date.now() + 120000).length, 0); // once
  assert.equal(cancelScheduled(db, 999).ok, false);
  logBot(db, "test", "ok line");
  logBot(db, "test", "bad line", false);
  assert.deepEqual(botLog(db).map((l) => [l.text, l.ok]), [["bad line", false], ["ok line", true]]);
});

test("round 4: live message, polls, guessing game, server users, fans' roles", async () => {
  const x = await import("../lib/botextra.js");
  const db = played();
  const state = getState(db);
  const m = state.qualifiers.meq1 && (await import("../lib/matchlist.js")).allMatches(state).find((y) => y.event === "meq1" && y.id === "r64-1");
  const e = x.liveEmbed({ ...m, sa: null, sb: null }, { a: 1, b: 0, maps: [{ map: "Lotus", a: 13, b: 9, done: true }, { map: "Bind", a: 4, b: 2 }] }, "fr");
  assert.match(e.title, /^🔴 Team 1 1–0 Team 2/);
  assert.match(e.description, /▶ Bind \*\*4–2\*\*/);
  const big = { ...m, id: "sf-1", sa: null, sb: null, live: false, at: new Date(Date.now() + 2 * 3600000).toISOString() };
  const p = x.pollPayload(big, "fr");
  assert.deepEqual([p.poll.answers.length, p.poll.duration], [2, 2]);
  const players = Array.from({ length: 6 }, (_, k) => ({ slug: `p${k}`, name: `P${k}`, team: `Team ${k % 5}`, maps: 5, r: 1.1, acs: 200 + k, kd: 1.2, agents: [{ name: "jett", n: 3 }] }));
  for (let seed = 0; seed < 3; seed++) {
    const q = x.makeQuestion(state, players, "fr", seed);
    assert.ok(q && q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length, `seed ${seed}`);
    const msg = x.questionMessage(q, "fr");
    const out = x.answerQuestion(db, "u1", "Fan", msg, q.answer, q.answer, "fr");
    assert.match(out.embeds[0].description, /Bonne réponse/);
  }
  assert.deepEqual(x.gameRanking(db).map((r) => [r.name, r.points, r.played]), [["Fan", 3, 3]]);
  x.noteGuildUser(db, "g1", "u1");
  x.noteGuildUser(db, "g1", "u1");
  assert.deepEqual(x.guildUsers(db, "g1"), ["u1"]);
  db.prepare("INSERT INTO kv (key, value) VALUES ('bot_roles', ?)").run(JSON.stringify({ g1: { "team-1": "555" } }));
  assert.deepEqual(x.fanRolesFor(db, "g1", ["team-1", "team-2"]), ["555"]);
});
