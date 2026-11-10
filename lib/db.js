// SQLite storage through libsql: on the site, every statement goes straight to Turso, with no local copy (a copy spends the synchronisation quota quickly). Locally or in tests, one file.
import Database from "libsql";
import fs from "node:fs";
import path from "node:path";
import { prizePool } from "./tournament.js";
import { EVENTS, buildBracket, podium, slotsOf } from "./bracket.js";
import { teamLogo } from "./team-logos.js";
import { KICK_DEFAULTS } from "./kickoff.js";
import { fillEditors } from "./editors.js";
import { fillAccounts } from "./accounts.js";
import { fillSeasons } from "./seasons.js";
import { fillCommunity, listNews } from "./community.js";
import { installUndo } from "./undo.js";
import { INFO_DEFAULTS, INFO_EVENTS, checkInfo } from "./einfo.js";
import { TIME_EVENTS, checkExtra, cleanLink, cleanTime, isMatchOf } from "./schedule.js";
import { withAutoLive } from "./matchlist.js";
import { REGIONS, REG_DEFAULTS, REG_QUALIFIERS, REG_QUALIFY, buildRegional, regPlaces } from "./regional.js";
import { fillPickem } from "./pickem.js";
import { fillFans } from "./fans.js";
import { fillSocial } from "./social.js";
import { fillBot } from "./botstore.js";
import { fillBotExtra } from "./botextra.js";
import { fillMore } from "./more.js";
import { fillRound6 } from "./round6.js";
import { fillGames } from "./games.js";
import { fillRound7 } from "./round7.js";
import { fillRound8 } from "./round8.js";

// Slot order matters: it is the seed order used for Round 1 pairings.
// `roster` lists the known players, comma separated. `source`/`pos` say where a qualified slot comes from.
const SEED = [
  { id: "t01", name: "UCAM Esports", tag: "UC", status: "invited", roster: "BULD|pl" },
  { id: "t02", name: "Eintracht Frankfurt", tag: "EF", status: "invited", roster: "azury|de, musashi|de, Fizzy|pt" },
  { id: "t03", name: "MIR", tag: "MR", status: "invited", roster: "reblyik|ua, Bishepss|ru, innersavage|ru, kospa1n|ru, xserten|ru" },
  { id: "t04", name: "Joblife", tag: "JL", status: "invited", roster: "westside|pl, WanZeru|cz, Sevire|gb, hoody|fi, al0rante|de" },
  { id: "t05", name: "NAVI Junior", tag: "NJ", status: "invited", roster: "avey|lv, Darxcio|be, Javelin|ua, Kolosha|ua, sizovskyy|pl" },
  { id: "t06", name: "Mandatory", tag: "MD", status: "invited", roster: "Veqaj|fr, starxo|pl, RunneR|mk, Kicks|ee, MiniBoo|lt" },
  { id: "t07", status: "invited" },
  { id: "t08", status: "invited" },
  { id: "t09", status: "qualified", source: "Qualifier 1", pos: 1 },
  { id: "t10", status: "qualified", source: "Qualifier 1", pos: 2 },
  { id: "t11", status: "qualified", source: "Qualifier 1", pos: 3 },
  { id: "t12", status: "qualified", source: "Qualifier 1", pos: 4 },
  { id: "t13", status: "qualified", source: "Qualifier 2", pos: 1 },
  { id: "t14", status: "qualified", source: "Qualifier 2", pos: 2 },
  { id: "t15", status: "qualified", source: "Qualifier 2", pos: 3 },
  { id: "t16", status: "qualified", source: "Qualifier 2", pos: 4 },
];

// Raise it when the tables change: the next server to start then runs the checks, once.
export const SCHEMA_REV = 17;

/** Whether Turso's tables are up to date: checking them all is many trips, so it is done only when needed. */
function schemaIsCurrent(db) {
  try {
    const r = db.prepare("SELECT value FROM kv WHERE key = 'schema_rev'").get();
    return !!r && JSON.parse(r.value) === SCHEMA_REV;
  } catch {
    return false; // a new database
  }
}

/**
 * Makes libsql behave like the code expects: a transaction inside a transaction joins it through a savepoint, and rows carry only
 * their columns (libsql adds timing to the rows of get).
 */
export function harden(db) {
  let depth = 0;
  let saves = 0;
  db.transaction = (fn) => (...args) => {
    const save = depth > 0 ? `nested_${(saves += 1)}` : "";
    db.exec(save ? `SAVEPOINT ${save}` : "BEGIN");
    depth += 1;
    try {
      const out = fn(...args);
      db.exec(save ? `RELEASE ${save}` : "COMMIT");
      return out;
    } catch (e) {
      db.exec(save ? `ROLLBACK TO ${save}; RELEASE ${save}` : "ROLLBACK");
      throw e;
    } finally {
      depth -= 1;
    }
  };
  // A statement prepared before a transaction would run outside it on Turso's copy: each run prepares it at that moment.
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const st = () => prepare(sql);
    return {
      run: (...args) => st().run(...args),
      all: (...args) => st().all(...args),
      get: (...args) => {
        const row = st().get(...args);
        if (row && typeof row === "object") delete row._metadata;
        return row;
      },
    };
  };
  return db;
}

