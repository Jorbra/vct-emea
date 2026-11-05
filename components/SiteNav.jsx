"use client";

import { usePathname } from "next/navigation";
import { useT } from "./lang.jsx";

const LINKS = [
  ["/calendar", "Calendar"], ["/predictions", "Predictions"], ["/rankings", "Rankings"], ["/transfers", "Transfers"],
  ["/compare", "Compare"], ["/news", "News"], ["/archives", "Archives of past seasons"],
];

/** The site's links, under the header of every page; on phones the bar scrolls by itself, so the page never does. */
export default function SiteNav() {
  const tr = useT();
  const path = usePathname() || "";
  const on = (href) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  return (
    <nav className="sitenav" aria-label={tr("Navigation")}>
      {LINKS.map(([href, label]) => <a key={href} href={href} aria-current={on(href)}>{tr(label)}</a>)}
      <a className="navend" href="/about" aria-current={on("/about")}>{tr("About")}</a>
    </nav>
  );
}
