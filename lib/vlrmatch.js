// Match details from vlr.gg: the score in maps, each map's score, the players' numbers, the stream and the VOD.
// A page every 10 seconds at most, a few per round; any refusal stops everything for a day (lib/vlrfetch.js). What an editor typed stays.
import { parseVeto } from "./round13.js";
import { mergeVlr, readSources } from "./sources.js";
import { checkExtra } from "./schedule.js";
import { liveUpdate } from "./vlive.js";

// vlr.gg puts every Europe qualifier in one event, every MENA one in another: the stage written on each match says which of the site's it is.
// A stage that fits none of these is left alone.
export const VLR_EVENTS = [
  { event: "q1", vlr: "3175", stage: /qualifier #1\b/i },
  { event: "q2", vlr: "3175", stage: /qualifier #2\b/i },
  // the Europe playoffs (Swiss Stage, then the bracket) have an event of their own on vlr.gg
  { event: "playoffs", vlr: "3233", stage: /./ },
  { event: "meq1", vlr: "3167", stage: /\b(me|middle east)\b[^#]*#1\b/i },
  { event: "meq2", vlr: "3167", stage: /\b(me|middle east)\b[^#]*#2\b/i },
  { event: "naq1", vlr: "3167", stage: /\b(na|north africa)\b[^#]*#1\b/i },
  { event: "naq2", vlr: "3167", stage: /\b(na|north africa)\b[^#]*#2\b/i },
  { event: "mena", vlr: "3167", stage: /playoff/i },
  { event: "trq1", vlr: "3177", stage: /qualifier #1\b/i },
  { event: "trq2", vlr: "3177", stage: /qualifier #2\b/i },
  { event: "tr", vlr: "3177", stage: /playoff/i },
  { event: "kickoff", vlr: "3176", stage: /./ },
];
const UA = "vct-emea-site/1.0 (personal tournament site)";
/** The qualifiers with no Toornament: their bracket itself comes from vlr.gg's list. */
export const VLR_BRACKETS = ["trq1", "trq2"];

/** The vlr.gg events and brackets followed: the code's lists with what the editors set from links. */
export const vlrSources = (db) => mergeVlr(VLR_EVENTS, VLR_BRACKETS, readSources(db));
// vlr.gg's pace: 10 s at least between two pages, 4 pages a round at most, a round a minute while matches are being played
// (one page every 15 s on average), every 2 minutes otherwise (as before).
const GAP = 10000;
const PER_ROUND = 4;
const TURN = 50000;
const QUIET = 110000;
// a round stops starting pages after this long: the task that runs it is stopped at 55 s
const BUDGET = 38000;
// a match vlr.gg shows as being played: its page every minute; one live on the site only (not begun on vlr.gg): now and then
export const LIVE_EVERY = 55000;
export const IDLE_EVERY = 8 * 60000;
// an event's list: every 3 minutes while one of its matches is being played (it says which are, and their score in maps)
const LIST_LIVE = 3 * 60000;
const LIST_HOT = 10 * 60000;
const LIST_COLD = 6 * 3600000;

// every HTML entity vlr.gg writes: named (&ndash;, &quot;…) and numbered (&#039;, &#x15f;), so that names and rounds read as on the page
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", middot: "·" };
export function decodeEntities(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    try { return n > 0 ? String.fromCodePoint(n) : m; } catch { return m; }
  });
}
const text = (s) => decodeEntities(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
export const norm = (s) => text(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/** vlr.gg's round name as the site's round: "Round of 256" -> "r256", "Round of 8" -> "qf". */
export function roundKey(series) {
  const s = String(series || "").toLowerCase();
  // the Europe playoffs' Swiss Stage: "Swiss Stage–Round 2 (1-0)" -> "s2" (the site's ids: s2-m01…)
  const swiss = /swiss[\s\S]*?round\s*(\d+)/.exec(s) || /^round\s*(\d+)\s*\(\d+\s*-\s*\d+\)/.exec(s.trim());
  if (swiss) return `s${swiss[1]}`;
  // a group of the regional playoffs: "Opening (B)" -> "gb-o" (gb-o1, gb-o2), "Winners' Match (A)" -> "ga-w"
  const g = /\(([a-d])\)/.exec(s);
  if (g) {
    const kind = /opening/.test(s) ? "o" : /winner/.test(s) ? "w" : /elimination/.test(s) ? "e" : /decider/.test(s) ? "d" : "";
    if (kind) return `g${g[1]}-${kind}`;
  }
  const n = Number((/round of (\d+)/.exec(s) || [])[1]);
  if (n) return { 8: "qf", 4: "sf", 2: "gf" }[n] || `r${n}`;
  if (/third|3rd|bronze/.test(s)) return "third";
  if (/quarter/.test(s)) return "qf";
  if (/semi/.test(s)) return "sf";
  if (/final/.test(s)) return "gf";
  return "";
}

// a team's name without the words sites add or leave out ("FRG" and "FRG Esports", "Team Onyx" and "ONYX")
const core = (s) => norm(String(s || "").replace(/\b(e-?sports?|team|gaming|club|gg)\b/gi, " ")) || norm(s);

/** The matches of an event's list: [{ id, path, a, b, done, stats }]. */
export function parseEventMatches(html) {
  const out = [];
  const re = /<a href="\/(\d+)\/([^"]+)"[^>]*class="[^"]*match-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of String(html || "").matchAll(re)) {
    const names = [...m[3].matchAll(/match-item-vs-team-name">([\s\S]*?)<\/div>\s*<\/div>/g)].map((x) => text(x[1]));
    if (names.length < 2) continue;
    const stats = (/Stats:\s*<\/div>([\s\S]*?)<\/div>/.exec(m[3]) || [])[1] || "";
    const series = text((/match-item-event-series[^>]*>([\s\S]*?)<\/div>/.exec(m[3]) || [])[1]);
    const ev = m[3].indexOf("match-item-event");
    const stage = ev >= 0 ? text(m[3].slice(ev).replace(/^[^>]*>/, "")) : "";
    const sc = [...m[3].matchAll(/match-item-vs-team-score[^>]*>([\s\S]*?)<\/div>/g)].map((x) => { const n = parseInt(text(x[1]), 10); return Number.isFinite(n) ? n : null; });
    out.push({ id: m[1], path: `/${m[1]}/${m[2]}`, a: names[0], b: names[1], round: roundKey(series), stage, done: /mod-completed/.test(m[3]), live: /mod-live/.test(m[3]), sa: sc[0] ?? null, sb: sc[1] ?? null, stats: !/Unavailable/i.test(text(stats)) });
  }
  return out;
}

const num = (s) => { const n = parseInt(String(s || "").replace(/[^0-9-]/g, ""), 10); return Number.isFinite(n) ? n : null; };

// the differences (+/–) are worked out from their two numbers rather than read: their cells are laid out differently
const COLS = [["r", "rating2"], ["acs", "acs"], ["k", "kills"], ["d", "deaths"], ["a", "assists"], ["kast", "kast"], ["adr", "adr"], ["hs", "hsp"], ["fk", "fb"], ["fd", "fd"]];

/** One player's row of vlr.gg's table: name, team tag, country, agents and every number (null when not shown). */
function parseRow(r) {
  const out = {
    name: text((/ovw-player-name[^>]*>([\s\S]*?)<\/div>/.exec(r) || [])[1]),
    tag: text((/ovw-player-tag[^>]*>([\s\S]*?)<\/div>/.exec(r) || [])[1]),
    cc: (/flag mod-([a-z]{2}(?:-[a-z]{3})?)"/.exec(r) || [])[1] || "",
    agents: [...r.matchAll(/agents\/([a-z0-9]+)\.png/g)].map((m) => m[1]).slice(0, 5),
  };
  for (const [key, col] of COLS) {
    const v = (new RegExp(`data-col="${col}"[^>]*>[\\s\\S]*?mod-both">([^<]*)<`).exec(r) || [])[1];
    const n = v == null ? NaN : parseFloat(String(v).replace(/[^0-9.+-]/g, ""));
    out[key] = Number.isFinite(n) ? n : null;
  }
  if (out.cc === "un") out.cc = "";
  out.pm = out.k != null && out.d != null ? out.k - out.d : null;
  out.fpm = out.fk != null && out.fd != null ? out.fk - out.fd : null;
  return out;
}

/** The rows of one block of the page, each marked with its team: the first team tag met is the page's first team. */
function parseRows(block) {
  const rows = [...block.matchAll(/<div class="ovw-row">([\s\S]*?)(?=<div class="ovw-row"|$)/g)].map((m) => parseRow(m[1])).filter((p) => p.name && p.k != null);
  const tags = [...new Set(rows.map((p) => p.tag))];
  return rows.map((p) => ({ ...p, side: tags.length === 2 ? (p.tag === tags[0] ? 1 : 2) : 0 }));
}

/** One match page: { bo, a, b, sa, sb, maps: [{ map, a, b }], players: [{ name, k, d, a, acs }], stream, vod }. */
export function parseVlrMatch(html) {
  const h = String(html || "");
  const names = [...h.matchAll(/match-header-link-name[^>]*>\s*<div class="wf-title-med[^"]*">([\s\S]*?)<\/div>/g)].map((m) => text(m[1]));
  const head = text((/match-header-vs-score">([\s\S]*?)match-header-vs-note[^>]*>\s*Bo/.exec(h) || /match-header-vs-score">([\s\S]{0,600})/.exec(h) || [])[1] || "");
  const score = /(\d+)\s*:\s*(\d+)/.exec(head);
  const bo = num((/match-header-vs-note">\s*Bo(\d)/.exec(h) || /\bBo(\d)\b/.exec(h) || [])[1]);
  const blocks = [...h.matchAll(/<div class="vm-stats-game[^"]*" data-game-id="([^"]+)"/g)].map((m) => ({ id: m[1], at: m.index }));
  const part = (i) => h.slice(blocks[i].at, i + 1 < blocks.length ? blocks[i + 1].at : h.length);
  const maps = [];
  let players = [];
  let allRows = [];
  const mapRows = {};
  blocks.forEach((b, i) => {
    const s = part(i);
    if (b.id === "all") allRows = parseRows(s);
    else if (!mapRows[b.id]) mapRows[b.id] = parseRows(s);
    if (b.id === "all") {
      players = [...s.matchAll(/<div class="ovw-row">([\s\S]*?)(?=<div class="ovw-row"|$)/g)].map((r) => {
        const cell = (col) => num((new RegExp(`data-col="${col}"[^>]*>[\\s\\S]*?mod-both">([^<]*)<`).exec(r[1]) || [])[1]);
        return { name: text((/ovw-player-name[^>]*>([\s\S]*?)<\/div>/.exec(r[1]) || [])[1]), k: cell("kills"), d: cell("deaths"), a: cell("assists"), acs: cell("acs") };
      }).filter((p) => p.name && [p.k, p.d, p.a, p.acs].every((n) => n != null));
      return;
    }
    const map = text((/<div class="map-name">([\s\S]*?)<\/div>/.exec(s) || [])[1]).replace(/\bPICK\b/i, "").trim();
    const sc = [...s.slice(0, 3000).matchAll(/<div class="score[^"]*"[^>]*>\s*(\d+)\s*<\/div>/g)].map((m) => Number(m[1]));
    // each team's rounds won on attack (mod-t) and defence (mod-ct), overtime left out
    const header = s.slice(0, 4000);
    const cut = header.indexOf('class="map"');
    const right = header.indexOf("mod-right");
    const halves = (part) => [num((/mod-t">\s*(\d+)/.exec(part) || [])[1]), num((/mod-ct">\s*(\d+)/.exec(part) || [])[1])];
    const [ta, ca] = cut > 0 ? halves(header.slice(0, cut)) : [null, null];
    const [tb, cb] = right > 0 ? halves(header.slice(right)) : [null, null];
    const sides = [ta, ca, tb, cb].every((x) => x != null) ? { t: [ta, tb], ct: [ca, cb] } : {};
    if (map && sc.length >= 2 && !maps.some((x) => x.map === map && x.a === sc[0] && x.b === sc[1])) maps.push({ map, a: sc[0], b: sc[1], ...sides, rows: mapRows[b.id] || [], rounds: parseRounds(s), gid: b.id });
  });
  // the map being played: vlr.gg marks its tab "live"
  const liveGid = (/vm-stats-gamesnav-item[^"]*\bmod-live\b[^"]*"\s+data-game-id="([^"]+)"/.exec(h) || [])[1] || "";
  const now = (maps.find((m) => m.gid === liveGid) || {}).map || "";
  const vodPart = (/sm-vods[^"]*">([\s\S]*?)<div class="match-stream-embed/.exec(h) || [])[1] || "";
  const vod = (/<a[^>]+href="(https:\/\/[^"]+)"/.exec(vodPart) || [])[1] || "";
  const stream = (/class="sm-ext" href="(https:\/\/[^"]+)"/.exec(h) || [])[1] || "";
  return { bo, logos: parseLogos(h), a: names[0] || "", b: names[1] || "", sa: score ? Number(score[1]) : null, sb: score ? Number(score[2]) : null, maps, players: players.slice(0, 16), all: allRows, stream, vod, veto: parseVeto(h), now };
}

/**
 * A map's rounds as vlr.gg draws them, in order: { w: 1 or 2 (the page's first or second team), side: "t" or "ct" (the winner's),
 * how: "elim" | "boom" | "defuse" | "time" }. Rounds not played yet are left out.
 */
export function parseRounds(block) {
  const at = String(block || "").indexOf('class="vlr-rounds"');
  if (at < 0) return [];
  const part = block.slice(at, at + 60000);
  const out = [];
  for (const c of part.split('<div class="vlr-rounds-row-col').slice(1)) {
    if (!/rnd-num/.test(c)) continue;
    const sq = [...c.matchAll(/<div class="rnd-sq([^"]*)"[^>]*>([\s\S]*?)<\/div>/g)];
    const i = sq.findIndex((x) => /mod-win/.test(x[1]));
    if (i < 0 || i > 1) continue;
    const how = (/round\/(elim|boom|defuse|time)\b/.exec(sq[i][2]) || [])[1] || "";
    out.push({ w: i + 1, side: /mod-ct/.test(sq[i][1]) ? "ct" : "t", how });
  }
  return out.slice(0, 40);
}

/**
 * The site's match a vlr.gg match is: the same two teams, in any order. Failing that, in the same round, where a team plays once,
 * the one match where one of the two teams is found (a name may be written differently on each site). { id, swap } or null.
 */
export function findSiteMatch(items, a, b, round = "") {
  const x = norm(a);
  const y = norm(b);
  for (const m of items) {
    const ma = norm(m.a && m.a.name);
    const mb = norm(m.b && m.b.name);
    if (ma === x && mb === y) return { id: m.id, swap: false };
    if (ma === y && mb === x) return { id: m.id, swap: true };
  }
  if (!round) return null;
  const ca = core(a);
  const cb = core(b);
  // how well one name fits another: the same (1), one the start of the other ("Dynasty" and "Dynasty Hydra", 0.5), else 0
  const fit = (x, y) => (!x || !y ? 0 : x === y ? 1 : x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x)) ? 0.5 : 0);
  const found = [];
  for (const m of items.filter((it) => inRound(it.id, round))) {
    const ma = core(m.a && m.a.name);
    const mb = core(m.b && m.b.name);
    const straight = fit(ma, ca) + fit(mb, cb);
    const crossed = fit(ma, cb) + fit(mb, ca);
    // one side the same at least, as before
    if (Math.max(fit(ma, ca), fit(mb, cb)) === 1 && straight >= crossed) found.push({ id: m.id, swap: false, score: straight });
    else if (Math.max(fit(ma, cb), fit(mb, ca)) === 1) found.push({ id: m.id, swap: true, score: crossed });
  }
  if (found.length === 1) return { id: found[0].id, swap: found[0].swap };
  // several: the one that fits clearly better than the others, else none (a wrong table is worse than none)
  const best = [...found].sort((x, y) => y.score - x.score);
  return best.length > 1 && best[0].score > best[1].score ? { id: best[0].id, swap: best[0].swap } : null;
}

/**
 * The matches of a vlr.gg list that belong to one of the site's events, by the stage written on each. A vlr.gg event followed
 * for that event alone (shared: false) keeps every match when the stage words fit none: an old filter, not a sorting (the
 * Europe playoffs' own event writes "Swiss Stage", where "Playoffs" was set). Pure.
 */
export function stageMatches(all, stage, shared) {
  const kept = all.filter((v) => stage.test(v.stage || ""));
  return kept.length || shared ? kept : all;
}

/**
 * The two teams' logos at the top of a match page: [{ name, url }] (vlr.gg's own placeholder left out). Teams with no logo on
 * Liquipedia or Toornament often have one there. Pure.
 */
export function parseLogos(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<img src="([^"]+)" alt="([^"]+?) team logo"/g)) {
    const url = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
    if (!/^https:\/\/owcdn\.net\/img\/[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(url)) continue;
    const name = text(m[2]);
    if (name && !out.some((x) => x.name === name)) out.push({ name, url });
  }
  return out.slice(0, 2);
}

/** Saves the logos read on a match page, by team name (kind vlr_logos). Never throws: logos are a bonus. */
export function saveVlrLogos(db, logos) {
  try {
    for (const l of logos || []) {
      const key = norm(l.name);
      if (!key) continue;
      const old = db.prepare("SELECT json FROM lp_items WHERE kind = 'vlr_logos' AND key = ?").get(key);
      if (!old || JSON.parse(old.json).url !== l.url) db.prepare("INSERT OR REPLACE INTO lp_items (kind, key, json, at) VALUES ('vlr_logos', ?, ?, ?)").run(key, JSON.stringify({ name: l.name, url: l.url }), new Date().toISOString());
    }
  } catch { /* none saved */ }
}

/** A list match's round: the one read with it, else worked out again from its stage (lists kept before a round was understood). */
export const roundOf = (v) => (v && v.round) || roundKey(v && v.stage);

/** Is a site match in this round? "r64" holds r64-1…, "s2" holds s2-m01…, "gb-o" holds gb-o1 and gb-o2. */
export const inRound = (id, round) => !!round && new RegExp(`^${String(round).replace(/[^a-z0-9-]/g, "")}(\\d+|-.+)$`).test(String(id));

/** What to save for a site match, its sides as on the site. { extra, score } or null when the page has nothing usable. */
export function detailsFor(parsed, swap, bo) {
  const flip = (p, q) => (swap ? [q, p] : [p, q]);
  const maps = parsed.maps.map((m) => { const [a, b] = flip(m.a, m.b); return { map: m.map, a, b, pick: "" }; });
  const checked = checkExtra({ stream: parsed.stream, vod: parsed.vod, highlights: "", mvp: "", pstats: parsed.players, maps });
  if (checked.error) return null;
  let score = null;
  if (parsed.sa != null && parsed.sb != null && maps.length && (!parsed.bo || !bo || parsed.bo === bo)) {
    const [sa, sb] = flip(parsed.sa, parsed.sb);
    if (sa !== sb) score = { sa, sb };
  }
  if (!maps.length && !checked.extra.pstats.length && !checked.extra.stream && !checked.extra.vod) return null;
  // the full table, sides as on the site: "a" or "b" ("" when the page did not say)
  const side = (s) => (!s ? "" : (s === 1) !== swap ? "a" : "b");
  const rows = (list) => (list || []).slice(0, 12).map(({ tag, side: s, ...p }) => ({ ...p, side: side(s) }));
  const sides = (m) => (m.t && m.ct ? { t: flip(m.t[0], m.t[1]), ct: flip(m.ct[0], m.ct[1]) } : {});
  const details = { all: rows(parsed.all), veto: parsed.veto || [], maps: parsed.maps.map((m) => { const [a, b] = flip(m.a, m.b); return { map: m.map, a, b, ...sides(m), rows: rows(m.rows) }; }) };
  return { extra: checked.extra, score, details };
}

/**
 * Has a finished match's page everything? The score, one named map per map played, each map's table and the players' totals.
 * found: detailsFor's answer; or a saved read ({ score, extra }) for those saved before `complete` was kept (no tables there).
 */
export function completeRead(found) {
  if (!found) return false;
  const extra = found.extra || {};
  if ((extra.pstats || []).length < 10) return false;
  // the maps played to their end (a named map, 13 rounds or more, a winner)
  const over = (list) => (list || []).filter((m) => m && m.map && !/^tbd$/i.test(m.map) && m.a !== m.b && Math.max(m.a, m.b) >= 13);
  const maps = over(found.details ? found.details.maps : extra.maps);
  // with no score understood (another Bo, a header not read), the maps over stand for it
  const played = found.score ? found.score.sa + found.score.sb : 1;
  if (maps.length < played) return false;
  return !found.details || maps.every((m) => (m.rows || []).length >= 10);
}

// a finished match whose page lacks something is read again until vlr.gg has it all: every 15 minutes at first, then less
// often, for 2 days after the match
export const REREAD_FOR = 48 * 3600000;
export const rereadWait = (reads) => (reads < 6 ? 15 : reads < 12 ? 45 : 120) * 60000;

/**
 * Is a finished match's page to be read again because it lacked something? s: its saved read; at: the match's time (ms,
 * NaN when not known: then its first read stands for it).
 */
export function rereadDue(s, at, now = Date.now()) {
  if (!s || !s.full) return false;
  if (s.complete === true || (s.complete === undefined && completeRead(s))) return false;
  const since = Number.isFinite(at) ? at : Date.parse(s.first || s.at);
  if (!(now - since < REREAD_FOR)) return false;
  return now - Date.parse(s.at) >= rereadWait(s.reads || 0);
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// what a saved page holds: 2 adds the rounds won on attack and defence, 3 the map veto
export const PARSE_VER = 3;

/** Takes a turn shared by every server of the site (one write): true for one of them at most every `gap` ms. */
function vlrTurn(db, key, gap, now) {
  const last = db.prepare("SELECT json FROM lp_items WHERE kind = 'turn' AND key = ?").get(key);
  if (last && now - Number(last.json) < gap) return false;
  if (!last) db.prepare("INSERT OR IGNORE INTO lp_items (kind, key, json, at) VALUES ('turn', ?, '0', '')").run(key);
  return db.prepare("UPDATE lp_items SET json = ? WHERE kind = 'turn' AND key = ? AND CAST(json AS INTEGER) <= ?").run(String(now), key, String(now - gap)).changes === 1;
}

/**
 * The matches being played, most in need of a read first. groups: [{ event, items, mine (vlr.gg's list for it), siteLive }].
 * Those vlr.gg shows as being played come first (their page every minute), then those live on the site only, which vlr.gg
 * has not begun (now and then); across every event followed, the one read longest ago first.
 * Returns every one of them: [{ event, v, site, key, onVlr, onSite, due }] (due: its page is to be read now).
 */
export function pickLive(groups, vlive, now = Date.now()) {
  const out = [];
  const keys = new Set();
  for (const { event, items, mine, siteLive } of groups) {
    for (const v of mine || []) {
      if (v.done) continue;
      const site = findSiteMatch(items, v.a, v.b, roundOf(v));
      if (!site) continue;
      const m = items.find((x) => x.id === site.id);
      if (!m || m.sa != null) continue;
      const onVlr = !!v.live;
      const onSite = !!(siteLive || {})[site.id];
      if (!onVlr && !onSite) continue;
      const key = `${event}:${site.id}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const s = vlive[key];
      const age = s && s.at ? now - new Date(s.at).getTime() : Infinity;
      out.push({ event, v, site, key, onVlr, onSite, at: (s && s.at) || "", due: age >= (onVlr ? LIVE_EVERY : IDLE_EVERY) });
    }
  }
  return out.sort((x, y) => Number(y.onVlr) - Number(x.onVlr) || x.at.localeCompare(y.at));
}

/**
 * One round of vlr.gg reads (at most 4 pages, 10 s apart): the lists of the events being played, then the matches being
 * played (their maps' scores, rounds and players), then the finished matches not read yet. Returns pages read.
 */
export async function vlrMatchesIfDue(now = Date.now(), { gap = GAP, fetcher = (...x) => fetch(...x) } = {}) {
  const { getDb, getState, dropStateCache } = await import("./db.js");
  const { readItems, saveItem } = await import("./lpstore.js");
  const { readVlrInfo, refuseVlr, vlrBlocked } = await import("./vlrfetch.js");
  const { eventData, matchesOf } = await import("./matchlist.js");
  if (vlrBlocked(readVlrInfo())) return 0;
  const db = getDb();
  // its own turn: a server takes it in one write, so two servers never read at once
  if (!vlrTurn(db, "vlrm", TURN, now)) return 0;

  // the vlr.gg events followed: the code's list with what the editors set from links
  const { events: followed, brackets: vlrBrackets } = vlrSources(db);
  const t0 = Date.now();
  let read = 0;
  let oldReads = 0;
  let liveSeen = 0;
  let roundError = null;
  let ran = false;
  const canRead = () => read < PER_ROUND && Date.now() - t0 + (read ? gap : 0) < BUDGET;
  const get = async (path) => {
    if (read) await pause(gap);
    read += 1;
    const ask = () => fetcher(`https://www.vlr.gg${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    let res;
    // a network hiccup (no answer, a cut connection): one more try 2 s later, time allowing; a refusal is never asked again
    try { res = await ask(); } catch (e) { if (Date.now() - t0 + 10000 > BUDGET) throw e; await pause(2000); res = await ask(); }
    if ([401, 403, 429, 503].includes(res.status)) { refuseVlr(res.status); throw Object.assign(new Error(`vlr.gg refused: ${res.status}`), { stop: true }); }
    if (!res.ok) throw new Error(`vlr.gg ${res.status}`);
    return res.text();
  };
  const iso = new Date(now).toISOString();
  try {
    const state = getState(db);
    const lists = readItems("vlr_event", db);
    const seen = readItems("vlr_match", db);
    const vlive = readItems("vlr_live", db);
    // a match live on the site counts as being played only around its time (a forgotten "live" does not use up the reads)
    const fresh = (event, id) => {
      const t = Date.parse(((state.times || {})[event] || {})[id] || "");
      return Number.isFinite(t) && now - t < 6 * 3600000 && t - now < 3600000;
    };
    const groups = [];
    for (const { event, vlr: vlrId, stage } of followed) {
      const items = matchesOf(event, eventData(state, event));
      const bracket = vlrBrackets.includes(event);
      if (!bracket && !items.some((m) => m.a && m.b)) continue; // no team yet: nothing to look for
      const liveNow = (state.live && state.live[event]) || {};
      const siteLive = Object.fromEntries(Object.entries(liveNow).filter(([id]) => fresh(event, id)));
      groups.push({ event, vlrId, stage, items, bracket, liveNow, siteLive });
    }
    const mineOf = (g) => stageMatches(((lists[`vlr:${g.vlrId}`] || {}).matches) || [], g.stage, followed.filter((x) => x.vlr === g.vlrId).length > 1);
    const withMine = () => groups.map((g) => ({ ...g, mine: mineOf(g) }));
    const liveIn = (vlrId) => groups.some((g) => g.vlrId === vlrId && (Object.keys(g.siteLive).length > 0 || mineOf(g).some((v) => v.live && !v.done)));
    // nothing being played: a round every 2 minutes, as before
    if (!groups.some((g) => liveIn(g.vlrId)) && !vlrTurn(db, "vlrm_quiet", QUIET, now)) return 0;
    ran = true;

    // 1. the lists: those of the events being played first, every 3 minutes (one a round while pages wait their turn)
    const ids = [...new Set(groups.map((g) => g.vlrId))].map((vlrId) => {
      const gs = groups.filter((g) => g.vlrId === vlrId);
      const list = lists[`vlr:${vlrId}`];
      // a bracket followed on vlr.gg: its list often while matches are left to play there
      const running = gs.some((g) => g.bracket && list && list.matches.some((v) => g.stage.test(v.stage || "") && !v.done && known2(v.a) && known2(v.b)));
      const hot = running || gs.some((g) => Object.values((state.times && state.times[g.event]) || {}).some((at) => Math.abs(now - new Date(at).getTime()) < 12 * 3600000));
      const live = liveIn(vlrId);
      const age = list ? now - new Date(list.at).getTime() : Infinity;
      return { vlrId, live, age, due: age > (live ? LIST_LIVE : hot ? LIST_HOT : LIST_COLD) };
    }).filter((x) => x.due).sort((x, y) => Number(y.live) - Number(x.live) || y.age - x.age);
    const waiting = pickLive(withMine(), vlive, now).some((p) => p.due);
    for (const { vlrId } of ids.slice(0, waiting ? 1 : 2)) {
      if (!canRead()) break;
      lists[`vlr:${vlrId}`] = { at: iso, matches: parseEventMatches(await get(`/event/matches/${vlrId}/?series_id=all`)) };
      saveItem("vlr_event", `vlr:${vlrId}`, lists[`vlr:${vlrId}`], db);
    }
    for (const g of groups) if (g.bracket) await bracketFromVlr(db, g.event, mineOf(g));

    // 2. the matches being played
    const picks = pickLive(withMine(), vlive, now);
    let marked = 0;
    liveSeen = picks.filter((x) => x.onVlr).length;
    for (const p of picks.filter((x) => x.onVlr)) {
      const g = groups.find((x) => x.event === p.event);
      // vlr.gg shows it being played while the site does not (no time, or a late one): it is shown live, unless an editor took it off
      if (!g.liveNow[p.site.id] && !db.prepare("SELECT 1 FROM kv WHERE key = ?").get(`nolive:${p.event}:${p.site.id}`)) {
        db.transaction(() => {
          db.prepare("UPDATE undostate SET off = 1").run();
          db.prepare("INSERT INTO mlive (event, id, la, lb) VALUES (?, ?, 0, 0) ON CONFLICT (event, id) DO NOTHING").run(p.event, p.site.id);
          db.prepare("UPDATE undostate SET off = 0").run();
        })();
        marked += 1;
      }
      // the list's score in maps, for the matches whose page waits its turn
      const list = lists[`vlr:${g.vlrId}`];
      if (p.v.sa != null && p.v.sb != null && list) {
        const [la, lb] = p.site.swap ? [p.v.sb, p.v.sa] : [p.v.sa, p.v.sb];
        const s = vlive[p.key];
        if (!s || ((s.sa !== la || s.sb !== lb) && list.at > (s.at || ""))) {
          vlive[p.key] = { maps: [], feed: [], rounds: [], ...(s || {}), sa: la, sb: lb, listAt: list.at };
          saveItem("vlr_live", p.key, vlive[p.key], db);
        }
      }
    }
    if (marked) dropStateCache();
    const matchAt = (event, id) => Date.parse(((state.times || {})[event] || {})[id] || "");
    const dueOf = (g) => mineOf(g).filter((v) => v.done).map((v) => ({ v, site: findSiteMatch(g.items, v.a, v.b, roundOf(v)) }))
      .filter(({ v, site }) => {
        if (!site) return false;
        const s = seen[`${g.event}:${site.id}`];
        const at = matchAt(g.event, site.id);
        // vlr.gg's list says "Stats: Unavailable": its page is read all the same around the match (the maps and tables
        // often come later), not for the old ones
        if (!v.stats && !(now - at < REREAD_FOR) && !(s && s.full)) return false;
        // read again once later for the VOD, which comes after the match
        if (!s || !s.full || (!s.vod && s.reads < 2 && now - new Date(s.at).getTime() > 3 * 3600000) || (s.v || 1) < PARSE_VER) return true;
        // a page that lacked something (no score, a "TBD" map, a table missing): read again until it has it all; not a
        // forfeit on the site, which never has a table
        const m = g.items.find((x) => x.id === site.id);
        if (m && m.note && m.note.kind === "ff") return false;
        return rereadDue(s, at, now);
      })
      // the pages never read first, those read with an older reader last
      .sort((x, y) => Number(((seen[`${g.event}:${x.site.id}`] || {}).v || 0) >= 1) - Number(((seen[`${g.event}:${y.site.id}`] || {}).v || 0) >= 1)
        || Number(!!seen[`${g.event}:${x.site.id}`]) - Number(!!seen[`${g.event}:${y.site.id}`]));
    // a finished match waiting for its table keeps one read of each round
    const reserve = groups.some((g) => dueOf(g).length) ? 1 : 0;
    for (const p of picks.filter((x) => x.due)) {
      if (read >= PER_ROUND - reserve || !canRead()) break;
      const g = groups.find((x) => x.event === p.event);
      const parsed = parseVlrMatch(await get(p.v.path));
      saveVlrLogos(db, parsed.logos);
      vlive[p.key] = liveUpdate(vlive[p.key], parsed, p.site.swap, now);
      saveItem("vlr_live", p.key, vlive[p.key], db);
      const stream = !((state.extra[p.event] || {})[p.site.id] || {}).stream && parsed.stream;
      if (stream) {
        db.transaction(() => {
          db.prepare("UPDATE undostate SET off = 1").run();
          db.prepare("INSERT INTO mextra (event, id, stream) VALUES (?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET stream = excluded.stream WHERE mextra.stream = ''").run(p.event, p.site.id, stream);
          db.prepare("UPDATE undostate SET off = 0").run();
        })();
      }
      // the page shows the series decided: the result goes in now; the full table comes with the finished match's read
      const m = g.items.find((x) => x.id === p.site.id);
      const need = m && m.bo ? Math.ceil(m.bo / 2) : 0;
      const found = need ? detailsFor(parsed, p.site.swap, m.bo) : null;
      if (found && found.score && Math.max(found.score.sa, found.score.sb) >= need) {
        if (!seen[p.key]) {
          seen[p.key] = { v: PARSE_VER, url: `https://www.vlr.gg${p.v.path}`, full: false, at: iso, reads: 0, vod: false, score: found.score, extra: null };
          saveItem("vlr_match", p.key, seen[p.key], db);
        }
        await closeFromVlr(db, state, p.event, p.site.id, found.score, true);
      }
    }

    // 3. the finished matches
    for (const g of groups) {
      const { event, items } = g;
      // a match vlr.gg says is over while the site still shows it live: its result, from vlr.gg (Toornament may be late closing it)
      for (const v of mineOf(g).filter((x) => x.done)) {
        const site = findSiteMatch(items, v.a, v.b, roundOf(v));
        const s = site && seen[`${event}:${site.id}`];
        if (s && s.score) await closeFromVlr(db, state, event, site.id, s.score, true);
      }
      for (const { v, site } of dueOf(g)) {
        if (!canRead()) return read;
        const old = seen[`${event}:${site.id}`];
        if (old && old.full && (old.v || 1) < PARSE_VER && old.v !== 0) { if (oldReads >= 1) continue; oldReads += 1; }
        const m = items.find((x) => x.id === site.id);
        const page = parseVlrMatch(await get(v.path));
        saveVlrLogos(db, page.logos);
        const found = detailsFor(page, site.swap, m.bo);
        const key = `${event}:${site.id}`;
        const before = seen[key];
        saveItem("vlr_match", key, { v: PARSE_VER, url: `https://www.vlr.gg${v.path}`, full: true, at: iso, first: (before && before.first) || iso, reads: ((before && before.reads) || 0) + 1, vod: !!(found && found.extra.vod), complete: completeRead(found), score: found && found.score, extra: found ? found.extra : null }, db);
        if (found) writeExtra(db, event, site.id, found.extra, before && before.extra, found.details);
        if (found && found.score) await closeFromVlr(db, state, event, site.id, found.score, true);
        // Toornament's round takes the score in maps the next time it reads
        if (found && found.score) db.prepare("UPDATE lp_items SET json = json_set(json, '$.hash', '') WHERE kind = 'tsync_meta' AND key = ?").run(event);
      }
    }

    // 4. the logos still missing: a finished match of a team with no logo anywhere, read again once for the two logos at its top
    // (the matches read before the logos were kept); the most recent matches first (the teams people look at now), two pages a
    // round at most, each match tried once, a team whose logo just came not asked again
    if (canRead() && read < PER_ROUND) {
      const tried = readItems("vlr_logo_try", db);
      const when = (event, id) => Date.parse(((state.times || {})[event] || {})[id] || "") || 0;
      const todo = groups.flatMap((g) => g.items.filter((m) => m.sa != null && [m.a, m.b].some((t) => t && t.name && !t.logo))
        .map((m) => ({ s: seen[`${g.event}:${m.id}`], at: when(g.event, m.id), names: [m.a, m.b].filter((t) => t && t.name && !t.logo).map((t) => norm(t.name)) })))
        .filter((x) => x.s && x.s.url && !tried[x.s.url])
        .sort((x, y) => y.at - x.at);
      const got = new Set();
      let taken = 0;
      for (const x of todo) {
        if (taken >= 2 || !canRead() || read >= PER_ROUND) break;
        if (x.names.every((n) => got.has(n))) continue;
        taken += 1;
        saveItem("vlr_logo_try", x.s.url, { at: iso }, db);
        const logos = parseVlrMatch(await get(x.s.url.replace("https://www.vlr.gg", ""))).logos;
        saveVlrLogos(db, logos);
        for (const l of logos) got.add(norm(l.name));
      }
    }
  } catch (e) {
    console.log(`[vlr-match] ${e.message}`);
    const { noteProblem } = await import("./health.js");
    noteProblem("vlr", e.message, db);
    roundError = e.message.slice(0, 120);
  } finally {
    // the round in one line, for the editor's Server panel: pages read, how long, matches vlr.gg showed being played
    if (ran) try { saveItem("vlr_round", "last", { at: iso, pages: read, ms: Date.now() - t0, live: liveSeen, error: roundError }, db); } catch { /* a convenience */ }
  }
  return read;
}

const known2 = (n) => !!n && !/^tbd$/i.test(String(n).trim());

/** The bracket of a qualifier with no Toornament, from vlr.gg's list: the same round as Toornament's (an editor's own changes stay). */
export async function bracketFromVlr(db, event, mine) {
  const { vlrRows } = await import("./vlrbracket.js");
  const rows = vlrRows(mine);
  if (!rows.length) return 0;
  const crypto = await import("node:crypto");
  const { readItems, saveItem } = await import("./lpstore.js");
  const hash = crypto.createHash("sha1").update(JSON.stringify(rows)).digest("hex");
  const meta = readItems("vbr_meta", db)[event] || {};
  if (meta.hash === hash) return 0;
  // each round's format, from vlr.gg's scores (2–0: Bo3), unless an editor set it
  const { roundsFor } = await import("./bracket.js");
  const size = rows.filter((r) => r.round === 1).length * 2;
  const winsOf = (k) => Math.max(0, ...rows.filter((x) => x.round === k + 1 && x.status === "completed").map((x) => Math.max(x.a.score || 0, x.b.score || 0)));
  const seen = Math.max(0, ...roundsFor(size).map((_, k) => winsOf(k)));
  roundsFor(size).forEach((r, k) => {
    // a round not played yet takes the format seen so far, but for the last rounds (often longer)
    const wins = winsOf(k) || (["sf", "gf", "third"].includes(r.key) ? 0 : seen);
    if (wins >= 1) db.prepare("INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)").run(`qbo:${event}:${r.key}`, String(wins * 2 - 1));
  });
  const { planSync, applySync } = await import("./toornament.js");
  const { getQualifier, getMatchTimes, getMatchLive, dropStateCache } = await import("./db.js");
  const plan = planSync({ event, rows, teams: null, site: { ...getQualifier(db, event), times: getMatchTimes(db)[event] || {}, live: getMatchLive(db)[event] || {}, vlr: {} }, last: readItems("tsync", db)[event] || {} });
  if (!plan || plan.blocked) { saveItem("vbr_meta", event, { hash: "", at: new Date().toISOString(), error: (plan && plan.blocked) || "no bracket" }, db); return 0; }
  const n = applySync(db, event, plan, saveItem);
  saveItem("vbr_meta", event, { hash, at: new Date().toISOString(), changes: n }, db);
  dropStateCache();
  return n;
}

/**
 * A live match with no result yet, finished on vlr.gg: its score goes in (an undoable change in the history) and it is no longer live.
 * Toornament's next round finds the same score and leaves it as it is.
 */
export async function closeFromVlr(db, state, event, id, score, notLiveToo = false) {
  const wasLive = !!(state.live[event] || {})[id];
  if (!wasLive && !notLiveToo) return false;
  const { allMatches } = await import("./matchlist.js");
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  if (!m || m.sa != null || score.sa == null || score.sb == null || score.sa === score.sb) return false;
  const { saveAnyScore } = await import("./r8apply.js");
  const r = saveAnyScore(db, { event, id, sa: score.sa, sb: score.sb });
  if (!r.ok) return false;
  db.prepare("DELETE FROM mlive WHERE event = ? AND id = ?").run(event, id);
  const { recordAction } = await import("./undo.js");
  recordAction(db, `Result from vlr.gg (match over${wasLive ? "" : ", before Toornament"}): ${event} ${id} ${score.sa}-${score.sb}`, "vlr.gg");
  try { const { logSync } = await import("./editor17.js"); logSync(db, [{ source: "vlr.gg", event, text: `Score ${id}: ${score.sa}-${score.sb}${wasLive ? "" : " (before Toornament)"}` }]); } catch { /* the log is a convenience */ }
  const { dropStateCache } = await import("./db.js");
  dropStateCache();
  return true;
}

/** Saves the details unless an editor changed them since vlr.gg's last ones. Kept out of "undo". */
function writeExtra(db, event, id, extra, lastFromVlr, details) {
  const row = db.prepare("SELECT stream, vod, highlights, mvp, pstats, maps FROM mextra WHERE event = ? AND id = ?").get(event, id);
  const parse = (t) => { try { return JSON.parse(t || "[]"); } catch { return []; } };
  const now = row && { stream: row.stream || "", vod: row.vod || "", highlights: row.highlights || "", mvp: row.mvp || "", pstats: parse(row.pstats), maps: parse(row.maps) };
  const blank = !now || (!now.stream && !now.vod && !now.highlights && !now.mvp && !now.pstats.length && !now.maps.length);
  if (!blank && JSON.stringify(now) !== JSON.stringify(lastFromVlr || null)) {
    // an editor's own details stay; vlr.gg's full table is kept beside them
    db.prepare("UPDATE mextra SET details = ? WHERE event = ? AND id = ?").run(JSON.stringify(details || null), event, id);
    return;
  }
  const next = { ...extra, stream: extra.stream || (now && now.stream) || "", mvp: (now && now.mvp) || "" };
  db.transaction(() => {
    db.prepare("UPDATE undostate SET off = 1").run();
    db.prepare(`INSERT INTO mextra (event, id, stream, vod, highlights, mvp, pstats, maps, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (event, id) DO UPDATE SET stream = excluded.stream, vod = excluded.vod, highlights = excluded.highlights, mvp = excluded.mvp, pstats = excluded.pstats, maps = excluded.maps, details = excluded.details`)
      .run(event, id, next.stream, next.vod, next.highlights, next.mvp, JSON.stringify(next.pstats), JSON.stringify(next.maps), JSON.stringify(details || null));
    db.prepare("UPDATE undostate SET off = 0").run();
  })();
}
