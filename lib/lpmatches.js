// The EU Qualifier Playoffs' matches from Liquipedia (CC-BY-SA), as a second source beside vlr.gg: each round's Swiss pairings,
// the bracket's semifinals, the scores and the times. Liquipedia no longer writes its matches in the page's text, so the page
// is read as shown (action=parse: one request every 30 s at most, by their API terms; the site's Liquipedia turn keeps that).
// It only fills what is empty: a match an editor placed, a score or a time already there is never changed.
import { readItems, saveItem } from "./lpstore.js";
import { readSources } from "./sources.js";

const API = "https://liquipedia.net/valorant/api.php";
const UA = "vct-emea-site/1.0 (personal tournament site; match results)";
// the code's page for each event followed; an editor's link (Sources) replaces it
export const LP_MATCH_EVENTS = { playoffs: "VCT/2027/EMEA/Kickoff/Europe" };
const HOT_EVERY = 3 * 60000;
const COLD_EVERY = 6 * 3600000;

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
// a team's name without the words sites add or leave out ("CGN Esports" and "CGN ESPORTS", "Barça eSports" and "Barca Esports")
const core = (s) => norm(String(s || "").replace(/\bnatus\s+vincere\b/gi, "NAVI").replace(/\b(e-?sports?|team|gaming|club|gg)\b/gi, " ")) || norm(s);
const known = (n) => !!n && !/^(tbd|tba|bye|definitions)$/i.test(String(n).trim());

