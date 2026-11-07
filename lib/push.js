// Phone and computer alerts through the browsers' push services: they arrive even when the site is closed.
// The server compares the matches with what it already sent, after each editor action and at each regular round. Each visitor's teams come with their subscription.
import webpush from "web-push";
import { alertText, nextAnnouncements } from "./discord.js";
import { readItems, saveItem } from "./lpstore.js";

const fail = (status, error) => ({ ok: false, status, error });
const MAX_SUBS = 20000;

// The server posts to the address a browser gives: only the browsers' own push services are accepted.
const PUSH_HOST = /^(fcm\.googleapis\.com|([\w-]+\.)*push\.services\.mozilla\.com|([\w-]+\.)*push\.apple\.com|([\w-]+\.)*notify\.windows\.com)$/;
export function isPushEndpoint(url) {
  try {
    const u = new URL(url);
    return String(url).length <= 1000 && u.protocol === "https:" && !u.port && PUSH_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** The site's own key pair, made the first time and kept in the database (PUSH_PUBLIC_KEY / PUSH_PRIVATE_KEY replace it). */
export function vapidKeys(db) {
  const { PUSH_PUBLIC_KEY: publicKey, PUSH_PRIVATE_KEY: privateKey } = process.env;
  if (publicKey && privateKey) return { publicKey, privateKey };
  const kept = readItems("meta", db).vapid;
  if (kept) return kept;
  const keys = webpush.generateVAPIDKeys();
  saveItem("meta", "vapid", keys, db);
  return keys;
}

/** Adds a browser, or updates its teams. No team means every match. */
export function savePushSub(db, { endpoint, keys, teams, players, lang, digest = false }) {
  if (!isPushEndpoint(endpoint)) return fail(400, "Unknown push service.");
  const key = (x) => typeof x === "string" && x.length > 0 && x.length <= 200;
  if (!keys || !key(keys.p256dh) || !key(keys.auth)) return fail(400, "Unknown push service.");
  const list = (Array.isArray(teams) ? teams : []).filter((t) => typeof t === "string" && /^[a-z0-9-]{1,60}$/.test(t)).slice(0, 100);
  const followed = (Array.isArray(players) ? players : []).filter((t) => typeof t === "string" && /^[a-z0-9-]{1,60}$/.test(t)).slice(0, 200);
  const language = ["fr", "en", "tr", "ar"].includes(lang) ? lang : "fr";
  const known = db.prepare("SELECT 1 FROM push_subs WHERE endpoint = ?").get(endpoint);
  if (!known && db.prepare("SELECT COUNT(*) AS n FROM push_subs").get().n >= MAX_SUBS) return fail(503, "Too many alerts registered.");
  db.prepare("INSERT INTO push_subs (endpoint, p256dh, auth, teams, lang, players, digest) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, teams = excluded.teams, lang = excluded.lang, players = excluded.players, digest = excluded.digest")
    .run(endpoint, keys.p256dh, keys.auth, JSON.stringify(list), language, JSON.stringify(followed), digest === true ? 1 : 0);
  return { ok: true, message: "Alerts saved." };
}

export function removePushSub(db, endpoint) {
  db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(String(endpoint || ""));
  return { ok: true, message: "Alerts removed." };
}

/**
 * Sends what is new to the browsers that follow one of its teams; a browser that no longer exists is forgotten.
 * The first look only notes what is known already. `send` is replaced in the tests.
 */
export async function sendPushes(db, state, now, send) {
  const fresh = nextAnnouncements(db, state, { table: "pushed", now });
  if (!fresh.length) return 0;
  const subs = db.prepare("SELECT endpoint, p256dh, auth, teams, lang, digest FROM push_subs").all();
  const forget = db.prepare("DELETE FROM push_subs WHERE endpoint = ?");
  let sent = 0;
  const problems = [];
  let skipped = 0;
  for (const a of fresh) {
    for (const s of subs) {
      const teams = JSON.parse(s.teams);
      if ((teams.length && !a.teams.some((t) => teams.includes(t))) || (s.digest && a.kind === "result")) {
        skipped += 1;
        continue;
      }
      try {
        const payload = JSON.stringify({ title: "VCT EMEA", body: alertText(a, s.lang || "fr").replace(/\*\*/g, ""), tag: a.key, url: a.url });
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        const service = (() => { try { return new URL(s.endpoint).hostname; } catch { return "?"; } })();
        problems.push(`${service}: ${e && e.statusCode ? e.statusCode : e && e.message}`.slice(0, 120));
        if (e && (e.statusCode === 404 || e.statusCode === 410)) forget.run(s.endpoint);
        else console.log(`[push] ${e && e.statusCode ? e.statusCode : e && e.message}`);
      }
    }
  }
  // no address of a browser here: only which service answered what, to understand an alert that did not arrive
  saveItem("meta", "push_last", { at: new Date(now).toISOString(), keys: fresh.map((a) => a.key).slice(0, 10), subs: subs.length, sent, skipped, problems: problems.slice(0, 10) }, db);
  return sent;
}

const PLAYER_WORDS = {
  fr: { free: "{name} est libre (a quitté {team})", signed: "{name} rejoint {team}" },
  en: { free: "{name} is a free agent (left {team})", signed: "{name} joins {team}" },
  tr: { free: "{name} serbest oyuncu ({team} takımından ayrıldı)", signed: "{name}, {team} takımına katıldı" },
  ar: { free: "{name} لاعب حر (غادر {team})", signed: "{name} ينضم إلى {team}" },
};

/** A followed player's news: [{ kind: "free" | "signed", slug, name, team, key }], to the browsers following them. */
export async function sendPlayerPushes(db, events, send) {
  if (!events.length) return 0;
  const subs = db.prepare("SELECT endpoint, p256dh, auth, players, lang FROM push_subs WHERE players <> '[]'").all();
  const forget = db.prepare("DELETE FROM push_subs WHERE endpoint = ?");
  let sent = 0;
  for (const ev of events) {
    for (const s of subs) {
      let players = [];
      try { players = JSON.parse(s.players); } catch { /* nothing followed */ }
      if (!players.includes(ev.slug)) continue;
      const words = PLAYER_WORDS[s.lang] || PLAYER_WORDS.fr;
      const body = words[ev.kind].replace("{name}", ev.name).replace("{team}", ev.team || "?");
      try {
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: "VCT EMEA", body, tag: ev.key, url: `/player/${ev.slug}` }));
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) forget.run(s.endpoint);
      }
    }
  }
  return sent;
}

