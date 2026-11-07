// Match details from vlr.gg: the score in maps, each map's score, the players' numbers, the stream and the VOD.
// A page every 10 seconds at most, a few per round; any refusal stops everything for a day (lib/vlrfetch.js). What an editor typed stays.
import { checkExtra } from "./schedule.js";

export const VLR_EVENTS = { q1: "3175" };
const UA = "vct-emea-site/1.0 (personal tournament site)";
const GAP = 10000;
const PER_ROUND = 3;
const LIST_HOT = 10 * 60000;
const LIST_COLD = 6 * 3600000;

const text = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();
export const norm = (s) => text(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");

/** The matches of an event's list: [{ id, path, a, b, done, stats }]. */
export function parseEventMatches(html) {
  const out = [];
  const re = /<a href="\/(\d+)\/([^"]+)"[^>]*class="[^"]*match-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of String(html || "").matchAll(re)) {
    const names = [...m[3].matchAll(/match-item-vs-team-name">([\s\S]*?)<\/div>\s*<\/div>/g)].map((x) => text(x[1]));
    if (names.length < 2) continue;
    const stats = (/Stats:\s*<\/div>([\s\S]*?)<\/div>/.exec(m[3]) || [])[1] || "";
    out.push({ id: m[1], path: `/${m[1]}/${m[2]}`, a: names[0], b: names[1], done: /mod-completed/.test(m[3]), stats: !/Unavailable/i.test(text(stats)) });
  }
  return out;
}

const num = (s) => { const n = parseInt(String(s || "").replace(/[^0-9-]/g, ""), 10); return Number.isFinite(n) ? n : null; };

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
  blocks.forEach((b, i) => {
    const s = part(i);
    if (b.id === "all") {
      players = [...s.matchAll(/<div class="ovw-row">([\s\S]*?)(?=<div class="ovw-row"|$)/g)].map((r) => {
        const cell = (col) => num((new RegExp(`data-col="${col}"[^>]*>[\\s\\S]*?mod-both">([^<]*)<`).exec(r[1]) || [])[1]);
        return { name: text((/ovw-player-name[^>]*>([\s\S]*?)<\/div>/.exec(r[1]) || [])[1]), k: cell("kills"), d: cell("deaths"), a: cell("assists"), acs: cell("acs") };
      }).filter((p) => p.name && [p.k, p.d, p.a, p.acs].every((n) => n != null));
      return;
    }
    const map = text((/<div class="map-name">([\s\S]*?)<\/div>/.exec(s) || [])[1]).replace(/\bPICK\b/i, "").trim();
    const sc = [...s.slice(0, 3000).matchAll(/<div class="score[^"]*"[^>]*>\s*(\d+)\s*<\/div>/g)].map((m) => Number(m[1]));
    if (map && sc.length >= 2 && !maps.some((x) => x.map === map && x.a === sc[0] && x.b === sc[1])) maps.push({ map, a: sc[0], b: sc[1] });
  });
  const vodPart = (/sm-vods[^"]*">([\s\S]*?)<div class="match-stream-embed/.exec(h) || [])[1] || "";
  const vod = (/<a[^>]+href="(https:\/\/[^"]+)"/.exec(vodPart) || [])[1] || "";
  const stream = (/class="sm-ext" href="(https:\/\/[^"]+)"/.exec(h) || [])[1] || "";
  return { bo, a: names[0] || "", b: names[1] || "", sa: score ? Number(score[1]) : null, sb: score ? Number(score[2]) : null, maps, players: players.slice(0, 16), stream, vod };
}

/** The site's match a vlr.gg match is: same two teams, in any order. { id, swap } or null. */
export function findSiteMatch(items, a, b) {
  const x = norm(a);
  const y = norm(b);
  for (const m of items) {
    const ma = norm(m.a && m.a.name);
    const mb = norm(m.b && m.b.name);
    if (ma === x && mb === y) return { id: m.id, swap: false };
    if (ma === y && mb === x) return { id: m.id, swap: true };
  }
  return null;
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
  return { extra: checked.extra, score };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

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
    for (const [event, vlrId] of Object.entries(VLR_EVENTS)) {
      const items = matchesOf(event, eventData(state, event));
      const times = (state.times && state.times[event]) || {};
      const hot = Object.values(times).some((at) => Math.abs(now - new Date(at).getTime()) < 12 * 3600000);
      let list = lists[event];
      if (!list || now - new Date(list.at).getTime() > (hot ? LIST_HOT : LIST_COLD)) {
        list = { at: new Date(now).toISOString(), matches: parseEventMatches(await get(`/event/matches/${vlrId}/?series_id=all`)) };
        saveItem("vlr_event", event, list, db);
      }
      const due = list.matches.filter((v) => v.done && v.stats).map((v) => ({ v, site: findSiteMatch(items, v.a, v.b) }))
        .filter(({ v, site }) => {
          if (!site) return false;
          const s = seen[`${event}:${site.id}`];
          // read again once later for the VOD, which comes after the match
          return !s || (!s.vod && s.reads < 2 && now - new Date(s.at).getTime() > 3 * 3600000);
        });
      for (const { v, site } of due) {
        if (read >= PER_ROUND) return read;
        const m = items.find((x) => x.id === site.id);
        const found = detailsFor(parseVlrMatch(await get(v.path)), site.swap, m.bo);
        const key = `${event}:${site.id}`;
        const before = seen[key];
        saveItem("vlr_match", key, { url: `https://www.vlr.gg${v.path}`, at: new Date(now).toISOString(), reads: ((before && before.reads) || 0) + 1, vod: !!(found && found.extra.vod), score: found && found.score, extra: found ? found.extra : null }, db);
        if (found) writeExtra(db, event, site.id, found.extra, before && before.extra);
        // Toornament's round takes the score in maps the next time it reads
        if (found && found.score) db.prepare("UPDATE lp_items SET json = json_set(json, '$.hash', '') WHERE kind = 'tsync_meta' AND key = ?").run(event);
      }
    }
  } catch (e) {
    console.log(`[vlr-match] ${e.message}`);
  }
  return read;
}