/** A Liquipedia link (or a page title) as the page title "A/B/C"; "" when it is not one. Its tabs (Swiss stage...) lead back to the event. */
export function parseLp(link) {
  let s = String(link || "").trim();
  const m = /liquipedia\.net\/valorant\/([^?#\s]+)/i.exec(s);
  if (m) s = m[1];
  else if (/^https?:/i.test(s) || !/^[A-Za-z0-9]/.test(s)) return "";
  try { s = decodeURIComponent(s); } catch { /* left as it is */ }
  s = s.replace(/ /g, "_").replace(/\/+$/, "").replace(/\/(Swiss_Stage|Statistics|Results|Bracket|Playoffs)$/i, "");
  return /^[^<>[\]{}|]{3,200}$/.test(s) ? s : "";
}
export const lpLink = (page) => (page ? `https://liquipedia.net/valorant/${page}` : "");

/**
 * Every match a Liquipedia page shows, in the page's order: { kind: "list" | "bracket", title (its match list's), bracket (which
 * bracket of the page, from 0), a, b, sa, sb, done, at (ISO) }. Names Liquipedia has not set yet ("TBD") come as "".
 */
export function parseLpMatches(html) {
  const h = String(html || "");
  // a match list's title: in bold in its header ("Round 2 Matches"), else the header's words without its Show/Hide button
  const titles = [...h.matchAll(/<div class="[^"]*(?<=["\s])brkts-matchlist-title(?=["\s])[^"]*"[^>]*>([\s\S]{0,600})/g)].map((m) => {
    const bold = /^\s*<b[^>]*>([\s\S]*?)<\/b>/.exec(m[1]);
    return { at: m.index, title: bold ? text(bold[1]) : text(m[1].split("</div>")[0]).replace(/\s*\b(show|hide)\b[\s\S]*$/i, "") };
  });
  const brackets = [...h.matchAll(/class="brkts-bracket[ "]/g)].map((m) => m.index);
  const starts = [...h.matchAll(/class="(brkts-matchlist-match|brkts-match) /g)].map((m) => ({ at: m.index, kind: m[1] === "brkts-match" ? "bracket" : "list" }));
  const out = [];
  starts.forEach((s, i) => {
    const chunk = h.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : h.length);
    const names = [];
    // each side's cell: its team in the tag's label (none for a side not known yet)
    // (the class itself, not "brkts-opponent-entry-left" inside it)
    for (const m of chunk.matchAll(/<div class="[^"]*(?<=["\s])(?:brkts-matchlist-opponent|brkts-opponent-entry)(?=["\s])[^"]*"[^>]*>/g)) {
      const n = decode((/aria-label="([^"]*)"/.exec(m[0]) || [])[1] || "").trim();
      if (names.length < 2) names.push(known(n) ? n : "");
    }
    const scoreRe = s.kind === "list" ? /class="brkts-matchlist-cell brkts-matchlist-score[^"]*"[^>]*>\s*<div class="brkts-matchlist-cell-content">([\s\S]*?)<\/div>/g : /brkts-opponent-score-inner">([\s\S]*?)<\/div>/g;
    const sc = [...chunk.matchAll(scoreRe)].map((m) => { const n = parseInt(text(m[1]), 10); return Number.isFinite(n) ? n : null; });
    const ts = Number((/data-timestamp="(\d{9,11})"/.exec(chunk) || [])[1]);
    const title = s.kind === "list" ? ([...titles].reverse().find((t) => t.at < s.at) || {}).title || "" : "";
    const bracket = s.kind === "bracket" ? brackets.filter((b) => b < s.at).length - 1 : -1;
    out.push({ kind: s.kind, title, bracket, a: names[0] || "", b: names[1] || "", sa: sc[0] ?? null, sb: sc[1] ?? null, done: /data-finished="finished"/.test(chunk), at: ts ? new Date(ts * 1000).toISOString() : "" });
  });
  return out;
}

/** The site team a Liquipedia name is: the same name, else the same name without "Esports"/"Team"... ; "" when none or two. */
export function teamOf(teams, name, aliases = {}) {
  if (!known(name)) return "";
  // a name an editor tied to a team (the same list as Toornament's)
  const alias = Object.entries(aliases).find(([from]) => norm(from) === norm(name));
  if (alias && alias[1] && alias[1].name && norm(alias[1].name) !== norm(name)) return teamOf(teams, alias[1].name);
  const x = norm(name);
  const same = teams.filter((t) => t.name && norm(t.name) === x);
  if (same.length === 1) return same[0].id;
  const c = core(name);
  const close = teams.filter((t) => t.name && core(t.name) === c);
  return close.length === 1 ? close[0].id : "";
}

const pairOf = (list, A, B) => {
  for (const m of list) {
    if (m.a === A && m.b === B) return { m, swap: false };
    if (m.a === B && m.b === A) return { m, swap: true };
  }
  return null;
};
const roundOf = (title) => Number((/\bround\s*([1-5])\b/i.exec(title || "") || [])[1]) || 0;

/** The playoffs' teams, matches and times, read directly: a few small queries. */
async function playoffsNow(db) {
  const { listMatches } = await import("./db.js");
  const teams = db.prepare("SELECT id, name, status, ord FROM teams ORDER BY ord").all().map((r) => ({ id: r.id, name: r.name || "", status: r.status, order: r.ord }));
  const times = Object.fromEntries(db.prepare("SELECT id, at FROM mtimes WHERE event = 'playoffs'").all().map((r) => [r.id, r.at]));
  return { teams, matches: listMatches(db), times: { playoffs: times } };
}

/**
 * Fills the EU Qualifier Playoffs from Liquipedia's matches: Swiss pairings into the empty places of their round, the bracket's
 * semifinals, then the scores of finished matches and the times, wherever the site has none. Returns the changes, in words.
 */
export async function applyPlayoffs(db, found) {
  const { dropStateCache, setMatchTime } = await import("./db.js");
  const { saveScore } = await import("./actions.js");
  const { swissDraw, bracketDraw, SEMI_IDS } = await import("./tournament.js");
  const { readTeamAliases } = await import("./editor17.js");
  const aliases = readTeamAliases(db);
  const changes = [];
  let state = await playoffsNow(db);
  const fresh = () => playoffsNow(db);
  const id = (n) => teamOf(state.teams, n, aliases);
  const ours = readItems("lpm_time", db);

  const finish = (lp, site) => {
    // the score of a finished match, sides as on the site, when the site has none
    if (lp.done && lp.sa != null && lp.sb != null && lp.sa !== lp.sb && site.m.sa == null) {
      const [sa, sb] = site.swap ? [lp.sb, lp.sa] : [lp.sa, lp.sb];
      const r = saveScore(db, { id: site.m.id, sa, sb });
      if (r.ok) changes.push(`Score ${site.m.id}: ${sa}-${sb}`);
    }
    // its time, unless one was typed by an editor (Liquipedia's own earlier times are kept up to date)
    const now = (state.times.playoffs || {})[site.m.id];
    if (lp.at && (!now || (ours[site.m.id] === now && now !== lp.at))) {
      const r = setMatchTime(db, { event: "playoffs", id: site.m.id, at: lp.at });
      if (r.ok) { saveItem("lpm_time", site.m.id, lp.at, db); ours[site.m.id] = lp.at; if (!now) changes.push(`Time ${site.m.id}`); }
    }
  };

  // the Swiss stage, round by round: a round's pairings can only be placed once the one before is over
  const swiss = found.filter((x) => x.kind === "list" && roundOf(x.title));
  for (let round = 1; round <= 5; round++) {
    for (const lp of swiss.filter((x) => roundOf(x.title) === round)) {
      const A = id(lp.a);
      const B = id(lp.b);
      if (!A || !B || A === B) continue;
      let site = pairOf(state.matches.filter((m) => m.stage === "swiss" && Number(m.round) === round), A, B);
      if (!site) {
        const draw = swissDraw(state.teams, state.matches, round);
        if (!draw || !draw.editable) continue;
        const used = new Set(draw.slots.flatMap((s) => (s.match ? [s.match.a, s.match.b] : [])));
        if (used.has(A) || used.has(B)) continue; // the site placed them otherwise: an editor's choice stays
        const slot = draw.slots.find((s) => !s.match && (draw.pools[s.key] || []).includes(A) && (draw.pools[s.key] || []).includes(B));
        if (!slot) continue;
        // checked above as the editor's screen does (both teams with that record, each once in the round)
        db.prepare("INSERT INTO matches (id, stage, round, a, b, bo) VALUES (?, 'swiss', ?, ?, ?, 3)").run(slot.id, String(round), A, B);
        changes.push(`Round ${round}: ${lp.a} – ${lp.b}`);
        state = await fresh();
        site = pairOf(state.matches.filter((m) => m.stage === "swiss" && Number(m.round) === round), A, B);
        if (!site) continue;
      }
      finish(lp, site);
      state = await fresh();
    }
  }

  // the bracket: one Liquipedia bracket per group, A then B. Its final is the match whose two teams both play another match of it.
  const groups = {};
  for (const lp of found.filter((x) => x.kind === "bracket" && x.bracket >= 0)) (groups[lp.bracket] ||= []).push(lp);
  const keys = Object.keys(groups).map(Number).sort((p, q) => p - q).slice(0, 2);
  for (const [gi, k] of keys.entries()) {
    const g = gi === 0 ? "A" : "B";
    const list = groups[k].map((lp) => ({ ...lp, A: id(lp.a), B: id(lp.b) })).filter((lp) => lp.A && lp.B && lp.A !== lp.B);
    const elsewhere = (lp, t) => list.some((o) => o !== lp && (o.A === t || o.B === t));
    const semis = list.filter((lp) => !(elsewhere(lp, lp.A) && elsewhere(lp, lp.B)));
    for (const lp of semis.slice(0, 2)) {
      if (pairOf(state.matches.filter((m) => m.stage === "elim"), lp.A, lp.B)) continue;
      const draw = bracketDraw(state.teams, state.matches);
      if (!draw.editable) break;
      const placed = new Set(draw.slots.flatMap((s) => (s.match ? [s.match.a, s.match.b].filter(Boolean) : [])));
      if (placed.has(lp.A) || placed.has(lp.B)) continue;
      if (!draw.adv.includes(lp.A) || !draw.adv.includes(lp.B)) continue;
      const slot = draw.slots.find((s) => s.key === g && SEMI_IDS.includes(s.id) && !(s.match && (s.match.a || s.match.b)));
      if (!slot) continue;
      placeSemi(db, slot.id, lp.A, lp.B);
      changes.push(`Bracket ${g}: ${lp.a} – ${lp.b}`);
      state = await fresh();
    }
    // the semifinals first: their winners make the final
    for (const lp of [...semis, ...list.filter((o) => !semis.includes(o))]) {
      const site = pairOf(state.matches.filter((m) => m.stage === "elim"), lp.A, lp.B);
      if (!site) continue;
      finish(lp, site);
      state = await fresh();
    }
  }

  if (changes.length) {
    try { const { recordAction } = await import("./undo.js"); recordAction(db, `From Liquipedia (EU Qualifier Playoffs): ${changes.join("; ")}`.slice(0, 500), "Liquipedia"); } catch { /* the history is a convenience */ }
    try { const { logSync } = await import("./editor17.js"); logSync(db, changes.map((t) => ({ source: "Liquipedia", event: "playoffs", text: t }))); } catch { /* the log is a convenience */ }
    dropStateCache();
  }
  return changes;
}

/** A semifinal's two teams, as the editor's screen places them: the bracket is made on the first one (lib/actions.js). */
function placeSemi(db, id, A, B) {
  db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM matches WHERE stage = 'elim' LIMIT 1").get()) {
      const ins = db.prepare("INSERT INTO matches (id, stage, round, grp, a, b, bo, feeds, slot) VALUES (?, 'elim', ?, ?, ?, ?, ?, ?, ?)");
      for (const g of ["A", "B"]) {
        ins.run(`e${g}-s1`, "semi", g, "", "", 3, `e${g}-f`, "a");
        ins.run(`e${g}-s2`, "semi", g, "", "", 3, `e${g}-f`, "b");
        ins.run(`e${g}-f`, "final", g, "", "", 5, null, null);
      }
    }
    db.prepare("UPDATE matches SET a = ?, b = ?, sa = NULL, sb = NULL WHERE id = ?").run(A, B, id);
  })();
}

