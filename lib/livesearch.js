// The search bar's second step: asks Liquipedia and vlr.gg about what was typed, and keeps what they find (data/search-found.json) so
// that it has a page here. Answers are remembered for an hour, and each site is asked in turn with a pause: typing does not flood them.
import { baseTitle } from "./directory.js";
import { teamSlug } from "./paths.js";
import { countryCode } from "./teaminfo.js";
import { readItems, saveItem } from "./lpstore.js";
import { isPlayerPage, isTeamPage, lpApi } from "./teamfetch.js";
import { readVlrInfo, refuseVlr } from "./vlrfetch.js";

const UA = "vct-kickoff-site/1.0 (personal tournament site)";
const CACHE_FOR = 3600000;
const CACHE_SIZE = 500;
const VLR_GAP = 10000;
const MAX_WAITING = 4; // more searches than this at once: the site's own results are enough

export const MIN_LIVE_QUERY = 3;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const isSubpage = (title) => /\/(Matches|Results|Coaching|Playing|Gear|Statistics|History|Media|Transfers|Broadcasts?)$/i.test(title);

/** What a Liquipedia page is: { type: "player" | "team" | "event", name, cc, key }; null for anything else. */
export function classifyPage(title, wikitext) {
  const source = String(wikitext || "");
  if (isTeamPage(source)) return { type: "team", name: title };
  if (isPlayerPage(source)) {
    const country = (source.match(/\|\s*country\s*=\s*([^\n|}]+)/i) || [])[1];
    return { type: "player", name: baseTitle(title), cc: countryCode((country || "").trim()) };
  }
  if (/\{\{\s*Infobox[ _]league\b/i.test(source)) {
    const name = (source.match(/\|\s*name\s*=\s*([^\n|}]+)/i) || [])[1];
    return { type: "event", name: (name || title).replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim(), key: title.replace(/ /g, "_") };
  }
  return null;
}

const VLR_KEEP = 5;

/** The best few players and teams of a vlr.gg search page, really named like what was typed: { type, id, name }. It lists many amateur teams. */
export function parseVlrSearch(html, query) {
  const q = norm(query);
  const out = [];
  for (const m of String(html || "").matchAll(/href="\/search\/r\/(player|team)\/(\d+)\/[^"]*"[\s\S]*?search-item-title">([\s\S]*?)<\/div>/g)) {
    const name = m[3].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\(\s*inactive\s*\)/i, "").replace(/\s+/g, " ").trim();
    if (name && norm(name).includes(q)) out.push({ type: m[1] === "player" ? "player" : "team", id: m[2], name });
  }
  // the same name first, then those that start with it; the page's own order otherwise
  const score = (it) => (norm(it.name) === q ? 0 : norm(it.name).startsWith(q) ? 1 : 2);
  const best = (type) => out.filter((it) => it.type === type).map((it, i) => ({ it, i })).sort((a, b) => score(a.it) - score(b.it) || a.i - b.i).slice(0, VLR_KEEP).map((x) => x.it);
  return [...best("player"), ...best("team")];
}

/** Puts what the two sites found together: { players, teams, events, found (what to keep) }. Liquipedia's come first. */
export function mergeLive(lpItems, vlrItems, query) {
  const out = { players: [], teams: [], events: [], found: { people: {}, teams: {}, tournaments: {} } };
  const q = norm(query);
  const named = (name) => norm(name).includes(q);
  for (const it of lpItems) {
    if (it.type === "event") {
      out.found.tournaments[it.key] = { name: it.name };
      out.events.push({ type: "event", name: it.name, sub: "Liquipedia", href: `/tournament/${encodeURI(it.key)}` });
      continue;
    }
    const key = teamSlug(it.name);
    if (!key || !named(it.name)) continue;
    if (it.type === "team") {
      out.found.teams[key] = { name: it.name };
      out.teams.push({ type: "team", name: it.name, sub: "Liquipedia", href: `/team/${key}` });
    } else {
      out.found.people[key] = { name: it.name, cc: it.cc || "" };
      out.players.push({ type: "player", name: it.name, cc: it.cc || "", sub: "Liquipedia", href: `/player/${key}` });
    }
  }
  for (const it of vlrItems) {
    const key = teamSlug(it.name);
    if (!key) continue;
    const kind = it.type === "player" ? "people" : "teams";
    const list = it.type === "player" ? out.players : out.teams;
    out.found[kind][key] = { name: it.name, cc: "", ...out.found[kind][key], vlrId: it.id };
    if (list.some((x) => teamSlug(x.name) === key)) continue;
    list.push({ type: it.type, name: it.name, sub: "vlr.gg", href: `/${it.type === "player" ? "player" : "team"}/${key}` });
  }
  return out;
}