/** The site's problems to the editors' devices, each once. */
export async function healthPushNow(db, problems) {
  if (!problems.length) return 0;
  const { sendHealthAlerts } = await import("./social.js");
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 3600, urgency: "high" };
  const sent = (readItems("meta", db).health_sent || {}).keys || [];
  const next = await sendHealthAlerts(db, problems, sent, (sub, payload) => webpush.sendNotification(sub, payload, options));
  if (next.length !== sent.length) saveItem("meta", "health_sent", { keys: next }, db);
  return next.length - sent.length;
}

/** Sends a followed player's news, with the site's keys. */
export async function playerPushNow(db, events) {
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 86400 };
  return sendPlayerPushes(db, events, (sub, payload) => webpush.sendNotification(sub, payload, options));
}

const DIGEST_WORDS = { fr: "Résultats du jour", en: "Today's results", tr: "Günün sonuçları", ar: "نتائج اليوم" };
const DIGEST_HOUR = 22; // Paris time
const parisDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const parisHour = (d) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(d));

/**
 * The evening summary, once a day after 22:00 Paris time, to the browsers that chose it: the day's results of their teams (of every
 * team when they follow none). Nothing is sent to one with no result that day.
 */
export async function sendDigest(db, state, now, send) {
  const at = new Date(now);
  if (parisHour(at) < DIGEST_HOUR) return 0;
  const day = parisDay(at);
  const meta = readItems("meta", db);
  if (meta.digest && meta.digest.day === day) return 0;
  saveItem("meta", "digest", { day, at: at.toISOString() }, db);
  const { allMatches } = await import("./matchlist.js");
  const { teamSlug, EVENT_NAMES } = await import("./paths.js");
  const results = allMatches(state).filter((m) => m.sa != null && m.sb != null && m.at && parisDay(new Date(m.at)) === day && m.a && m.b);
  if (!results.length) return 0;
  const subs = db.prepare("SELECT endpoint, p256dh, auth, teams, lang FROM push_subs WHERE digest = 1").all();
  const forget = db.prepare("DELETE FROM push_subs WHERE endpoint = ?");
  let sent = 0;
  for (const s of subs) {
    let teams = [];
    try { teams = JSON.parse(s.teams); } catch { /* every team */ }
    const mine = results.filter((m) => !teams.length || teams.includes(teamSlug(m.a.name)) || teams.includes(teamSlug(m.b.name)));
    if (!mine.length) continue;
    const lines = mine.slice(0, 8).map((m) => `${m.a.name} ${m.sa}–${m.sb} ${m.b.name}`);
    const body = lines.join(" · ") + (mine.length > 8 ? ` · +${mine.length - 8}` : "");
    const events = [...new Set(mine.map((m) => EVENT_NAMES[m.event]))].join(", ");
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: `${DIGEST_WORDS[s.lang] || DIGEST_WORDS.fr} · ${events}`, body, tag: `digest:${day}`, url: "/calendar" }));
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) forget.run(s.endpoint);
    }
  }
  return sent;
}

/** The evening summary, with the site's keys. */
export async function digestNow(db, state, now = Date.now()) {
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 3600 };
  return sendDigest(db, state, now, (sub, payload) => webpush.sendNotification(sub, payload, options));
}

/** Sends what is new, with the site's keys. */
export async function pushNow(db, state, now = Date.now()) {
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: "high" };
  return sendPushes(db, state, now, (sub, payload) => webpush.sendNotification(sub, payload, options));
}
