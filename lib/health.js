// The editor's view of what runs by itself: when each source last worked, and its last problem. Read from what each part saves.
import { readItems, saveItem } from "./lpstore.js";

/** Notes a part's problem, for the health table. Never throws. */
export function noteProblem(part, message, db) {
  try { saveItem("meta", `err:${part}`, { at: new Date().toISOString(), message: String(message || "").slice(0, 200) }, db); } catch { /* the table just shows less */ }
}

/** Notes that a part worked. */
export function noteWorked(part, db) {
  try { saveItem("meta", `ok:${part}`, { at: new Date().toISOString() }, db); } catch { /* the table just shows less */ }
}

const latest = (...list) => list.filter(Boolean).sort().pop() || "";

/** [{ part, at, problem: { at, message } | null, late }]: late when nothing worked for longer than that part should take. */
export function healthReport(db, now = Date.now()) {
  const meta = readItems("meta", db);
  const turns = Object.fromEntries(db.prepare("SELECT key, json FROM lp_items WHERE kind = 'turn'").all().map((r) => [r.key, r.json]));
  const asDate = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : ""; };
  const sync = readItems("tsync_meta", db);
  const lists = readItems("vlr_event", db);
  const lft = readItems("lft", db);
  const syncErr = Object.entries(sync).filter(([, m]) => m.error).map(([e, m]) => ({ at: m.at, message: `${e}: ${m.error}` }))[0] || null;
  const blocked = meta.vlr && meta.vlr.blockedUntil && new Date(meta.vlr.blockedUntil).getTime() > now ? { at: meta.vlr.blockedUntil, message: "vlr.gg refused: paused until this time" } : null;
  const rows = [
    { part: "cron", at: (meta["ok:tick"] || {}).at || "", problem: null, every: 15 },
    { part: "toornament", at: latest(...Object.values(sync).map((m) => m.at)), problem: syncErr, every: 30 },
    { part: "vlr", at: latest(asDate(turns.vlrm), ...Object.values(lists).map((l) => l.at)), problem: blocked || meta["err:vlr"] || null, every: 120 },
    { part: "liquipedia", at: latest(asDate(turns.lp), ...Object.values(lft).map((x) => x && x.at)), problem: meta["err:lft"] || null, every: 180 },
    { part: "alerts", at: (meta.push_last || {}).at || "", problem: (meta.push_last && meta.push_last.problems && meta.push_last.problems.length) ? { at: meta.push_last.at, message: meta.push_last.problems.join(" · ") } : null, every: 0, note: meta.push_last ? `${meta.push_last.sent || 0}/${meta.push_last.subs || 0}` : "" },
    { part: "regular", at: (meta["ok:regular"] || {}).at || "", problem: meta["err:regular"] || null, every: 60 },
  ];
  return rows.map((r) => ({ ...r, late: !!(r.every && (!r.at || now - new Date(r.at).getTime() > r.every * 60000)) }));
}
