"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import { siteHref } from "../lib/paths.js";
import { LostAgent } from "./Round14.jsx";
import { useEffect, useState } from "react";
import { wordsOfPath } from "../lib/maj40.js";

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
        <LostAgent />
        <div className="nfcode">404</div>
        <h2>{tr("This page does not exist.")}</h2>
        <p>{tr("The link may be old. Use the search above, or go back to a page of the site.")}</p>
        <div className="nflinks">
          <a className="btn pri" href="/">{tr("Home")}</a>
          <a className="btn" href={siteHref("kickoff")}>Kickoff</a>
          <a className="btn" href={siteHref("playoffs")}>EU Qualifier Playoffs</a>
          <a className="btn" href={siteHref("gc")}>Game Changers EMEA</a>
        </div>
        <Suggest />
      </div>
    </div>
  );
}

/** The pages that look like the address asked for: its words searched like in the bar (preview "recherche"). */
function Suggest() {
  const tr = useT();
  const [list, setList] = useState([]);
  useEffect(() => {
    const q = wordsOfPath(window.location.pathname);
    if (q.length < 2) return;
    // the whole address first, then its longest words one by one (a word mistyped or added leaves the others)
    const tries = [q, ...q.split(" ").filter((w) => w.length >= 3).sort((x, y) => y.length - x.length)].filter((x, i, l) => l.indexOf(x) === i).slice(0, 3);
    let on = true;
    (async () => {
      for (const t of tries) {
        const j = await fetch(`/api/search?q=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const found = j ? [...(j.teams || []), ...(j.players || []), ...(j.events || []), ...(j.matches || [])].filter((x) => x.href).slice(0, 5) : [];
        if (found.length) { if (on) setList(found); return; }
      }
    })();
    return () => { on = false; };
  }, []);
  if (!list.length) return null;
  return (
    <div className="nfsuggest">
      <h3>{tr("Maybe you were looking for")}</h3>
      <ul>{list.map((x) => <li key={x.href}><a href={x.href}>{x.name}</a>{x.sub && <small> · {x.sub}</small>}</li>)}</ul>
    </div>
  );
}

export default function NotFoundView({ lang }) {
  return <LangProvider lang={lang}><View /></LangProvider>;
}
