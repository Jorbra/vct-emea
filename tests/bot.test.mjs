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
    assert.match(c.name, /^[a-z]{1,32}$/);
    assert.ok(c.description.length <= 100, c.name);
    for (const o of c.options || []) assert.ok(o.description.length <= 100 && /^[a-z]{1,32}$/.test(o.name), `${c.name}.${o.name}`);
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
