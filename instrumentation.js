// Runs once when a server starts. The pages are drawn on the server, then taken over by the browser: the times they show
// (match times, dates) must be written in the same time zone in both, or React throws the page away and draws it again.
// The visitors are mostly in Central European Time, the VCT EMEA's own time: the server writes its times there too.
export function register() {
  // the site's public address: Vercel gives it as VERCEL_PROJECT_PRODUCTION_URL, the code reads that name everywhere.
  // Elsewhere: SITE_HOST if set (a domain of its own), or the address Render gives (RENDER_EXTERNAL_HOSTNAME).
  if (!process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const host = process.env.SITE_HOST || process.env.RENDER_EXTERNAL_HOSTNAME || "";
    if (host) process.env.VERCEL_PROJECT_PRODUCTION_URL = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  if (!process.env.SITE_TZ_SET) {
    process.env.TZ = process.env.SITE_TZ || "Europe/Paris";
    process.env.SITE_TZ_SET = "1";
  }
  // the Discord bot's live connection (lib/botgateway.js): moderation log, welcome and goodbye, anti-flood. Only on a server
  // with the bot's token; DISCORD_GATEWAY=off turns it off.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GATEWAY !== "off") {
    setTimeout(async () => {
      try {
        const { gatewayWanted, startGateway } = await import("./lib/botgateway.js");
        if (!gatewayWanted()) return;
        const { getDb } = await import("./lib/db.js");
        startGateway({ getDb });
      } catch (e) { console.log(`[gateway] not started: ${e.message}`); }
    }, 8000).unref?.();
  }
  // on a server that keeps running: a few seconds after it starts, it opens its heaviest pages itself, so that their
  // season-wide numbers are ready (lib/keep.js) before the first visitor comes
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.BACKGROUND_WORK === "external") {
    const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
    setTimeout(async () => {
      for (const page of ["/", "/stats"]) {
        try { await fetch(base + page, { signal: AbortSignal.timeout(60000) }); } catch { /* the first visitor will do it */ }
      }
      console.log("[warm] home and stats ready");
    }, 5000).unref?.();
  }
}
