"use client";

import { localeOf } from "../lib/i18n.js";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { siteHref } from "../lib/paths.js";

function View({ seasons }) {
  const tr = useT();
  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Archives")}</span></h1>
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <span>{tr("Archives")}</span></nav>
      {seasons.length === 0 ? <p className="note">{tr("No archived season yet.")}</p> : (
        <div className="evgrid">
          {seasons.map((s) => (
            <a key={s.slug} className="evcard" href={`/archives/${s.slug}${siteHref("playoffs")}`}>
              <span className="evtitle">{s.name}</span>
              <span className="evmeta">{new Intl.DateTimeFormat(localeOf(tr.lang), { dateStyle: "long" }).format(new Date(s.created))}</span>
              <span className="evgo">{tr("Open")} ›</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArchivesList({ seasons, lang }) {
  return <LangProvider lang={lang}><View seasons={seasons} /></LangProvider>;
}