/** Open (and create or upgrade if needed) a database. Pass ":memory:" in tests. With options (Turso's token), file is Turso's address. */
export function openDb(file, options) {
  const db = harden(options ? new Database(file, options) : new Database(file));
  if (options) {
    if (schemaIsCurrent(db)) return db;
  } else {
    db.pragma("busy_timeout = 10000");
    db.pragma("journal_mode = WAL");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      teams TEXT NOT NULL DEFAULT '[]',
      lang TEXT NOT NULL DEFAULT 'fr'
    );
    CREATE TABLE IF NOT EXISTS announced ("key" TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS pushed ("key" TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS lp_items (
      kind TEXT NOT NULL,
      "key" TEXT NOT NULL,
      json TEXT NOT NULL,
      at TEXT NOT NULL,
      PRIMARY KEY (kind, key)
    );
    CREATE TABLE IF NOT EXISTS lp_requests (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      "first" INTEGER NOT NULL DEFAULT 0,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lp_blobs (
      "key" TEXT PRIMARY KEY,
      data BLOB NOT NULL,
      ext TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lp_logos (
      file TEXT PRIMARY KEY,
      data BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'qualified' CHECK (status IN ('invited', 'qualified')),
      roster TEXT NOT NULL DEFAULT '',
      ord INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      pos INTEGER,
      logo TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL CHECK (stage IN ('swiss', 'elim')),
      round TEXT NOT NULL,
      grp TEXT,
      a TEXT NOT NULL DEFAULT '',
      b TEXT NOT NULL DEFAULT '',
      sa INTEGER,
      sb INTEGER,
      bo INTEGER NOT NULL DEFAULT 3,
      feeds TEXT,
      slot TEXT
    );
    CREATE TABLE IF NOT EXISTS qslots (
      event TEXT NOT NULL,
      slot INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      roster TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'invited',
      PRIMARY KEY (event, slot)
    );
    CREATE TABLE IF NOT EXISTS qscores (
      event TEXT NOT NULL,
      id TEXT NOT NULL,
      a INTEGER NOT NULL,
      b INTEGER NOT NULL,
      sa INTEGER NOT NULL,
      sb INTEGER NOT NULL,
      PRIMARY KEY (event, id)
    );
    CREATE TABLE IF NOT EXISTS kteams (
      slot INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'qualified')),
      source TEXT NOT NULL DEFAULT '',
      pos INTEGER NOT NULL DEFAULT 0,
      logo TEXT NOT NULL DEFAULT '',
      roster TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kmatches (
      id TEXT PRIMARY KEY,
      a INTEGER,
      b INTEGER,
      sa INTEGER,
      sb INTEGER,
      pa INTEGER,
      pb INTEGER
    );
    CREATE TABLE IF NOT EXISTS kv (
      "key" TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  upgradeTeams(db);
  fillSeedDefaults(db);
  fillKickoff(db);
  fillRegional(db);
  fillEventInfo(db);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM teams").get();
  if (n === 0) {
    const ins = db.prepare(
      "INSERT INTO teams (id, name, tag, status, roster, ord, source, pos, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    db.transaction(() =>
      SEED.forEach((s, i) =>
        ins.run(s.id, s.name || "", s.tag || "", s.status, s.roster || "", i + 1, s.source || "", s.pos ?? null, s.logo || "")
      )
    )();
  }
  fillEditors(db);
  fillSeasons(db);
  fillCommunity(db);
  fillAccounts(db);
  fillPickem(db);
  fillFans(db);
  fillSocial(db);
  fillBot(db);
  fillBotExtra(db);
  fillMore(db);
  fillRound6(db);
  fillGames(db);
  fillRound7(db);
  fillRound8(db);
  if (!db.prepare("PRAGMA table_info(predictions)").all().some((c) => c.name === "score")) db.exec("ALTER TABLE predictions ADD COLUMN score TEXT NOT NULL DEFAULT ''");
  installUndo(db); // last: what the steps above fill in is not an editor's change
  if (!db.prepare("PRAGMA table_info(push_subs)").all().some((c) => c.name === "lang")) db.exec("ALTER TABLE push_subs ADD COLUMN lang TEXT NOT NULL DEFAULT 'fr'");
  if (!db.prepare("PRAGMA table_info(push_subs)").all().some((c) => c.name === "players")) db.exec("ALTER TABLE push_subs ADD COLUMN players TEXT NOT NULL DEFAULT '[]'");
  if (!db.prepare("PRAGMA table_info(push_subs)").all().some((c) => c.name === "digest")) db.exec("ALTER TABLE push_subs ADD COLUMN digest INTEGER NOT NULL DEFAULT 0");
  if (options) db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('schema_rev', ?)").run(JSON.stringify(SCHEMA_REV));
  return db;
}

/**
 * Idempotent: gives older databases the seed logos and player countries without touching anything an editor changed.
 * A roster is only replaced when it is empty or still the old seed text without country codes.
 */
/** Table einfo: one row per event (dates, type, location, venue, tier). Rows are only added when missing. */
export function fillEventInfo(db) {
  db.exec("CREATE TABLE IF NOT EXISTS mtimes (event TEXT NOT NULL, id TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (event, id))");
  db.exec("CREATE TABLE IF NOT EXISTS mextra (event TEXT NOT NULL, id TEXT NOT NULL, stream TEXT NOT NULL DEFAULT '', vod TEXT NOT NULL DEFAULT '', maps TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (event, id))");
  db.exec("CREATE TABLE IF NOT EXISTS mlive (event TEXT NOT NULL, id TEXT NOT NULL, la INTEGER NOT NULL DEFAULT 0, lb INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (event, id))");
  const xcols = db.prepare("PRAGMA table_info(mextra)").all().map((c) => c.name);
  if (!xcols.includes("highlights")) db.exec("ALTER TABLE mextra ADD COLUMN highlights TEXT NOT NULL DEFAULT ''");
  if (!xcols.includes("details")) db.exec("ALTER TABLE mextra ADD COLUMN details TEXT NOT NULL DEFAULT 'null'");
  if (!xcols.includes("mvp")) db.exec("ALTER TABLE mextra ADD COLUMN mvp TEXT NOT NULL DEFAULT ''");
  if (!xcols.includes("pstats")) db.exec("ALTER TABLE mextra ADD COLUMN pstats TEXT NOT NULL DEFAULT '[]'");
  // maps won so far while live (la, lb): added after the first version of the table
  const lcols = db.prepare("PRAGMA table_info(mlive)").all().map((c) => c.name);
  if (!lcols.includes("la")) db.exec("ALTER TABLE mlive ADD COLUMN la INTEGER NOT NULL DEFAULT 0; ALTER TABLE mlive ADD COLUMN lb INTEGER NOT NULL DEFAULT 0;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS einfo (
      event TEXT PRIMARY KEY,
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'online',
      location TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT ''
    );
  `);
  // a first version named the date columns start / end ("end" is an SQL keyword): rename them
  const cols = db.prepare("PRAGMA table_info(einfo)").all().map((c) => c.name);
  if (cols.includes("start")) db.exec(`ALTER TABLE einfo RENAME COLUMN start TO start_date; ALTER TABLE einfo RENAME COLUMN "end" TO end_date;`);
  if (!db.prepare("PRAGMA table_info(einfo)").all().some((c) => c.name === "stream")) db.exec("ALTER TABLE einfo ADD COLUMN stream TEXT NOT NULL DEFAULT ''");
  const have = new Set(db.prepare("SELECT event FROM einfo").all().map((r) => r.event));
  const missing = INFO_EVENTS.filter((e) => !have.has(e));
  if (!missing.length) return;
  const ins = db.prepare("INSERT OR IGNORE INTO einfo (event, start_date, end_date, type, location, venue, tier) VALUES (?, ?, ?, ?, ?, ?, ?)");
  db.transaction(() => missing.forEach((e) => { const d = INFO_DEFAULTS[e]; ins.run(e, d.start, d.end, d.type, d.location, d.venue, d.tier); }))();
}

/** Match times: { kickoff: { "u1-1": "2027-01-15T15:00:00.000Z", ... }, ... } (UTC). */
export function getMatchTimes(db) {
  const out = Object.fromEntries(TIME_EVENTS.map((e) => [e, {}]));
  for (const r of db.prepare("SELECT event, id, at FROM mtimes").all()) if (out[r.event]) out[r.event][r.id] = r.at;
  return out;
}

/** Sets the times of several matches at once: all of them or, on any error, none. */
export function setMatchTimes(db, { event, items }) {
  if (!Array.isArray(items) || !items.length) return { ok: false, status: 400, error: "Write the date and time of the match." };
  let failed = null;
  try {
    db.transaction(() => {
      const size = EVENTS.includes(event) ? qualifierSize(db, event) : undefined;
      for (const it of items) {
        const r = setMatchTime(db, { event, id: it.id, at: it.at }, size);
        if (!r.ok) {
          failed = r;
          throw new Error("rollback");
        }
      }
    })();
  } catch (e) {
    if (!failed) throw e;
  }
  return failed || { ok: true, message: "Round scheduled." };
}

/** Sets (or with an empty time, clears) one match's date and time. */
export function setMatchTime(db, { event, id, at }, knownSize) {
  if (!TIME_EVENTS.includes(event)) return { ok: false, status: 404, error: "Unknown event." };
  if (!isMatchOf(event, id, knownSize || (EVENTS.includes(event) ? qualifierSize(db, event) : undefined))) return { ok: false, status: 404, error: "Unknown match." };
  const t = cleanTime(at);
  if (t === null) return { ok: false, status: 400, error: "Write the date and time of the match." };
  if (!t) {
    db.prepare("DELETE FROM mtimes WHERE event = ? AND id = ?").run(event, id);
    return { ok: true, message: "Match time cleared." };
  }
  db.prepare("INSERT INTO mtimes (event, id, at) VALUES (?, ?, ?) ON CONFLICT(event, id) DO UPDATE SET at = excluded.at").run(event, id, t);
  return { ok: true, message: "Match time saved." };
}

/**
 * Matches being played now, with the maps won so far: { kickoff: { "u1-1": { a: 1, b: 0 } }, ... }.
 * A match with a result is no longer shown live.
 */
export function getMatchLive(db) {
  const out = Object.fromEntries(TIME_EVENTS.map((e) => [e, {}]));
  for (const r of db.prepare("SELECT event, id, la, lb FROM mlive").all()) if (out[r.event]) out[r.event][r.id] = { a: r.la, b: r.lb };
  return out;
}

/**
 * Marks a match as being played now (live true) or not; while live, a and b are the maps won so far (the score in
 * progress, e.g. 1-0). That score is not a result: the result is still entered as usual once the match is over.
 */
/**
 * vlr.gg's view of the matches being played: each live entry gets its maps' scores and its feed; while no editor gave the maps won,
 * vlr.gg's count is used. Only reads of the last 6 hours.
 */
function mergeVlrLive(state, db, now = Date.now()) {
  for (const r of db.prepare("SELECT key, json FROM lp_items WHERE kind = 'vlr_live'").all()) {
    const [event, id] = r.key.split(":");
    const entry = state.live[event] && state.live[event][id];
    if (!entry) continue;
    let v;
    try { v = JSON.parse(r.json); } catch { continue; }
    if (!v || !v.at || now - new Date(v.at).getTime() > 6 * 3600000) continue;
    const base = typeof entry === "object" ? entry : { a: 0, b: 0 };
    const typed = (base.a || 0) + (base.b || 0) > 0;
    state.live[event][id] = { ...base, a: typed ? base.a : v.sa, b: typed ? base.b : v.sb, maps: v.maps || [], feed: v.feed || [] };
  }
}

/** The matches an editor took off live after their time came: { "event:id": time }. */
function tookOffLive(db) {
  const out = {};
  for (const r of db.prepare("SELECT key, value FROM kv WHERE key LIKE 'nolive:%'").all()) out[r.key.slice(7)] = r.value;
  return out;
}

export function setMatchLive(db, { event, id, live, a, b }) {
  if (!TIME_EVENTS.includes(event)) return { ok: false, status: 404, error: "Unknown event." };
  if (!isMatchOf(event, id, EVENTS.includes(event) ? qualifierSize(db, event) : undefined)) return { ok: false, status: 404, error: "Unknown match." };
  const offKey = `nolive:${event}:${id}`;
  if (!live) {
    db.prepare("DELETE FROM mlive WHERE event = ? AND id = ?").run(event, id);
    // its time has come: it would go live again by itself, so this is remembered (a new time starts over)
    const at = db.prepare("SELECT at FROM mtimes WHERE event = ? AND id = ?").get(event, id);
    if (at && new Date(at.at).getTime() <= Date.now()) db.prepare("INSERT INTO kv (\"key\", value) VALUES (?, ?) ON CONFLICT (\"key\") DO UPDATE SET value = excluded.value").run(offKey, at.at);
    return { ok: true, message: "Match no longer live." };
  }
  db.prepare("DELETE FROM kv WHERE key = ?").run(offKey);
  const n = (x) => (x === undefined || x === null || x === "" ? 0 : Number(x));
  const la = n(a);
  const lb = n(b);
  if (![la, lb].every((x) => Number.isInteger(x) && x >= 0 && x <= 4)) return { ok: false, status: 400, error: "The score in progress is a number of maps from 0 to 4." };
  const had = db.prepare("SELECT 1 FROM mlive WHERE event = ? AND id = ?").get(event, id);
  db.prepare("INSERT INTO mlive (event, id, la, lb) VALUES (?, ?, ?, ?) ON CONFLICT(event, id) DO UPDATE SET la = excluded.la, lb = excluded.lb").run(event, id, la, lb);
  return { ok: true, message: had ? "Score in progress saved." : "Match marked as live." };
}

/** Each match's details: { kickoff: { "u4": { stream, vod, maps: [{ map, a, b, pick }] } }, ... }. */
export function getMatchExtra(db) {
  const out = Object.fromEntries(TIME_EVENTS.map((e) => [e, {}]));
  // vlr.gg's tables are not carried by every page: only whether there is one (lib/tstats.js reads them)
  for (const r of db.prepare("SELECT event, id, stream, vod, highlights, mvp, pstats, maps, (details IS NOT NULL AND details <> 'null') AS has FROM mextra").all()) {
    if (!out[r.event]) continue;
    const list = (text) => {
      try {
        const v = JSON.parse(text);
        return Array.isArray(v) ? v : [];
      } catch {
        return []; // a broken cell reads as nothing
      }
    };
    out[r.event][r.id] = { stream: r.stream, vod: r.vod, highlights: r.highlights, mvp: r.mvp, pstats: list(r.pstats), maps: list(r.maps), hasDetails: !!r.has };
  }
  return out;
}

/** Saves a match's stream and VOD links and its maps (all empty: the row is removed). */
export function setMatchExtra(db, { event, id, ...raw }) {
  if (!TIME_EVENTS.includes(event)) return { ok: false, status: 404, error: "Unknown event." };
  if (!isMatchOf(event, id, EVENTS.includes(event) ? qualifierSize(db, event) : undefined)) return { ok: false, status: 404, error: "Unknown match." };
  const { extra, error } = checkExtra(raw);
  if (error) return { ok: false, status: 400, error };
  if (!extra.stream && !extra.vod && !extra.highlights && !extra.mvp && !extra.pstats.length && !extra.maps.length) {
    db.prepare("DELETE FROM mextra WHERE event = ? AND id = ?").run(event, id);
  } else {
    db.prepare("INSERT INTO mextra (event, id, stream, vod, highlights, mvp, pstats, maps) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event, id) DO UPDATE SET stream = excluded.stream, vod = excluded.vod, highlights = excluded.highlights, mvp = excluded.mvp, pstats = excluded.pstats, maps = excluded.maps")
      .run(event, id, extra.stream, extra.vod, extra.highlights, extra.mvp, JSON.stringify(extra.pstats), JSON.stringify(extra.maps));
  }
  return { ok: true, message: "Match details saved." };
}

/** Every event's info: { playoffs: { start, end, type, location, venue, tier }, ... }. */
export function getEventInfo(db) {
  const rows = Object.fromEntries(db.prepare(`SELECT event, start_date AS start, end_date AS "end", type, location, venue, tier, stream FROM einfo`).all().map(({ event, ...r }) => [event, r]));
  return Object.fromEntries(INFO_EVENTS.map((e) => [e, rows[e] || { ...INFO_DEFAULTS[e] }]));
}

/** Saves one event's info. Same contract as the other actions: { ok, message } or { ok: false, status, error }. */
export function setEventInfo(db, { event, ...raw }) {
  if (!INFO_EVENTS.includes(event)) return { ok: false, status: 404, error: "Unknown event." };
  const { info, error } = checkInfo(raw);
  if (error) return { ok: false, status: 400, error };
  const stream = cleanLink(raw.stream);
  if (stream === null) return { ok: false, status: 400, error: "Links start with https://." };
  db.prepare("INSERT INTO einfo (event, start_date, end_date, type, location, venue, tier) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date, type = excluded.type, location = excluded.location, venue = excluded.venue, tier = excluded.tier")
    .run(event, info.start, info.end, info.type, info.location, info.venue, info.tier);
  if (raw.stream !== undefined) db.prepare("UPDATE einfo SET stream = ? WHERE event = ?").run(stream, event);
  return { ok: true, message: "Event information saved." };
}

export function fillSeedDefaults(db) {
  const get = db.prepare("SELECT name, logo, roster FROM teams WHERE id = ?");
  const setLogo = db.prepare("UPDATE teams SET logo = ? WHERE id = ?");
  const setRoster = db.prepare("UPDATE teams SET roster = ? WHERE id = ?");
  // Read first: when nothing needs changing (almost every start) the database is not written at all,
  // so a second process or a viewer such as DB Browser holding the file cannot make start-up fail.
  const todo = [];
  for (const s of SEED) {
    if (!s.name) continue;
    const row = get.get(s.id);
    if (!row || row.name !== s.name) continue;
    if (s.logo && row.logo === "") todo.push(() => setLogo.run(s.logo, s.id));
    if (s.roster && s.roster !== row.roster && (row.roster === "" || row.roster === s.roster.replace(/\|[a-z-]+/g, ""))) {
      todo.push(() => setRoster.run(s.roster, s.id));
    }
  }
  if (todo.length) db.transaction(() => todo.forEach((f) => f()))();
}

/**
 * Kickoff tables: one row per participant (12) and one per match that has teams or a score set by hand.
 * Read first, write only when a row is missing; also moves data saved by the previous version (kv) into the tables.
 */
export function fillKickoff(db) {
  const have = new Set(db.prepare("SELECT slot FROM kteams").all().map((r) => r.slot));
  const hadMatches = db.prepare("SELECT COUNT(*) AS n FROM kmatches").get().n > 0;
  const kv = (k) => {
    const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(k);
    if (!r) return null;
    try { return JSON.parse(r.value); } catch { return null; }
  };
  const oldTeams = have.size < KICK_DEFAULTS.length ? kv("kick:teams") || {} : {};
  const oldManual = !hadMatches ? kv("kick:manual") : null;
  const oldScores = !hadMatches ? kv("kick:scores") : null;
  if (have.size >= KICK_DEFAULTS.length && !oldManual && !oldScores) return;
  db.transaction(() => {
    const ins = db.prepare("INSERT INTO kteams (slot, name, tag, status, source, pos, logo, roster, staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    KICK_DEFAULTS.forEach((d, i) => {
      if (have.has(i + 1)) return;
      const s = oldTeams[i + 1] || {};
      const name = s.name !== undefined ? s.name : d.name;
      ins.run(i + 1, name, name ? s.tag || "" : "", s.entry || d.entry, d.source || "", d.pos || 0, name ? s.logo || "" : "", s.roster || "", s.staff || "");
    });
    const put = db.prepare("INSERT OR IGNORE INTO kmatches (id, a, b) VALUES (?, ?, ?)");
    for (const [id, m] of Object.entries(oldManual || {})) put.run(id, m.a ?? null, m.b ?? null);
    const sc = db.prepare("UPDATE kmatches SET sa = ?, sb = ?, pa = ?, pb = ? WHERE id = ?");
    for (const [id, s] of Object.entries(oldScores || {})) {
      put.run(id, null, null);
      sc.run(s.sa, s.sb, s.a, s.b, id);
    }
    db.prepare("DELETE FROM kv WHERE key IN ('kick:teams', 'kick:manual', 'kick:scores')").run();
  })();
}

/**
 * Regional Qualifier Playoffs (Türkiye...): one row per participant (8 per region) and one per match with teams or a score.
 * Creates the tables when missing (also on a running server after a hot reload) and adds each region's default teams once.
 */
export function fillRegional(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rteams (
      event TEXT NOT NULL,
      slot INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'qualified')),
      source TEXT NOT NULL DEFAULT '',
      pos INTEGER NOT NULL DEFAULT 0,
      roster TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT '',
      auto INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (event, slot)
    );
    CREATE TABLE IF NOT EXISTS rmatches (
      event TEXT NOT NULL,
      id TEXT NOT NULL,
      a INTEGER,
      b INTEGER,
      sa INTEGER,
      sb INTEGER,
      pa INTEGER,
      pb INTEGER,
      PRIMARY KEY (event, id)
    );
  `);
  // auto: 1 while a place holds the team a qualifier's result put there (tables made before it get the column)
  if (!db.prepare("PRAGMA table_info(rteams)").all().some((c) => c.name === "auto")) db.exec("ALTER TABLE rteams ADD COLUMN auto INTEGER NOT NULL DEFAULT 0");
  const have = new Set(db.prepare("SELECT event || ':' || slot AS k FROM rteams").all().map((r) => r.k));
  const todo = REGIONS.flatMap((ev) => REG_DEFAULTS[ev].map((d, i) => ({ ev, slot: i + 1, d })).filter((x) => !have.has(`${x.ev}:${x.slot}`)));
  if (!todo.length) return;
  const ins = db.prepare("INSERT INTO rteams (event, slot, name, tag, status, source, pos, roster, staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  // Game Changers: its 8 places start with the teams of its earlier team list (qslots "gc"), when there is one
  let gcList = [];
  try { gcList = db.prepare("SELECT slot, name, tag, roster, staff, status FROM qslots WHERE event = 'gc' ORDER BY slot").all(); } catch { /* no list yet */ }
  db.transaction(() => todo.forEach(({ ev, slot, d }) => {
    const g = ev === "gc" ? gcList[slot - 1] : null;
    if (g && g.name) ins.run(ev, slot, g.name, g.tag || "", g.status === "qualified" ? "qualified" : "invited", "", 0, g.roster || "", g.staff || "");
    else ins.run(ev, slot, d.name, d.tag || "", d.entry, d.source || "", d.pos || 0, "", "");
  }))();
}

/** Databases created by the first version have no source/pos columns: add them and fill the known values. */
export function upgradeTeams(db) {
  const cols = db.prepare("PRAGMA table_info(teams)").all().map((c) => c.name);
  if (!cols.includes("logo")) db.exec("ALTER TABLE teams ADD COLUMN logo TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("staff")) db.exec("ALTER TABLE teams ADD COLUMN staff TEXT NOT NULL DEFAULT ''");
  const qcols = db.prepare("PRAGMA table_info(qslots)").all().map((c) => c.name);
  if (qcols.length && !qcols.includes("roster")) db.exec("ALTER TABLE qslots ADD COLUMN roster TEXT NOT NULL DEFAULT ''");
  if (qcols.length && !qcols.includes("tag")) db.exec("ALTER TABLE qslots ADD COLUMN tag TEXT NOT NULL DEFAULT ''");
  if (qcols.length && !qcols.includes("staff")) db.exec("ALTER TABLE qslots ADD COLUMN staff TEXT NOT NULL DEFAULT ''");
  // GC EMEA teams are invited or qualified, like the Playoffs and Kickoff ones (unused by the Qualifiers)
  if (qcols.length && !qcols.includes("status")) db.exec("ALTER TABLE qslots ADD COLUMN status TEXT NOT NULL DEFAULT 'invited'");
  if (cols.includes("source") && cols.includes("pos")) return;
  db.transaction(() => {
    if (!cols.includes("source")) db.exec("ALTER TABLE teams ADD COLUMN source TEXT NOT NULL DEFAULT ''");
    if (!cols.includes("pos")) db.exec("ALTER TABLE teams ADD COLUMN pos INTEGER");
    const setSource = db.prepare("UPDATE teams SET source = ?, pos = ? WHERE id = ? AND source = ''");
    // Only fill rosters that are still empty, so nothing an editor typed is overwritten.
    const setRoster = db.prepare("UPDATE teams SET roster = ? WHERE id = ? AND roster = '' AND name = ?");
    for (const s of SEED) {
      if (s.source) setSource.run(s.source, s.pos, s.id);
      if (s.roster) setRoster.run(s.roster, s.id, s.name);
    }
  })();
}

/** One shared connection per server process. On the site it talks straight to Turso. */
export function getDb() {
  if (!globalThis.__kickoffDb) {
    const url = process.env.TURSO_DATABASE_URL;
    if (url) {
      globalThis.__kickoffDb = openDb(url, { authToken: process.env.TURSO_AUTH_TOKEN });
    } else {
      const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "kickoff.db");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      globalThis.__kickoffDb = openDb(file);
    }
  }
  return globalThis.__kickoffDb;
}

/** The names of the logos saved in the database. */
export const logoFiles = () => getDb().prepare("SELECT file FROM lp_logos").all().map((r) => r.file);
const slug = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const LOGO_EXT = ["png", "svg", "webp", "jpg", "jpeg"];

/**
 * Logo file found by the short tag in public/logos, whatever the capitals of the file name (VIT -> VIT.png, vit.svg).
 * The logo is tied to the tag only: a team with no tag gets no automatic logo (its name is never used).
 */
export function findLogo(name, dir, tag = "") {
  const key = slug(tag || "");
  if (!name || !key) return "";
  let files;
  if (dir === undefined) files = logoFiles();
  else try { files = fs.readdirSync(dir); } catch { return ""; }
  let best = null;
  for (const f of files) {
    const m = /^(.+)\.([a-z0-9]+)$/i.exec(f);
    if (!m || !LOGO_EXT.includes(m[2].toLowerCase()) || slug(m[1]) !== key) continue;
    const rank = LOGO_EXT.indexOf(m[2].toLowerCase());
    if (!best || rank < best.rank) best = { file: f, rank };
  }
  return best ? `/api/logos/${encodeURIComponent(best.file)}` : "";
}

/**
 * Saves an uploaded logo as public/logos/<TAG>.<ext>, the file findLogo picks for that tag.
 * A tag with spaces, accents or signs ("BJK FE", "KRÜ", "[A].Co") gets a plain file name instead (BJK-FE, KRU, A-CO): findLogo matches both.
 * Any other file for the same tag (another extension or other capitals) is removed, so the new one always wins.
 */
export function saveTagLogo(tag, buf, ext, dir) {
  const key = slug(tag || "");
  if (!key) return "";
  const plainName = () => {
    const plain = String(tag).trim().toUpperCase();
    return `${/^[A-Z0-9][A-Z0-9_.-]*$/.test(plain) ? plain : key.toUpperCase()}.${ext}`;
  };
  if (dir === undefined) {
    // on the site there is no lasting disk: the logos are in the database
    const db = getDb();
    db.transaction(() => {
      for (const f of logoFiles()) {
        const m = /^(.+)\.([a-z0-9]+)$/i.exec(f);
        if (m && LOGO_EXT.includes(m[2].toLowerCase()) && slug(m[1]) === key) db.prepare("DELETE FROM lp_logos WHERE file = ?").run(f);
      }
      db.prepare("INSERT OR REPLACE INTO lp_logos (file, data) VALUES (?, ?)").run(plainName(), buf);
    })();
    return plainName();
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.+)\.([a-z0-9]+)$/i.exec(f);
    if (m && LOGO_EXT.includes(m[2].toLowerCase()) && slug(m[1]) === key) fs.rmSync(path.join(dir, f), { force: true });
  }
  const file = plainName();
  fs.writeFileSync(path.join(dir, file), buf);
  return file;
}

export function listTeams(db, logoDir) {
  return db
    .prepare("SELECT id, name, tag, status, roster, ord, source, pos, logo, staff FROM teams ORDER BY ord")
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      tag: r.tag,
      status: r.status,
      roster: r.roster,
      logo: findLogo(r.name, logoDir, r.tag),
      staff: r.staff || "",
      order: r.ord,
      source: r.source || "",
      pos: r.pos == null ? null : r.pos,
    }));
}

