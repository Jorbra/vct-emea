"use client";

import { useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { PartTabs } from "./Round10.jsx";
import { EmptyState } from "./Round11.jsx";

function Top({ title }) {
  const tr = useT();
  return (
    <>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
    </>
  );
}

// ---- R26. the search page

function Search({ q, found }) {
  const tr = useT();
  const groups = found ? [["teams", tr("Teams")], ["players", tr("Players")], ["matches", tr("Matches")], ["events", tr("Events")], ["maps", tr("Maps")]].filter(([k]) => (found[k] || []).length) : [];
  const [tab, setTab] = useState(groups[0] ? groups[0][0] : "teams");
  const total = found ? groups.reduce((s, [k]) => s + found[k].length, 0) : 0;
  return (
    <div className="wrap teampage">
      <Top title={tr("Search")} />
      <form className="bigsearch" method="get" action="/recherche"><input name="q" defaultValue={q} placeholder={tr("Search: tournament, team, player")} aria-label={tr("Search")} autoFocus /><button className="btn pri" type="submit">{tr("Search")}</button></form>
      {!found ? <EmptyState kind="search" text={tr("Type at least 2 letters.")} /> : total === 0 ? <EmptyState kind="search" text={tr("No result for “{q}”.", { q })} /> : (
        <>
          <PartTabs value={tab} onChange={setTab} label={tr("Search")} items={groups.map(([k, l]) => [k, `${l} (${found[k].length})`])} />
          <div className="sresults">{(found[tab] || []).map((x, i) => (
            <a key={i} href={x.href} className="sres">
              {x.crest ? <Crest team={x.crest} /> : x.logo ? <Crest team={{ name: x.name, logo: x.logo }} /> : <span className="sresi" aria-hidden="true">{tab === "players" ? "👤" : tab === "matches" ? "⚔️" : tab === "maps" ? "🗺️" : "🏆"}</span>}
              <b>{x.name}</b>{x.sub && <small>{x.sub}</small>}
            </a>
          ))}</div>
        </>
      )}
    </div>
  );
}
export const SearchPage = (p) => <LangProvider lang={p.lang}><Search {...p} /></LangProvider>;

// ---- A14. the season's feed

function Season({ feed }) {
  const tr = useT();
  const [kind, setKind] = useState("all");
  const shown = feed.filter((x) => kind === "all" || x.kind === kind);
  const fmt = (iso) => new Date(iso).toLocaleDateString(tr.lang === "en" ? "en-GB" : tr.lang, { day: "numeric", month: "short" });
  return (
    <div className="wrap teampage">
      <Top title={tr("The season's feed")} />
      <PartTabs value={kind} onChange={setKind} label={tr("Show")} items={[["all", tr("All")], ["result", tr("Results")], ["qualified", tr("Qualified")], ["transfer", tr("Transfers")]]} />
      {shown.length === 0 ? <EmptyState text={tr("Nothing yet.")} /> : (
        <ol className="sfeed">{shown.map((x, i) => (
          <li key={i} className={x.kind}>
            <time>{fmt(x.at)}</time>
            <span className="sfi" aria-hidden="true">{x.kind === "result" ? "⚔️" : x.kind === "qualified" ? "🎟️" : "🔁"}</span>
            {x.kind === "result" && <a href={`/match/${x.event}/${x.id}`}><b>{x.winner}</b> {tr("wins")} <span className="spoil">{x.a} {x.sa}–{x.sb} {x.b}</span><small> · {tr(x.name)}</small></a>}
            {x.kind === "qualified" && <a href={`/team/${x.slug}`}><b>{x.team}</b> {tr("qualifies")} : {tr(x.name)} → {tr(x.to)}</a>}
            {x.kind === "transfer" && <span><b>{x.player}</b> {x.move === "in" ? tr("joins {team}", { team: x.team }) : tr("leaves {team}", { team: x.team })}{x.to ? ` → ${x.to}` : ""}</span>}
          </li>
        ))}</ol>
      )}
    </div>
  );
}
export const SeasonPage = (p) => <LangProvider lang={p.lang}><Season {...p} /></LangProvider>;
