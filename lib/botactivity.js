// The bot dashboard's activity and members (app/api/bot/route.js, components/BotPages.jsx): arrivals and departures counted
// per day, the server's last 30 days (with the 30 before, to compare), a member's file (sanctions, notes, tickets, teams
// followed), how often each command shown in the editor was used. Pure but for db.
import { GROUPS, RENAMED_SITE } from "./botdash.js";
import { activeOf } from "./botadmin.js";

const ready = new WeakSet();
/** The daily arrivals and departures' table, made once per database. */
export function fillActivity(db) {
  if (ready.has(db)) return;
  db.exec("CREATE TABLE IF NOT EXISTS bot_members_daily (guild TEXT NOT NULL, day TEXT NOT NULL, joins INTEGER NOT NULL DEFAULT 0, leaves INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (guild, day))");
  ready.add(db);
}

/** One arrival ("join") or departure ("leave") on the server, counted on its day (UTC). Never throws. */
export function countMember(db, guild, kind, now = Date.now()) {
  if (!db || !guild || (kind !== "join" && kind !== "leave")) return;
  try {
    fillActivity(db);
    const col = kind === "join" ? "joins" : "leaves";
    db.prepare(`INSERT INTO bot_members_daily (guild, day, ${col}) VALUES (?, ?, 1) ON CONFLICT (guild, day) DO UPDATE SET ${col} = ${col} + 1`).run(guild, new Date(now).toISOString().slice(0, 10));
  } catch { /* the count is a convenience */ }
}

const dayOf = (now, back) => new Date(now - back * 86400000).toISOString().slice(0, 10);
// what counts as a sanction in the activity: not the notes, nor the bans lifted
const PUNISH = "kind IN ('warn','timeout','kick','ban','tempban')";

/**
 * The server's activity: { days: [{ day, joins, leaves, sanctions, tickets, commands }] (the last `span` days, oldest
 * first), totals, before (the same totals over the `span` days before), recentCases (6), recentTickets (5), counted }.
 * counted: the first day arrivals were counted (they are not known before).
 */
export function serverActivity(db, guild, now = Date.now(), span = 30) {
  fillActivity(db);
  const start = dayOf(now, span - 1);
  const prev = dayOf(now, 2 * span - 1);
  const keyed = (rows) => Object.fromEntries(rows.map((r) => [r.day, r]));
  const members = keyed(db.prepare("SELECT day, joins, leaves FROM bot_members_daily WHERE guild = ? AND day >= ?").all(guild, prev));
  const sanctions = keyed(db.prepare(`SELECT substr(at, 1, 10) AS day, COUNT(*) AS n FROM bot_sanctions WHERE guild = ? AND ${PUNISH} AND at >= ? GROUP BY day`).all(guild, prev));
  const tickets = keyed(db.prepare("SELECT substr(opened, 1, 10) AS day, COUNT(*) AS n FROM bot_tickets WHERE guild = ? AND opened >= ? GROUP BY day").all(guild, prev));
  const commands = keyed(db.prepare("SELECT day, SUM(n) AS n FROM bot_usage WHERE day >= ? AND cmd NOT IN ('pronostic-clic','suivre-bouton','devine-reponse') GROUP BY day").all(prev));
  const row = (day) => ({ day, joins: (members[day] || {}).joins || 0, leaves: (members[day] || {}).leaves || 0, sanctions: (sanctions[day] || {}).n || 0, tickets: (tickets[day] || {}).n || 0, commands: (commands[day] || {}).n || 0 });
  const all = Array.from({ length: 2 * span }, (_, i) => row(dayOf(now, 2 * span - 1 - i)));
  const sum = (list) => list.reduce((t, d) => ({ joins: t.joins + d.joins, leaves: t.leaves + d.leaves, sanctions: t.sanctions + d.sanctions, tickets: t.tickets + d.tickets, commands: t.commands + d.commands }), { joins: 0, leaves: 0, sanctions: 0, tickets: 0, commands: 0 });
  const days = all.slice(span);
  const first = db.prepare("SELECT MIN(day) AS day FROM bot_members_daily WHERE guild = ?").get(guild);
  return {
    days, totals: sum(days), before: sum(all.slice(0, span)), start,
    counted: (first && first.day) || "",
    recentCases: db.prepare("SELECT id, user, kind, mod, reason, at, until, done FROM bot_sanctions WHERE guild = ? ORDER BY id DESC LIMIT 6").all(guild).map((r) => ({ ...r, active: activeOf(r, now) })),
    recentTickets: db.prepare("SELECT thread, user, subject, opened, closed, claimed FROM bot_tickets WHERE guild = ? ORDER BY opened DESC LIMIT 5").all(guild),
  };
}

/** A member's id from what an editor types: an id, a mention <@123>, a link ending with it. "" if none. */
export function memberId(q) {
  const m = String(q || "").match(/(?:<@!?)?(\d{17,21})>?\s*$/);
  return m ? m[1] : "";
}