export function listMatches(db) {
  return db
    .prepare("SELECT id, stage, round, grp, a, b, sa, sb, bo, feeds, slot FROM matches ORDER BY id")
    .all()
    .map((r) => ({
      id: r.id,
      stage: r.stage,
      round: r.stage === "swiss" ? Number(r.round) : r.round,
      group: r.grp || null,
      a: r.a || "",
      b: r.b || "",
      sa: r.sa == null ? null : r.sa,
      sb: r.sb == null ? null : r.sb,
      bo: r.bo,
      feeds: r.feeds || null,
      slot: r.slot || null,
    }));
}

export function getPlacements(db) {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'swap'").get();
  return { swap: !!row && row.value === "1" };
}

/** How many places a qualifier has: its usual number, or what its Toornament bracket has. */
export function qualifierSize(db, event) {
  const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(`qbo:${event}:size`);
  return (r && Number(r.value)) || slotsOf(event);
}

/** An open Qualifier: its slots (null when empty), the saved scores and the best-of per round. */
export function getQualifier(db, event, logoDir) {
  const bo = {};
  const savedNotes = {};
  for (const r of db.prepare("SELECT key, value FROM kv WHERE key LIKE ?").all(`qbo:${event}:%`)) {
    const parts = r.key.split(":");
    if (parts[2] === "note") savedNotes[parts[3]] = r.value;
    else bo[parts[2]] = Number(r.value);
  }
  const size = bo.size || slotsOf(event);
  delete bo.size;
  const rows = db.prepare("SELECT slot, name, roster, staff, tag, status FROM qslots WHERE event = ?").all(event);
  // logos read on Toornament: one read, and only when a team has no other
  let fromToornament = null;
  const tLogo = (name) => {
    if (logoDir !== undefined) return "";
    if (fromToornament === null) {
      const row = db.prepare("SELECT json FROM lp_items WHERE kind = 'tsync_logos' AND key = ?").get(event);
      fromToornament = row ? JSON.parse(row.json) : {};
    }
    const id = fromToornament[name];
    return id && /^\d+$/.test(id) ? `https://play.toornament.com/media/file/${id}/logo_medium` : "";
  };
  const slots = Array.from({ length: size }, () => null);
  for (const r of rows) {
    if (r.slot >= 1 && r.slot <= size && r.name) {
      slots[r.slot - 1] = { name: r.name, tag: r.tag, logo: findLogo(r.name, logoDir, r.tag) || teamLogo(r.name) || tLogo(r.name), roster: r.roster, staff: r.staff, status: r.status };
    }
  }
  const scores = {};
  for (const r of db.prepare("SELECT id, a, b, sa, sb FROM qscores WHERE event = ?").all(event)) {
    scores[r.id] = { a: r.a, b: r.b, sa: r.sa, sb: r.sb };
  }
  // a note holds only for the very score it came with: a score changed by hand takes over
  const notes = {};
  for (const [id, text] of Object.entries(savedNotes)) {
    const s = scores[id];
    const [key, note] = text.split("|");
    if (s && note && key === `${s.a}-${s.b}-${s.sa}-${s.sb}`) notes[id] = note;
  }
  return { slots, scores, bo, notes };
}

