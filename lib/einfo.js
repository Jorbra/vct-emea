// Event information shown on the site (dates, type, location, venue, tier), editable in the editor. Pure rules, no I/O.

export const INFO_EVENTS = ["q1", "q2", "playoffs", "trq1", "trq2", "tr", "meq1", "meq2", "naq1", "naq2", "mena", "kickoff", "gc"];
export const INFO_TYPES = ["online", "offline", "hybrid"];
export const INFO_TIERS = ["S-Tier", "A-Tier", "B-Tier", "C-Tier", ""];

/** What a new database starts with: start / end are "YYYY-MM-DD", "YYYY-MM" (month only) or "" (to be announced). */
export const INFO_DEFAULTS = {
  q1: { start: "", end: "", type: "online", location: "Europe", venue: "", tier: "A-Tier" },
  q2: { start: "", end: "", type: "online", location: "Europe", venue: "", tier: "A-Tier" },
  playoffs: { start: "2026-11-25", end: "2026-12-05", type: "online", location: "Europe", venue: "", tier: "A-Tier" },
  trq1: { start: "", end: "", type: "online", location: "Türkiye", venue: "", tier: "A-Tier" },
  trq2: { start: "", end: "", type: "online", location: "Türkiye", venue: "", tier: "A-Tier" },
  meq1: { start: "", end: "", type: "online", location: "Middle East", venue: "", tier: "B-Tier" },
  meq2: { start: "", end: "", type: "online", location: "Middle East", venue: "", tier: "B-Tier" },
  naq1: { start: "", end: "", type: "online", location: "North Africa", venue: "", tier: "B-Tier" },
  naq2: { start: "", end: "", type: "online", location: "North Africa", venue: "", tier: "B-Tier" },
  tr: { start: "2026-11-25", end: "2026-12-06", type: "online", location: "Türkiye", venue: "", tier: "A-Tier" },
  mena: { start: "2026-11-21", end: "2026-12-06", type: "hybrid", location: "MENA", venue: "", tier: "A-Tier" },
  kickoff: { start: "2027-01", end: "2027-02", type: "offline", location: "Berlin", venue: "Riot Games Arena", tier: "S-Tier" },
  gc: { start: "", end: "", type: "online", location: "EMEA", venue: "", tier: "" },
};

/** "Online", "Offline", "Online/Offline": English keys, translated where shown. */
export const TYPE_LABEL = { online: "Online", offline: "Offline", hybrid: "Online/Offline" };

const DATE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;
const realDay = (s) => {
  if (s.length === 7) return true;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Cleans and checks one event's info. Returns { info } or { error }. */
export function checkInfo(raw) {
  const s = (x) => String(x ?? "").trim();
  const info = { start: s(raw.start), end: s(raw.end), type: s(raw.type), location: s(raw.location), venue: s(raw.venue), tier: s(raw.tier) };
  for (const k of ["start", "end"]) {
    if (info[k] && (!DATE.test(info[k]) || !realDay(info[k]))) return { error: "Dates are written YYYY-MM-DD, or YYYY-MM when only the month is known." };
  }
  // "2026-12" ends after "2026-12-05": compare the common part only
  if (info.start && info.end) {
    const n = Math.min(info.start.length, info.end.length);
    if (info.end.slice(0, n) < info.start.slice(0, n)) return { error: "The end date is before the start date." };
  }
  if (!INFO_TYPES.includes(info.type)) return { error: "Type must be online, offline or hybrid." };
  if (!INFO_TIERS.includes(info.tier)) return { error: "Unknown tier." };
  if (info.location.length > 40 || info.venue.length > 60) return { error: "Location is limited to 40 characters and venue to 60." };
  return { info };
}
