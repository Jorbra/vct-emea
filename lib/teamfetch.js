// Keeps the information of the team and person pages filled: reads Liquipedia (CC-BY-SA 3.0) and saves what those pages show.
// Run from GitHub Actions (scripts/worker.mjs).
// Their API terms: one parse request every 30 s, other requests every 2 s.
import { askToRead, readItems, saveItem, takeRequest } from "./lpstore.js";
import { teamSlug } from "./paths.js";
import { baseTitle } from "./directory.js";
import { countryCode, parsePlayerPage, parseTeamPage, parseTournamentPage } from "./teaminfo.js";

const API = "https://liquipedia.net/valorant/api.php";
const UA = "vct-kickoff-site/1.0 (personal tournament site; team pages)";
export const PARSE_GAP = 30000;
const QUERY_GAP = 2000;
const NOT_FOUND_RETRY = 864e5; // a team with no page is looked for again after a day
const ERROR_RETRY = 10 * 60000; // after a network error, 10 minutes
const WEEK = 7 * 864e5;
const PLAYER_FRESH = 14 * 864e5; // there are many more players than teams: each one is read every two weeks

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const readTeamInfo = () => readItems("team");

export const saveTeamEntry = (key, entry) => saveItem("team", key, entry);

/** Every team name of the site: EU, Türkiye and MENA events, Kickoff, Game Changers. */
export function siteTeamNames(db) {
  const names = new Set();
  for (const t of ["teams", "kteams", "rteams", "qslots"]) {
    for (const r of db.prepare(`SELECT name FROM ${t}`).all()) if (r.name && r.name.trim().length >= 2) names.add(r.name.trim());
  }
  return [...names];
}

/** The name whose saved information is the oldest, once older than a week. */
export function nextStale(names, info, now = Date.now()) {
  let best = null;
  for (const name of names) {
    const e = info[teamSlug(name)];
    if (!e || !e.page) continue;
    const age = now - new Date(e.fetched).getTime();
    if (age >= WEEK && (!best || age > best.age)) best = { name, age };
  }
  return best ? best.name : undefined;
}

/** Saved before former players and staff were read: to read again, once. */
export const teamOutdated = (entry) => !!(entry && entry.page && !entry.formerPlayers);

/** The first team whose saved information is missing what team pages now show. */
export function nextOutdated(names, info) {
  return names.find((name) => teamOutdated(info[teamSlug(name)]));
}

/**
 * The first name with nothing saved yet, or whose search for a page is old enough to try again.
 * failed: { key: time of a network error }, kept by the caller.
 */
