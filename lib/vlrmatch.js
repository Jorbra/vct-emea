// Match details from vlr.gg: the score in maps, each map's score, the players' numbers, the stream and the VOD.
// A page every 10 seconds at most, a few per round; any refusal stops everything for a day (lib/vlrfetch.js). What an editor typed stays.
import { checkExtra } from "./schedule.js";
import { liveUpdate } from "./vlive.js";

// vlr.gg puts every Europe qualifier in one event, every MENA one in another: the stage written on each match says which of the site's it is.
// A stage that fits none of these is left alone.
export const VLR_EVENTS = [
  { event: "q1", vlr: "3175", stage: /qualifier #1\b/i },
  { event: "q2", vlr: "3175", stage: /qualifier #2\b/i },
  { event: "playoffs", vlr: "3175", stage: /playoff/i },
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
const GAP = 10000;
const LIVE_EVERY = 2 * 60000;
const PER_ROUND = 3;
const LIST_HOT = 10 * 60000;
const LIST_COLD = 6 * 3600000;

const text = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();
export const norm = (s) => text(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/** vlr.gg's round name as the site's round: "Round of 256" -> "r256", "Round of 8" -> "qf". */
export function roundKey(series) {
  const s = String(series || "").toLowerCase();
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
    out.push({ id: m[1], path: `/${m[1]}/${m[2]}`, a: names[0], b: names[1], round: roundKey(series), stage, done: /mod-completed/.test(m[3]), stats: !/Unavailable/i.test(text(stats)) });
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
    if (map && sc.length >= 2 && !maps.some((x) => x.map === map && x.a === sc[0] && x.b === sc[1])) maps.push({ map, a: sc[0], b: sc[1], ...sides, rows: mapRows[b.id] || [] });
  });
  const vodPart = (/sm-vods[^"]*">([\s\S]*?)<div class="match-stream-embed/.exec(h) || [])[1] || "";
  const vod = (/<a[^>]+href="(https:\/\/[^"]+)"/.exec(vodPart) || [])[1] || "";
  const stream = (/class="sm-ext" href="(https:\/\/[^"]+)"/.exec(h) || [])[1] || "";
  return { bo, a: names[0] || "", b: names[1] || "", sa: score ? Number(score[1]) : null, sb: score ? Number(score[2]) : null, maps, players: players.slice(0, 16), all: allRows, stream, vod };
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
  const found = [];
  for (const m of items.filter((it) => it.id.startsWith(`${round}-`))) {
    const ma = core(m.a && m.a.name);
    const mb = core(m.b && m.b.name);
    if (ma === ca || mb === cb) found.push({ id: m.id, swap: false });
    else if (ma === cb || mb === ca) found.push({ id: m.id, swap: true });
  }
  return found.length === 1 ? found[0] : null;
}

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
  const details = { all: rows(parsed.all), maps: parsed.maps.map((m) => { const [a, b] = flip(m.a, m.b); return { map: m.map, a, b, ...sides(m), rows: rows(m.rows) }; }) };
  return { extra: checked.extra, score, details };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// what a saved page holds: 2 adds the rounds won on attack and defence
export const PARSE_VER = 2;

/** A few pages for the event that needs them most: its list now and then, then the finished matches not read yet. Returns pages read. */
export async function vlrMatchesIfDue(now = Date.now()) {
  const { getDb, getState } = await import("./db.js");
  const { readItems, saveItem } = await import("./lpstore.js");
  const { readVlrInfo, refuseVlr, vlrBlocked } = await import("./vlrfetch.js");
  const { eventData, matchesOf } = await import("./matchlist.js");
  if (vlrBlocked(readVlrInfo())) return 0;
  const db = getDb();
  // its own turn: a server takes it in one write, so two servers never read at once
  const last = db.prepare("SELECT json FROM lp_items WHERE kind = 'turn' AND key = 'vlrm'").get();
  if (last && now - Number(last.json) < GAP * PER_ROUND) return 0;
  if (!last) db.prepare("INSERT OR IGNORE INTO lp_items (kind, key, json, at) VALUES ('turn', 'vlrm', '0', '')").run();
  if (db.prepare("UPDATE lp_items SET json = ? WHERE kind = 'turn' AND key = 'vlrm' AND CAST(json AS INTEGER) <= ?").run(String(now), String(now - GAP * PER_ROUND)).changes !== 1) return 0;

  let read = 0;
  const get = async (path) => {
    if (read) await pause(GAP);
    read += 1;
    const res = await fetch(`https://www.vlr.gg${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if ([401, 403, 429, 503].includes(res.status)) { refuseVlr(res.status); throw Object.assign(new Error(`vlr.gg refused: ${res.status}`), { stop: true }); }
    if (!res.ok) throw new Error(`vlr.gg ${res.status}`);
    return res.text();
  };
  try {
    const state = getState(db);
    const lists = readItems("vlr_event", db);
    const seen = readItems("vlr_match", db);
    const vlive = readItems("vlr_live", db);
    const listOf = {};
    for (const { event, vlr: vlrId, stage } of VLR_EVENTS) {
      const items = matchesOf(event, eventData(state, event));
      if (!items.some((m) => m.a && m.b)) continue; // no team yet: nothing to look for
      const hot = VLR_EVENTS.filter((c) => c.vlr === vlrId).some((c) => Object.values((state.times && state.times[c.event]) || {}).some((at) => Math.abs(now - new Date(at).getTime()) < 12 * 3600000));
      let list = listOf[vlrId] || lists[`vlr:${vlrId}`];
      if (!list || now - new Date(list.at).getTime() > (hot ? LIST_HOT : LIST_COLD)) {
        list = { at: new Date(now).toISOString(), matches: parseEventMatches(await get(`/event/matches/${vlrId}/?series_id=all`)) };
        saveItem("vlr_event", `vlr:${vlrId}`, list, db);
      }
      listOf[vlrId] = list;
      const mine = list.matches.filter((v) => stage.test(v.stage || ""));
      const due = mine.filter((v) => v.done && v.stats).map((v) => ({ v, site: findSiteMatch(items, v.a, v.b, v.round) }))
        .filter(({ v, site }) => {
          if (!site) return false;
          const s = seen[`${event}:${site.id}`];
          // read again once later for the VOD, which comes after the match
          return !s || !s.full || (!s.vod && s.reads < 2 && now - new Date(s.at).getTime() > 3 * 3600000) || (s.v || 1) < PARSE_VER;
        })
        // the pages never read first, those read with an older reader last
        .sort((x, y) => Number(((seen[`${event}:${x.site.id}`] || {}).v || 0) >= 1) - Number(((seen[`${event}:${y.site.id}`] || {}).v || 0) >= 1)
          || Number(!!seen[`${event}:${x.site.id}`]) - Number(!!seen[`${event}:${y.site.id}`]));
      // a match being played: its page every few minutes, the one read longest ago first, for its maps' scores and its stream.
      // A finished match waiting for its table keeps one read of each round.
      const playing = mine.filter((v) => !v.done).map((v) => ({ v, site: findSiteMatch(items, v.a, v.b, v.round) }))
        .filter(({ site }) => site && (state.live[event] || {})[site.id])
        .filter(({ site }) => { const s = vlive[`${event}:${site.id}`]; return !s || now - new Date(s.at).getTime() > LIVE_EVERY; })
        .sort((x, y) => ((vlive[`${event}:${x.site.id}`] || {}).at || "").localeCompare((vlive[`${event}:${y.site.id}`] || {}).at || ""));
      for (const { v, site } of playing) {
        if (read >= (due.length ? PER_ROUND - 1 : PER_ROUND)) break;
        const parsed = parseVlrMatch(await get(v.path));
        const key = `${event}:${site.id}`;
        vlive[key] = liveUpdate(vlive[key], parsed, site.swap, now);
        saveItem("vlr_live", key, vlive[key], db);
        const stream = !((state.extra[event] || {})[site.id] || {}).stream && parsed.stream;
        if (stream) {
          db.transaction(() => {
            db.prepare("UPDATE undostate SET off = 1").run();
            db.prepare("INSERT INTO mextra (event, id, stream) VALUES (?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET stream = excluded.stream WHERE mextra.stream = ''").run(event, site.id, stream);
            db.prepare("UPDATE undostate SET off = 0").run();
          })();
        }
      }
      // a match vlr.gg says is over while the site still shows it live: its result, from vlr.gg (Toornament may be late closing it)
      for (const v of mine.filter((x) => x.done)) {
        const site = findSiteMatch(items, v.a, v.b, v.round);
        const s = site && seen[`${event}:${site.id}`];
        if (s && s.score) await closeFromVlr(db, state, event, site.id, s.score);
      }
      for (const { v, site } of due) {
        if (read >= PER_ROUND) return read;
        const m = items.find((x) => x.id === site.id);
        const found = detailsFor(parseVlrMatch(await get(v.path)), site.swap, m.bo);
        const key = `${event}:${site.id}`;
        const before = seen[key];
        saveItem("vlr_match", key, { v: PARSE_VER, url: `https://www.vlr.gg${v.path}`, full: true, at: new Date(now).toISOString(), reads: ((before && before.reads) || 0) + 1, vod: !!(found && found.extra.vod), score: found && found.score, extra: found ? found.extra : null }, db);
        if (found) writeExtra(db, event, site.id, found.extra, before && before.extra, found.details);
        if (found && found.score) await closeFromVlr(db, state, event, site.id, found.score);
        // Toornament's round takes the score in maps the next time it reads
        if (found && found.score) db.prepare("UPDATE lp_items SET json = json_set(json, '$.hash', '') WHERE kind = 'tsync_meta' AND key = ?").run(event);
      }
    }
  } catch (e) {
    console.log(`[vlr-match] ${e.message}`);
    const { noteProblem } = await import("./health.js");
    noteProblem("vlr", e.message, db);
  }
  return read;
}

/**
 * A live match with no result yet, finished on vlr.gg: its score goes in (an undoable change in the history) and it is no longer live.
 * Toornament's next round finds the same score and leaves it as it is.
 */
export async function closeFromVlr(db, state, event, id, score) {
  if (!(state.live[event] || {})[id]) return false;
  const { allMatches } = await import("./matchlist.js");
  const m = allMatches(state).find((x) => x.event === event && x.id === id);
  if (!m || m.sa != null || score.sa == null || score.sb == null || score.sa === score.sb) return false;
  const { saveAnyScore } = await import("./r8apply.js");
  const r = saveAnyScore(db, { event, id, sa: score.sa, sb: score.sb });
  if (!r.ok) return false;
  db.prepare("DELETE FROM mlive WHERE event = ? AND id = ?").run(event, id);
  const { recordAction } = await import("./undo.js");
  recordAction(db, `Result from vlr.gg (match over): ${event} ${id} ${score.sa}-${score.sb}`, "vlr.gg");
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
