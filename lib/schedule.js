// Match dates and times: which match ids exist per event, and how a time is written. Pure rules, no I/O.
import { localeOf } from "./i18n.js";
import { EVENTS, THIRD, matchId, roundsFor, slotsOf } from "./bracket.js";
import { isKickId } from "./kickoff.js";
import { REGIONS, isRegId } from "./regional.js";

export const TIME_EVENTS = ["q1", "q2", "playoffs", "trq1", "trq2", "tr", "meq1", "meq2", "naq1", "naq2", "mena", "kickoff", "gc"];

const idsOf = (size) => new Set([...roundsFor(size), THIRD].flatMap((r) => Array.from({ length: r.count }, (_, i) => matchId(r.key, i))));
const QUAL_IDS = { 64: idsOf(64), 256: idsOf(256) };
const EU_ID = /^(s[1-5]-m(0[1-9]|1[0-6])|e[AB]-(s1|s2|f))$/;

/** True when `id` is a match of `event` (also before its teams are known). */
export function isMatchOf(event, id) {
  if (typeof id !== "string") return false;
  if (event === "playoffs") return EU_ID.test(id);
  if (EVENTS.includes(event)) return QUAL_IDS[slotsOf(event)].has(id);
  if (event === "kickoff") return isKickId(id);
  if (REGIONS.includes(event)) return isRegId(id, event);
  return false;
}

/** A match time is an instant, stored in UTC ("2026-11-25T17:00:00.000Z"); "" clears it. Returns the cleaned value or null. */
export function cleanTime(at) {
  const s = String(at ?? "").trim();
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const t = new Date(s);
  if (Number.isNaN(t.getTime()) || t.getUTCFullYear() < 2020 || t.getUTCFullYear() > 2100) return null;
  return t.toISOString();
}

/** "25 nov. · 18:00" in the viewer's own time zone. */
export function formatMatchTime(iso, lang = "fr", withWeekday = false) {
  if (!iso) return "";
  const t = new Date(iso);
  const loc = localeOf(lang);
  const day = new Intl.DateTimeFormat(loc, { weekday: withWeekday ? "short" : undefined, day: "numeric", month: "short" }).format(t);
  const hour = new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(t);
  return `${day} · ${hour}`;
}

/** The Valorant maps offered in the editor (any other name can still be typed). */
export const MAP_POOL = ["Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"];
export const MAX_MAPS = 5;
const PICKS = ["a", "b", "d", ""]; // picked by team 1, team 2, decider, unknown

/** A stream / VOD link: https only. Returns the cleaned link, "" for none, or null when it is not a link. */
export function cleanLink(x) {
  const s = String(x ?? "").trim();
  if (!s) return "";
  if (s.length > 300 || !/^https:\/\/[^\s<>"']+$/i.test(s)) return null;
  return s;
}

/**
 * Checks a match's details: stream and VOD links and its maps ([{ map, a, b, pick }], up to 5, scores 0-99 or empty).
 * Returns { extra } or { error }.
 */
export function checkExtra(raw) {
  const stream = cleanLink(raw.stream);
  const vod = cleanLink(raw.vod);
  const highlights = cleanLink(raw.highlights);
  if (stream === null || vod === null || highlights === null) return { error: "Links start with https://." };
  const list = Array.isArray(raw.maps) ? raw.maps : [];
  if (list.length > MAX_MAPS) return { error: "A match has at most 5 maps." };
  const maps = [];
  for (const m of list) {
    const map = String((m && m.map) ?? "").trim();
    const sc = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const a = sc(m && m.a);
    const b = sc(m && m.b);
    const pick = String((m && m.pick) ?? "");
    if (map.length > 20) return { error: "A map name is limited to 20 characters." };
    if (![a, b].every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 99))) return { error: "A map score is a number from 0 to 99." };
    if (!PICKS.includes(pick)) return { error: "Unknown map pick." };
    if (!map && a === null && b === null) continue; // empty row
    maps.push({ map, a, b, pick });
  }
  const mvp = String(raw.mvp ?? "").trim();
  if (mvp.length > 30) return { error: "A player's name is limited to 30 characters." };
  const rows = Array.isArray(raw.pstats) ? raw.pstats : [];
  if (rows.length > 16) return { error: "A match has at most 16 players." };
  const pstats = [];
  for (const p of rows) {
    const name = String((p && p.name) ?? "").trim();
    const nums = ["k", "d", "a", "acs"].map((k) => (p && p[k] !== "" && p[k] != null ? Number(p[k]) : null));
    if (name.length > 30) return { error: "A player's name is limited to 30 characters." };
    if (nums.every((n) => n === null)) continue; // not filled in
    if (!name || !nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 999)) return { error: "A player's line needs K, D, A and ACS, from 0 to 999." };
    pstats.push({ name, k: nums[0], d: nums[1], a: nums[2], acs: nums[3] });
  }
  return { extra: { stream, vod, highlights, mvp, pstats, maps } };
}

/**
 * The times of a whole round: from a start, `together` matches at a time, then `gap` minutes later the next ones.
 * Returns [{ id, at }] (ISO), or null when the start or the numbers make no sense.
 */
export function planRound(ids, start, gap = 120, together = 1) {
  const t = new Date(start).getTime();
  const g = Number(gap);
  const n = Number(together);
  if (!Number.isFinite(t) || !Number.isInteger(g) || g < 0 || g > 1440 || !Number.isInteger(n) || n < 1 || n > 32) return null;
  return ids.map((id, i) => ({ id, at: new Date(t + Math.floor(i / n) * g * 60000).toISOString() }));
}