const initials = (name) => {
  const w = name.split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
};

/** Kickoff: the 12 participants, the teams set by hand per match and the saved scores (all from the kteams / kmatches tables). */
export function getKickoff(db, logoDir) {
  const teams = db.prepare("SELECT slot, name, tag, status, source, pos, logo, roster, staff FROM kteams ORDER BY slot").all().map((r) => ({
    id: `k${r.slot}`, slot: r.slot, name: r.name, tag: r.name ? r.tag : "",
    logo: findLogo(r.name, logoDir, r.tag),
    roster: r.roster, staff: r.staff, status: r.status, source: r.source, pos: r.pos,
  }));
  const manual = {};
  const scores = {};
  for (const r of db.prepare("SELECT id, a, b, sa, sb, pa, pb FROM kmatches").all()) {
    if (r.a != null || r.b != null) manual[r.id] = { a: r.a, b: r.b };
    if (r.sa != null && r.sb != null) scores[r.id] = { a: r.pa, b: r.pb, sa: r.sa, sb: r.sb };
  }
  // The two Qualifier Playoffs winners (group A, group B) take the EU Qualifier 1st / 2nd places by themselves.
  const pt = listTeams(db, logoDir);
  const pool = prizePool(pt, listMatches(db), getPlacements(db));
  // They are also written into kteams (slots 9 and 10), so the table always holds them; cleared again if the Playoffs no longer have a winner.
  const sync = db.prepare("UPDATE kteams SET name = ?, tag = ?, roster = ?, staff = ?, logo = '' WHERE slot = ?");
  const fill = (source, pos, w) => {
    const slot = KICK_DEFAULTS.findIndex((d) => d.source === source && d.pos === pos);
    if (slot < 0) return;
    const has = !!(w && w.name);
    const v = has ? { name: w.name, tag: w.tag || "", roster: w.roster || "", staff: w.staff || "" } : { name: "", tag: "", roster: "", staff: "" };
    const cur = db.prepare("SELECT name, tag, roster, staff, logo FROM kteams WHERE slot = ?").get(slot + 1);
    if (cur && (cur.name !== v.name || cur.tag !== v.tag || cur.roster !== v.roster || cur.staff !== v.staff || cur.logo !== "")) {
      sync.run(v.name, v.tag, v.roster, v.staff, slot + 1);
    }
    if (has) teams[slot] = { ...teams[slot], name: w.name, tag: w.tag, logo: w.logo, roster: w.roster, staff: w.staff, auto: true };
  };
  pool.winners.forEach((id, i) => fill("EU Qualifier", i + 1, id && pt.find((t) => t.id === id)));
  // Same for the regional Qualifier Playoffs: their winner takes the region's Kickoff place. With no winner, the place is
  // emptied only if it still holds one of that region's teams (a winner taken back); a team typed there by hand stays.
  for (const [source, ev] of Object.entries(KICK_REGION)) {
    const r = getRegional(db, ev, logoDir);
    const first = regPlaces(buildRegional(r.manual, r.scores, ev))[0];
    const slot = KICK_DEFAULTS.findIndex((d) => d.source === source && d.pos === 1);
    if (first) fill(source, 1, r.teams[first - 1]);
    else if (slot >= 0 && teams[slot].name && r.teams.some((t) => t.name && t.name === teams[slot].name)) {
      fill(source, 1, null);
      teams[slot] = { ...teams[slot], name: "", tag: "", logo: "", roster: "", staff: "" };
    }
  }
  return { teams, manual, scores };
}

