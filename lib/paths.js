// One URL per tab, for the public site and for the editor. Pure functions: they turn a path into the tab state and back.
// The address follows the rows of tabs: circuit / region / stage / section, e.g. "/vctemea/eu/playoff/swiss".
// "/" is the home page. Short or old addresses ("/vctemea/eu", "/playoffs/swiss"...) are still understood; the page
// then sends the visitor on to the full address.

// Where each event lives: [circuit, region, stage] (region and stage only where that row of tabs exists).
const EVENT_SEGS = {
  playoffs: ["vctemea", "eu", "playoff"],
  q1: ["vctemea", "eu", "qualifier-1"],
  q2: ["vctemea", "eu", "qualifier-2"],
  tr: ["vctemea", "turkiye", "playoff"],
  trq1: ["vctemea", "turkiye", "qualifier-1"],
  trq2: ["vctemea", "turkiye", "qualifier-2"],
  mena: ["vctemea", "mena", "playoff"],
  meq1: ["vctemea", "mena", "me-qualifier-1"],
  meq2: ["vctemea", "mena", "me-qualifier-2"],
  naq1: ["vctemea", "mena", "na-qualifier-1"],
  naq2: ["vctemea", "mena", "na-qualifier-2"],
  kickoff: ["vctemea", "kickoff"],
  gc: ["vctgcemea"],
};
// Sections of each event's page; the others only have an Overview.
const EVENT_SECTIONS = { playoffs: ["overview", "swiss", "bracket", "stats"], tr: ["overview", "stats"], mena: ["overview", "stats"], gc: ["overview", "stats"] };
const sectionsOf = (event) => EVENT_SECTIONS[event] || ["overview"];
// Region address -> its stages ("playoff" first: what "/vctemea/turkiye" opens).
const REGION_STAGES = {
  eu: { playoff: "playoffs", "qualifier-1": "q1", "qualifier-2": "q2" },
  turkiye: { playoff: "tr", "qualifier-1": "trq1", "qualifier-2": "trq2" },
  mena: { playoff: "mena", "me-qualifier-1": "meq1", "me-qualifier-2": "meq2", "na-qualifier-1": "naq1", "na-qualifier-2": "naq2" },
};
const STAGE_ALIAS = { playoffs: "playoff", "qualifier-playoffs": "playoff", q1: "qualifier-1", q2: "qualifier-2" };
const CIRCUIT_ALIAS = { "vct-emea": "vctemea", "vct-gc-emea": "vctgcemea", "gc-emea": "vctgcemea", gc: "vctgcemea" };
const REGION_ALIAS = { tr: "turkiye", turkey: "turkiye", europe: "eu" };

// Addresses used before the circuit/region/stage layout: "/playoffs/swiss", "/turkiye/qualifier-1", "/gc-emea"...
const OLD_EVENT = { playoffs: "playoffs", "qualifier-1": "q1", "qualifier-2": "q2", mena: "mena", turkiye: "tr", kickoff: "kickoff", "gc-emea": "gc" };
const OLD_REGION_EVENTS = { tr: { "qualifier-1": "trq1", "qualifier-2": "trq2" } };

// A region's own open qualifiers (editor: shown as its stage tabs, "ttop"): event -> [region, stage address]
const REGION_QUALS = {
  trq1: ["tr", "qualifier-1"], trq2: ["tr", "qualifier-2"],
  meq1: ["mena", "me-qualifier-1"], meq2: ["mena", "me-qualifier-2"], naq1: ["mena", "na-qualifier-1"], naq2: ["mena", "na-qualifier-2"],
};
const isRegionQual = (e, region) => !!REGION_QUALS[e] && (!region || REGION_QUALS[e][0] === region);

const SUBS = ["teams", "matches", "tournament"];
const KVIEWS = ["teams", "matches"];

const parts = (p) => String(p || "").split("?")[0].split("#")[0].split("/").filter(Boolean).map((s) => s.toLowerCase());
const withTab = (event, rest) => {
  if (rest.length > 1) return null;
  const tab = rest[0] || "overview";
  return sectionsOf(event).includes(tab) ? { event, tab } : null;
};

