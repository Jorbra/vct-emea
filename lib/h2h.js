// Two teams across every season: their meetings in the current one and in the archives (lib/seasons.js), their recent form,
// their maps and key players, for the team comparison and the match page. Pure but for archivedPlayed(), which reads the archives.
import { allMatches } from "./matchlist.js";
import { teamSlug } from "./paths.js";

const slugOf = (t) => teamSlug(t && t.name);
const played = (m) => m.sa != null && m.sb != null && m.a && m.b && m.a.name && m.b.name;
const slim = (t) => ({ name: t.name, logo: t.logo || "", tag: t.tag || "" });

/** The played matches of a state, small: [{ event, id, at, a, b, sa, sb, win, note }]. A state of an older shape gives what it can. */
export function playedOf(state) {
  let list = [];
  try { list = allMatches(state); } catch { return []; }
  return list.filter(played).map((m) => ({ event: m.event, id: m.id, at: m.at || "", round: m.round || [], a: slim(m.a), b: slim(m.b), sa: m.sa, sb: m.sb, win: m.win, note: m.note || null }));
}

/** Every archived season's played matches, the newest season first: [{ slug, name, matches }]. Reads every archive once. */
export function archivedPlayed(db) {
  let rows = [];
  try { rows = db.prepare("SELECT slug, name, state FROM seasons ORDER BY created DESC").all(); } catch { return []; }
  return rows.map((r) => {
    let state = null;
    try { state = JSON.parse(r.state); } catch { /* a broken archive shows nothing */ }
    return { slug: r.slug, name: r.name, matches: state ? playedOf(state) : [] };
  });
}

/** A's and B's meetings in a list of played matches, seen from A: [{ event, id, at, round, sa, sb, won: "a" | "b", note }], latest first. */
export function meetingsOf(matches, a, b, exceptId = "") {
  const A = typeof a === "string" ? a : slugOf(a);
  const B = typeof b === "string" ? b : slugOf(b);
  if (!A || !B || A === B) return [];
  return matches.filter((m) => m.id !== exceptId && [slugOf(m.a), slugOf(m.b)].sort().join() === [A, B].sort().join()).map((m) => {
    const flip = slugOf(m.a) !== A;
    return { event: m.event, id: m.id, at: m.at, round: m.round || [], sa: flip ? m.sb : m.sa, sb: flip ? m.sa : m.sb, won: (m.win === "a") !== flip ? "a" : "b", note: m.note || null };
  }).sort((x, y) => (y.at || "").localeCompare(x.at || ""));
}

/**
 * Their meetings over every season: { a, b (match wins), mapsA, mapsB, seasons: [{ slug, name, a, b, list }] } with the current
 * season first (slug ""), then the archives with a meeting. `exceptId` leaves out the current season's match being looked at.
 */
export function headToHeadAll(current, archives, a, b, { exceptId = "", currentName = "" } = {}) {
  const seasons = [{ slug: "", name: currentName, matches: current, except: exceptId }, ...archives.map((s) => ({ ...s, except: "" }))]
    .map((s) => {
      const list = meetingsOf(s.matches, a, b, s.except);
      return { slug: s.slug, name: s.name, list, a: list.filter((m) => m.won === "a").length, b: list.filter((m) => m.won === "b").length };
    })
    .filter((s) => s.list.length);
  const maps = (side) => seasons.reduce((n, s) => n + s.list.filter((m) => !m.note).reduce((k, m) => k + (side === "a" ? m.sa : m.sb), 0), 0);
  return { a: seasons.reduce((n, s) => n + s.a, 0), b: seasons.reduce((n, s) => n + s.b, 0), mapsA: maps("a"), mapsB: maps("b"), seasons };
}

/** A team's last `n` results, latest first: [{ event, id, at, opp, sa, sb, won }]. */
export function recentForm(matches, team, n = 5) {
  const T = typeof team === "string" ? team : slugOf(team);
  return matches.filter((m) => slugOf(m.a) === T || slugOf(m.b) === T)
    .sort((x, y) => (y.at || "").localeCompare(x.at || ""))
    .slice(0, n)
    .map((m) => {
      const side = slugOf(m.a) === T ? "a" : "b";
      return { event: m.event, id: m.id, at: m.at, opp: side === "a" ? m.b : m.a, sa: side === "a" ? m.sa : m.sb, sb: side === "a" ? m.sb : m.sa, won: m.win === side, note: m.note || null };
    });
}

/** Map pools from the site's own match details ({ map, played, w }) in the shape of vlr.gg's ({ map, played, won }). */
export const poolOf = (maps) => (maps || []).filter((m) => m.w + m.l > 0).map((m) => ({ map: m.map, played: m.w + m.l, won: m.w }));
