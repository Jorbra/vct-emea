"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { MatchCard } from "./MatchModal.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

function View({ e, id, state }) {
  const tr = useT();
  useAutoRefresh();
  const m = e.items.find((x) => x.id === id);
  const title = `${(m.a && m.a.name) || tr("TBD")} vs ${(m.b && m.b.name) || tr("TBD")}`;
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href={e.href}>{tr(EVENT_NAMES[e.event])}</a> › <span>{title}</span></nav>
      <MatchCard e={e} m={m} state={state} />
    </div>
  );
}

export default function MatchPage({ e, id, state, lang }) {
  return <LangProvider lang={lang}><View e={e} id={id} state={state} /></LangProvider>;
}