/**
 * A member's file on the server: { id, sanctions (newest first, notes included), counts by kind, active (running
 * sanctions), tickets, follows (teams followed in private messages), seen (when the bot first saw them use it) }.
 */
export function memberFile(db, guild, id, now = Date.now()) {
  const sanctions = db.prepare("SELECT id, user, kind, mod, reason, at, until, done FROM bot_sanctions WHERE guild = ? AND user = ? ORDER BY id DESC").all(guild, id).map((r) => ({ ...r, active: activeOf(r, now) }));
  const counts = {};
  for (const r of sanctions) counts[r.kind] = (counts[r.kind] || 0) + 1;
  let seen = "";
  try { seen = (db.prepare("SELECT at FROM bot_guild_users WHERE guild = ? AND user = ?").get(guild, id) || {}).at || ""; } catch { /* table not made yet */ }
  return {
    id, sanctions, counts,
    active: sanctions.filter((r) => r.active && r.kind !== "warn"),
    tickets: db.prepare("SELECT thread, subject, opened, closed, category, claimed, rating, length(transcript) AS size FROM bot_tickets WHERE guild = ? AND user = ? ORDER BY opened DESC").all(guild, id),
    follows: db.prepare("SELECT name, at FROM bot_follows WHERE user = ? ORDER BY name").all(id),
    seen,
  };
}

/** The account's creation date from a Discord id (ISO), "" if it is not one. Pure. */
export function createdAt(id) {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString(); } catch { return ""; }
}

/**
 * How often each command the editor shows was used over the last `span` days: { name: n }, the grouped ones summing their
 * subcommands (counted under the names they stand for), the site's /meilleurs under its former /role.
 */
export function commandUsage(db, now = Date.now(), span = 30) {
  const raw = Object.fromEntries(db.prepare("SELECT cmd, SUM(n) AS n FROM bot_usage WHERE day >= ? GROUP BY cmd").all(dayOf(now, span - 1)).map((r) => [r.cmd, r.n]));
  const out = { ...raw };
  const inner = new Set();
  for (const [name, g] of Object.entries(GROUPS)) {
    const subs = Object.values(g.subs);
    subs.forEach((s) => inner.add(s));
    out[name] = subs.reduce((t, s) => t + (raw[s] || 0), 0);
  }
  for (const [shown, old] of Object.entries(RENAMED_SITE)) out[shown] = raw[old] || 0;
  for (const s of inner) if (!GROUPS[s] && !(s in RENAMED_SITE)) delete out[s];
  // /close is still its own command too: its uses are those of /ticket close
  if (raw.close) out.close = raw.close;
  return out;
}

/**
 * The members to keep an eye on: those with a sanction running (time-out, ban) or 2 warnings or more in the last 30 days.
 * [{ user, warns30, total, running: [kinds], last }], the most warned first, 30 at most.
 */
export function watchList(db, guild, now = Date.now()) {
  const since = new Date(now - 30 * 86400000).toISOString();
  const rows = db.prepare("SELECT id, user, kind, at, until, done FROM bot_sanctions WHERE guild = ? AND kind IN ('warn','timeout','kick','ban','tempban') ORDER BY id DESC LIMIT 3000").all(guild);
  const by = new Map();
  for (const r of rows) {
    const m = by.get(r.user) || { user: r.user, warns30: 0, total: 0, running: [], last: r.at };
    m.total += 1;
    if (r.kind === "warn" && r.at >= since) m.warns30 += 1;
    if (r.kind !== "warn" && activeOf(r, now) && !m.running.includes(r.kind)) m.running.push(r.kind);
    if (r.at > m.last) m.last = r.at;
    by.set(r.user, m);
  }
  return [...by.values()].filter((m) => m.running.length || m.warns30 >= 2).sort((a, b) => b.running.length - a.running.length || b.warns30 - a.warns30 || b.last.localeCompare(a.last)).slice(0, 30);
}

/**
 * What the team should look at now: open tickets nobody took (oldest first, with their age), time-outs and temporary
 * bans ending within a day. { unclaimed: [{ thread, user, subject, opened }], ending: [{ id, user, kind, until }] }.
 */
export function todoOf(db, guild, now = Date.now()) {
  const unclaimed = db.prepare("SELECT thread, user, subject, opened FROM bot_tickets WHERE guild = ? AND closed = '' AND claimed = '' ORDER BY opened LIMIT 10").all(guild);
  const soon = new Date(now + 86400000).toISOString();
  const ending = db.prepare("SELECT id, user, kind, until, done FROM bot_sanctions WHERE guild = ? AND kind IN ('timeout','tempban') AND until != '' AND until <= ? ORDER BY until LIMIT 40").all(guild, soon)
    .filter((r) => !r.done && Date.parse(r.until) > now).slice(0, 10).map(({ done: _d, ...r }) => r);
  return { unclaimed, ending };
}