/** Saves the details unless an editor changed them since vlr.gg's last ones. Kept out of "undo". */
function writeExtra(db, event, id, extra, lastFromVlr) {
  const row = db.prepare("SELECT stream, vod, highlights, mvp, pstats, maps FROM mextra WHERE event = ? AND id = ?").get(event, id);
  const parse = (t) => { try { return JSON.parse(t || "[]"); } catch { return []; } };
  const now = row && { stream: row.stream || "", vod: row.vod || "", highlights: row.highlights || "", mvp: row.mvp || "", pstats: parse(row.pstats), maps: parse(row.maps) };
  const blank = !now || (!now.stream && !now.vod && !now.highlights && !now.mvp && !now.pstats.length && !now.maps.length);
  if (!blank && JSON.stringify(now) !== JSON.stringify(lastFromVlr || null)) return; // an editor's own details
  const next = { ...extra, stream: extra.stream || (now && now.stream) || "", mvp: (now && now.mvp) || "" };
  db.transaction(() => {
    db.prepare("UPDATE undostate SET off = 1").run();
    db.prepare(`INSERT INTO mextra (event, id, stream, vod, highlights, mvp, pstats, maps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (event, id) DO UPDATE SET stream = excluded.stream, vod = excluded.vod, highlights = excluded.highlights, mvp = excluded.mvp, pstats = excluded.pstats, maps = excluded.maps`)
      .run(event, id, next.stream, next.vod, next.highlights, next.mvp, JSON.stringify(next.pstats), JSON.stringify(next.maps));
    db.prepare("UPDATE undostate SET off = 0").run();
  })();
}
