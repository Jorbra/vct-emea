// Runs once when a server starts. The pages are drawn on the server, then taken over by the browser: the times they show
// (match times, dates) must be written in the same time zone in both, or React throws the page away and draws it again.
// The visitors are mostly in Central European Time, the VCT EMEA's own time: the server writes its times there too.
export function register() {
  if (!process.env.SITE_TZ_SET) {
    process.env.TZ = process.env.SITE_TZ || "Europe/Paris";
    process.env.SITE_TZ_SET = "1";
  }
}
