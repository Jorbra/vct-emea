"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import { siteHref } from "../lib/paths.js";

function View() {
  const tr = useT();
  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>VCT EMEA</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <div className="nf">
        <div className="nfcode">404</div>
        <h2>{tr("This page does not exist.")}</h2>
        <p>{tr("The link may be old. Use the search above, or go back to a page of the site.")}</p>
        <div className="nflinks">
          <a className="btn pri" href="/">{tr("Home")}</a>
          <a className="btn" href={siteHref("kickoff")}>Kickoff</a>
          <a className="btn" href={siteHref("playoffs")}>EU Qualifier Playoffs</a>
          <a className="btn" href={siteHref("gc")}>Game Changers EMEA</a>
        </div>
      </div>
    </div>
  );
}

export default function NotFoundView({ lang }) {
  return <LangProvider lang={lang}><View /></LangProvider>;
}
