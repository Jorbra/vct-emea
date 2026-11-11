// Where each event stands, for the home page cards and the site's navigation card. Pure: works from getState().
import { localeOf } from "./i18n.js";
import { buildBracket, qualifiedOf } from "./bracket.js";
import { buildKickoff, kickPlaces } from "./kickoff.js";
import { buildRegional, regPlaces } from "./regional.js";
import { prizePool, result } from "./tournament.js";

const named = (t) => (t && t.name ? t : null);
const any = (o) => Object.keys(o || {}).length > 0;

/** Today as "YYYY-MM-DD", in the visitor's (or server's) own time zone. */
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Compares a day with a date that may be month only ("2027-01"): -1 before it, 0 inside it, 1 after it.
const cmp = (day, date) => {
  const a = day.slice(0, date.length);
  return a < date ? -1 : a > date ? 1 : 0;
};

/**
 * State from the event's dates first: before its start date it is upcoming, after its end date finished, in between live.
 * The results only decide when a date is missing (results entered = live) or when the winner is already known (finished).
 */
export function stateFor(byResults, info, today = todayStr()) {
  const start = info && info.start;
  const end = info && info.end;
  if (byResults === "done" && !(start && cmp(today, start) < 0)) return "done";
  if (start && cmp(today, start) < 0) return "upcoming";
  if (end && cmp(today, end) > 0) return "done";
  if (start) return "live"; // started, not over yet
  return byResults; // no start date: the results tell
}

/**
 * Each event: state "upcoming" | "live" | "done" (dates, then results: see stateFor), the teams it sent on ("out"),
 * and how many teams it has ("teams" of "of").
 */
export function eventStatus(initial, today = todayStr()) {
  const ev = {};
  // EU Playoffs: the two group winners
  const pool = prizePool(initial.teams, initial.matches, initial.placements);
  const byId = Object.fromEntries(initial.teams.map((t) => [t.id, t]));
  const winners = pool.winners.map((id) => named(byId[id])).filter(Boolean);
  ev.playoffs = {
    state: winners.length === 2 ? "done" : initial.matches.some((m) => result(m)) ? "live" : "upcoming",
    out: winners, teams: initial.teams.filter((t) => t.name).length, of: 16,
  };
  // Open qualifiers: the first 4 (EU) or 2 (Türkiye) go on
  for (const [k, n] of [["q1", 4], ["q2", 4], ["trq1", 2], ["trq2", 2], ["meq1", 1], ["meq2", 1], ["naq1", 1], ["naq2", 1]]) {
    const q = initial.qualifiers[k];
    const top = qualifiedOf(buildBracket(q.slots, q.scores, q.bo), n).map((s) => named(s && q.slots[s - 1]));
    ev[k] = { state: top.every(Boolean) ? "done" : any(q.scores) ? "live" : "upcoming", out: top.filter(Boolean), teams: q.slots.filter(Boolean).length, of: q.slots.length };
  }
  // Regional Qualifier Playoffs (the winner goes to the Kickoff) and Game Changers (its champion)
  for (const k of ["tr", "mena", "gc"]) {
    const r = initial.regional[k];
    const first = regPlaces(buildRegional(r.manual, r.scores, k))[0];
    const w = named(first && r.teams[first - 1]);
    ev[k] = { state: w ? "done" : any(r.scores) ? "live" : "upcoming", out: w ? [w] : [], teams: r.teams.filter((t) => t.name).length, of: r.teams.length };
  }
  // Kickoff: the three bracket winners go to Masters
  const k = initial.kickoff;
  const top = kickPlaces(buildKickoff(k.manual, k.scores)).slice(0, 3).map((n) => named(n && k.teams[n - 1]));
  ev.kickoff = { state: top.every(Boolean) ? "done" : any(k.scores) ? "live" : "upcoming", out: top.filter(Boolean), teams: k.teams.filter((t) => t.name).length, of: 12 };
  for (const [k, e] of Object.entries(ev)) e.state = stateFor(e.state, initial.info && initial.info[k], today);
  return ev;
}

/** One date: "25 nov. 2026", or "janv. 2027" when only the month is known; "" when empty. */
export function formatDate(s, lang = "fr") {
  if (!s) return "";
  const [y, m, day] = s.split("-").map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), { timeZone: "UTC", day: day ? "numeric" : undefined, month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, day || 1)));
}

/** "25 – 29 nov. 2026", "21 nov. – 6 déc. 2026", "janv. – févr. 2027" from an event's info; "" when the dates are not known. */
export function formatDates(info, lang = "fr") {
  if (!info || (!info.start && !info.end)) return "";
  if (!info.start || !info.end) return (info.start ? "" : "– ") + formatDate(info.start || info.end, lang) + (info.start ? " –" : "");
  const d = [info.start, info.end];
  const loc = localeOf(lang);
  const parse = (s) => { const [y, m, day] = s.split("-").map(Number); return { y, m, day, date: new Date(Date.UTC(y, m - 1, day || 1)) }; };
  const a = parse(d[0]);
  const b = parse(d[1]);
  const fmt = (x, o) => new Intl.DateTimeFormat(loc, { timeZone: "UTC", ...o }).format(x.date);
  if (!a.day) return a.y === b.y ? `${fmt(a, { month: "short" })} – ${fmt(b, { month: "short", year: "numeric" })}` : `${fmt(a, { month: "short", year: "numeric" })} – ${fmt(b, { month: "short", year: "numeric" })}`;
  if (a.m === b.m && a.y === b.y) return `${a.day} – ${fmt(b, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${fmt(a, { day: "numeric", month: "short" })} – ${fmt(b, { day: "numeric", month: "short", year: "numeric" })}`;
}
