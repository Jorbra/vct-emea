// Round 14: vlr.gg's tables for the editors, a re-read, missing pictures, the meta draft, the new bot commands.
import test from "node:test";
import assert from "node:assert/strict";
import { getState, openDb } from "../lib/db.js";
import { saveQualifierScore, setQualifierTeams } from "../lib/qactions.js";
import { allMatches } from "../lib/matchlist.js";
import { readItems, saveItem } from "../lib/lpstore.js";
import { metaDraft, missingPictures, rereadVlr, vlrReport } from "../lib/round14.js";
import { COMMANDS, answerCommand } from "../lib/discordbot.js";
import { BOT_COMMANDS } from "../lib/botstore.js";
import { botCtx, cmd } from "./botctx.mjs";

test("vlr.gg's tables: finished matches with and without, a re-read asked", () => {
  const db = openDb(":memory:");
  setQualifierTeams(db, "q1", Array.from({ length: 8 }, (_, i) => `T${i}`).join("\n"));
  const ms = allMatches(getState(db)).filter((m) => m.event === "q1" && m.a && m.b && m.a.name && m.b.name);
  saveQualifierScore(db, { event: "q1", id: ms[0].id, sa: 2, sb: 0 });
  assert.equal(saveQualifierScore(db, { event: "q1", id: ms[1].id, sa: 2, sb: 0 }).ok, true, JSON.stringify(ms[1]));
  const state = getState(db);
  state.extra = { q1: { [ms[0].id]: { hasDetails: true } } };
  const r = vlrReport(state, { [`q1:${ms[0].id}`]: { v: 2 } });
  assert.deepEqual(r.events, [{ event: "q1", done: 2, withStats: 1, old: 1 }]);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].id, ms[1].id);
  saveItem("vlr_match", `q1:${ms[0].id}`, { v: 3, full: true, reads: 1 }, db);
  assert.equal(rereadVlr(db, "q1", ms[0].id).queued, true);
  assert.equal(readItems("vlr_match", db)[`q1:${ms[0].id}`].v, 0);
  assert.equal(rereadVlr(db, "nope", "x").ok, false);
});

test("pictures missing and the meta draft", () => {
  const entries = [{ details: { maps: [{ map: "Newmap", rows: [{ side: "a", agents: ["jett", "newagent"] }] }, { map: "Bind", rows: [] }, { map: "TBD", rows: [] }] } }];
  assert.deepEqual(missingPictures(entries), { agents: ["newagent"], maps: ["Newmap"] });
  assert.equal(metaDraft(getState(openDb(":memory:")), []), "");
});

test("bot: /meta, /duelagent, /pool", () => {
  for (const c of ["meta", "duelagent", "pool"]) { assert.ok(COMMANDS.some((x) => x.name === c), c); assert.ok(BOT_COMMANDS.includes(c), c); }
  const db = openDb(":memory:");
  setQualifierTeams(db, "q1", "Alpha\nBravo");
  const state = getState(db);
  const tiers = [{ tier: "S", agents: [{ name: "viper", games: 4, pick: 100, win: 50 }] }];
  const page = (k, color) => ({ key: k, name: k.toUpperCase(), color, icon: "https://x/i.png", picks: 10, share: 40, pct: 55, maps: [{ map: "Bind", pct: 50 }] });
  const ctx = botCtx(state, { agentTiers: () => tiers, agentPage: (n) => (/jett|viper/i.test(n) ? page(n.toLowerCase(), "#5cb1d6") : null), stats: () => ({ players: [], teams: { alpha: { byMap: [{ map: "Bind", played: 4, won: 3 }] } } }) });
  const meta = answerCommand("meta", cmd("meta", { nom: "Bind" }), ctx);
  assert.match(meta.embeds[0].description, /\*\*S\*\* · Viper 100%/);
  const duel = answerCommand("duelagent", cmd("duelagent", { agent1: "Jett", agent2: "Viper" }), ctx);
  assert.equal(duel.embeds[0].title, "JETT vs VIPER");
  assert.match(answerCommand("duelagent", cmd("duelagent", { agent1: "Jett", agent2: "Nobody" }), ctx).content, /inconnu/);
  const pool = answerCommand("pool", cmd("pool", { equipe: "Alpha" }), ctx);
  assert.match(pool.embeds[0].description, /\*\*Bind\*\* 3–1 \(75%\)/);
});
