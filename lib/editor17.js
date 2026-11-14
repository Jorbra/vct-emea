// Round 17, for the editors: the syncs' log (what Toornament and vlr.gg changed, line by line), the teams' names as the
// site writes them when Toornament writes them another way, and news written now to be published later.
// All kept in kv; nothing here is shown to visitors except the news once published.

const kvGet = (db, key, fallback) => {
  try { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key); return r ? JSON.parse(r.value) : fallback; } catch { return fallback; }
};
const kvSet = (db, key, value) => db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));

// ---- the syncs' log

/** Adds lines to the log: [{ source: "Toornament" | "vlr.gg", event, text }]. The 150 latest are kept. Never throws. */
export function logSync(db, lines, now = Date.now()) {
  if (!lines || !lines.length) return;
  try {
    const at = new Date(now).toISOString();
    const list = kvGet(db, "sync_log", []);
    kvSet(db, "sync_log", [...list, ...lines.map((l) => ({ at, source: l.source, event: l.event, text: String(l.text).slice(0, 200) }))].slice(-150));
  } catch { /* the log is a convenience */ }
}
export const readSyncLog = (db) => kvGet(db, "sync_log", []).slice().reverse();

/** What a Toornament round changed, in words, from its plan. Pure. */
export function planLines(event, plan) {
  const out = [];
  for (const s of plan.slots || []) out.push({ source: "Toornament", event, text: s.name ? `Slot ${s.slot}: ${s.name}` : `Slot ${s.slot} emptied` });
  for (const s of plan.scores || []) out.push({ source: "Toornament", event, text: `Score ${s.id}: ${s.sa}-${s.sb}` });
  for (const s of plan.times || []) out.push({ source: "Toornament", event, text: `Time ${s.id}: ${s.at ? s.at.slice(0, 16).replace("T", " ") : "removed"}` });
  for (const id of plan.liveOn || []) out.push({ source: "Toornament", event, text: `Live: ${typeof id === "string" ? id : id.id}` });
  for (const id of plan.liveOff || []) out.push({ source: "Toornament", event, text: `No longer live: ${typeof id === "string" ? id : id.id}` });
  for (const s of plan.dropped || []) out.push({ source: "Toornament", event, text: `Score removed: ${typeof s === "string" ? s : s.id}` });
  return out.slice(0, 40);
}

// ---- teams' names

/** The editors' names: { "name on Toornament": { name, tag } }. */
export const readTeamAliases = (db) => kvGet(db, "team_aliases", {});

/** Sets (or, with an empty name, removes) one name. */
export function saveTeamAlias(db, { from, name = "", tag = "" }) {
  const f = String(from || "").trim().slice(0, 60);
  const n = String(name || "").trim().slice(0, 60);
  if (!f) return { ok: false, status: 400, error: "Write the name as Toornament gives it." };
  const all = readTeamAliases(db);
  if (n) all[f] = { name: n, tag: String(tag || "").trim().slice(0, 8) }; else delete all[f];
  kvSet(db, "team_aliases", all);
  return { ok: true, aliases: all };
}

// ---- news to publish later

export const readScheduledNews = (db) => kvGet(db, "news_scheduled", []);

/** Keeps a news item to publish at a time (ISO, in the future). */
export function scheduleNews(db, { title, body, at, who = "" }, now = Date.now()) {
  const t = String(title ?? "").trim();
  const b = String(body ?? "").trim();
  const when = new Date(at);
  if (!t || t.length > 120) return { ok: false, status: 400, error: "A title has 1 to 120 characters." };
  if (!b || b.length > 10000) return { ok: false, status: 400, error: "A text has 1 to 10000 characters." };
  if (Number.isNaN(when.getTime()) || when.getTime() < now + 60000) return { ok: false, status: 400, error: "Pick a time at least a minute from now." };
  const list = readScheduledNews(db);
  const id = `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  kvSet(db, "news_scheduled", [...list, { id, title: t, body: b, at: when.toISOString(), who }].sort((x, y) => x.at.localeCompare(y.at)).slice(0, 30));
  return { ok: true, id, message: "News scheduled." };
}

export function cancelScheduledNews(db, id) {
  const list = readScheduledNews(db);
  if (!list.some((x) => x.id === id)) return { ok: false, status: 404, error: "Unknown news." };
  kvSet(db, "news_scheduled", list.filter((x) => x.id !== id));
  return { ok: true };
}

/** The news whose time came: taken out of the list (to be published by the caller). */
export function takeDueNews(db, now = Date.now()) {
  const list = readScheduledNews(db);
  const due = list.filter((x) => new Date(x.at).getTime() <= now);
  if (due.length) kvSet(db, "news_scheduled", list.filter((x) => !due.includes(x)));
  return due;
}
