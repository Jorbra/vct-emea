// Reads a team's or a player's Liquipedia page (rendered HTML of its API) into the fields of the site's pages. Pure, no I/O.
import { COUNTRIES } from "./countries.js";

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** Plain text of some HTML, without its reference marks. */
const text = (html) => decode(html.replace(/<sup[\s\S]*?<\/sup>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const CODE = Object.fromEntries(COUNTRIES.map(([cc, name]) => [name.toLowerCase(), cc]));
const ALIAS = { turkey: "tr", "united kingdom": "gb", "czech republic": "cz", "south korea": "kr", russia: "ru", kosovo: "xk" };
/** flagcdn code of a country as Liquipedia names it; "" when unknown. */
export const countryCode = (name) => { const n = String(name || "").toLowerCase(); return ALIAS[n] || CODE[n] || ""; };

const LINK_TYPES = [
  [/twitter\.com|x\.com/, "X"], [/instagram\.com/, "Instagram"], [/youtube\.com/, "YouTube"], [/twitch\.tv/, "Twitch"],
  [/facebook\.com/, "Facebook"], [/discord\.(gg|com)/, "Discord"], [/tiktok\.com/, "TikTok"], [/vk\.com/, "VK"],
  [/weibo\.com/, "Weibo"], [/bilibili\.com/, "Bilibili"], [/vlr\.gg/, "VLR"],
];
const linkType = (url) => (LINK_TYPES.find(([re]) => re.test(url)) || [null, "Website"])[1];

/** The HTML from a heading with this id up to the next heading of the same level or above. */
function section(html, id) {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) return "";
  const level = (html.slice(Math.max(0, at - 6), at).match(/<h([2-6])/) || [])[1] || "2";
  const re = new RegExp(`<h[2-${level}][ >]`, "g");
  re.lastIndex = at;
  const next = re.exec(html);
  return html.slice(at, next ? next.index : undefined);
}

/** The people of the "Active" part of a main section ("Active_2" when MediaWiki numbers it); none when it has no such part. */
function activePeople(html, sectionId) {
  return partPeople(html, sectionId, "Active");
}

/** The people of one part of a main section ("Former", "Former_2" when MediaWiki numbers it); none when it has no such part. */
function partPeople(html, sectionId, part) {
  const main = section(html, sectionId);
  const id = (main.match(new RegExp(`id="(${part}(?:_\\d+)?)"`)) || [])[1];
  return id ? people(section(main, id)) : [];
}

/** Who left most recently first. */
const latestFirst = (list) => list.map((p, i) => ({ p, i })).sort((a, b) => (b.p.leave || "").localeCompare(a.p.leave || "") || a.i - b.i).map((x) => x.p);

/** The rows of a table: arrays of the raw HTML of their cells, the header row first. */
const rows = (table) => [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1]));
const tables = (html) => [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((t) => t[0]);

/** People of a roster or organization section: { id, name, country, cc, role, join, captain, leave, newTeam, newTeamName (its page's name) }. */
function people(html) {
  const out = [];
  for (const t of tables(html)) {
    const [head, ...body] = rows(t);
    if (!head) continue;
    const col = (label) => head.findIndex((c) => text(c).toLowerCase() === label);
    const iId = col("id");
    if (iId < 0) continue;
    const iName = col("name");
    const iJoin = col("join date");
    const iLeave = [col("leave date"), col("inactive date")].find((i) => i >= 0) ?? -1;
    const iNew = col("new team");
    // the role column has no title on Liquipedia, or is called Position / Role
    const iRole = head.findIndex((c, i) => i !== iId && i !== iName && i !== iJoin && ["", "position", "role"].includes(text(c).toLowerCase()));
    for (const c of body) {
      if (c.length <= iId) continue;
      const id = text(c[iId]);
      if (!id) continue;
      const country = (c[iId].match(/class="flag"[^>]*>\s*<img[^>]*alt="([^"]*)"/) || [])[1] || "";
      out.push({
        id, name: iName >= 0 && c[iName] ? text(c[iName]) : "", country: decode(country), cc: countryCode(decode(country)),
        role: iRole >= 0 && c[iRole] ? text(c[iRole]) : "", join: iJoin >= 0 && c[iJoin] ? text(c[iJoin]).slice(0, 10) : "",
        captain: /fa-crown/.test(c[iId]),
        // only people who left have these; a link to a page that does not exist gives no name
        ...(iLeave >= 0 ? { leave: c[iLeave] ? text(c[iLeave]).slice(0, 10) : "" } : {}),
        ...(iNew >= 0 ? { newTeam: c[iNew] ? text(c[iNew]) : "", newTeamName: c[iNew] ? decode((c[iNew].match(/<a[^>]*href="\/valorant\/(?!index\.php)[^"]*"[^>]*title="([^"]*)"/) || [])[1] || "") : "" } : {}),
      });
    }
  }
  return out;
}

/** The first image of some HTML as a path under Liquipedia's commons/images ("a/ae/VCT_icon_allmode.png"), also from a thumbnail; "" if none. */
function imagePath(html) {
  const src = (String(html || "").match(/<img[^>]*src="\/commons\/images\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/"]+)/) || [])[1];
  return src ? decode(src) : "";
}

