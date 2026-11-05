// Changes to the Qualifier 1 / 2 brackets. Same contract as actions.js: { ok, message } or { ok: false, status, error }.
import { getQualifier, qualifierSize } from "./db.js";
import { BO_CHOICES, EVENTS, THIRD, buildBracket, checkScore, roundsFor, slotsFromLines } from "./bracket.js";
import { parseRoster, rosterEntry } from "./tournament.js";
import { countryCode } from "./teaminfo.js";

const fail = (status, error) => ({ ok: false, status, error });
const done = (message) => ({ ok: true, message });
const known = (event) => EVENTS.includes(event);
// Team lists with no bracket yet, kept in the same qslots table: only their teams can be edited.
const TEAM_LISTS = ["gc"];

/** Replaces the teams: one name per line, in bracket order (lines 1-2 meet in the first round, 3-4, ...). */
export function setQualifierTeams(db, event, text) {
  if (!known(event)) return fail(404, "Unknown event.");
  const names = slotsFromLines(text, qualifierSize(db, event));
  db.transaction(() => {
    // keep the short tag a team already has (matched by name): the bulk text has no place for it
    const tags = Object.fromEntries(db.prepare("SELECT name, tag FROM qslots WHERE event = ?").all(event).map((r) => [r.name, r.tag]));
    db.prepare("DELETE FROM qslots WHERE event = ?").run(event);
    const ins = db.prepare("INSERT INTO qslots (event, slot, name, roster, staff, tag) VALUES (?, ?, ?, ?, ?, ?)");
    names.forEach((n, i) => n.name && ins.run(event, i + 1, n.name, n.roster, n.staff, tags[n.name] || ""));
    dropStaleScores(db, event);
  })();
  return done(`${names.filter((n) => n.name).length} teams saved.`);
}

/** Sets one slot: name, roster and staff. An empty name empties the slot. Also used for the GC EMEA team list, whose teams also have an entry (invited or qualified). */
export function setQualifierSlot(db, { event, slot, name, roster, staff, tag, entry }) {
  const list = TEAM_LISTS.includes(event);
  if (!known(event) && !list) return fail(404, "Unknown event.");
  if (entry !== undefined && entry !== "invited" && entry !== "qualified") return fail(400, "Entry must be invited or qualified.");
  if (!Number.isInteger(slot) || slot < 1 || slot > qualifierSize(db, event)) return fail(400, "Unknown slot.");
  const n = String(name ?? "").trim();
  const r = String(roster ?? "").trim();
  const s = String(staff ?? "").trim();
  if (n.length > 40) return fail(400, "Team name is limited to 40 characters.");
  if (r.length > 240) return fail(400, "Roster is limited to 240 characters.");
  if (s.length > 200) return fail(400, "Staff is limited to 200 characters.");
  db.transaction(() => {
    const old = db.prepare("SELECT status FROM qslots WHERE event = ? AND slot = ?").get(event, slot);
    db.prepare("DELETE FROM qslots WHERE event = ? AND slot = ?").run(event, slot);
    if (n) {
      db.prepare("INSERT INTO qslots (event, slot, name, roster, staff, tag, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(event, slot, n, r, s, String(tag ?? "").trim().toUpperCase().slice(0, 7), entry ?? (old ? old.status : "invited"));
    }
    if (!list) dropStaleScores(db, event);
  })();
  return done(n ? "Team saved." : list ? "Team removed." : "Slot emptied.");
}

export function saveQualifierScore(db, { event, id, sa, sb }) {
  if (!known(event)) return fail(404, "Unknown event.");
  const q = getQualifier(db, event);
  const m = buildBracket(q.slots, q.scores, q.bo).byId[id];
  if (!m) return fail(404, "Unknown match.");
  if (sa == null && sb == null) {
    db.prepare("DELETE FROM qscores WHERE event = ? AND id = ?").run(event, id);
    dropStaleScores(db, event);
    return done("Score cleared.");
  }
  if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) return fail(400, "Scores must be whole numbers.");
  const err = checkScore(m, sa, sb);
  if (err) return fail(err.startsWith("Both") ? 409 : 400, err);
  db.transaction(() => {
    // not INSERT OR REPLACE: over a direct connection to Turso, the undo button would not see the row it replaces
    db.prepare("INSERT INTO qscores (event, id, a, b, sa, sb) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET a = excluded.a, b = excluded.b, sa = excluded.sa, sb = excluded.sb").run(event, id, m.a, m.b, sa, sb);
    dropStaleScores(db, event);
  })();
  return done("Score saved.");
}

