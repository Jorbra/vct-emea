"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { typing } from "./autoRefresh.js";
import { makeT } from "../lib/i18n.js";
import { adminHrefForPath } from "../lib/paths.js";

/**
 * The way into the editor, on every page outside it, only for those who have access: the E key on a computer, a button on touch
 * screens. It opens on the event being looked at, or on the editor's home page. Anyone else sees nothing; /admin still asks for the password.
 */
// the editor opens in a new tab: the site stays open in the first one (if the browser refuses the tab, in this one)
export function openEditor(href = adminHrefForPath(window.location.pathname)) {
  const w = window.open(href, "_blank");
  if (w) w.opener = null;
  else window.location.assign(href);
}

export default function EditorAccess({ lang, isAdmin }) {
  const pathname = usePathname();
  const inEditor = /^\/admin(\/|$)/.test(pathname || "");
  useEffect(() => {
    if (inEditor || !isAdmin) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "e" || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing()) return;
      openEditor(); // tabs change the address without a new page: the event is read from it when the key is pressed
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inEditor, isAdmin]);
  if (inEditor || !isAdmin) return null;
  const tr = makeT(lang);
  return (
    <a className="btn edfab pri" href="/admin" target="_blank" rel="noopener" title={tr("Open the editor (E key)")}
      onClick={(e) => { e.preventDefault(); openEditor(); }}>
      {tr("Edit")}
    </a>
  );
}
