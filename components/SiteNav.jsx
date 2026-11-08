"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { accountName } from "./account.js";
import { useT } from "./lang.jsx";
import { useLiveCount } from "./visual.jsx";
import { EmeaMark } from "./Brand.jsx";
import { SpoilerSwitch } from "./Round6Bits.jsx";

// small line icons, drawn on a 24-pixel grid
const ICON = {
  home: "M4 11l8-7 8 7v9h-5v-6h-6v6H4z",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  target: "M12 4a8 8 0 1 0 0.01 0M12 8a4 4 0 1 0 0.01 0M12 12h.01",
  live: "M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  stats: "M5 20V11M10 20V5M15 20v-8M20 20V8",
  transfers: "M4 8h13l-3-3M20 16H7l3 3",
  lft: "M10 11a4 4 0 1 0 0-.01M3 20c1-3.5 4-5 7-5M17 14v6M14 17h6",
  compare: "M12 4v16M5 8l-3 6h6zM19 8l-3 6h6zM5 8h14",
  news: "M5 5h12v14H6a1 1 0 0 1-1-1zM17 9h2v9a1 1 0 0 1-2 0M8 9h6M8 13h6M8 16h4",
  archives: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  account: "M12 11a4 4 0 1 0 0-.01M5 20c1-4 4-6 7-6s6 2 7 6",
  about: "M12 4a8 8 0 1 0 .01 0M12 11v5M12 8h.01",
  night: "M4 5h16v11H4zM8 20h8M12 16v4",
  week: "M5 5h14v15H5zM5 9h14M9 13h2M13 13h2M9 16h2",
  power: "M4 20h16M7 20v-6M12 20V8M17 20v-10M5 9l5-4 4 3 6-4",
  quiz: "M12 4a8 8 0 1 0 .01 0M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
};
const Icon = ({ name }) => (
  <svg className="navicon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[name]} /></svg>
);

const LINKS = [
  ["/", "Home", "home"], ["/live", "Live", "live"], ["/soiree", "Match night", "night"], ["/moi", "My week", "week"], ["/calendar", "Calendar", "calendar"], ["/predictions", "Predictions", "target"], ["/quiz", "Quiz of the week", "quiz"], ["/puissance", "Power ranking", "power"], ["/stats", "Stats", "stats"],
  ["/transfers", "Transfers", "transfers"], ["/lft", "LFT", "lft"], ["/compare", "Compare", "compare"], ["/news", "News", "news"], ["/archives", "Archives of past seasons", "archives"],
];

/**
 * The site's links: on a wide screen a column on the left with the brand and the live count, under the header elsewhere;
 * on phones the bar at the bottom (MobileTabs) takes over.
 */
export default function SiteNav() {
  const tr = useT();
  const path = usePathname() || "";
  const live = useLiveCount();
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
  const on = (href) => (href === "/" ? (path === "/" ? "page" : undefined) : path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  return (
    <nav className="sitenav" aria-label={tr("Navigation")}>
      <a className="navbrand" href="/" aria-label="VCT EMEA"><EmeaMark /><span>VCT EMEA</span></a>
      {LINKS.map(([href, label, icon]) => (
        <a key={href} href={href} aria-current={on(href)} className={href === "/" ? "navhomelink" : undefined}>
          <Icon name={icon} /><span>{tr(label)}</span>
          {href === "/live" && live > 0 && <b className="navlive" aria-label={tr("{n} live", { n: live })}>{live}</b>}
        </a>
      ))}
      <a className="navacct" href="/compte" aria-current={on("/compte")}><Icon name="account" /><span>{who || tr("My account")}</span></a>
      <a className="navabout" href="/about" aria-current={on("/about")}><Icon name="about" /><span>{tr("About")}</span></a>
      <SpoilerSwitch />
    </nav>
  );
}