export function setQualifierBo(db, event, bo) {
  if (!known(event)) return fail(404, "Unknown event.");
  const keys = [...roundsFor(qualifierSize(db, event)), THIRD].map((r) => r.key);
  for (const [k, v] of Object.entries(bo || {})) {
    if (!keys.includes(k) || !BO_CHOICES.includes(Number(v))) return fail(400, "Unknown best-of.");
  }
  db.transaction(() => {
    const set = db.prepare("INSERT INTO kv (\"key\", value) VALUES (?, ?) ON CONFLICT (\"key\") DO UPDATE SET value = excluded.value");
    for (const [k, v] of Object.entries(bo || {})) set.run(`qbo:${event}:${k}`, String(Number(v)));
    dropStaleScores(db, event);
  })();
  return done("Formats saved.");
}

export function resetQualifier(db, event) {
  if (!known(event)) return fail(404, "Unknown event.");
  db.transaction(() => {
    db.prepare("DELETE FROM qscores WHERE event = ?").run(event);
    db.prepare("DELETE FROM qslots WHERE event = ?").run(event);
    db.prepare("DELETE FROM kv WHERE key LIKE ?").run(`qbo:${event}:%`);
  })();
  return done("Qualifier reset.");
}

/**
 * Flags from a pasted list, one "player, country" per line (a two-letter code or an English country name), for the players of every qualifier.
 * Matches the nickname whatever its capitals; two players of the same name in different teams both get it.
 */
export function importFlags(db, text) {
  const wanted = new Map();
  const bad = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const parts = line.split(/[,;\t|]/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) continue;
    const raw = (parts[1] || "").toLowerCase();
    const cc = /^[a-z]{2}(-[a-z]{3})?$/.test(raw) ? raw : countryCode(raw);
    if (parts.length < 2 || !cc) bad.push(parts[0]);
    else wanted.set(parts[0].toLowerCase(), cc);
  }
  if (!wanted.size) return fail(400, "Write one player and one country per line.");
  const found = new Set();
  let changed = 0;
  db.transaction(() => {
    const set = db.prepare("UPDATE qslots SET roster = ? WHERE event = ? AND slot = ?");
    for (const r of db.prepare("SELECT event, slot, roster FROM qslots").all()) {
      let touched = false;
      const next = parseRoster(r.roster).map((p) => {
        const cc = wanted.get(p.name.toLowerCase());
        if (!cc) return rosterEntry(p.name, p);
        found.add(p.name.toLowerCase());
        if (cc !== p.cc) { touched = true; changed++; }
        return rosterEntry(p.name, { ...p, cc });
      }).join(", ");
      if (touched && next.length <= 240) set.run(next, r.event, r.slot);
    }
  })();
  const missing = [...wanted.keys()].filter((k) => !found.has(k));
  return done(`${changed} flags saved.${missing.length + bad.length ? ` Not understood or not found: ${[...bad, ...missing].slice(0, 12).join(", ")}.` : ""}`);
}

/** Removes every score that no longer fits the bracket (its teams changed, or its best-of did). */
function dropStaleScores(db, event) {
  for (let pass = 0; pass < 10; pass++) {
    const q = getQualifier(db, event);
    const { byId } = buildBracket(q.slots, q.scores, q.bo);
    const del = db.prepare("DELETE FROM qscores WHERE event = ? AND id = ?");
    let removed = 0;
    for (const [id, s] of Object.entries(q.scores)) {
      const m = byId[id];
      const ok = m && !m.bye && m.a === s.a && m.b === s.b && m.winner != null;
      if (!ok) {
        del.run(event, id);
        removed++;
      }
    }
    if (!removed) return;
  }
}
