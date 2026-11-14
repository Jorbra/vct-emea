// Round 14, for the editors: where vlr.gg's tables stand, today's games, the week's meta as a news draft, the pictures missing.
import ASSETS from "./valorant-assets.json" with { type: "json" };
import { allMatches } from "./matchlist.js";
import { readItems, saveItem } from "./lpstore.js";
import { PARSE_VER, VLR_EVENTS, vlrSources } from "./vlrmatch.js";
import { agentTiers } from "./round13.js";
import { extraStats, readDetails, tournamentStats } from "./tstats.js";
import { EVENT_NAMES } from "./paths.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const forfeit = (m) => !!(m.note && m.note.kind === "ff");

/**
 * vlr.gg's tables, event by event: { events: [{ event, done, withStats, old }], missing: [{ event, id, a, b, at }] }.
 * old: tables read before the reader learnt the veto (read again by themselves, a few each round). Pure apart from the store given.
 */
export function vlrReport(state, seen, followed = VLR_EVENTS) {
  const vlrEvents = new Set(followed.map((v) => v.event));
  const out = {};
  const missing = [];
  for (const m of allMatches(state)) {
    if (!vlrEvents.has(m.event) || m.sa == null || forfeit(m) || !m.a || !m.b) continue;
    const e = (out[m.event] ||= { event: m.event, done: 0, withStats: 0, old: 0 });
    e.done += 1;
    const has = !!(((state.extra || {})[m.event] || {})[m.id] || {}).hasDetails;
    const s = seen[`${m.event}:${m.id}`];
    if (has) { e.withStats += 1; if (s && (s.v || 1) < PARSE_VER) e.old += 1; } else missing.push({ event: m.event, id: m.id, a: m.a.name || "", b: m.b.name || "", at: m.at || "" });
  }
  return { events: Object.values(out).filter((e) => e.done), missing: missing.sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 12) };
}

/** Asks for a match's vlr.gg page to be read again at the next round (its table kept until then). */
export function rereadVlr(db, event, id) {
  if (!vlrSources(db).events.some((v) => v.event === event) || !/^[a-z0-9-]{1,40}$/.test(String(id))) return { ok: false, status: 400, error: "Unknown match." };
  const key = `${event}:${id}`;
  const s = readItems("vlr_match", db)[key];
  if (s) saveItem("vlr_match", key, { ...s, v: 0, full: false }, db);
  return { ok: true, queued: !!s };
}

/** Today's daily games: { game: { played, won } }. */
export function gamesToday(db, day) {
  const rows = db.prepare("SELECT game, COUNT(*) AS n, SUM(won) AS w FROM daily_play WHERE day = ? AND done = 1 GROUP BY game").all(day);
  return Object.fromEntries(rows.map((r) => [r.game, { played: r.n, won: r.w || 0 }]));
}

/** The week's meta as a news draft: the agents most taken, the map most played and its tier list's top. */
export function metaDraft(state, entries) {
  const ex = extraStats(state, entries);
  const maps = tournamentStats(state, entries).maps;
  if (!ex.agents.length || !maps.length) return "";
  const total = ex.agents.reduce((s, a) => s + a.picks, 0) / 5 || 1;
  const top = ex.agents.slice(0, 5).map((a) => `${a.name} (${Math.round((a.picks / total) * 100)} %)`).join(", ");
  const best = ex.agents.filter((a) => a.picks >= 10).sort((x, y) => y.pct - x.pct)[0];
  const map = maps[0];
  const tiers = agentTiers(entries, map.map);
  const s = tiers.find((t) => t.tier === "S");
  return [
    "Méta de la semaine",
    `Les agents les plus joués : ${top}.`,
    best ? `Celui qui gagne le plus : ${best.name}, ${best.pct} % de cartes gagnées.` : "",
    `La carte la plus jouée : ${map.map} (${map.played} cartes, ${map.attack != null ? `l'attaque gagne ${map.attack} % des manches` : "attaque et défense pas encore connues"}).`,
    s && s.agents.length ? `Sur ${map.map}, le tier S : ${s.agents.map((a) => a.name.charAt(0).toUpperCase() + a.name.slice(1)).join(", ")}.` : "",
    "Tout le détail sur les pages Agents et Cartes du site.",
  ].filter(Boolean).join("\n");
}

/** The agents and maps seen in vlr.gg's tables that have no picture yet (a new agent, a new map). */
export function missingPictures(entries) {
  const agents = new Set();
  const maps = new Set();
  for (const { details } of entries) {
    for (const mp of (details && details.maps) || []) {
      if (mp.map && !/^(tbd|n\/a|-)$/i.test(mp.map.trim()) && !Object.keys(ASSETS.maps).some((k) => norm(k) === norm(mp.map))) maps.add(mp.map);
      for (const r of mp.rows || []) for (const a of r.agents || []) if (!ASSETS.agents[norm(a)]) agents.add(a);
    }
  }
  return { agents: [...agents].sort(), maps: [...maps].sort() };
}

/** Everything round 14 adds to the editor's home page. */
export function editorR14(db, state, day) {
  const entries = readDetails(db, "");
  return { vlr: vlrReport(state, readItems("vlr_match", db), vlrSources(db).events), games: gamesToday(db, day), meta: metaDraft(state, entries), missing: missingPictures(entries), names: EVENT_NAMES };
}
