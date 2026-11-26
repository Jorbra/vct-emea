// The bot's live connection (lib/botgateway.js) with a pretend WebSocket: it says who it is with the intents it needs,
// keeps the connection alive, and connects again without the privileged intents when Discord refuses them (code 4014).
import test from "node:test";
import assert from "node:assert/strict";

test("gateway: identify, heartbeat, ready; without the privileged intents after a 4014", async () => {
  const sockets = [];
  class FakeSocket {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() { this.closed = true; }
    hello() { this.onmessage({ data: JSON.stringify({ op: 10, d: { heartbeat_interval: 40000 } }) }); }
  }
  const before = { ws: globalThis.WebSocket, token: process.env.DISCORD_BOT_TOKEN };
  globalThis.WebSocket = FakeSocket;
  process.env.DISCORD_BOT_TOKEN = "aaa.bbb.ccc"; // a pretend token: nothing reaches Discord
  delete globalThis.__vctGatewayStarted;
  try {
    const { FULL_INTENTS, BASIC_INTENTS, gatewayState, startGateway } = await import("../lib/botgateway.js");
    startGateway({ getDb: () => null });
    assert.equal(sockets.length, 1);
    assert.match(sockets[0].url, /^wss:\/\/gateway\.discord\.gg\/\?v=10&encoding=json$/);
    sockets[0].hello();
    const id = sockets[0].sent.find((p) => p.op === 2);
    assert.equal(id.d.intents, FULL_INTENTS);
    assert.equal(id.d.token, "aaa.bbb.ccc");
    sockets[0].onmessage({ data: JSON.stringify({ op: 0, t: "READY", s: 1, d: { session_id: "S", resume_gateway_url: "wss://resume.example", user: { id: "B" } } }) });
    assert.equal(gatewayState().on, true);
    // Discord refuses the privileged intents: again, without them, and the editor is told
    sockets[0].onclose({ code: 4014 });
    assert.equal(gatewayState().on, false);
    assert.match(gatewayState().error, /Intents privilégiés/);
    await new Promise((r) => setTimeout(r, 2300));
    assert.equal(sockets.length, 2);
    assert.match(sockets[1].url, /^wss:\/\/gateway\.discord\.gg/); // a new session, not a resume
    sockets[1].hello();
    assert.equal(sockets[1].sent.find((p) => p.op === 2).d.intents, BASIC_INTENTS);
    // a token Discord refuses: no retry loop
    sockets[1].onclose({ code: 4004 });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(sockets.length, 2);
    assert.match(gatewayState().error, /4004/);
  } finally {
    globalThis.WebSocket = before.ws;
    if (before.token === undefined) delete process.env.DISCORD_BOT_TOKEN; else process.env.DISCORD_BOT_TOKEN = before.token;
  }
});