/** Kickoff places filled by a regional Qualifier Playoffs winner: KICK_DEFAULTS source -> region. */
const KICK_REGION = { "TR Qualifier": "tr", "MENA Qualifier": "mena" };

/**
 * The region's qualified places ("Qualifier 1" 1st / 2nd...) follow that qualifier's results: the team that finished there is
 * written into rteams and marked auto. With no such team (yet, or any more), a place still marked auto is emptied;
 * a team typed there by hand (auto 0) stays. Returns the slots filled automatically.
 */
function syncRegionalQualifiers(db, event) {
  const auto = new Set();
  const qs = REG_QUALIFIERS[event] || {};
  const rows = db.prepare("SELECT slot, name, tag, roster, staff, source, pos, auto FROM rteams WHERE event = ?").all(event);
  const put = db.prepare("UPDATE rteams SET name = ?, tag = ?, roster = ?, staff = ?, auto = ? WHERE event = ? AND slot = ?");
  for (const [source, qev] of Object.entries(qs)) {
    const q = getQualifier(db, qev);
    const top = podium(buildBracket(q.slots, q.scores, q.bo));
    for (const row of rows.filter((r) => r.source === source && r.pos >= 1 && r.pos <= REG_QUALIFY)) {
      const w = top[row.pos - 1] ? q.slots[top[row.pos - 1] - 1] : null;
      if (w) {
        auto.add(row.slot);
        const v = [w.name, w.tag || "", w.roster || "", w.staff || ""];
        if (!row.auto || row.name !== v[0] || row.tag !== v[1] || row.roster !== v[2] || row.staff !== v[3]) put.run(...v, 1, event, row.slot);
      } else if (row.auto) {
        put.run("", "", "", "", 0, event, row.slot);
      }
    }
  }
  return auto;
}

