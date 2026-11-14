// Where each event's data comes from, set by the editors with links: a Toornament tournament, a vlr.gg event (and the words
// of its stage that are this event's, e.g. "Qualifier #2"), and whether vlr.gg also gives the bracket. What an editor sets
// replaces what the code says for that event; an event the code does not know can be added. Kept in kv "event_sources".
import { EVENT_NAMES } from "./paths.js";

const KEY = "event_sources";
// the open qualifiers: the only events whose bracket can follow Toornament or vlr.gg
export const isQualifier = (event) => /^(q|trq|meq|naq)\d$/.test(String(event));

/** A Toornament tournament's number from its link (or the number itself); "" when none. */
export function parseToornament(link) {
  const s = String(link || "").trim();
  if (/^\d{12,22}$/.test(s)) return s;
  const m = /toornament\.com\/(?:[a-z_]{2,6}\/)?tournaments\/(\d{12,22})/i.exec(s);
  return m ? m[1] : "";
}

/** A vlr.gg event's number from its link (or the number itself); "" when none. */
export function parseVlr(link) {
  const s = String(link || "").trim();
  if (/^\d{2,7}$/.test(s)) return s;
  const m = /vlr\.gg\/event\/(?:matches\/)?(\d{2,7})/i.exec(s);
  return m ? m[1] : "";
}

/** The links' pages, to show them back. */
export const toornamentLink = (id) => (id ? `https://play.toornament.com/fr/tournaments/${id}/` : "");
export const vlrLink = (id) => (id ? `https://www.vlr.gg/event/${id}` : "");

/** What the editors set: { event: { toornament, vlr, stage, bracket, at, by } }. */
export function readSources(db) {
  try {
    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(KEY);
    const v = row ? JSON.parse(row.value) : {};
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

/**
 * Sets an event's sources from links. toornament / vlr: a link, a number, "" (back to what the code says) or "off" (none).
 * stage: the words of vlr.gg's stage that are this event's ("" = the code's, or every match of the vlr.gg event).
 */
export function saveSource(db, { event, toornament = "", vlr = "", stage = "", bracket = false, by = "" }) {
  if (!EVENT_NAMES[event]) return { ok: false, status: 400, error: "Unknown event." };
  const one = (v, parse) => { const s = String(v || "").trim(); if (!s) return ""; if (s.toLowerCase() === "off") return "off"; return parse(s) || null; };
  const t = one(toornament, parseToornament);
  const l = one(vlr, parseVlr);
  if (t === null) return { ok: false, status: 400, error: "Toornament link not recognised: paste the tournament's page." };
  if ((t && t !== "off") || bracket) { if (!isQualifier(event)) return { ok: false, status: 400, error: "Only an open qualifier's bracket can follow Toornament or vlr.gg." }; }
  if (l === null) return { ok: false, status: 400, error: "vlr.gg link not recognised: paste the event's page." };
  const all = readSources(db);
  const entry = { toornament: t, vlr: l, stage: String(stage || "").trim().slice(0, 60), bracket: !!bracket, at: new Date().toISOString(), by: String(by || "").slice(0, 40) };
  if (!entry.toornament && !entry.vlr && !entry.stage && !entry.bracket) delete all[event];
  else all[event] = entry;
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(KEY, JSON.stringify(all));
  return { ok: true, source: all[event] || null };
}

/** The Toornament tournaments to follow: the code's, with the editors' changes. Pure. */
export function mergeToornament(defaults, sources) {
  const out = { ...defaults };
  for (const [event, s] of Object.entries(sources || {})) {
    if (s.toornament === "off") delete out[event];
    else if (s.toornament) out[event] = s.toornament;
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The vlr.gg events to follow ([{ event, vlr, stage: RegExp }]) and the brackets vlr.gg gives: the code's, with the editors' changes. Pure. */
export function mergeVlr(defaults, brackets, sources) {
  const list = defaults.map((x) => ({ ...x }));
  const br = new Set(brackets);
  for (const [event, s] of Object.entries(sources || {})) {
    const i = list.findIndex((x) => x.event === event);
    if (s.vlr === "off") { if (i >= 0) list.splice(i, 1); br.delete(event); continue; }
    const stage = s.stage ? new RegExp(escape(s.stage).replace(/\s+/g, "\\s*"), "i") : null;
    if (s.vlr) {
      const entry = { event, vlr: s.vlr, stage: stage || (i >= 0 && list[i].vlr === s.vlr ? list[i].stage : /./) };
      if (i >= 0) list[i] = entry; else list.push(entry);
    } else if (stage && i >= 0) list[i] = { ...list[i], stage };
    if (s.bracket) br.add(event);
  }
  return { events: list, brackets: [...br] };
}
