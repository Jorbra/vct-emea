"use client";
// A private league of predictions: its own page.

import { useEffect, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { visitorToken } from "./CommunityPages.jsx";
import { Groups, Podium, SeasonTable } from "./Fans.jsx";

/** A private league's own page: its podium and ranking, joining, the invite link; the predictions are one click away. */
function League({ league }) {
  const tr = useT();
  const [token, setToken] = useState("");
  const [named, setNamed] = useState(false);
  useEffect(() => {
    const t = visitorToken();
    setToken(t);
    if (!t) return;
    fetch("/api/predictions/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.name) setNamed(true); }).catch(() => { /* offline */ });
  }, []);
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{league ? league.name : tr("Private league")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/predictions">{tr("Predictions")}</a> › <span>{tr("Private league")}</span></nav>
      {!league ? (
        <>
          <p className="err">{tr("This league does not exist (any more).")}</p>
          <p className="note">{tr("Ask its creator for the code, or create your own league from the predictions page.")}</p>
          <p><a className="btn pri" href="/predictions">{tr("To the predictions")}</a></p>
        </>
      ) : (
        <>
          <Groups token={token} group={league} named={named} />
          <section>
            <h2>{tr("League ranking")}</h2>
            {league.ranking.length === 0 ? <p className="note">{tr("Nobody has scored yet: the ranking fills in as the matches end.")}</p> : (
              <>
                <Podium ranking={league.ranking} />
                <SeasonTable ranking={league.ranking} me="" />
              </>
            )}
            <p className="hint">{tr("Points: 1 per right winner, +1 for the exact score, plus the points of Who qualifies? and of the next map.")}</p>
          </section>
          <p><a className="btn pri" href="/predictions">{tr("To the predictions")}</a></p>
        </>
      )}
    </div>
  );
}

export const LeaguePage = ({ league, lang }) => <LangProvider lang={lang}><League league={league} /></LangProvider>;
