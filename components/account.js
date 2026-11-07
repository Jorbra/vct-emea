"use client";
// This device and the visitor's account. The account itself is a secret cookie; here only its name is remembered, to know whether to follow it.
const MARK = "vct-account";
export const TOKEN_KEY = "vct-predictions";
export const FAVORITES_KEY = "vct-favorites";
export const COUNTDOWN_KEY = "vct-countdown";

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export const accountName = () => safe(() => localStorage.getItem(MARK) || "", "");
export const deviceToken = () => safe(() => localStorage.getItem(TOKEN_KEY) || "", "");
export const deviceFavorites = () => safe(() => { const l = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); return Array.isArray(l) ? l : []; }, []);

/** What just changed here, for the other devices. Does nothing when no one is signed in. */
export function pushAccount(patch) {
  if (!accountName()) return;
  fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
    .catch(() => { /* offline: the next change carries the list again */ });
}

/** Puts the account's data on this device; the page follows. */
export function applyAccount(account) {
  safe(() => {
    localStorage.setItem(MARK, account.name);
    localStorage.setItem(TOKEN_KEY, account.token);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(account.favorites || []));
    if (typeof account.prefs?.countdown === "boolean") localStorage.setItem(COUNTDOWN_KEY, account.prefs.countdown ? "1" : "0");
    if (Array.isArray(account.prefs?.players)) localStorage.setItem("vct-players", JSON.stringify(account.prefs.players));
  });
  window.dispatchEvent(new Event("vct-favorites"));
  window.dispatchEvent(new Event("vct-players"));
  window.dispatchEvent(new Event("vct-account"));
}

/** Signed out: nothing of the account stays on this device, which may be shared. */
export function forgetAccount() {
  safe(() => {
    localStorage.removeItem(MARK);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FAVORITES_KEY);
    localStorage.removeItem("vct-players");
  });
  window.dispatchEvent(new Event("vct-favorites"));
  window.dispatchEvent(new Event("vct-players"));
  window.dispatchEvent(new Event("vct-account"));
}
