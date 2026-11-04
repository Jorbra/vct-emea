// Reads a player's or a team's vlr.gg page into what the site's pages show. Pure, no I/O.
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&sdot;/g, "·").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html) => decode(String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const num = (s) => { const n = parseFloat(String(s).replace(/[%,]/g, "")); return Number.isFinite(n) ? n : 0; };
const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

/** The latest matches of a page: { event, stage, a, b, sa, sb, win (true when the page's own team or player won), date }. */
function recentResults(html) {
  const out = [];
  for (const part of String(html || "").split(/class="wf-card fc-flex m-item"/).slice(1)) {
    const names = [...part.matchAll(/m-item-team-name">([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
    const score = part.match(/m-item-result[^"]*"[^>]*>\s*<span>(\d+)<\/span>\s*<div>:<\/div>\s*<span>(\d+)<\/span>/);
    if (names.length < 2 || !score) continue;
    const event = part.match(/m-item-event[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>([\s\S]*?)<\/div>/);
    const date = part.match(/m-item-date">\s*<div>\s*(\d{4})\/(\d{2})\/(\d{2})/);
    out.push({
      event: event ? text(event[1]) : "", stage: event ? text(event[2]) : "",
      a: names[0], b: names[1], sa: +score[1], sb: +score[2], win: /m-item-result[^"]*mod-win/.test(part),
      date: date ? `${date[1]}-${date[2]}-${date[3]}` : "",
    });
  }
  return out;
}

/** The agents' table: { agent, maps, pick, rounds, rating, acs, kd, kast, adr, kpr, apr, k, d, a, fk, fd }. */
function agentRows(html) {
  const table = (String(html || "").match(/<table class="st-table mod-agent-rows"[\s\S]*?<\/table>/) || [""])[0];
  const out = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const agent = (row[1].match(/<img[^>]*alt="([^"]*)"/) || [])[1];
    if (!agent) continue; // the header
    const c = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    if (c.length < 16) continue;
    const use = c[1].match(/\((\d+)\)\s*(\d+)%/);
    out.push({
      agent: decode(agent), maps: use ? +use[1] : 0, pick: use ? +use[2] : 0, rounds: num(c[2]), rating: num(c[3]), acs: num(c[4]), kd: num(c[5]),
      kast: num(c[6]), adr: num(c[7]), kpr: num(c[8]), apr: num(c[9]), k: num(c[11]), d: num(c[12]), a: num(c[13]), fk: num(c[14]), fd: num(c[15]),
    });
  }
  return out;
}

/** The whole table in one line: averages weighed by rounds played; null with no rounds. */
function allAgents(agents) {
  const rounds = agents.reduce((n, x) => n + x.rounds, 0);
  if (!rounds) return null;
  const avg = (key) => agents.reduce((n, x) => n + x[key] * x.rounds, 0) / rounds;
  const sum = (key) => agents.reduce((n, x) => n + x[key], 0);
  return { rounds, maps: sum("maps"), rating: round(avg("rating"), 2), acs: round(avg("acs"), 1), adr: round(avg("adr"), 1), kast: Math.round(avg("kast")), k: sum("k"), d: sum("d"), a: sum("a"), kd: sum("d") ? round(sum("k") / sum("d"), 2) : sum("k") };
}

/** A player's page: { agents, totals, results, team: { id, name } or null }. */
export function parseVlrPlayer(html) {
  const page = String(html || "");
  const at = page.indexOf("Current Teams");
  const end = page.indexOf("Past Teams");
  const box = at < 0 ? "" : page.slice(at, end > at ? end : undefined);
  const link = box.match(/href="\/team\/(\d+)\/[^"]*"[\s\S]*?font-weight: 500;">([\s\S]*?)<\/div>/);
  const agents = agentRows(page);
  return { agents, totals: allAgents(agents), results: recentResults(page), team: link ? { id: link[1], name: text(link[2]) } : null };
}

/** A team's page: { results }. */
export function parseVlrTeam(html) {
  return { results: recentResults(html) };
}

/** The vlr.gg number of a player or a team, from the links Liquipedia gives; "" without one. kind: "player" | "team". */
export function vlrId(links, kind) {
  for (const l of links || []) {
    const m = String(l.url).match(new RegExp(`^https?://(?:www\\.)?vlr\\.gg/${kind}/(\\d+)`));
    if (m) return m[1];
  }
  return "";
}
