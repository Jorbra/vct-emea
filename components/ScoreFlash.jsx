"use client";
// A score that changes on screen (a round, a map, a series, after the page refreshed by itself) flashes for a moment, so the
// eye catches it. Watches the page for text changes inside score elements; nothing is drawn otherwise. In preview: the flash
// shows only with html[data-ft~="flash"] (lib/apercu.js).
import { useEffect } from "react";

const SCORES = ".sc.lv, .ssc.lv, .livemap b, .ldscore, .lps.lv, .schs.lv, .mcs, .fmscore, .lsscore, .livescore";

export default function ScoreFlash() {
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const flash = (el) => {
      el.classList.remove("scoreflash");
      void el.offsetWidth; // restart the animation
      el.classList.add("scoreflash");
      setTimeout(() => el.classList.remove("scoreflash"), 1400);
    };
    const mo = new MutationObserver((list) => {
      const seen = new Set();
      for (const m of list) {
        const node = m.type === "characterData" ? m.target.parentElement : m.target;
        const el = node && node.closest ? node.closest(SCORES) : null;
        if (el && !seen.has(el)) { seen.add(el); flash(el); }
      }
    });
    mo.observe(document.body, { subtree: true, characterData: true, childList: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
