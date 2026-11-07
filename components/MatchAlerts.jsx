"use client";

import { useEffect, useState } from "react";
import { readFavorites, useFavorites } from "./favorites.js";
import { readPlayers, usePlayers } from "./players.js";
import { useT } from "./lang.jsx";

const KEY = "vct-alerts";
const DIGEST_KEY = "vct-digest"; // "1": the results in one evening summary
const readDigest = () => { try { return localStorage.getItem(DIGEST_KEY) === "1"; } catch { return false; } };
const readOn = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const remember = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* not remembered */ } };

/** What stops alerts here, or "" when they can work. */
function blocker() {
  if (!window.isSecureContext) return "insecure";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "";
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !standalone ? "ios" : "unsupported";
}

const keyBytes = (key) => Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const sameBytes = (a, b) => !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

async function json(url, method, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

/** This browser's subscription, made if needed, sent to the server with the visitor's teams. */
async function subscribe() {
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  const { key } = await json("/api/push", "GET");
  const bytes = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameBytes(sub.options.applicationServerKey, bytes)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const { endpoint, keys } = sub.toJSON();
  await json("/api/push", "POST", { endpoint, keys, teams: readFavorites(), players: readPlayers(), digest: readDigest(), lang: document.documentElement.lang });
}

async function unsubscribe() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await json("/api/push", "DELETE", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** Turns the alerts on or off, and says why when they cannot work here. */
export function AlertsButton() {
  const tr = useT();
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [digest, setDigest] = useState(false);
  useEffect(() => {
    setOn(!blocker() && readOn() && Notification.permission === "granted");
    setDigest(readDigest());
  }, []);
  const chooseDigest = async (v) => {
    setDigest(v);
    try { localStorage.setItem(DIGEST_KEY, v ? "1" : "0"); } catch { /* not remembered */ }
    await subscribe().catch(() => { /* offline: done at the next visit */ });
  };
  if (on === null) return null;
  const reasons = {
    insecure: tr("Alerts only work on the site's secure address (https)."),
    ios: tr("On iPhone or iPad, first add the site to the Home Screen (Share menu), open it from there and turn the alerts on."),
    unsupported: tr("This browser cannot show alerts."),
  };
  const toggle = async () => {
    const stop = blocker();
    if (stop) return setNote(reasons[stop]);
    setBusy(true);
    setNote("");
    try {
      if (on) {
        await unsubscribe();
        remember(false);
        setOn(false);
      } else if ((await Notification.requestPermission()) !== "granted") {
        setNote(tr("Notifications are blocked for this site: allow them in the browser's site settings, then try again."));
      } else {
        await subscribe();
        remember(true);
        setOn(true);
      }
    } catch (e) {
      setNote(tr("Could not change the alerts: {error}", { error: e.message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="btn" disabled={busy} aria-pressed={on} title={tr("For your favorite teams if you have any, otherwise for every match")} onClick={toggle}>{on ? `🔔 ${tr("Match alerts on")}` : `🔕 ${tr("Turn on match alerts")}`}</button>
      {on && <label className="digestopt"><input type="checkbox" checked={digest} onChange={(e) => chooseDigest(e.target.checked)} /> {tr("Results in one summary at 10 pm")}</label>}
      {note && <span className="hint" role="status"> {note}</span>}
    </>
  );
}

/** On every page: keeps the server up to date with the visitor's favorite teams. */
export default function MatchAlerts() {
  const favKey = useFavorites().list.join() + "|" + usePlayers().list.join();
  // the site as an application: its pages kept for when the network is gone
  useEffect(() => {
    if (window.isSecureContext && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => { /* no offline pages */ });
  }, []);
  useEffect(() => {
    if (!readOn() || blocker() || Notification.permission !== "granted") return;
    subscribe().catch(() => { /* offline: done at the next visit */ });
  }, [favKey]);
  return null;
}
