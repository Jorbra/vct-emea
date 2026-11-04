// Keeps the database filled with what the player and team pages show from vlr.gg. Only pages robots.txt allows, reached from the
// addresses Liquipedia gives; one page every 30 s. vlr.gg's terms forbid automated collection: when it refuses, everything stops for a day,
// and nothing tries to get around it.
import { askToRead, readItems, saveItem, takeRequest } from "./lpstore.js";
import { teamSlug } from "./paths.js";
import { parseVlrPlayer, parseVlrTeam, vlrId } from "./vlrinfo.js";

const BASE = "https://www.vlr.gg";
const UA = "vct-kickoff-site/1.0 (personal tournament site)";
const FRESH = 14 * 864e5;
const BLOCK = 864e5;
const ERROR_RETRY = 10 * 60000;

export function readVlrInfo() {
  const meta = readItems("meta");
  return { players: readItems("vlr_player"), teams: readItems("vlr_team"), blockedUntil: (meta.vlr && meta.vlr.blockedUntil) || "" };
}

export const vlrDue = (entry, now = Date.now()) => !entry || now - new Date(entry.fetched).getTime() >= FRESH;

/** The vlr.gg number of a team: the one on its Liquipedia page, else the one of the current team of a player, else what a search found. */
export function teamVlrId(slug, teamInfo, vlr, found = {}) {
  const own = vlrId(teamInfo[slug] && teamInfo[slug].links, "team");
  if (own) return own;
  const mate = Object.values(vlr.players || {}).find((p) => p.team && teamSlug(p.team.name) === slug);
  if (mate) return mate.team.id;
  return (found.teams && found.teams[slug] && found.teams[slug].vlrId) || "";
}

/** The next page to read for the site's people, then its teams: { kind, key, id }, or undefined when all are recent. */
export function nextVlr(people, teams, playerInfo, teamInfo, vlr, failed = {}, now = Date.now()) {
  const ready = (t) => !(failed[`${t.kind}:${t.key}`] && now - failed[`${t.kind}:${t.key}`] < ERROR_RETRY);
  for (const name of people) {
    const key = teamSlug(name);
    const id = vlrId(playerInfo[key] && playerInfo[key].links, "player");
    const t = { kind: "player", key, id };
    if (id && vlrDue(vlr.players[key], now) && ready(t)) return t;
  }
  for (const name of teams) {
    const key = teamSlug(name);
    const id = teamVlrId(key, teamInfo, vlr);
    const t = { kind: "team", key, id };
    if (id && vlrDue(vlr.teams[key], now) && ready(t)) return t;
  }
  return undefined;
}

/** A page was opened and has no recent vlr.gg information: read it soon; `first`, before anything else. r: { kind, key, id }. */
export function requestVlr(r, first = false) {
  askToRead(`vlr:${r.kind}:${r.key}`, r, first);
}

class Refused extends Error {}

/** vlr.gg refused the site: nothing more is asked of it for a day. */
export function refuseVlr(status) {
  saveItem("meta", "vlr", { blockedUntil: new Date(Date.now() + BLOCK).toISOString() });
  console.log(`[vlr] vlr.gg answered ${status}: stopped for a day`);
}

export const vlrBlocked = (vlr, now = Date.now()) => !!(vlr && vlr.blockedUntil && now < new Date(vlr.blockedUntil).getTime());

/** Reads one page and saves it. Throws Refused when vlr.gg refuses the site. */
export async function fetchVlr(t, now = Date.now()) {
  const url = t.kind === "player" ? `${BASE}/player/${t.id}/?timespan=all` : `${BASE}/team/${t.id}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if ([401, 403, 429, 503].includes(res.status)) throw new Refused(String(res.status));
  const base = { id: t.id, url: `${BASE}/${t.kind}/${t.id}`, fetched: new Date(now).toISOString() };
  let entry = { ...base, results: [], agents: [], totals: null, team: null };
  if (res.ok) entry = { ...entry, ...(t.kind === "player" ? parseVlrPlayer(await res.text()) : parseVlrTeam(await res.text())) };
  else if (res.status !== 404) throw new Error(`vlr.gg answered ${res.status}`);
  saveItem(t.kind === "player" ? "vlr_player" : "vlr_team", t.key, entry);
  return entry;
}

/** One round, every 30 s: one page: what a visitor just opened, then the site's people and teams. getWork: (failed) => the next page. */
export async function vlrTick(getWork, failed) {
  if (vlrBlocked(readVlrInfo())) return;
  let t;
  try {
    t = takeRequest("vlr:") || getWork(failed);
    if (t) {
      await fetchVlr(t);
      console.log(`[vlr] ${t.kind} ${t.key}: saved`);
    }
  } catch (err) {
    if (err instanceof Refused) {
      refuseVlr(err.message);
    } else {
      if (t) failed[`${t.kind}:${t.key}`] = Date.now();
      console.log(`[vlr] ${t ? t.key : "?"}: ${err.message}`);
    }
  }
}
