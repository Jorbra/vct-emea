"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "vct-favorites"; // kept per visitor, in the browser

const read = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return []; // storage blocked: no favorites
  }
};

/** The visitor's favorite teams (their addresses' names), and the star's action. Every part of the page follows a change. */
export function useFavorites() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const sync = () => setList(read());
    sync();
    window.addEventListener("vct-favorites", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("vct-favorites", sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = useCallback((slug) => {
    const cur = read();
    const next = cur.includes(slug) ? cur.filter((x) => x !== slug) : [...cur, slug];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch { /* not remembered */ }
    setList(next);
    window.dispatchEvent(new Event("vct-favorites"));
  }, []);
  return { list, toggle, has: (slug) => list.includes(slug) };
}
