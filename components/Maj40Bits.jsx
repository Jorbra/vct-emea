"use client";

// Small things of the big update (maj-40) for the match page: share, copy the result, the time left, the score in the tab, and
// the screen kept awake. Each one shows only once its new thing is open (html[data-ft], lib/apercu.js).
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { resultText, timeLeft } from "../lib/maj40.js";

/** Is this new thing shown to this visitor (lib/apercu.js, set on <html data-ft> by app/layout.js)? */
export const ftOn = (name) => typeof document !== "undefined" && String(document.documentElement.dataset.ft || "").split(/\s+/).includes(name);

/** "in 2 h 15", "in 3 days", "in 12 min": beside a coming match's time (preview "match2"). */
export function TimeLeft({ at }) {
  const tr = useT();
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const left = now ? timeLeft(at, now) : null;
  if (!left) return null;
  const text = left.d >= 2 ? tr("in {n} days", { n: left.d }) : left.d === 1 ? tr("in 1 day {h} h", { h: left.h }) : left.h ? tr("in {h} h {m}", { h: left.h, m: String(left.m).padStart(2, "0") }) : tr("in {m} min", { m: Math.max(1, left.m) });
  return <span className="mmrel">{text}</span>;
}

/** While the match is played, its score in the browser tab ("● 1–0 · A vs B"); put back when leaving (preview "match2"). */
export function useLiveTitle(live, a, b) {
  const sa = live ? live.a : null;
  const sb = live ? live.b : null;
  useEffect(() => {
    if (sa == null || !ftOn("match2")) return undefined;
    const before = document.title;
    document.title = `● ${sa}–${sb} · ${a} vs ${b}`;
    return () => { document.title = before; };
  }, [sa, sb, a, b]);
}

/** The phone's own share menu, where there is one (preview "match2"). */
export function ShareMatch({ href, title }) {
  const tr = useT();
  const [can, setCan] = useState(false);
  useEffect(() => setCan(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  if (!can) return null;
  const share = () => navigator.share({ title, url: window.location.origin + href }).catch(() => { /* closed */ });
  return <button type="button" className="btn m2only" onClick={share}>↗ {tr("Share")}</button>;
}

export function CopyResult(props) {
  const tr = useT();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resultText({ ...props, url: window.location.origin + props.href }));
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch { /* refused by the browser */ }
  };
  return <button type="button" className="btn m2only" onClick={copy}>{done ? tr("Result copied") : tr("Copy the result")}</button>;
}

/** Keeps the phone's screen on while this is shown, where the browser allows it (preview "ecran"). */
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !ftOn("ecran") || typeof navigator === "undefined" || !navigator.wakeLock) return undefined;
    let lock = null;
    let gone = false;
    const take = () => { if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then((l) => { if (gone) l.release(); else lock = l; }).catch(() => { /* refused: the screen sleeps as usual */ }); };
    take();
    // the lock goes when the tab is hidden: taken again on coming back
    document.addEventListener("visibilitychange", take);
    return () => { gone = true; document.removeEventListener("visibilitychange", take); if (lock) lock.release().catch(() => {}); };
  }, [on]);
}