/** The Liquipedia pages followed for each event: the code's, with the editors' links. { event: [pages] } */
export function lpMatchPages(db) {
  const out = {};
  const set = readSources(db);
  for (const [event, page] of Object.entries(LP_MATCH_EVENTS)) {
    const s = set[event] || {};
    if (s.lp === "off") continue;
    const base = s.lp || page;
    out[event] = [`${base}/Swiss_Stage`, base];
  }
  return out;
}

/**
 * One Liquipedia page, when one is due: every 3 minutes while the event runs (its dates, a day either side, or a match time
 * within 12 hours), every 6 hours otherwise, the one read longest ago first. Returns whether a page was read (it takes the
 * Liquipedia turn of this round). Called once the turn is taken.
 */
export async function lpMatchesIfDue(now = Date.now()) {
  const { getDb } = await import("./db.js");
  const db = getDb();
  const pages = lpMatchPages(db);
  const meta = readItems("lpm_meta", db);
  let pick = null;
  for (const [event, list] of Object.entries(pages)) {
    if (event === "playoffs" && !db.prepare("SELECT 1 FROM teams WHERE name <> '' LIMIT 1").get()) continue;
    const info = db.prepare('SELECT start_date AS start, end_date AS "end" FROM einfo WHERE event = ?').get(event) || {};
    const day = 864e5;
    const inDates = info.start && info.end && now >= new Date(info.start).getTime() - day && now <= new Date(info.end).getTime() + 2 * day;
    const soon = db.prepare("SELECT at FROM mtimes WHERE event = ?").all(event).some((r) => Math.abs(now - new Date(r.at).getTime()) < 12 * 3600000);
    const every = inDates || soon ? HOT_EVERY : COLD_EVERY;
    for (const page of list) {
      const m = meta[page];
      const age = m ? now - new Date(m.at).getTime() : Infinity;
      if (age >= every && (!pick || age > pick.age)) pick = { event, page, age };
    }
  }
  if (!pick) return false;
  let entry = { at: new Date(now).toISOString(), event: pick.event };
  try {
    const res = await fetch(`${API}?action=parse&page=${encodeURIComponent(pick.page)}&prop=text&format=json&formatversion=2`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Liquipedia ${res.status}`);
    const j = await res.json();
    if (j.error) entry = { ...entry, matches: 0, error: j.error.code === "missingtitle" ? "no such page" : j.error.code };
    else {
      const found = parseLpMatches(j.parse.text);
      const changes = pick.event === "playoffs" ? await applyPlayoffs(db, found) : [];
      entry = { ...entry, matches: found.filter((x) => x.a && x.b).length, changes: changes.length };
      console.log(`[lp-matches] ${pick.page}: ${entry.matches} matches, ${changes.length} changes`);
    }
  } catch (e) {
    entry = { ...entry, error: e.message };
    console.log(`[lp-matches] ${pick.page}: ${e.message}`);
  }
  saveItem("lpm_meta", pick.page, entry, db);
  return true;
}
