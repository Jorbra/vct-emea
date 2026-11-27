// A ticket read in the editor (lib/botticket.js): the saved transcript turned back into messages, the live ones alike.
import test from "node:test";
import assert from "node:assert/strict";
import { buildTranscript } from "../lib/botmod2.js";
import { isImage, liveMessages, parseTranscript } from "../lib/botticket.js";

// Discord's messages, newest first
const RAW = [
  { id: "3", timestamp: "2026-11-26T14:19:30.000Z", author: { id: "9", username: "VCT EMEA", bot: true }, content: "🔒 Ticket fermé par <@2>.", embeds: [], attachments: [] },
  { id: "2", timestamp: "2026-11-26T14:19:00.000Z", author: { id: "2", username: "modo", global_name: "Modo" }, content: "Bonjour ! Voici la **règle** :\nhttps://vct.example/regles", embeds: [], attachments: [{ url: "https://cdn.discordapp.com/a/capture.png" }] },
  { id: "1", timestamp: "2026-11-26T14:18:00.000Z", author: { id: "1", username: "alice", avatar: "abc" }, content: "J'ai un souci", embeds: [{ title: "Formulaire", description: "Pseudo : alice" }], attachments: [] },
];

test("ticket: the saved transcript reads back as messages, oldest first, with files and embeds", () => {
  const text = buildTranscript(RAW, { name: "T1", opened: "2026-11-26T14:18:00.000Z", closedBy: "Modo" });
  const { head, messages } = parseTranscript(text);
  assert.equal(head.closedBy, "Modo");
  assert.equal(head.count, 3);
  assert.deepEqual(messages.map((m) => m.who), ["alice", "Modo", "VCT EMEA"]);
  assert.equal(messages[0].at, "2026-11-26T14:18:00Z");
  assert.deepEqual(messages[0].embeds, ["Formulaire · Pseudo : alice"]);
  assert.equal(messages[1].text, "Bonjour ! Voici la **règle** :\nhttps://vct.example/regles", "the line breaks come back");
  assert.deepEqual(messages[1].files, ["https://cdn.discordapp.com/a/capture.png"]);
  assert.deepEqual(parseTranscript("").messages, []);
});

test("ticket: the live messages in the same shape, with avatars and the bot marked", () => {
  const m = liveMessages(RAW);
  assert.deepEqual(m.map((x) => x.who), ["alice", "Modo", "VCT EMEA"]);
  assert.equal(m[0].avatar, "https://cdn.discordapp.com/avatars/1/abc.png?size=64");
  assert.equal(m[2].bot, true);
  assert.deepEqual(m[1].files, ["https://cdn.discordapp.com/a/capture.png"]);
  assert.equal(liveMessages([{ id: "x", author: { id: "1" }, content: "", embeds: [], attachments: [] }]).length, 0, "an empty message is left out");
  assert.ok(isImage("https://cdn.discordapp.com/a/capture.png?ex=1"));
  assert.ok(!isImage("https://cdn.discordapp.com/a/rapport.pdf"));
});
