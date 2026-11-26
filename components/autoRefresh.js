"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// the site stamp last seen by this tab (lib/stamp.js), kept across its pages
const stamp = { current: null };

/** True while the visitor is typing in a field or has a menu open, so page shortcuts and refreshes leave them alone. */
export const typing = () => {
  const ae = document.activeElement;
  return !!(ae && (ae.isContentEditable || (ae.matches && ae.matches("input:not([type=checkbox]):not([type=radio]), select, textarea"))));
};

// a match being played on the page (its red LIVE badge, a live score, the live details): the page refreshes faster
const LIVE_SEL = ".livebadge, .lv, .livedetail, .livemap, .mcard.live";
const LIVE_EVERY = 20000;

/**
 * Keeps the page current (also after changes made by another editor or straight in the database): asks the server for
 * fresh data every `ms` (2 minutes by default), every 20 s while a match is being played on the page (vlr.gg is read every
 * minute), and when the tab comes back, but never while someone is typing or the tab is hidden.
 * React keeps what is on screen; only what changed on the server is redrawn.
 */
export function useAutoRefresh(ms = 120000, enabled = true) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    let drawn = Date.now();
    let asking = false;
    // The page is drawn again only when the site has something new (its stamp, a few bytes: lib/stamp.js). Drawing it again
    // sent the whole page (up to 70 KB) every 20 to 60 s even when nothing had moved. Every 5 minutes it is drawn anyway
    // (predictions, polls and the like change without the stamp), and when the stamp cannot be read, as before.
    const readStamp = () => fetch("/api/stamp", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.s) || null).catch(() => null);
    // the editor shows more than the stamp covers (journal, accounts…): it is drawn again each time, as before
    const editor = window.location.pathname.startsWith("/admin");
    // the stamp of the page as it was drawn, read once it is shown
    if (!editor && stamp.current === null) readStamp().then((s) => { if (s && stamp.current === null) stamp.current = s; });
    const go = async () => {
      if (asking) return;
      last = Date.now();
      if (editor) { drawn = Date.now(); router.refresh(); return; }
      asking = true;
      let fresh = true;
      try {
        const j = await fetch("/api/stamp", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        const s = j && j.s;
        if (s && stamp.current === null) { stamp.current = s; fresh = Date.now() - drawn >= 300000; }
        else if (s) { fresh = s !== stamp.current || Date.now() - drawn >= 300000; stamp.current = s; }
      } catch { /* offline or no stamp: as before */ }
      asking = false;
      if (fresh) { drawn = Date.now(); router.refresh(); }
    };
    const tick = () => {
      if (document.hidden || typing()) return;
      const live = !!document.querySelector(LIVE_SEL);
      if (Date.now() - last >= (live ? LIVE_EVERY : Math.max(ms, 45000))) go();
    };
    // coming back to the tab refreshes too, but never twice within 20 s: switching tabs back and forth costs nothing
    const back = () => { if (!document.hidden && !typing() && Date.now() - last >= 20000) go(); };
    const t = setInterval(tick, 5000);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [router, ms, enabled]);
}
