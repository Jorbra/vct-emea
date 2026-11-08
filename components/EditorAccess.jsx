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
export default function EditorAccess({ lang, isAdmin }) {
  const pathname = usePathname();
  const inEditor = /^\/admin(\/|$)/.test(pathname || "");
  useEffect(() => {
    if (inEditor || !isAdmin) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "e" || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing()) return;
      window.location.assign(adminHrefForPath(window.location.pathname)); // tabs change the address without a new page
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inEditor, isAdmin]);
  if (inEditor || !isAdmin) return null;
  const tr = makeT(lang);
  return (
    <a className="btn edfab pri" href="/admin" title={tr("Open the editor (E key)")}
      onClick={(e) => { e.preventDefault(); window.location.assign(adminHrefForPath(window.location.pathname)); }}>
      {tr("Edit")}
    </a>
  );
}
