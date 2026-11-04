"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "./favorites.js";
import { useT } from "./lang.jsx";

const KEY = "vct-alerts";
const readOn = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/**
 * Browser alerts when a match starts or ends, while a page of the site is open: for the visitor's favorite teams if there are any,
 * else for every match. The first look only notes what is known already.
 */
export function useMatchAlerts() {
  const fav = useFavorites();
  const favKey = fav.list.join();
  useEffect(() => {
    if (typeof Notification === "undefined") return undefined;
    let seen = null;
    let stop = false;
    const tick = async () => {
      if (!readOn() || Notification.permission !== "granted" || document.hidden === undefined) return;
      try {
        const r = await fetch("/api/now");
        if (!r.ok || stop) return;
        const { items } = await r.json();
        const mine = favKey ? items.filter((a) => a.teams.some((t) => favKey.split(",").includes(t))) : items;
        if (seen) for (const a of mine) if (!seen.has(a.key)) new Notification("VCT EMEA", { body: a.text.replace(/\*\*/g, ""), icon: "/brand/icon-192.png", tag: a.key });
        seen = new Set(mine.map((a) => a.key));
      } catch { /* offline, or this browser only allows alerts from an installed app: try again later */ }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [favKey]);
}

/** Turns the alerts on or off. Hidden where the browser has no alerts. */
export function AlertsButton() {
  const tr = useT();
  const [on, setOn] = useState(false);
  const [can, setCan] = useState(false);
  useEffect(() => {
    setCan(typeof Notification !== "undefined");
    setOn(readOn() && typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);
  if (!can) return null;
  const toggle = async () => {
    const next = !on && (await Notification.requestPermission()) === "granted";
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* not remembered */ }
    setOn(next);
  };
  return <button type="button" className="btn" aria-pressed={on} title={tr("While a page of the site is open")} onClick={toggle}>{on ? `🔔 ${tr("Match alerts on")}` : `🔕 ${tr("Turn on match alerts")}`}</button>;
}

/** Keeps the alerts running on every page. */
export default function MatchAlerts() {
  useMatchAlerts();
  return null;
}
