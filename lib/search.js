// The site's search bar: tournaments, teams and players. Pure: works from getState(), the saved Liquipedia information and the
// lists of all Valorant people and teams. Every result leads to a page of this site.
import { tournamentKey } from "./directory.js";
import { EVENT_NAMES, siteHref, teamHref, teamSlug } from "./paths.js";
import { parseRoster, parseStaff } from "./tournament.js";
import { siteTeams } from "./teams.js";
import { playerHref } from "./playerstats.js";
import { allMatches } from "./matchlist.js";
import ASSETS from "./valorant-assets.json" with { type: "json" };

export const MIN_QUERY = 2;
const PER_GROUP = 6;

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Other words a visitor may look an event up with
const EVENT_WORDS = {
  q1: "europe eu", q2: "europe eu", playoffs: "europe eu playoff",
  trq1: "turquie turkey tr", trq2: "turquie turkey tr", tr: "turquie turkey tr playoff",
  meq1: "moyen orient middle east mena", meq2: "moyen orient middle east mena", naq1: "afrique du nord north africa mena", naq2: "afrique du nord north africa mena",
  mena: "afrique moyen orient playoff", kickoff: "vct 2027 berlin", gc: "gc vct game changers femmes women",
};

/** Every searchable thing: { type, name, words (other names), sub, href, onSite, logo, logoDark, crest, cc }. */
export function searchIndex(initial, info = {}, lists = {}) {
  const items = [];
  // tournaments: the site's events, then those of the teams' achievements
  for (const [event, name] of Object.entries(EVENT_NAMES)) items.push({ type: "event", name, words: EVENT_WORDS[event] || "", href: siteHref(event), onSite: true });
  const seenT = new Set(Object.values(EVENT_NAMES).map(norm));
  for (const e of Object.values(info)) {
    for (const r of e.results || []) {
      if (!r.tournament || !tournamentKey(r.tournamentUrl) || seenT.has(norm(r.tournament))) continue;
      seenT.add(norm(r.tournament));
      items.push({ type: "event", name: r.tournament, href: `/tournament/${r.tournamentUrl.replace("https://liquipedia.net/valorant/", "")}`, logo: r.tournamentLogo, logoDark: r.tournamentLogoDark });
    }
  }
  // teams and players of the site
  const seenTeams = new Set();
  const seenPlayers = new Set();
  const addPlayer = (id, realName, cc, teamName) => {
    const k = norm(id);
    if (!k || k === "tbd" || seenPlayers.has(k)) return;
    seenPlayers.add(k);
    items.push({ type: "player", name: id, words: realName || "", sub: teamName, href: playerHref(id), onSite: true, cc });
  };
  for (const t of siteTeams(initial)) {
    const key = teamSlug(t.name);
    const lp = info[key];
    seenTeams.add(norm(t.name));
    if (lp && lp.page) seenTeams.add(norm(lp.page));
    items.push({ type: "team", name: t.name, words: `${t.tag || ""} ${lp && lp.page ? lp.page : ""}`, sub: t.tag || "", href: teamHref(t.name), onSite: true, crest: { name: t.name, tag: t.tag, logo: t.logo } });
    for (const p of parseRoster(t.roster)) addPlayer(p.name, "", p.cc, t.name);
    for (const p of (lp && lp.roster) || []) addPlayer(p.id, p.name, p.cc, t.name);
    for (const p of parseStaff(t.staff)) addPlayer(p.name, "", p.cc, t.name);
    for (const p of (lp && lp.staff) || []) addPlayer(p.id, p.name, p.cc, t.name);
  }
  // every other Valorant team and player
  for (const [name, tag, logo] of lists.teams || []) {
    if (seenTeams.has(norm(name))) continue;
    items.push({ type: "team", name, words: tag || "", sub: tag || "", href: teamHref(name), logo });
  }
  for (const [id, cc] of [...((lists.players && lists.players.players) || []), ...((lists.players && lists.players.staff) || [])]) {
    if (seenPlayers.has(norm(id))) continue;
    seenPlayers.add(norm(id));
    items.push({ type: "player", name: id, href: playerHref(id), cc });
  }
  // the site's matches, by their two teams
  for (const m of allMatches(initial)) {
    if (!m.a || !m.b || !m.a.name || !m.b.name) continue;
    items.push({ type: "match", name: `${m.a.name} vs ${m.b.name}`, words: `${m.a.tag || ""} ${m.b.tag || ""}`, sub: EVENT_NAMES[m.event] || "", href: `/match/${m.event}/${m.id}`, onSite: true, crest: { name: m.a.name, tag: m.a.tag, logo: m.a.logo }, at: m.at || "" });
  }
  for (const map of MAPS) items.push({ type: "map", name: map, words: "map carte", href: `/map/${map.toLowerCase()}`, onSite: true, pic: (ASSETS.maps[map] || {}).list || "" });
  for (const [key, a] of Object.entries(ASSETS.agents)) items.push({ type: "agent", name: a.name, words: `agent ${a.role || ""}`, sub: a.role || "", href: `/agent/${key}`, onSite: true, pic: a.icon || "" });
  return items;
}

const MAPS = Object.entries(ASSETS.maps).filter(([, v]) => v.icon).map(([k]) => k).sort();

/** 0 same text, 1 starts with it, 2 a word starts with it, 3 somewhere in it; -1 no match. */
function rank(text, q) {
  const t = norm(text);
  if (!t) return -1;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(" " + q)) return 2;
  if (t.includes(q)) return 3;
  // several words: each starts a word of the text ("barca monarchy")
  const words = q.split(" ").filter(Boolean);
  if (words.length > 1) {
    const mine = t.split(/[\s.\-]+/);
    if (words.every((w) => mine.some((x) => x.startsWith(w)))) return 3;
  }
  return -1;
}

/** The best matches of each kind: { events, teams, players }. What plays on this site comes first among equals. */
export function searchAll(items, query) {
  const q = norm(query);
  const out = { events: [], teams: [], players: [], matches: [], maps: [], agents: [] };
  if (q.length < MIN_QUERY) return out;
  const scored = [];
  for (const it of items) {
    const byName = rank(it.name, q);
    const byWords = it.type === "match" ? rank(`${it.name} ${it.words}`, q) : rank(it.words, q);
    const best = byName < 0 ? byWords : byWords < 0 ? byName : Math.min(byName, byWords);
    if (best >= 0) scored.push({ it, best });
  }
  scored.sort((a, b) => a.best - b.best || (b.it.onSite ? 1 : 0) - (a.it.onSite ? 1 : 0) || (b.it.at || "").localeCompare(a.it.at || "") || a.it.name.length - b.it.name.length || a.it.name.localeCompare(b.it.name));
  const group = { event: out.events, team: out.teams, player: out.players, match: out.matches, map: out.maps, agent: out.agents };
  for (const { it } of scored) {
    const g = group[it.type];
    if (g.length < PER_GROUP) {
      const { words, at, ...shown } = it; // eslint-disable-line no-unused-vars
      g.push(shown);
    }
  }
  return out;
}