/** Keeps what is new, or what now has more to say: most searches find what was already found, and write nothing. */
function keepFound(found) {
  for (const kind of ["people", "teams", "tournaments"]) {
    const old = readItems(`found_${kind}`);
    for (const [k, v] of Object.entries(found[kind])) {
      const merged = { ...old[k], ...v };
      if (JSON.stringify(merged) !== JSON.stringify(old[k])) saveItem(`found_${kind}`, k, merged);
    }
  }
}

async function askLiquipedia(q) {
  const s = await lpApi({ action: "opensearch", search: q, limit: "10", namespace: "0" });
  const titles = (s[1] || []).filter((t) => !isSubpage(t)).slice(0, 6);
  if (!titles.length) return [];
  const r = await lpApi({ action: "query", titles: titles.join("|"), redirects: "1", prop: "revisions", rvprop: "content", rvslots: "main" });
  return Object.values((r.query && r.query.pages) || {})
    .map((p) => classifyPage(p.title, p.revisions && p.revisions[0] && p.revisions[0].slots.main["*"]))
    .filter(Boolean);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => (globalThis.__liveSearch ||= { cache: new Map(), vlrTurn: Promise.resolve(), waitingLp: 0, waitingVlr: 0 });

async function askVlr(q) {
  const s = state();
  const blocked = readVlrInfo().blockedUntil;
  if (blocked && Date.now() < new Date(blocked).getTime()) return [];
  const turn = s.vlrTurn;
  s.vlrTurn = turn.then(() => wait(VLR_GAP));
  await turn;
  const res = await fetch(`https://www.vlr.gg/search/?q=${encodeURIComponent(q)}&type=all`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
  if ([401, 403, 429, 503].includes(res.status)) {
    refuseVlr(res.status);
    return [];
  }
  if (!res.ok) throw new Error(`vlr.gg answered ${res.status}`);
  return parseVlrSearch(await res.text(), q);
}

/** A source's answer; [] and `complete: false` when it is busy or fails, so that the search can be asked again later. */
async function ask(counter, fn) {
  const s = state();
  if (s[counter] >= MAX_WAITING) return { items: [], complete: false };
  s[counter] += 1;
  try {
    return { items: await fn(), complete: true };
  } catch (err) {
    console.log(`[search] ${err.message}`);
    return { items: [], complete: false };
  } finally {
    s[counter] -= 1;
  }
}

/** The search: { players, teams, events }, each with its address here. */
export async function liveSearch(query, now = Date.now()) {
  const q = norm(query);
  const s = state();
  const hit = s.cache.get(q);
  if (hit && now - hit.at < CACHE_FOR) return hit.result;
  const [lp, vlr] = await Promise.all([ask("waitingLp", () => askLiquipedia(q)), ask("waitingVlr", () => askVlr(q))]);
  const { found, ...result } = mergeLive(lp.items, vlr.items, q);
  if (lp.items.length || vlr.items.length) keepFound(found);
  if (lp.complete && vlr.complete) {
    if (s.cache.size >= CACHE_SIZE) s.cache.delete(s.cache.keys().next().value);
    s.cache.set(q, { at: now, result });
  }
  return result;
}
