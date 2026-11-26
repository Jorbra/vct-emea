// Pure helpers of the big update (maj-40), read by components/Maj40Bits.jsx and checked in tests/maj40.test.mjs.

/** The time left before a match: { d, h, m } (rounded down to the minute), or null when it has begun. */
export function timeLeft(at, now) {
  const ms = new Date(at).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 };
}

/** The result as text, ready to paste in a chat: "UCAM 2–0 La masia · event · Bind 13–9, Lotus 13–11 · address". */
export function resultText({ a, b, sa, sb, event, maps, url }) {
  const list = (maps || []).filter((x) => x.a != null && x.b != null && x.map).map((x) => `${x.map} ${x.a}–${x.b}`).join(", ");
  return [`${a} ${sa}–${sb} ${b}`, event, list, url].filter(Boolean).join(" · ");
}

/** The words of a page address not found, to search for: "/team/team-vitalty/" -> "team vitalty" (the page kind is left out). */
export function wordsOfPath(path) {
  const parts = String(path || "").split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const words = parts.filter((p, i) => !(i === 0 && parts.length > 1 && /^(team|player|match|tournament|map|agent|pays|p|news|saison)$/i.test(p)));
  return words.join(" ").replace(/[-_+.]+/g, " ").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The news as an RSS 2.0 feed. news: [{ id, title, body, at }], site: "https://…". */
export function rssFeed(news, site) {
  const items = (news || []).map((n) => {
    const link = `${site}/news/${n.id}`;
    const date = Number.isFinite(Date.parse(n.at)) ? new Date(n.at).toUTCString() : "";
    const body = String(n.body || "");
    return `<item><title>${xml(n.title)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid>${date ? `<pubDate>${date}</pubDate>` : ""}<description>${xml(body.length > 500 ? `${body.slice(0, 500)}…` : body)}</description></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>VCT EMEA · Actualités</title><link>${xml(site)}/news</link><description>Les actualités du VCT EMEA.</description><language>fr</language>${items}</channel></rss>`;
}

/** The breadcrumb of a page for search engines (schema.org BreadcrumbList): crumbs [[name, path]], site "https://…". */
export function breadcrumbLd(crumbs, site) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${path}` })) };
}