export function nextMissing(names, info, failed = {}, now = Date.now()) {
  return names.find((name) => {
    const key = teamSlug(name);
    if (!key) return false;
    if (failed[key] && now - failed[key] < ERROR_RETRY) return false;
    const e = info[key];
    if (!e) return true;
    return !e.page && now - new Date(e.fetched).getTime() >= NOT_FOUND_RETRY;
  });
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
/** A search result is the same team when only a letter or two differ at its end ("FUT Esport", "FUT Esports"). */
export const sameTeamName = (name, title) => { const a = norm(name); const b = norm(title); return !!a && b.startsWith(a) && b.length - a.length <= 2; };
/** Liquipedia also has players, tournaments... under a name: only a page with a team infobox counts. */
export const isTeamPage = (wikitext) => /\{\{\s*Infobox[ _]team\b/i.test(wikitext || "");

/** Every query waits its turn, whoever asks (the search bar or the server's reading): two seconds apart, Liquipedia's limit. */
async function queryTurn() {
  const turn = globalThis.__lpQueryTurn || Promise.resolve();
  globalThis.__lpQueryTurn = turn.then(() => wait(QUERY_GAP));
  await turn;
}

export const lpApi = (params) => get(params);

async function get(params) {
  if (params.action !== "parse") await queryTurn();
  const res = await fetch(API + "?" + new URLSearchParams({ format: "json", ...params }), { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`Liquipedia answered ${res.status}`);
  return res.json();
}

/** A page's real title and source text; the text is "" when the page does not exist. */
async function pageSource(title) {
  const q = await get({ action: "query", titles: title, redirects: "1", prop: "revisions", rvprop: "content", rvslots: "main" });
  await wait(QUERY_GAP);
  const page = Object.values(q.query.pages)[0];
  return { title: page ? page.title : "", text: (page && page.revisions && page.revisions[0] && page.revisions[0].slots.main["*"]) || "" };
}

/** The real title of a page if it is a team's, else "". */
async function teamPageTitle(title) {
  const { title: real, text } = await pageSource(title);
  return isTeamPage(text) ? real : "";
}

async function findPage(name) {
  const direct = await teamPageTitle(name);
  if (direct) return direct;
  const s = await get({ action: "opensearch", search: name, limit: "5", namespace: "0" });
  await wait(QUERY_GAP);
  for (const title of (s[1] || []).filter((t) => sameTeamName(name, t))) {
    const found = await teamPageTitle(title);
    if (found) return found;
  }
  return "";
}

/** Looks a team up and saves it. Returns its entry; entry.page is "" when Liquipedia has no such team. Throws on a network error. */
export async function fetchTeam(name) {
  const key = teamSlug(name);
  const page = await findPage(name);
  const base = { name, page, fetched: new Date().toISOString() };
  if (!page) {
    saveTeamEntry(key, base);
    return base;
  }
  const j = await get({ action: "parse", page, prop: "text" });
  if (j.error) throw new Error(j.error.info);
  const entry = { ...base, url: `https://liquipedia.net/valorant/${encodeURIComponent(page.replace(/ /g, "_"))}`, ...parseTeamPage(j.parse.text["*"]) };
  saveTeamEntry(key, entry);
  return entry;
}

export const readPlayerInfo = () => readItems("player");
const savePlayerEntry = (key, entry) => saveItem("player", key, entry);
export const readTournamentInfo = () => readItems("tournament");

/** Looks a tournament up by its page ("VCT/2025/Champions") and saves it. Throws on a network error. */
export async function fetchTournament(page) {
  const j = await get({ action: "parse", page, redirects: "1", prop: "text" });
  const base = { page: j.error ? "" : page, fetched: new Date().toISOString() };
  const entry = j.error ? base : { ...base, url: `https://liquipedia.net/valorant/${encodeURI(page)}`, ...parseTournamentPage(j.parse.text["*"]) };
  saveItem("tournament", page, entry);
  return entry;
}

/** Coaches and other staff have the same kind of page as players. */
export const isPlayerPage = (wikitext) => /\{\{\s*Infobox[ _](player|person|personality|talent|coach)\b/i.test(wikitext || "");

/**
 * Nicknames are not unique ("Cloud", "Nami"): a page is this player's only when one of its countries is the player's, or it names
 * the player's team. p: { cc, team }.
 */
export function playerPageMatches(wikitext, p) {
  const source = String(wikitext || "");
  const land = (cc) => String(cc || "").slice(0, 2); // gb-sct and gb are the same player
  const countries = [...source.matchAll(/\|\s*country\d*\s*=\s*([^\n|}]+)/gi)].map((m) => land(countryCode(m[1].trim()))).filter(Boolean);
  if (p.cc && countries.includes(land(p.cc))) return true;
  const team = norm(p.team);
  if (!team) return false;
  const name = String(p.team).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${name}($|[^a-z0-9])`, "i").test(source);
}

async function findPlayerPage(p) {
  // with neither a country nor a team to check, only a page under exactly this name will do
  const isTheirs = (source, title) => isPlayerPage(source) && (p.cc || p.team ? playerPageMatches(source, p) : baseTitle(title) === title);
  const direct = await pageSource(p.name);
  if (isTheirs(direct.text, direct.title)) return direct.title;
  const s = await get({ action: "opensearch", search: p.name, limit: "10", namespace: "0" });
  await wait(QUERY_GAP);
  for (const title of (s[1] || []).filter((t) => t !== direct.title && norm(baseTitle(t)) === norm(p.name))) {
    const found = await pageSource(title);
    if (isTheirs(found.text, found.title)) return found.title;
  }
  return "";
}

/** Looks a player up and saves it. p: { name, cc, team }. entry.page is "" when no page is this player's. Throws on a network error. */
export async function fetchPlayer(p) {
  const page = await findPlayerPage(p);
  const base = { name: p.name, page, fetched: new Date().toISOString() };
  if (!page) {
    savePlayerEntry(teamSlug(p.name), base);
    return base;
  }
  const j = await get({ action: "parse", page, prop: "text" });
  if (j.error) throw new Error(j.error.info);
  const entry = { ...base, url: `https://liquipedia.net/valorant/${encodeURIComponent(page.replace(/ /g, "_"))}`, ...parsePlayerPage(j.parse.text["*"]) };
  savePlayerEntry(teamSlug(p.name), entry);
  return entry;
}

/** Whether a player's saved information should be read again: never read, read two weeks ago, or no page found a week ago. */
export function playerDue(entry, now = Date.now()) {
  if (!entry) return true;
  return now - new Date(entry.fetched).getTime() >= (entry.page ? PLAYER_FRESH : WEEK);
}

/** The next player to read: one never read, else one whose information is old. failed: { key: time of a network error }. */
export function nextPlayer(players, info, failed = {}, now = Date.now()) {
  const ready = players.filter((p) => { const k = teamSlug(p.name); return k && !(failed[k] && now - failed[k] < ERROR_RETRY); });
  return ready.find((p) => !info[teamSlug(p.name)]) || ready.find((p) => playerDue(info[teamSlug(p.name)], now));
}


/**
 * A page was opened and has nothing saved, or old information: asks the server to read it soon, before anything else.
 * r: { kind: "team", name } | { kind: "person", name, cc, team } | { kind: "tournament", page }. Asked once, however many visitors.
 */
export function requestFetch(r, _now = Date.now(), first = false) {
  askToRead(`lp:${r.kind}:${r.page || teamSlug(r.name)}`, r, first);
}

/** Whether a page opened on the site should be read again: a team or person after two weeks, or a week when no page was found. */
export function requestDue(entry, now = Date.now()) {
  return playerDue(entry, now);
}

const UPDATE_AFTER = 3600000;
/** Opened from the search bar: read again, first of all, unless that was done in the last hour. */
export const updateDue = (entry, now = Date.now()) => !entry || now - new Date(entry.fetched).getTime() >= UPDATE_AFTER;

async function fetchRequest(r) {
  if (r.kind === "tournament") {
    const e = await fetchTournament(r.page);
    console.log(`[lp-info] ${r.page}: ${e.page ? "saved" : "no page"}`);
  } else if (r.kind === "team") {
    const e = await fetchTeam(r.name);
    console.log(`[lp-info] team ${r.name}: ${e.page ? "saved" : "no page"}`);
  } else {
    const e = await fetchPlayer(r);
    console.log(`[lp-info] ${r.name}: ${e.page ? "saved" : "no matching page"}`);
  }
}

/**
 * One round, every 30 s: first what a visitor just opened, then the first team of the site that has no information yet, whichever way it
 * was added, else the one read longest ago if over a week; with no team to read, one person. failed: { teams, people }, kept by the caller.
 */
export async function lpTick(getNames, getPlayers, failed) {
  const asked = takeRequest("lp:");
  if (asked) {
    try {
      await fetchRequest(asked);
    } catch (err) {
      console.log(`[lp-info] ${asked.id}: ${err.message}`);
    }
    return;
  }
  let name;
  let player;
  try {
    const names = getNames();
    const info = readTeamInfo();
    // new teams first, then the oldest information: every team is read again each week by itself
    const ready = names.filter((n) => !failed.teams[teamSlug(n)] || Date.now() - failed.teams[teamSlug(n)] >= ERROR_RETRY);
    name = nextMissing(names, info, failed.teams) || nextOutdated(ready, info) || nextStale(ready, info);
    if (name) {
      const e = await fetchTeam(name);
      console.log(`[team-info] ${name}: ${e.page ? "saved" : "no Liquipedia team page"}`);
    } else {
      player = nextPlayer(getPlayers(), readPlayerInfo(), failed.people);
      if (player) {
        const e = await fetchPlayer(player);
        console.log(`[player-info] ${player.name}: ${e.page ? "saved" : "no matching Liquipedia page"}`);
      }
    }
  } catch (err) {
    if (name) failed.teams[teamSlug(name)] = Date.now();
    if (player) failed.people[teamSlug(player.name)] = Date.now();
    console.log(`[${player ? "player" : "team"}-info] ${name || (player && player.name) || "?"}: ${err.message}`);
  }
}