/** The logo meant for dark backgrounds, when the page gives one logo per theme; "" otherwise. */
function darkImagePath(html) {
  const src = (String(html || "").match(/darkmode[^>]*>\s*(?:<a[^>]*>)?\s*<img[^>]*src="\/commons\/images\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/"]+)/) || [])[1];
  return src ? decode(src) : "";
}

/**
 * The organization's other teams, from the tabs at the top of the page: { name, page, logo, logoDark }. The page's own team has
 * no link there. Tabs that are not teams (Overview, Results...) are left out.
 */
function orgTeams(head) {
  const out = [];
  for (const m of head.matchAll(/<li[^>]*>\s*<span>\s*(<span class="team-template-team-standard"[\s\S]*?)<\/li>/g)) {
    const href = (m[1].match(/<a[^>]*href="\/valorant\/([^"#]+)"/) || [])[1];
    if (!href || /mw-selflink/.test(m[1])) continue;
    let page = decode(href);
    try { page = decodeURIComponent(page); } catch { /* not %-encoded */ }
    out.push({ name: text(m[1]), page: page.replace(/_/g, " "), logo: imagePath(m[1]), logoDark: darkImagePath(m[1]) });
  }
  return out;
}

/** The first link of some HTML as a full Liquipedia address; "" if none. */
function pageLink(html) {
  const href = (String(html || "").match(/<a[^>]*href="(\/valorant\/[^"#]+)"/) || [])[1];
  return href ? "https://liquipedia.net" + decode(href) : "";
}

/** The infobox: its labelled fields by lower-case label (without the ":"). */
function infobox(html) {
  const end = html.search(/<h2[ >]/);
  const box = end > 0 ? html.slice(0, end) : html;
  const out = {};
  const parts = box.split('infobox-cell-2 infobox-description">').slice(1);
  for (const part of parts) {
    const stop = part.search(/class="[^"]*(infobox-header|infobox-center|infobox-icons)/);
    // stop before the tag that holds the next block (not inside it)
    const cut = stop > 0 ? part.slice(0, part.lastIndexOf("<", stop)) : part.slice(0, 4000);
    const t = text("<x>" + cut.replace(/<div class="$/, ""));
    const i = t.indexOf(":");
    if (i < 0) continue;
    out[t.slice(0, i).trim().toLowerCase()] = { value: t.slice(i + 1).trim(), html: cut };
  }
  return out;
}

/** The infobox's icons: [{ type, url }]. */
function iconLinks(head) {
  const icons = (head.match(/infobox-icons[\s\S]*?<\/div>/) || [""])[0];
  return [...new Set([...icons.matchAll(/href="(https?:[^"]+)"/g)].map((m) => decode(m[1])))].map((url) => ({ type: linkType(url), url }));
}

/**
 * A tournament's page: { series, organizer, type, location, venue, prizePool, start, end, teams, tier, placements }.
 * placements: { place, team, logo, logoDark, prize }, in the order of its prize table.
 */
export function parseTournamentPage(html) {
  const box = infobox(html);
  const f = (...labels) => { for (const l of labels) if (box[l] && box[l].value) return box[l].value; return ""; };
  const placements = [];
  let place = "";
  for (const row of section(html, "Prize_Pool").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    // a shared place is written once, on the first of its rows
    const here = row[1].match(/prizepooltable-place[^>]*>([\s\S]*?)<\/td>/);
    if (here) place = text(here[1]);
    const cell = row[1].match(/prizepooltable-col-team[^>]*>([\s\S]*?)<\/td>/);
    if (!cell) continue;
    const team = decode((cell[1].match(/<a[^>]*title="([^"]*)"/) || [])[1] || "");
    if (!team) continue;
    const money = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1])).find((c) => c.includes("$")) || "";
    placements.push({ place, team, logo: imagePath(cell[1]), logoDark: darkImagePath(cell[1]), prize: money });
  }
  return {
    series: f("series"), organizer: f("organizer", "organizers"), type: f("type"), location: f("location"), venue: f("venue"),
    prizePool: f("prize pool"), start: f("start date"), end: f("end date"), teams: f("teams", "number of teams"), tier: f("liquipedia tier"),
    placements,
  };
}

/**
 * A player's page: { name, nationality: [{ name, cc }], status, years, roles, team, winnings, links, history, results }.
 * history: { period, team, note ("Inactive", "Loan"...) }, the latest first.
 * results: { date, place, tier, tournament, tournamentLogo, tournamentUrl, team, teamName, teamLogo, score, opponent, opponentName, opponentLogo, prize },
 * as Liquipedia lists them on that page (its latest results only). A group-stage exit has no opponent.
 */
export function parsePlayerPage(html) {
  const box = infobox(html);
  const f = (...labels) => { for (const l of labels) if (box[l] && box[l].value) return box[l].value; return ""; };
  const end = html.search(/<h2[ >]/);
  const head = end > 0 ? html.slice(0, end) : html;
  const flags = box.nationality ? [...box.nationality.html.matchAll(/class="flag"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"/g)].map((m) => decode(m[1])) : [];
  const from = head.indexOf(">History<");
  const history = [];
  for (const c of rows(from < 0 ? "" : tables(head.slice(from))[0] || "")) {
    if (c.length < 2) continue;
    const full = text(c[1]);
    const m = full.match(/^(.*?)\s*\(([^()]*)\)$/);
    history.unshift({ period: text(c[0]), team: m ? m[1] : full, note: m ? m[2] : "" });
  }
  const achievements = tables(section(html, "Achievements") || section(html, "Results"))[0] || "";
  const results = [];
  for (const c of rows(achievements).slice(1)) {
    if (c.length < 8) continue; // the spacer rows
    // date, place, tier, tournament logo, tournament, team, score, opponent, prize (no opponent cell when the score spans it)
    const [date, place, tier, icon, tournament, team, score] = c;
    const opponent = c.length >= 9 ? c[7] : "";
    const titleOf = (cell) => decode((cell.match(/<a[^>]*title="([^"]*)"/) || [])[1] || "");
    results.push({
      date: text(date).slice(0, 10), place: text(place), tier: text(tier),
      tournament: text(tournament), tournamentLogo: imagePath(icon), tournamentLogoDark: darkImagePath(icon), tournamentUrl: pageLink(tournament),
      team: text(team) || titleOf(team), teamName: titleOf(team), teamLogo: imagePath(team), teamLogoDark: darkImagePath(team),
      score: text(score), opponent: text(opponent), opponentName: titleOf(opponent), opponentLogo: imagePath(opponent), opponentLogoDark: darkImagePath(opponent),
      prize: text(c[c.length - 1]),
    });
  }
  return {
    name: f("romanized name", "name"), // in Latin letters when the page gives both
    nationality: (flags.length ? flags : f("nationality") ? [f("nationality")] : []).map((name) => ({ name, cc: countryCode(name) })),
    status: f("status"), years: f("years active (player)", "years active"), roles: f("roles", "role"),
    team: f("team"), winnings: f("approx. total winnings"),
    links: iconLinks(head),
    history,
    results,
  };
}

/**
 * { location: [names], region, coach, igl, manager, winnings, created: [dates], links: [{ type, url }], org (the organization's
 * other teams), roster, staff, results }.
 * results: { date, place, tier, tournament, tournamentLogo, tournamentUrl, score, opponent, opponentName, opponentLogo, prize },
 * the latest first as Liquipedia lists them. Logos are paths under Liquipedia's commons/images; a group-stage exit has no opponent.
 */
export function parseTeamPage(html) {
  const box = infobox(html);
  const f = (...labels) => { for (const l of labels) if (box[l] && box[l].value) return box[l].value; return ""; };
  const end = html.search(/<h2[ >]/);
  const head = end > 0 ? html.slice(0, end) : html;
  const links = iconLinks(head);
  const loc = box.location ? [...box.location.html.matchAll(/class="flag"[^>]*>\s*<img[^>]*alt="([^"]*)"/g)].map((m) => decode(m[1])) : [];
  const res = section(html, "Results");
  const achievements = tables(res)[0] || "";
  const results = [];
  for (const c of rows(achievements).slice(1)) {
    if (c.length < 7) continue; // the spacer rows
    // date, place, tier, tournament logo, tournament, score, opponent, prize (no opponent cell when the score spans it)
    const [date, place, tier, icon, tournament, score] = c;
    const opponent = c.length >= 8 ? c[6] : "";
    results.push({
      date: text(date).slice(0, 10), place: text(place), tier: text(tier),
      tournament: text(tournament), tournamentLogo: imagePath(icon), tournamentLogoDark: darkImagePath(icon), tournamentUrl: pageLink(tournament),
      score: text(score), opponent: text(opponent), opponentName: decode((opponent.match(/<a[^>]*title="([^"]*)"/) || [])[1] || ""), opponentLogo: imagePath(opponent), opponentLogoDark: darkImagePath(opponent),
      prize: text(c[c.length - 1]),
    });
  }
  return {
    location: loc.length ? loc : f("location") ? [f("location")] : [],
    region: f("region"), coach: f("coach", "coaches"), igl: f("in-game leader"), manager: f("manager"),
    winnings: f("approx. total winnings"), created: (f("created").match(/\d{4}-\d{2}-\d{2}/g) || []),
    links,
    org: orgTeams(head),
    roster: activePeople(html, "Player_Roster"),
    staff: activePeople(html, "Organization"),
    inactivePlayers: partPeople(html, "Player_Roster", "Inactive"),
    formerPlayers: latestFirst([...partPeople(html, "Player_Roster", "Former"), ...partPeople(html, "Player_Roster", "Stand-in").map((p) => ({ ...p, role: p.role || "Stand-in" }))]),
    formerStaff: latestFirst(partPeople(html, "Organization", "Former")),
    results,
  };
}
