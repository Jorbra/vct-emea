"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { accountName } from "./account.js";
import { useT } from "./lang.jsx";

const LINKS = [
  ["/calendar", "Calendar"], ["/predictions", "Predictions"], ["/live", "Live"], ["/stats", "Stats"], ["/transfers", "Transfers"], ["/lft", "LFT"],
  ["/compare", "Compare"], ["/news", "News"], ["/archives", "Archives of past seasons"],
];

/** The site's links, under the header of every page; on phones the bar scrolls by itself, so the page never does. */
export default function SiteNav() {
  const tr = useT();
  const path = usePathname() || "";
  const [who, setWho] = useState(""); // known once in the browser
  useEffect(() => {
    const sync = () => setWho(accountName());
    sync();
    window.addEventListener("vct-account", sync);
    return () => window.removeEventListener("vct-account", sync);
  }, []);
  // the header above stays at the top while scrolling: the menu stays right under it
  useEffect(() => {
    const top = document.querySelector(".topbar");
    if (!top || !window.ResizeObserver) return undefined;
    const set = () => document.documentElement.style.setProperty("--topbar-h", `${top.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(top);
    return () => ro.disconnect();
  }, []);
  const on = (href) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  return (
    <nav className="sitenav" aria-label={tr("Navigation")}>
      {LINKS.map(([href, label]) => <a key={href} href={href} aria-current={on(href)}>{tr(label)}</a>)}
      <a className="navacct" href="/compte" aria-current={on("/compte")}>{who || tr("My account")}</a>
      <a className="navabout" href="/about" aria-current={on("/about")}>{tr("About")}</a>
    </nav>
  );
}
