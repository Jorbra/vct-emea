"use client";

// Round 17, community: the season's man of the match votes.
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { EmptyState } from "./Round11.jsx";

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Mvp({ list }) {
  const tr = useT();
  const max = Math.max(1, ...list.map((x) => x.n));
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("The fans' MVP")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("After each match, the visitors vote for its best player. Here are the season's most voted.")}</p>
      {list.length === 0 ? <EmptyState text={tr("No vote yet: vote on a finished match's page.")} /> : (
        <ol className="mvplist">{list.map((x, i) => (
          <li key={x.player}>
            <span className="mvprank">{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
            <a href={`/player/${slug(x.player)}`}><b>{x.player}</b></a>
            <span className="mvpbar"><i style={{ width: `${Math.round((x.n / max) * 100)}%` }} /></span>
            <span className="mvpn"><b>{x.n}</b> {tr("votes")}{x.matches ? ` · ${tr("MVP of {n} match(es)", { n: x.matches })}` : ""}</span>
          </li>
        ))}</ol>
      )}
    </div>
  );
}
export const MvpSeasonPage = (p) => <LangProvider lang={p.lang}><Mvp {...p} /></LangProvider>;
