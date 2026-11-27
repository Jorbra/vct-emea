"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { typing } from "./autoRefresh.js";
import { makeT } from "../lib/i18n.js";
import { adminHrefForPath } from "../lib/paths.js";

/**
 * The way into the editor, on every page outside it, only for those who have access: the E key on a computer, a button on touch
 * screens. It opens on the event being looked at, or on the editor's home page, in a new tab: the site stays open in the first
 * one. Anyone else sees nothing; /admin still asks for the password.
 */
// the editor in a new tab, as a link does it (a real link opening a tab is never taken for a pop-up, unlike window.open)
export function openEditor(href = adminHrefForPath(window.location.pathname)) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
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
  // the button is a plain link to a new tab; its address follows the page (tabs change it without a new page) just before
  // it is used, so the browser opens it by itself
  const aim = (e) => { e.currentTarget.href = adminHrefForPath(window.location.pathname); };
  return (
    <a className="btn edfab pri" href={adminHrefForPath(pathname || "/")} target="_blank" rel="noopener" title={tr("Open the editor (E key)")}
      onPointerDown={aim} onFocus={aim} onMouseEnter={aim}>
      {tr("Edit")}
    </a>
  );
}
