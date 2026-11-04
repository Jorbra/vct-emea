// Phone and computer alerts through the browsers' push services: they arrive even when the site is closed.
// The server compares the matches with what it already sent, after each editor action and at each regular round. Each visitor's teams come with their subscription.
import webpush from "web-push";
import { nextAnnouncements } from "./discord.js";
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
export function savePushSub(db, { endpoint, keys, teams }) {
  if (!isPushEndpoint(endpoint)) return fail(400, "Unknown push service.");
  const key = (x) => typeof x === "string" && x.length > 0 && x.length <= 200;
  if (!keys || !key(keys.p256dh) || !key(keys.auth)) return fail(400, "Unknown push service.");
  const list = (Array.isArray(teams) ? teams : []).filter((t) => typeof t === "string" && /^[a-z0-9-]{1,60}$/.test(t)).slice(0, 100);
  const known = db.prepare("SELECT 1 FROM push_subs WHERE endpoint = ?").get(endpoint);
  if (!known && db.prepare("SELECT COUNT(*) AS n FROM push_subs").get().n >= MAX_SUBS) return fail(503, "Too many alerts registered.");
  db.prepare("INSERT INTO push_subs (endpoint, p256dh, auth, teams) VALUES (?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, teams = excluded.teams")
    .run(endpoint, keys.p256dh, keys.auth, JSON.stringify(list));
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
  const subs = db.prepare("SELECT endpoint, p256dh, auth, teams FROM push_subs").all();
  const forget = db.prepare("DELETE FROM push_subs WHERE endpoint = ?");
  let sent = 0;
  const problems = [];
  let skipped = 0;
  for (const a of fresh) {
    const payload = JSON.stringify({ title: "VCT EMEA", body: a.text.replace(/\*\*/g, ""), tag: a.key, url: a.url });
    for (const s of subs) {
      const teams = JSON.parse(s.teams);
      if (teams.length && !a.teams.some((t) => teams.includes(t))) {
        skipped += 1;
        continue;
      }
      try {
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

/** Sends what is new, with the site's keys. */
export async function pushNow(db, state, now = Date.now()) {
  const { publicKey, privateKey } = vapidKeys(db);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.PUSH_SUBJECT || (host ? `https://${host}` : "https://vct-emea.vercel.app");
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: "high" };
  return sendPushes(db, state, now, (sub, payload) => webpush.sendNotification(sub, payload, options));
}
