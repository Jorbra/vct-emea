// What the Discord bot keeps: its settings (set in the editor), the commands' use, who follows which team, and the Discord users
// tied to a name of the predictions.
import crypto from "node:crypto";

export function fillBot(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS bot_usage (day TEXT NOT NULL, cmd TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, cmd));
    CREATE TABLE IF NOT EXISTS bot_users (hash TEXT PRIMARY KEY, first TEXT NOT NULL, last TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS bot_follows (user TEXT NOT NULL, team TEXT NOT NULL, name TEXT NOT NULL, dm TEXT NOT NULL DEFAULT '', at TEXT NOT NULL, PRIMARY KEY (user, team));
    CREATE TABLE IF NOT EXISTS bot_links (user TEXT PRIMARY KEY, hash TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_codes (code TEXT PRIMARY KEY, hash TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_sent ("key" TEXT PRIMARY KEY, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bot_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS bot_sched (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, channel TEXT NOT NULL, payload TEXT NOT NULL, label TEXT NOT NULL, who TEXT NOT NULL DEFAULT '', sent TEXT NOT NULL DEFAULT '');`);
}

export const BOT_COMMANDS = ["rappel", "duel", "cartedujour", "devine", "classementjeu", "score", "prochain", "classement", "equipe", "joueur", "bracket", "match", "live", "top", "lft", "suivre", "pronostic", "lier", "carte", "compare", "h2h", "agent", "records", "recap", "calendrier", "mesprono", "puissance", "profil", "fantasy", "rappelprono", "jeux", "simule", "tierlist", "quiz", "palmares", "forme", "aide"];
const EVENTS = ["q1", "q2", "playoffs", "trq1", "trq2", "tr", "meq1", "meq2", "naq1", "naq2", "mena", "kickoff", "gc"];

/** The settings, with their defaults: nothing is posted by the bot until a channel is chosen. */
export function botSettings(db) {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'bot_settings'").get();
  let s = {};
  try { s = row ? JSON.parse(row.value) : {}; } catch { /* defaults */ }
  return {
    lang: s.lang === "en" ? "en" : "fr",
    guild: s.guild || "",
    channel: s.channel || "",
    announce: { start: true, result: true, image: true, transfers: false, news: true, ...(s.announce || {}) },
    events: Object.fromEntries(EVENTS.map((e) => [e, !(s.events && s.events[e] === false)])),
    role: s.role || "",
    roleWhen: ["none", "final", "all"].includes(s.roleWhen) ? s.roleWhen : "none",
    pinChannel: s.pinChannel || "",
    resultChannel: s.resultChannel || "",
    transferChannel: s.transferChannel || "",
    auto: { reminder: false, daily: false, weekly: false, liveEdit: false, polls: false, fanRoles: false, recap: false, threadMaps: false, oracle: false, games: false, weekRecap: false, pronoDm: false, qualified: false, motd: false, ...(s.auto || {}) },
    threads: ["none", "final", "all"].includes(s.threads) ? s.threads : "none",
    disabled: Array.isArray(s.disabled) ? s.disabled.filter((c) => BOT_COMMANDS.includes(c)) : [],
  };
}

const snowflake = (v) => (/^\d{5,25}$/.test(String(v || "")) ? String(v) : "");

/** Saves what the editor chose; only known fields, ids as Discord writes them. */
export function saveBotSettings(db, raw) {
  const cur = botSettings(db);
  const next = {
    lang: raw.lang === "en" ? "en" : raw.lang === "fr" ? "fr" : cur.lang,
    guild: raw.guild !== undefined ? snowflake(raw.guild) : cur.guild,
    channel: raw.channel !== undefined ? snowflake(raw.channel) : cur.channel,
    announce: Object.fromEntries(Object.keys(cur.announce).map((k) => [k, raw.announce && typeof raw.announce[k] === "boolean" ? raw.announce[k] : cur.announce[k]])),
    events: Object.fromEntries(EVENTS.map((e) => [e, raw.events && typeof raw.events[e] === "boolean" ? raw.events[e] : cur.events[e]])),
    role: raw.role !== undefined ? snowflake(raw.role) : cur.role,
    roleWhen: ["none", "final", "all"].includes(raw.roleWhen) ? raw.roleWhen : cur.roleWhen,
    pinChannel: raw.pinChannel !== undefined ? snowflake(raw.pinChannel) : cur.pinChannel,
    resultChannel: raw.resultChannel !== undefined ? snowflake(raw.resultChannel) : cur.resultChannel,
    transferChannel: raw.transferChannel !== undefined ? snowflake(raw.transferChannel) : cur.transferChannel,
    auto: Object.fromEntries(Object.keys(cur.auto).map((k) => [k, raw.auto && typeof raw.auto[k] === "boolean" ? raw.auto[k] : cur.auto[k]])),
    threads: ["none", "final", "all"].includes(raw.threads) ? raw.threads : cur.threads,
    disabled: Array.isArray(raw.disabled) ? raw.disabled.filter((c) => BOT_COMMANDS.includes(c)) : cur.disabled,
  };
  db.prepare("INSERT INTO kv (key, value) VALUES ('bot_settings', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
  return { ok: true, message: "Bot settings saved.", settings: next };
}

const userHash = (id) => crypto.createHash("sha256").update(`discord-user:${id}`).digest("hex");

/** One use of a command: counted per day, and its user as a hash only. */
export function countUse(db, cmd, userId, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const at = new Date(now).toISOString();
  db.prepare("INSERT INTO bot_usage (day, cmd, n) VALUES (?, ?, 1) ON CONFLICT (day, cmd) DO UPDATE SET n = n + 1").run(day, cmd);
  if (userId) db.prepare("INSERT INTO bot_users (hash, first, last, n) VALUES (?, ?, ?, 1) ON CONFLICT (hash) DO UPDATE SET last = excluded.last, n = n + 1").run(userHash(userId), at, at);
}

/** For the editor: { total, users, week, byCmd: [{ cmd, n }], days: [{ day, n }] (last 14) }. */
export function botUsage(db, now = Date.now()) {
  const day = (d) => new Date(now - d * 86400000).toISOString().slice(0, 10);
  const byCmd = db.prepare("SELECT cmd, SUM(n) AS n FROM bot_usage WHERE day >= ? GROUP BY cmd ORDER BY n DESC").all(day(29));
  const per = Object.fromEntries(db.prepare("SELECT day, SUM(n) AS n FROM bot_usage WHERE day >= ? GROUP BY day").all(day(13)).map((r) => [r.day, r.n]));
  const days = Array.from({ length: 14 }, (_, i) => ({ day: day(13 - i), n: per[day(13 - i)] || 0 }));
  return {
    total: byCmd.reduce((s, r) => s + r.n, 0),
    users: db.prepare("SELECT COUNT(*) AS n FROM bot_users WHERE last >= ?").get(day(29)).n,
    week: days.slice(7).reduce((s, d) => s + d.n, 0),
    byCmd, days,
    follows: db.prepare("SELECT COUNT(*) AS n FROM bot_follows").get().n,
    topFollows: db.prepare("SELECT name, COUNT(*) AS n FROM bot_follows GROUP BY team ORDER BY n DESC, name LIMIT 10").all(),
    clicks: db.prepare("SELECT COALESCE(SUM(n), 0) AS n FROM bot_usage WHERE cmd = 'pronostic-clic' AND day >= ?").get(day(29)).n,
    links: db.prepare("SELECT COUNT(*) AS n FROM bot_links").get().n,
  };
}

// ---- following a team in private messages

export function toggleFollow(db, userId, team, name, now = Date.now()) {
  if (db.prepare("SELECT 1 FROM bot_follows WHERE user = ? AND team = ?").get(userId, team)) {
    db.prepare("DELETE FROM bot_follows WHERE user = ? AND team = ?").run(userId, team);
    return false;
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM bot_follows WHERE user = ?").get(userId).n >= 20) return null;
  db.prepare("INSERT INTO bot_follows (user, team, name, at) VALUES (?, ?, ?, ?)").run(userId, team, name, new Date(now).toISOString());
  return true;
}

export const followsOf = (db, userId) => db.prepare("SELECT team, name FROM bot_follows WHERE user = ? ORDER BY name").all(userId);
export const followersOf = (db, teams) => (teams.length ? db.prepare(`SELECT DISTINCT user, dm FROM bot_follows WHERE team IN (${teams.map(() => "?").join(",")})`).all(...teams) : []);
export const saveDmChannel = (db, userId, dm) => db.prepare("UPDATE bot_follows SET dm = ? WHERE user = ?").run(dm, userId);

// ---- the predictions from Discord: a Discord user plays under a name of the site

/** The voter's hash a Discord user plays with: the one they tied to their name, or their own. */
export function discordVoter(db, userId, secret) {
  const link = db.prepare("SELECT hash FROM bot_links WHERE user = ?").get(userId);
  if (link) return link.hash;
  return crypto.createHash("sha256").update(`discord-voter:${secret || "vct"}:${userId}`).digest("hex");
}

/** A code shown on the site, to tie a Discord user to the visitor's name: 6 characters, 15 minutes. */
export function makeLinkCode(db, hash, now = Date.now()) {
  db.prepare("DELETE FROM bot_codes WHERE at < ? OR hash = ?").run(new Date(now - 15 * 60000).toISOString(), hash);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(crypto.randomBytes(6), (b) => chars[b % chars.length]).join("");
  db.prepare("INSERT INTO bot_codes (code, hash, at) VALUES (?, ?, ?)").run(code, hash, new Date(now).toISOString());
  return code;
}

/** /lier: the code ties the Discord user to that name. Returns the name, or "" when the code is unknown or too old. */
export function useLinkCode(db, userId, code, now = Date.now()) {
  const row = db.prepare("SELECT hash, at FROM bot_codes WHERE code = ?").get(String(code || "").trim().toUpperCase());
  if (!row || now - new Date(row.at).getTime() > 15 * 60000) return "";
  db.prepare("DELETE FROM bot_codes WHERE code = ?").run(String(code).trim().toUpperCase());
  db.prepare("INSERT INTO bot_links (user, hash, at) VALUES (?, ?, ?) ON CONFLICT (user) DO UPDATE SET hash = excluded.hash, at = excluded.at").run(userId, row.hash, new Date(now).toISOString());
  const v = db.prepare("SELECT name FROM voters WHERE hash = ?").get(row.hash);
  return v ? v.name : "?";
}

// ---- sent once: reminders, summaries (the key says what and when)
export function sendOnce(db, key, now = Date.now()) {
  return db.prepare('INSERT OR IGNORE INTO bot_sent ("key", at) VALUES (?, ?)').run(key, new Date(now).toISOString()).changes === 1;
}

// ---- the bot's log, for the editor: the last 200 lines are kept
export function logBot(db, kind, text, ok = true, now = Date.now()) {
  try {
    db.prepare("INSERT INTO bot_log (at, kind, text, ok) VALUES (?, ?, ?, ?)").run(new Date(now).toISOString(), kind, String(text).slice(0, 300), ok ? 1 : 0);
    db.prepare("DELETE FROM bot_log WHERE id <= (SELECT MAX(id) - 200 FROM bot_log)").run();
  } catch { /* the log is a convenience */ }
}
export const botLog = (db, limit = 60) => db.prepare("SELECT at, kind, text, ok FROM bot_log ORDER BY id DESC LIMIT ?").all(limit).map((r) => ({ ...r, ok: !!r.ok }));

// ---- announcements written in the editor and sent later
export function scheduleAnnouncement(db, { at, channel, payload, label, who = "" }, now = Date.now()) {
  const t = new Date(at).getTime();
  if (!Number.isFinite(t) || t < now - 60000) return { ok: false, status: 400, error: "Choose a time to come." };
  if (t > now + 60 * 86400000) return { ok: false, status: 400, error: "60 days ahead at most." };
  if (db.prepare("SELECT COUNT(*) AS n FROM bot_sched WHERE sent = ''").get().n >= 50) return { ok: false, status: 409, error: "50 scheduled announcements at most." };
  db.prepare("INSERT INTO bot_sched (at, channel, payload, label, who) VALUES (?, ?, ?, ?, ?)").run(new Date(t).toISOString(), channel, JSON.stringify(payload), String(label).slice(0, 120), who);
  return { ok: true, message: "Announcement scheduled." };
}
export const scheduledList = (db) => db.prepare("SELECT id, at, channel, label, who FROM bot_sched WHERE sent = '' ORDER BY at").all();
export function cancelScheduled(db, id) {
  const r = db.prepare("DELETE FROM bot_sched WHERE id = ? AND sent = ''").run(Number(id));
  return r.changes ? { ok: true, message: "Scheduled announcement removed." } : { ok: false, status: 404, error: "Unknown announcement." };
}
/** Those whose time has come, marked as sent at once (a second server does not send them again). */
export function takeDueScheduled(db, now = Date.now()) {
  const due = db.prepare("SELECT id, channel, payload, label FROM bot_sched WHERE sent = '' AND at <= ? ORDER BY at LIMIT 5").all(new Date(now).toISOString());
  return due.filter((r) => db.prepare("UPDATE bot_sched SET sent = ? WHERE id = ? AND sent = ''").run(new Date(now).toISOString(), r.id).changes === 1)
    .map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}