/** One region's Qualifier Playoffs: the 8 participants, the teams set by hand per match and the saved scores. */
export function getRegional(db, event, logoDir) {
  const auto = syncRegionalQualifiers(db, event);
  const teams = db.prepare("SELECT slot, name, tag, status, source, pos, roster, staff FROM rteams WHERE event = ? ORDER BY slot").all(event).map((r) => ({
    id: `${event}${r.slot}`, slot: r.slot, name: r.name, tag: r.name ? r.tag : "",
    logo: findLogo(r.name, logoDir, r.tag),
    roster: r.roster, staff: r.staff, status: r.status, source: r.source, pos: r.pos,
    ...(auto.has(r.slot) ? { auto: true } : {}),
  }));
  const manual = {};
  const scores = {};
  for (const r of db.prepare("SELECT id, a, b, sa, sb, pa, pb FROM rmatches WHERE event = ?").all(event)) {
    if (r.a != null || r.b != null) manual[r.id] = { a: r.a, b: r.b };
    if (r.sa != null && r.sb != null) scores[r.id] = { a: r.pa, b: r.pb, sa: r.sa, sb: r.sb };
  }
  return { teams, manual, scores };
}

const STATE_FOR = 10000; // visitors may see a change up to 10 seconds late; it saves many trips to Turso

