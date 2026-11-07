// Follows the qualifiers on Toornament: teams, line-ups, times, matches in progress and results.
// planSync is pure: it compares what Toornament publishes with what the site holds and with what the last round wrote. Toornament updates what it
// wrote itself; what an editor changed by hand since then stays as it is.
import crypto from "node:crypto";
import { THIRD, buildBracket, checkScore, matchId, roundsFor } from "./bracket.js";
import { needWins, parseRoster, rosterEntry } from "./tournament.js";
import { cleanTime } from "./schedule.js";

export const TOORNAMENT = {
  q1: "2585087696641116159", q2: "2585088541901830143",
  meq1: "2580784486056376319", meq2: "2585052022178932735",
  naq1: "2585059482900897791", naq2: "2585059697830209535",
};
const ALIASES = { q1: { "Barça": { name: "Barça eSports", tag: "BAR" } } };
const API = "https://play.toornament.com/api";
const UA = "vct-emea-site/1.0 (personal tournament site)";
const PAGE = 48;
const HOT_EVERY = 60000;
const COLD_EVERY = 6 * 3600000;
const TEAMS_EVERY = 600000;

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const nick = (s) => clean(clean(s).replace(/#.*$/, "").replace(/[,;|]/g, " "));
const setKey = (names) => [...names].map((n) => n.toLowerCase()).sort().join("|");
const scoreKey = (s) => `${s.a}-${s.b}-${s.sa}-${s.sb}`;

/** Only what is needed of a match; never an account detail. */
export function readMatch(m) {
  const side = (o) => ({ pid: (o && o.participant && o.participant.id) || "", name: clean(o && o.participant && o.participant.name), score: o && o.score != null ? Number(o.score) : null, result: (o && o.result) || "", forfeit: !!(o && o.forfeit) });
  return { round: m.round && m.round.number, n: m.number, at: m.scheduledDatetime || "", status: m.status || "", type: (m.stage && m.stage.type) || "", a: side(m.opponents && m.opponents[0]), b: side(m.opponents && m.opponents[1]) };
}

/** Only what is needed of a participant: its name, logo and players' nicknames. */
export function readParticipant(p) {
  const id = p.team && p.team.logo && p.team.logo.id;
  return { pid: p.id, name: clean(p.name), logo: /^\d+$/.test(String(id || "")) ? String(id) : "", players: (p.lineup || []).map((x) => nick(x.name)).filter(Boolean) };
}

const rosterOf = (players, old) => {
  const known = new Map(parseRoster(old).map((p) => [p.name.toLowerCase(), p]));
  let text = "";
  for (const name of players) {
    const p = known.get(name.toLowerCase());
    const next = rosterEntry(name, { cc: p ? p.cc : "", sub: p ? p.sub : false });
    if ((text ? text.length + 2 : 0) + next.length > 240) break;
    text += (text ? ", " : "") + next;
  }
  return text;
};

/**
 * What to change on the site. rows: readMatch of every match. teams: { pid: readParticipant } or null when they were not read this time.
 * site: { slots, scores, bo, times, live }. last: what the last round wrote. Returns null when Toornament has no bracket to follow.
 */
export function planSync({ event, rows, teams, site, last = {} }) {
  const r1 = rows.filter((r) => r.round === 1).sort((x, y) => x.n - y.n);
  const size = r1.length * 2;
  if (!r1.length || !rows.every((r) => r.type === "single_elimination") || size > 512 || size < 4 || (size & (size - 1))) return null;
  if (!r1.some((r) => r.a.pid || r.b.pid)) return null;
  const named = site.slots.some(Boolean);
  if (named && site.slots.length !== size && !last.size) return { blocked: `Toornament has ${size} places, the site ${site.slots.length}.` };

  const seen = { slots: { ...(last.slots || {}) }, rosters: { ...(last.rosters || {}) }, pids: {}, scores: {}, times: {}, live: {}, size };
  const out = { size, resize: site.slots.length !== size, notes: [], slots: [], scores: [], dropped: [], times: [], liveOn: [], liveOff: [], kept: [], guessed: 0, mismatch: 0, snapshot: seen };
  const alias = ALIASES[event] || {};
  const slots = Array.from({ length: size }, (_, i) => site.slots[i] || null);
  const pidSlot = {};

  r1.forEach((r, i) => {
    [r.a, r.b].forEach((o, side) => {
      if (!o.pid) return;
      // a team keeps its place even if Toornament lists it the other way round
      const slot = (last.pids && last.pids[o.pid]) || 2 * i + side + 1;
      pidSlot[o.pid] = slot;
      seen.pids[o.pid] = slot;
      const want = alias[o.name] || { name: o.name, tag: "" };
      const cur = slots[slot - 1];
      const before = last.slots && last.slots[slot];
      let name = cur ? cur.name : "";
      if (want.name !== name) {
        if ((!cur && before === undefined) || (cur && cur.name === before)) {
          const roster = teams && teams[o.pid] ? rosterOf(teams[o.pid].players, "") : "";
          out.slots.push({ slot, name: want.name, tag: want.tag, roster });
          slots[slot - 1] = { name: want.name, tag: want.tag, roster, staff: "" };
          seen.rosters[slot] = setKey(parseRoster(roster).map((p) => p.name));
          name = want.name;
        } else out.kept.push(`slot ${slot}`);
      } else if (teams && teams[o.pid] && cur) {
        const now = setKey(parseRoster(cur.roster).map((p) => p.name));
        const wanted = teams[o.pid].players;
        const before2 = last.rosters && last.rosters[slot];
        if (setKey(wanted) !== now && wanted.length && (before2 === undefined ? !cur.roster : now === before2)) {
          const roster = rosterOf(wanted, cur.roster);
          out.slots.push({ slot, name, tag: cur.tag || want.tag, roster, only: "roster" });
          slots[slot - 1] = { ...cur, roster };
          seen.rosters[slot] = setKey(wanted);
        } else if (before2 === undefined) seen.rosters[slot] = now;
      }
      seen.slots[slot] = name;
    });
  });

  const rounds = [...roundsFor(size)];
  const scores = { ...site.scores };
  const finalRound = rounds.length;
  const idsFor = (r) => (r.round === finalRound ? [r.n === 2 ? matchId(THIRD.key, 0) : matchId("gf", 0)] : rounds[r.round - 1] ? [matchId(rounds[r.round - 1].key, r.n - 1)] : []);
  for (let ri = 1; ri <= finalRound; ri++) {
    const list = rows.filter((r) => r.round === ri);
    const { byId } = buildBracket(slots, scores, site.bo);
    for (const r of list) {
      const sa = pidSlot[r.a.pid];
      const sb = pidSlot[r.b.pid];
      let id = idsFor(r)[0];
      // the last round holds the final and the third place match: its teams say which is which
      if (ri === finalRound && sa && sb) {
        const both = [matchId("gf", 0), matchId(THIRD.key, 0)].find((x) => byId[x] && [byId[x].a, byId[x].b].includes(sa) && [byId[x].a, byId[x].b].includes(sb));
        if (both) id = both;
      }
      const m = id && byId[id];
      if (!m) continue;
      const iso = r.at ? cleanTime(r.at) : "";
      if (iso) {
        const have = (site.times || {})[id] || "";
        const had = last.times && last.times[id];
        if (have === iso) seen.times[id] = iso;
        else if ((!have && had === undefined) || have === had) { out.times.push({ id, at: iso }); seen.times[id] = iso; }
        else { out.kept.push(id); if (had !== undefined) seen.times[id] = had; }
      } else if (last.times && last.times[id]) seen.times[id] = last.times[id];

      const has = scores[id];
      const lastScore = last.scores && last.scores[id];
      const won = r.a.result === "win" || r.b.result === "win";
      const fits = sa && sb && m.a && m.b && [m.a, m.b].includes(sa) && [m.a, m.b].includes(sb);
      if (won && !fits) { out.mismatch++; if (lastScore) seen.scores[id] = lastScore; continue; }
      if (won) {
        const na = m.a === sa ? r.a : r.b;
        const nb = m.a === sa ? r.b : r.a;
        let va = na.score;
        let vb = nb.score;
        let note = "";
        const given = va != null && vb != null;
        const forfeit = na.forfeit || nb.forfeit;
        // vlr.gg's score in maps, when it names the same winner, is the one to keep
        const fromVlr = (site.vlr || {})[id];
        if (!forfeit && fromVlr && (na.result === "win") === (fromVlr.sa > fromVlr.sb) && !checkScore(m, fromVlr.sa, fromVlr.sb)) {
          va = fromVlr.sa;
          vb = fromVlr.sb;
        } else if (forfeit || !given || checkScore(m, va, vb) || (na.result === "win") !== (va > vb)) {
          // the bracket needs a winner in maps; the note says what really happened
          note = forfeit ? "ff" : given && (na.result === "win") === (va > vb) ? `raw:${va}-${vb}` : "win";
          if (note === "win") out.guessed++;
          const need = needWins(m.bo);
          va = na.result === "win" ? need : 0;
          vb = na.result === "win" ? 0 : need;
        }
        const next = { a: m.a, b: m.b, sa: va, sb: vb };
        const key = scoreKey(next);
        if (has && scoreKey(has) !== key && scoreKey(has) !== lastScore) { out.kept.push(id); if (lastScore) seen.scores[id] = lastScore; continue; }
        if (!has || scoreKey(has) !== key) out.scores.push({ id, ...next });
        scores[id] = next;
        seen.scores[id] = key;
        const noted = (site.notes || {})[id] || "";
        if (noted !== note) out.notes.push({ id, value: note ? `${key}|${note}` : "" });
      } else if (has) {
        if (scoreKey(has) === lastScore) { delete scores[id]; out.dropped.push(id); } else if (lastScore) seen.scores[id] = lastScore;
      }

      const running = r.status === "running" && !won && sa && sb;
      if (running) {
        if (!(site.live || {})[id]) out.liveOn.push(id);
        seen.live[id] = 1;
      } else if ((site.live || {})[id] && last.live && last.live[id]) out.liveOff.push(id);
    }
  }
  // a corrected result takes with it what it led to
  for (let pass = 0; pass < 10; pass++) {
    const { byId } = buildBracket(slots, scores, site.bo);
    let gone = 0;
    for (const [id, s] of Object.entries(scores)) {
      const m = byId[id];
      if (!m || m.a !== s.a || m.b !== s.b || m.winner == null) {
        delete scores[id];
        if (!out.dropped.includes(id)) out.dropped.push(id);
        out.scores = out.scores.filter((x) => x.id !== id);
        delete seen.scores[id];
        gone++;
      }
    }
    if (!gone) break;
  }
  out.logos = teams ? Object.fromEntries(Object.values(teams).filter((t) => t.logo).map((t) => [(alias[t.name] || t).name, t.logo])) : null;
  return out;
}

/** Writes a plan. Kept out of "undo": undoing would only make the next round see a change by hand. */
export function applySync(db, event, plan, saveItem) {
  const changes = plan.notes.length + plan.slots.length + plan.scores.length + plan.dropped.length + plan.times.length + plan.liveOn.length + plan.liveOff.length;
  db.transaction(() => {
    db.prepare("UPDATE undostate SET off = 1").run();
    if (plan.resize) db.prepare("INSERT INTO kv (\"key\", value) VALUES (?, ?) ON CONFLICT (\"key\") DO UPDATE SET value = excluded.value").run(`qbo:${event}:size`, String(plan.size));
    // the rounds before the Round of 64 (256 or 512 places) are played like it (Bo3 for the Europe qualifiers), unless set already
    const r64 = db.prepare("SELECT value FROM kv WHERE key = ?").get(`qbo:${event}:r64`);
    if (r64) for (const r of roundsFor(plan.size)) db.prepare("INSERT OR IGNORE INTO kv (key, value) VALUES (?, ?)").run(`qbo:${event}:${r.key}`, r64.value);
    const slot = db.prepare("INSERT INTO qslots (event, slot, name, roster, staff, tag) VALUES (?, ?, ?, ?, '', ?) ON CONFLICT (event, slot) DO UPDATE SET name = excluded.name, roster = excluded.roster, tag = excluded.tag");
    for (const s of plan.slots) slot.run(event, s.slot, s.name, s.roster, s.tag || "");
    const score = db.prepare("INSERT INTO qscores (event, id, a, b, sa, sb) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET a = excluded.a, b = excluded.b, sa = excluded.sa, sb = excluded.sb");
    for (const s of plan.dropped) db.prepare("DELETE FROM qscores WHERE event = ? AND id = ?").run(event, s);
    for (const s of plan.scores) score.run(event, s.id, s.a, s.b, s.sa, s.sb);
    const note = db.prepare("INSERT INTO kv (\"key\", value) VALUES (?, ?) ON CONFLICT (\"key\") DO UPDATE SET value = excluded.value");
    for (const n of plan.notes) {
      if (n.value) note.run(`qbo:${event}:note:${n.id}`, n.value);
      else db.prepare("DELETE FROM kv WHERE key = ?").run(`qbo:${event}:note:${n.id}`);
    }
    const time = db.prepare("INSERT INTO mtimes (event, id, at) VALUES (?, ?, ?) ON CONFLICT (event, id) DO UPDATE SET at = excluded.at");
    for (const t of plan.times) time.run(event, t.id, t.at);
    for (const id of plan.liveOn) db.prepare("INSERT INTO mlive (event, id, la, lb) VALUES (?, ?, 0, 0) ON CONFLICT (event, id) DO NOTHING").run(event, id);
    for (const id of plan.liveOff) db.prepare("DELETE FROM mlive WHERE event = ? AND id = ?").run(event, id);
    db.prepare("UPDATE undostate SET off = 0").run();
  })();
  saveItem("tsync", event, plan.snapshot, db);
  if (plan.logos) saveItem("tsync_logos", event, plan.logos, db);
  return changes;
}

async function pages(path) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${API}/${path}&offset=${offset}&limit=${PAGE}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Toornament answered ${res.status}`);
    const j = await res.json();
    const list = Object.values(Array.isArray(j) ? j : j.items || j.data || j);
    out.push(...list);
    if (list.length < PAGE) return out;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** How often an event is read: every minute around its matches, every few hours otherwise. */
export function syncDue(meta, now = Date.now()) {
  if (!meta || !meta.at) return true;
  const hot = meta.first && now > new Date(meta.first).getTime() - 2 * 3600000 && now < new Date(meta.lastAt).getTime() + 12 * 3600000;
  return now - new Date(meta.at).getTime() >= (hot ? HOT_EVERY : COLD_EVERY);
}

/** vlr.gg's scores in maps for an event: { id: { sa, sb } }, sides as on the site. */
export function vlrScores(items, event) {
  const out = {};
  for (const [key, v] of Object.entries(items || {})) {
    const [e, id] = key.split(":");
    if (e === event && id && v && v.score) out[id] = v.score;
  }
  return out;
}

/**
 * The event's start and end dates, as Toornament gives them, every 6 hours. A date an editor typed since the last one written here stays.
 * Writes meta.dates (what was written) and meta.datesAt; the caller saves meta.
 */
async function followDates(db, event, meta, now) {
  if (meta.datesAt && now - new Date(meta.datesAt).getTime() < 6 * 3600000) return;
  meta.datesAt = new Date(now).toISOString();
  const res = await fetch(`${API}/tournaments/${TOORNAMENT[event]}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return;
  const t = await res.json();
  const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") && !String(s).startsWith("000") ? s : "");
  const start = day(t.scheduledDateStart);
  const end = day(t.scheduledDateEnd);
  if (!start) return;
  const { getEventInfo, setEventInfo } = await import("./db.js");
  const info = getEventInfo(db)[event];
  if (!info) return;
  const last = meta.dates || null;
  const mine = (v, k) => !v || !last || v === last[k];
  const next = { start: mine(info.start, "start") ? start : info.start, end: mine(info.end, "end") ? end || info.end : info.end };
  if (next.start !== info.start || next.end !== info.end) setEventInfo(db, { event, ...info, ...next });
  meta.dates = { start, end };
}

/** One round, for the event that has waited longest. At most one event every 30 seconds, whoever calls. Returns how many things changed. */
export async function syncIfDue(now = Date.now()) {
  const { getDb, getMatchTimes, getQualifier, getMatchLive } = await import("./db.js");
  const { readItems, saveItem, takeTurn } = await import("./lpstore.js");
  const { recordAction } = await import("./undo.js");
  const db = getDb();
  const metas = readItems("tsync_meta", db);
  const event = Object.keys(TOORNAMENT).filter((e) => syncDue(metas[e], now)).sort((a, b) => ((metas[a] && metas[a].at) || "").localeCompare((metas[b] && metas[b].at) || ""))[0];
  if (!event || !takeTurn("tsync", now, db)) return 0;
  const meta = metas[event] || {};
  const stamp = new Date(now).toISOString();
  try {
    await followDates(db, event, meta, now);
    const rows = (await pages(`matches?tournament_ids=${TOORNAMENT[event]}&sort=scheduled_asc`)).map(readMatch);
    const hash = crypto.createHash("sha1").update(JSON.stringify(rows)).digest("hex");
    const times = rows.map((r) => r.at).filter(Boolean).sort();
    const nextMeta = { ...meta, at: stamp, first: times[0] || "", lastAt: times[times.length - 1] || "", error: "", dates: meta.dates, datesAt: meta.datesAt };
    const needTeams = rows.length > 0 && (!meta.teamsAt || now - new Date(meta.teamsAt).getTime() >= TEAMS_EVERY);
    if (hash === meta.hash && !needTeams) { saveItem("tsync_meta", event, nextMeta, db); return 0; }
    let teams = null;
    if (needTeams) {
      teams = Object.fromEntries((await pages(`participants?tournament_ids=${TOORNAMENT[event]}&sort=alphabetic`)).map(readParticipant).map((t) => [t.pid, t]));
      nextMeta.teamsAt = stamp;
    }
    const plan = planSync({ event, rows, teams, site: { ...getQualifier(db, event), times: getMatchTimes(db)[event] || {}, live: getMatchLive(db)[event] || {}, vlr: vlrScores(readItems("vlr_match", db), event) }, last: readItems("tsync", db)[event] || {} });
    if (!plan) { saveItem("tsync_meta", event, { ...nextMeta, hash }, db); return 0; }
    if (plan.blocked) { saveItem("tsync_meta", event, { ...nextMeta, hash: "", error: plan.blocked }, db); return 0; }
    const changed = applySync(db, event, plan, saveItem);
    saveItem("tsync_meta", event, { ...nextMeta, hash, changedAt: changed ? stamp : meta.changedAt || "", guessed: plan.guessed, kept: plan.kept.length, mismatch: plan.mismatch, teams: plan.snapshot.slots ? Object.keys(plan.snapshot.slots).length : 0 }, db);
    if (changed) recordAction(db, `Toornament: ${event} updated (${changed}).`, "Toornament");
    return changed;
  } catch (e) {
    console.log(`[toornament] ${event}: ${e.message}`);
    saveItem("tsync_meta", event, { ...meta, at: stamp, error: e.message.slice(0, 120) }, db);
    return 0;
  }
}