/** The event and tab of a site address after its circuit/region/stage segments, or null. */
function parseNew(s) {
  const circuit = CIRCUIT_ALIAS[s[0]] || s[0];
  if (circuit === "vctgcemea") return withTab("gc", s.slice(1));
  if (circuit !== "vctemea") return null;
  if (s.length === 1) return { event: "playoffs", tab: "overview" };
  const region = REGION_ALIAS[s[1]] || s[1];
  if (region === "kickoff") return withTab("kickoff", s.slice(2));
  const stages = REGION_STAGES[region];
  if (!stages) return null;
  if (s.length === 2) return { event: stages.playoff, tab: "overview" };
  const event = stages[STAGE_ALIAS[s[2]] || s[2]];
  return event ? withTab(event, s.slice(3)) : null;
}

function parseOld(s) {
  const event = OLD_EVENT[s[0]];
  if (!event || s.length > 2) return null;
  if (s.length === 1) return { event, tab: "overview" };
  const sub = OLD_REGION_EVENTS[event] && OLD_REGION_EVENTS[event][s[1]];
  if (sub) return { event: sub, tab: "overview" };
  return (EVENT_SECTIONS[event] || []).includes(s[1]) ? { event, tab: s[1] } : null;
}

/**
 * Public site: "/vctemea/eu/playoff/overview", "/vctemea/eu/qualifier-1/overview", "/vctemea/turkiye/playoff/stats",
 * "/vctemea/kickoff/overview", "/vctgcemea/overview"... Returns null for "/" (the home page) and for an unknown path.
 */
export function parseSitePath(p) {
  const s = parts(p);
  if (!s.length) return null;
  return parseNew(s) || parseOld(s);
}

/** The full address of a tab: always circuit/region/stage/section. */
export function siteHref(event, tab = "overview") {
  const segs = EVENT_SEGS[event] || EVENT_SEGS.playoffs;
  const ev = EVENT_SEGS[event] ? event : "playoffs";
  return "/" + [...segs, sectionsOf(ev).includes(tab) ? tab : "overview"].join("/");
}

/** The editor tab of an event; with `matches`, on its matches. */
export function adminNavForEvent(event, matches = false) {
  const nav = { region: "eu", top: "q1", sub: "teams", kview: matches ? "matches" : "teams" };
  if (event === "playoffs") return { ...nav, top: "playoffs", sub: matches ? "matches" : "teams" };
  if (event === "q2") return { ...nav, top: "q2" };
  if (isRegionQual(event)) return { ...nav, region: REGION_QUALS[event][0], ttop: event };
  if (["tr", "mena", "kickoff", "gc"].includes(event)) return { ...nav, region: event };
  return nav;
}

/** The editor tab matching a site event, for the E key. */
export const adminHrefForEvent = (event) => adminHref(adminNavForEvent(event));

/** Where the editor opens from a page of the site: on its event, else on the editor's home page. */
export function adminHrefForPath(p) {
  const st = parseSitePath(p);
  return st ? adminHrefForEvent(st.event) : "/admin";
}

const ADMIN_DEFAULT = { region: "eu", top: "q1", sub: "teams", kview: "teams" };

function parseAdminNew(r) {
  const out = ADMIN_DEFAULT;
  const circuit = CIRCUIT_ALIAS[r[0]] || r[0];
  if (circuit === "vctgcemea") {
    const kview = r.length <= 2 && (r[1] === undefined ? "teams" : KVIEWS.includes(r[1]) ? r[1] : null);
    return kview ? { ...out, region: "gc", kview } : null;
  }
  if (circuit !== "vctemea") return null;
  if (r.length === 1) return out;
  const region = REGION_ALIAS[r[1]] || r[1];
  const view = (x, ok) => (x === undefined ? "teams" : ok.includes(x) ? x : null);
  if (region === "kickoff") {
    const kview = r.length <= 3 && view(r[2], KVIEWS);
    return kview ? { ...out, region: "kickoff", kview } : null;
  }
  const stages = REGION_STAGES[region];
  if (!stages || r.length > 4) return null;
  const event = r.length === 2 ? stages.playoff : stages[STAGE_ALIAS[r[2]] || r[2]];
  if (!event) return null;
  if (event === "q1" || event === "q2") return r.length <= 3 ? { ...out, top: event } : null;
  if (isRegionQual(event)) return r.length <= 3 ? { ...out, region: REGION_QUALS[event][0], ttop: event } : null;
  if (event === "playoffs") {
    const sub = view(r[3], SUBS);
    return sub ? { ...out, top: "playoffs", sub } : null;
  }
  const kview = view(r[3], KVIEWS); // tr, mena: their Qualifier Playoffs
  return kview ? { ...out, region: event, kview } : null;
}

