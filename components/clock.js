"use client";
// One clock for the whole page: every countdown and "time left" reads it, instead of each one keeping its own timer.
// It stops while the tab is hidden, and a component asks only for the step it shows (the second, or the minute), so that
// a list of matches is not drawn again every second for a badge in it.
import { useEffect, useState } from "react";

const subs = new Set();
let timer = 0;

function start() {
  if (timer) return;
  timer = setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    for (const f of subs) f(now);
  }, 1000);
}

/** The time now, rounded down to `step` ms (1000: every second, 60000: every minute); null before the page is on screen. */
export function useClock(step = 1000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const at = (t) => Math.floor(t / step) * step;
    setNow(at(Date.now()));
    const f = (t) => { const v = at(t); setNow((old) => (old === v ? old : v)); };
    subs.add(f);
    start();
    // back on the tab: the right time at once
    const back = () => { if (!document.hidden) f(Date.now()); };
    document.addEventListener("visibilitychange", back);
    return () => {
      subs.delete(f);
      document.removeEventListener("visibilitychange", back);
      if (!subs.size) { clearInterval(timer); timer = 0; }
    };
  }, [step]);
  return now;
}
