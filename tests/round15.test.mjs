// Round 15: agents and maps in the search, the bot's one look, its new commands.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb } from "../lib/db.js";
import { searchAll, searchIndex } from "../lib/search.js";
import { styleAnswer } from "../lib/botstyle.js";
import { COMMANDS, answerCommand } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";
import { botCtx, cmd } from "./botctx.mjs";

test("search: agents and maps with their pictures", () => {
  const items = searchIndex(getState(openDb(":memory:")));
  const r = searchAll(items, "jet");
  assert.equal(r.agents[0].name, "Jett");
  assert.equal(r.agents[0].href, "/agent/jett");
  assert.equal(r.agents[0].pic, "/va/agents/jett-icon.webp");
  assert.equal(searchAll(items, "lotus").maps[0].pic, "/va/maps/lotus-list.webp");
});

test("bot: every embed dressed the same way", () => {
  const a = styleAnswer({ embeds: [{ title: "x" }, { title: "y", color: 1, footer: { text: "note" } }], components: [1] }, "https://site.test", "fr");
  assert.equal(a.embeds[0].color, 0xc9f03c);
  assert.equal(a.embeds[0].author.name, "VCT EMEA");
  assert.equal(a.embeds[0].author.icon_url, "https://site.test/brand/icon-192.png");
  assert.match(a.embeds[0].footer.text, /site\.test/);
  assert.equal(a.embeds[1].color, 1);
  assert.equal(a.embeds[1].footer.text, "note · site.test");
  assert.ok(a.embeds[0].timestamp);
  assert.deepEqual(a.components, [1]);
  assert.deepEqual(styleAnswer({ content: "hi" }, "https://site.test"), { content: "hi" });
});

test("bot: /agentaleatoire and /statsagents", () => {
  for (const c of ["agentaleatoire", "statsagents"]) { assert.ok(COMMANDS.some((x) => x.name === c), c); assert.ok(BOT_COMMANDS.includes(c), c); }
  const ctx = botCtx(getState(openDb(":memory:")), { extra: () => ({ agents: [{ name: "Jett", agent: "jett", picks: 20, pct: 60 }, { name: "Omen", agent: "omen", picks: 30, pct: 40 }] }) });
  const r = answerCommand("agentaleatoire", cmd("agentaleatoire", { role: "Controller" }), ctx);
  assert.match(r.embeds[0].title, /Joue/);
  assert.ok(r.embeds[0].image.url.startsWith("https://"));
  const top = answerCommand("statsagents", cmd("statsagents"), ctx);
  assert.match(top.embeds[0].fields[0].value, /\*\*Jett\*\*/);
});

test("round 16: help grouped by theme, every map and agent offered", async () => {
  const { helpMessage, MAPS, AGENTS } = await import("../lib/discordbot.js");
  const help = helpMessage("fr");
  assert.ok(help.embeds[0].fields.some((f) => /Agents et cartes/.test(f.name) && /\/meta/.test(f.value)));
  assert.equal(helpMessage("fr", ["meta"]).embeds[0].fields.some((f) => /`\/meta/.test(f.value)), false);
  assert.ok(MAPS.includes("Summit") && MAPS.includes("Lotus") && !MAPS.includes("Gauntlet"));
  assert.ok(AGENTS.includes("Jett") && AGENTS.length >= 28);
});

test("the pages send a lighter state and point at the light pictures", async () => {
  const { publicState } = await import("../lib/publicstate.js");
  const { withLocal } = await import("../lib/assetmerge.js");
  const s = { extra: { q1: { a: { hasDetails: true, pstats: [{ name: "x" }], maps: [1] }, b: { hasDetails: false, pstats: [{ name: "y" }] } } }, teams: [] };
  const lite = publicState(s);
  assert.deepEqual(lite.extra.q1.a, { hasDetails: true, pstats: [], maps: [1] });
  assert.deepEqual(lite.extra.q1.b.pstats, [{ name: "y" }]); // no vlr.gg table: the numbers stay
  assert.equal(publicState(s), lite); // the same state, the same object
  assert.equal(s.extra.q1.a.pstats.length, 1); // the server's own state is untouched
  const v = withLocal({ agents: { jett: { icon: "https://x/i.png", portrait: "https://x/p.png" } }, maps: { Lotus: { splash: "https://x/s.png" } } }, { agents: { jett: { icon: "/va/agents/jett-icon.webp" } }, maps: {} });
  assert.equal(v.agents.jett.icon, "/va/agents/jett-icon.webp");
  assert.equal(v.agents.jett.portrait, "https://x/p.png");
  assert.equal(v.maps.Lotus.splash, "https://x/s.png");
});