function parseAdminOld(r) {
  const out = ADMIN_DEFAULT;
  const event = OLD_EVENT[r[0]];
  if (!event) return null;
  if (event === "q1" || event === "q2") return r.length === 1 ? { ...out, top: event } : null;
  if (event === "playoffs") {
    if (r.length === 1) return { ...out, top: "playoffs" };
    return r.length === 2 && SUBS.includes(r[1]) ? { ...out, top: "playoffs", sub: r[1] } : null;
  }
  if (event === "kickoff" || event === "tr" || event === "mena") {
    if (r.length === 1) return { ...out, region: event };
    const sub = OLD_REGION_EVENTS[event] && OLD_REGION_EVENTS[event][r[1]];
    if (r.length === 2 && sub) return { ...out, region: event, ttop: sub };
    return r.length === 2 && KVIEWS.includes(r[1]) ? { ...out, region: event, kview: r[1] } : null;
  }
  return r.length === 1 ? { ...out, region: event } : null; // gc
}

/**
 * Editor: "/admin/vctemea/eu/qualifier-1", "/admin/vctemea/eu/playoff/matches", "/admin/vctemea/turkiye/playoff/teams",
 * "/admin/vctemea/turkiye/qualifier-2", "/admin/vctemea/mena/playoff/matches", "/admin/vctemea/kickoff/teams", "/admin/vctgcemea".
 * "/admin" alone is the editor's home page.
 */
export function parseAdminPath(p) {
  const s = parts(p);
  if (s[0] !== "admin") return null;
  const r = s.slice(1);
  if (!r.length) return { ...ADMIN_DEFAULT, home: true };
  return parseAdminNew(r) || parseAdminOld(r);
}

export function adminHref({ home, region, top, sub, kview, ttop }) {
  if (home) return "/admin";
  const v = (x) => (KVIEWS.includes(x) ? x : "teams");
  if (region === "gc") return `/admin/vctgcemea/${v(kview)}`;
  if (region === "kickoff") return `/admin/vctemea/kickoff/${v(kview)}`;
  if (region === "tr" || region === "mena") {
    const base = region === "tr" ? "turkiye" : "mena";
    if (isRegionQual(ttop, region)) return `/admin/vctemea/${base}/${REGION_QUALS[ttop][1]}`;
    return `/admin/vctemea/${base}/playoff/${v(kview)}`;
  }
  if (top === "playoffs") return `/admin/vctemea/eu/playoff/${SUBS.includes(sub) ? sub : "teams"}`;
  return top === "q2" ? "/admin/vctemea/eu/qualifier-2" : "/admin/vctemea/eu/qualifier-1";
}

/** The event an editor tab works on ("playoffs", "trq1", "kickoff"...). */
export function eventForAdmin({ region, top, ttop }) {
  if (region === "tr" || region === "mena") return isRegionQual(ttop, region) ? ttop : region;
  if (region === "kickoff" || region === "gc") return region;
  return top === "q1" || top === "q2" ? top : "playoffs";
}

/** The site tab matching an editor tab, for "Back to the site". */
export const siteHrefForAdmin = (nav) => (nav.home ? "/" : siteHref(eventForAdmin(nav)));

/** A team's page address from its name: "/team/navi-junior". */
export const teamSlug = (name) => String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const teamHref = (name) => (teamSlug(name) ? `/team/${teamSlug(name)}` : "");

/** The events' names, as shown on match cards, team pages and in the search. */
export const EVENT_NAMES = {
  q1: "EU Qualifier 1", q2: "EU Qualifier 2", playoffs: "EU Qualifier Playoffs",
  trq1: "Türkiye Qualifier 1", trq2: "Türkiye Qualifier 2", tr: "Türkiye Qualifier Playoffs",
  meq1: "ME Qualifier 1", meq2: "ME Qualifier 2", naq1: "NA Qualifier 1", naq2: "NA Qualifier 2",
  mena: "MENA Qualifier Playoffs", kickoff: "EMEA Kickoff", gc: "Game Changers EMEA",
};
