"use client";
import { useEffect, useRef, useState } from "react";
import { pushAccount } from "./account.js";
import { applyTheme, currentTheme } from "../lib/theme.js";
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

// half light, half dark: follows the device
const Auto = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
  </svg>
);

const MODES = [["auto", "Auto", Auto], ["light", "Light", Sun], ["dark", "Dark", Moon]];

/** The theme: Auto (the phone or computer decides), Light or Dark. A small menu of three choices, kept on this device. */
export function ThemeSwitch() {
  const tr = useT();
  const [mode, setMode] = useState("auto"); // known only in the browser
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const sync = () => setMode(currentTheme());
    sync();
    window.addEventListener("vct-theme", sync);
    return () => window.removeEventListener("vct-theme", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    const first = box.current && box.current.querySelector('[aria-checked="true"]');
    if (first) first.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  const pick = (m) => {
    setMode(applyTheme(m));
    pushAccount({ prefs: { theme: m } });
    setOpen(false);
  };

  const [, name, Icon] = MODES.find((x) => x[0] === mode) || MODES[0];
  const label = `${tr("Theme")} : ${tr(name)}`;
  return (
    <div className="themewrap" ref={box}>
      <button type="button" className="themesw" onClick={() => setOpen((o) => !o)} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open}>
        <Icon />
      </button>
      {open && (
        <div className="thememenu" role="menu" aria-label={tr("Theme")}>
          {MODES.map(([m, n, I]) => (
            <button key={m} type="button" role="menuitemradio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => pick(m)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const all = [...e.currentTarget.parentNode.querySelectorAll("button")];
                const i = all.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1);
                all[(i + all.length) % all.length].focus();
              }}>
              <I /><span>{tr(n)}</span>{m === "auto" && <small>{tr("like the device")}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
