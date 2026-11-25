"use client";
// The glossary page: the site's words for newcomers, by group, with a filter.

import { useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { LEX_GROUPS, LEXICON } from "../lib/lexicon.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Lex() {
  const tr = useT();
  const [q, setQ] = useState("");
  const fr = tr.lang === "fr";
  const k = norm(q);
  const shown = LEXICON.filter(([term, , f, e]) => !k || norm(`${term} ${fr ? f : e}`).includes(k));
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Glossary")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("The words of VALORANT esports the site uses, explained simply.")}</p>
      <input type="search" className="lexfind" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a word")} aria-label={tr("Find a word")} />
      {LEX_GROUPS.map(([g, frName, enName]) => {
        const list = shown.filter((x) => x[1] === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h2>{fr ? frName : enName}</h2>
            <dl className="lexlist">
              {list.map(([term, , f, e]) => <div key={term} id={norm(term).replace(/[^a-z0-9]+/g, "-")}><dt>{term}</dt><dd>{fr ? f : e}</dd></div>)}
            </dl>
          </section>
        );
      })}
      {!shown.length && <p className="note">{tr("No result.")}</p>}
      <p><a className="btn" href="/format">{tr("How the events work")}</a></p>
    </div>
  );
}

export default function Lexicon({ lang }) {
  return <LangProvider lang={lang}><Lex /></LangProvider>;
}
