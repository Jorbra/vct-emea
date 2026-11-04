"use client";
import { useEffect, useState } from "react";
import { THEME_COOKIE } from "../lib/theme.js";
import { useT } from "./lang.jsx";

const Sun = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

/** One button that flips light/dark. The choice is kept in a cookie so the server renders the right theme at once. */
export function ThemeSwitch() {
  const tr = useT();
  const [theme, setTheme] = useState(null); // known only in the browser (it may follow the device setting)

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setTheme(set || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  }, []);

  const flip = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };

  const label = theme === "light" ? tr("Dark mode") : tr("Light mode");
  return (
    <button type="button" className="themesw" onClick={flip} aria-label={label} title={label}>
      {theme === "light" ? <Moon /> : <Sun />}
    </button>
  );
}
