"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "./lang.jsx";
import { useLiveCount } from "./visual.jsx";

const MORE = [["/soiree", "Match night"], ["/moi", "My week"], ["/jeux", "Games of the day"], ["/quiz", "Quiz of the week"], ["/puissance", "Power ranking"], ["/stats", "Stats"], ["/transfers", "Transfers"], ["/lft", "LFT"], ["/compare", "Compare"], ["/news", "News"], ["/archives", "Archives of past seasons"], ["/compte", "My account"], ["/about", "About"]];

/** On phones: the main pages in a bar at the bottom of the screen, the live count in red, the rest under "More". */
export default function MobileTabs() {
  const tr = useT();
  const path = usePathname() || "/";
  const live = useLiveCount();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  if (path.startsWith("/admin") || path.startsWith("/overlay")) return null;
  const is = (href) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  const tab = (href, icon, label, extra = null) => (
    <a href={href} className={"mtab" + (is(href) ? " on" : "")} aria-current={is(href) ? "page" : undefined}>
      <span className="mticon" aria-hidden="true">{icon}</span><span>{label}</span>{extra}
    </a>
  );
  return (
    <>
      {more && (
        <div className="mtmore" role="dialog" aria-label={tr("More")} onClick={() => setMore(false)}>
          <nav onClick={(e) => e.stopPropagation()}>{MORE.map(([href, label]) => <a key={href} href={href} aria-current={is(href) ? "page" : undefined}>{tr(label)}</a>)}</nav>
        </div>
      )}
      <nav className="mtabs" aria-label={tr("Navigation")}>
        {tab("/", "⌂", tr("Home"))}
        {tab("/live", "●", tr("Live"), live > 0 ? <b className="mtbadge" aria-label={tr("{n} live", { n: live })}>{live}</b> : null)}
        {tab("/calendar", "▦", tr("Calendar"))}
        {tab("/predictions", "◎", tr("Predictions"))}
        <button type="button" className={"mtab" + (more ? " on" : "")} aria-expanded={more} onClick={() => setMore(!more)}><span className="mticon" aria-hidden="true">☰</span><span>{tr("More")}</span></button>
      </nav>
    </>
  );
}
