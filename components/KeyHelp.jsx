"use client";
// The keyboard shortcuts, shown with "?" on a computer.

import { useEffect, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { ftOn } from "./Maj40Bits.jsx";

const typing = (t) => /^(INPUT|TEXTAREA|SELECT)$/.test((t && t.tagName) || "") || (t && t.isContentEditable);
// L and C: the live page and the calendar in one key (preview "recherche", lib/apercu.js)
const GO = { l: "/live", c: "/calendar" };
const MORE = [["L", "Live matches"], ["C", "Calendar"]];
const KEYS = [["/", "Search the site"], ["Ctrl K", "Pages, teams, players and matches in one box"], ["E", "Open the editor (for editors)"], ["Esc", "Close a window"], ["?", "This help"]];

export default function KeyHelp() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
      else if (GO[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !typing(e.target) && ftOn("recherche")) { e.preventDefault(); window.location.assign(GO[e.key]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open && box.current) box.current.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="keyhelp" role="presentation" onClick={() => setOpen(false)}>
      <div className="keybox" role="dialog" aria-modal="true" aria-label={tr("Keyboard shortcuts")} tabIndex={-1} ref={box} onClick={(e) => e.stopPropagation()}>
        <h2>{tr("Keyboard shortcuts")}</h2>
        <dl>{[...KEYS, ...(ftOn("recherche") ? MORE : [])].map(([k, what]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{tr(what)}</dd></div>)}</dl>
        <button type="button" className="btn" onClick={() => setOpen(false)}>{tr("Close")}</button>
      </div>
    </div>
  );
}