/** Forgets the kept state: an editor always sees the latest, and so does whatever follows a change. */
export function dropStateCache() {
  globalThis.__kickoffState = null;
}

export function getState(db, logoDir) {
  const shared = !logoDir && process.env.TURSO_DATABASE_URL && db === globalThis.__kickoffDb;
  if (!shared) return readState(db, logoDir);
  const kept = globalThis.__kickoffState;
  if (kept && Date.now() - kept.at < STATE_FOR) return kept.state;
  const state = readState(db);
  globalThis.__kickoffState = { at: Date.now(), state };
  return state;
}

function readState(db, logoDir) {
  const qualifiers = {};
  for (const e of EVENTS) qualifiers[e] = getQualifier(db, e, logoDir);
  // VCT Game Changers EMEA: a plain team list for now (each team keeps its slot number).
  const gc = getQualifier(db, "gc", logoDir).slots.map((t, i) => t && { ...t, slot: i + 1 }).filter(Boolean);
  const regional = Object.fromEntries(REGIONS.map((ev) => [ev, getRegional(db, ev, logoDir)]));
  const state = { teams: listTeams(db, logoDir), matches: listMatches(db), placements: getPlacements(db), qualifiers, kickoff: getKickoff(db, logoDir), gc, regional, info: getEventInfo(db), times: getMatchTimes(db), live: getMatchLive(db), extra: getMatchExtra(db), news: listNews(db, 3) };
  state.live = withAutoLive(state, tookOffLive(db));
  mergeVlrLive(state, db);
  return state;
}
