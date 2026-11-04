"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** True while the visitor is typing in a field or has a menu open, so page shortcuts and refreshes leave them alone. */
export const typing = () => {
  const ae = document.activeElement;
  return !!(ae && (ae.isContentEditable || (ae.matches && ae.matches("input:not([type=checkbox]):not([type=radio]), select, textarea"))));
};

/**
 * Keeps the page current (also after changes made by another editor or straight in the database): asks the server for
 * fresh data every 30 seconds (each time counts against the free host's limits) and when the tab comes back, but never while someone is typing or the tab is hidden.
 * React keeps what is on screen; only what changed on the server is redrawn.
 */
export function useAutoRefresh(ms = 30000, enabled = true) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (!document.hidden && !typing()) router.refresh();
    };
    const t = setInterval(tick, ms);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, ms, enabled]);
}
