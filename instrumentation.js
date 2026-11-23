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
}
