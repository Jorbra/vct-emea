"use client";
import { useCallback, useEffect, useState } from "react";
import { pushAccount } from "./account.js";

export const PLAYERS_KEY = "vct-players"; // the players a visitor follows, kept in the browser and in the account

export const readPlayers = () => {
  try {
    const list = JSON.parse(localStorage.getItem(PLAYERS_KEY) || "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** The players followed, and the star's action. Every part of the page follows a change. */
export function usePlayers() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const sync = () => setList(readPlayers());
    sync();
    window.addEventListener("vct-players", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("vct-players", sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = useCallback((slug) => {
    const cur = readPlayers();
    const next = cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug].slice(-200);
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
    setList(next);
    pushAccount({ prefs: { players: next } });
    window.dispatchEvent(new Event("vct-players"));
  }, []);
  return { list, toggle, has: (slug) => list.includes(slug) };
}
