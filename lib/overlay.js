// What the stream overlays show, small enough to be read every few seconds: the chosen match (or the live one, or the next),
// its maps, the matches coming up, the latest results and the other live matches. Pure: works from getState().
import { allMatches } from "./matchlist.js";
import { EVENT_NAMES } from "./paths.js";
import { tension } from "./livemore.js";

const team = (t) => (t && t.name ? { name: t.name, tag: t.tag || "", logo: t.logo || "" } : null);
const ready = (m) => m.a && m.b && m.a.name && m.b.name;

/** One match as an overlay shows it. */
function shown(state, m, details = null) {
  const live = !!m.live && m.sa == null;
  const s = ((state.live || {})[m.event] || {})[m.id] || {};
  const ex = ((state.extra || {})[m.event] || {})[m.id] || {};
  // a finished match's maps: the editor's, else vlr.gg's table (read for the match shown only)
  const done = !live && !(ex.maps || []).some((x) => x && x.a != null) && details ? (details(m.event, m.id) || {}).maps || [] : null;
  const maps = (live ? s.maps || [] : done || ex.maps || []).filter((x) => x && (x.map || x.a != null)).map((x) => ({ map: x.map || "", a: x.a ?? null, b: x.b ?? null, done: live ? !!x.done : x.a != null }));
  return {
    event: m.event, id: m.id, eventName: EVENT_NAMES[m.event] || m.event, round: m.round, bo: m.bo || 0, at: m.at || "",
    a: team(m.a), b: team(m.b), live, done: m.sa != null, win: m.win || "",
    sa: live ? s.a ?? 0 : m.sa, sb: live ? s.b ?? 0 : m.sb, maps, stream: ex.stream || "", mvp: ex.mvp || "",
    rounds: live ? s.rounds || [] : [], tension: live ? tension(s, m.bo) : null,
  };
}

/**
 * { match, upcoming, results, live } for the overlays. match: the one asked for ("q2:r16-1"), else the event's live one,
 * else its next one, else its latest result. event: one event's matches only (all of them when empty).
 */
export function overlayData(state, { event = "", match = "", now = Date.now(), details = null } = {}) {
  const all = allMatches(state).filter((m) => ready(m) && (!event || m.event === event));
  const [mev, mid] = String(match).split(":");
  const time = (m) => (m.at ? new Date(m.at).getTime() : 0);
  const live = all.filter((m) => m.live && m.sa == null);
  const upcoming = all.filter((m) => m.sa == null && !m.live && m.at && time(m) > now - 2 * 3600000).sort((x, y) => time(x) - time(y));
  const results = all.filter((m) => m.sa != null).sort((x, y) => time(y) - time(x) || String(y.id).localeCompare(String(x.id)));
  const pick = (mev && allMatches(state).find((m) => m.event === mev && m.id === mid)) || live[0] || upcoming[0] || results[0] || null;
  return {
    now,
    match: pick ? shown(state, pick, details) : null,
    upcoming: upcoming.slice(0, 8).map((m) => shown(state, m)),
    // the latest result with its maps too: the result card shows it when the match shown is not over
    results: results.slice(0, 10).map((m, i) => shown(state, m, i === 0 ? details : null)),
    live: live.slice(0, 8).map((m) => shown(state, m)),
  };
}

/** The overlays' settings from a page's address, kept to known values. */
export function overlayParams(q = {}) {
  const one = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const types = ["scoreboard", "next", "ticker", "standby", "result", "maps"];
  const type = types.includes(one(q.type)) ? one(q.type) : "scoreboard";
  const event = /^[a-z0-9]{1,12}$/.test(one(q.event)) ? one(q.event) : "";
  const match = /^[a-z0-9]{1,12}:[a-z0-9-]{1,40}$/.test(one(q.match)) ? one(q.match) : "";
  const accent = /^[0-9a-f]{6}$/i.test(one(q.accent)) ? `#${one(q.accent)}` : "";
  const theme = ["dark", "light", "glass"].includes(one(q.theme)) ? one(q.theme) : "dark";
  const pos = ["top", "bottom"].includes(one(q.pos)) ? one(q.pos) : "top";
  const scale = Math.min(2, Math.max(0.5, Number(one(q.scale)) || 1));
  const title = one(q.title).slice(0, 60);
  const until = /^\d{1,2}:\d{2}$/.test(one(q.until)) ? one(q.until) : "";
  return { type, event, match, accent, theme, pos, scale, title, until };
}
