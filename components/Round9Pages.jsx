"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES, teamHref } from "../lib/paths.js";

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

// ---- A1. two teams face to face

function TeamCompare({ teams, a, b, c }) {
  const tr = useT();
  const pct = (r) => (r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0);
  const bar = (label, va, vb, fmt = (x) => x) => {
    const top = Math.max(va, vb) || 1;
    return (
      <div className="cmpbar" key={label}>
        <span className={"cba" + (va > vb ? " w" : "")}><i style={{ width: `${Math.round((va / top) * 100)}%` }} /><em>{fmt(va)}</em></span>
        <small>{label}</small>
        <span className={"cbb" + (vb > va ? " w" : "")}><i style={{ width: `${Math.round((vb / top) * 100)}%` }} /><em>{fmt(vb)}</em></span>
      </div>
    );
  };
  return (
    <div className="wrap teampage">
      <Top title={tr("Compare teams")} />
      <form className="cmpform" method="get" action="/equipes">
        <label className="f">{tr("Team 1")}<input name="a" list="cmpteams" defaultValue={a ? a.name : ""} maxLength={60} /></label>
        <label className="f">{tr("Team 2")}<input name="b" list="cmpteams" defaultValue={b ? b.name : ""} maxLength={60} /></label>
        <datalist id="cmpteams">{teams.map((t) => <option key={t} value={t} />)}</datalist>
        <button className="btn pri" type="submit">{tr("Compare them")}</button>
      </form>
      {a && b && c && (
        <>
          <div className="tcmphead">
            <a href={teamHref(a.name)}><Crest team={a} /><b>{a.name}</b></a>
            <div className="tcmph2h spoil"><b>{c.h2h.a} – {c.h2h.b}</b><small>{tr("head to head")}</small></div>
            <a href={teamHref(b.name)} className="r"><b>{b.name}</b><Crest team={b} /></a>
          </div>
          <div className="cmpbars">
            {bar(tr("Wins"), c.a.w, c.b.w)}
            {bar(tr("Win rate"), pct(c.a), pct(c.b), (x) => `${x}%`)}
            {bar(tr("Maps won"), c.a.mw, c.b.mw)}
            {bar(tr("Map rate"), c.a.mw + c.a.ml ? Math.round((c.a.mw / (c.a.mw + c.a.ml)) * 100) : 0, c.b.mw + c.b.ml ? Math.round((c.b.mw / (c.b.mw + c.b.ml)) * 100) : 0, (x) => `${x}%`)}
          </div>
          <section>
            <h2>{tr("Their meetings")}</h2>
            {c.meetings.length === 0 ? <p className="note">{tr("Never met on the site.")}</p> : (
              <ul className="weeklist">{c.meetings.map((m) => <li key={m.event + m.id} className={m.won === "a" ? "ok" : "ko"}><span>{m.won === "a" ? "🟢" : "🔴"}</span><a href={`/match/${m.event}/${m.id}`}>{a.name} {m.sa}–{m.sb} {b.name}</a><small>{tr(EVENT_NAMES[m.event] || m.event)}</small></li>)}</ul>
            )}
          </section>
        </>
      )}
      {(a === null || b === null) && <p className="err">{tr("Unknown team.")}</p>}
    </div>
  );
}
export const TeamComparePage = (p) => <LangProvider lang={p.lang}><TeamCompare {...p} /></LangProvider>;

// ---- A4. how the events work

const FORMATS = [
  ["Open qualifiers (Europe)", "Two qualifiers open to everyone, in single elimination: up to 512 teams. The four semifinalists of each go to the Qualifier Playoffs."],
  ["Open qualifiers (Türkiye)", "Two qualifiers in single elimination. The two finalists of each go to the Türkiye Qualifier Playoffs."],
  ["Open qualifiers (MENA)", "Middle East and North Africa each have two qualifiers. Their winners go to the MENA Qualifier Playoffs."],
  ["EU Qualifier Playoffs", "16 teams (8 invited, 8 from the qualifiers): a Swiss stage, then two single-elimination brackets. The two winners go to the Kickoff."],
  ["Türkiye and MENA Qualifier Playoffs", "Türkiye: 8 teams in two GSL groups, then a final. MENA: 4 teams, semifinals and final. Each winner goes to the Kickoff."],
  ["EMEA Kickoff", "12 teams: the partner teams and the qualified ones, in triple elimination. The best go to the season's first Masters."],
  ["Game Changers EMEA", "The circuit for women and marginalised genders, with its own events through the year."],
];

function Formats() {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("How the events work")} />
      <p className="note">{tr("The road to the EMEA Kickoff, step by step.")}</p>
      <ol className="fmtlist">{FORMATS.map(([t, d], i) => <li key={t}><span className="fmtn">{i + 1}</span><div><b>{tr(t)}</b><p>{tr(d)}</p></div></li>)}</ol>
      <section>
        <h2>{tr("Words to know")}</h2>
        <dl className="fmtdl">
          {[["Bo1 / Bo3 / Bo5", "Best of 1, 3 or 5 maps: the first to win 1, 2 or 3 maps wins the series."], ["Bye", "A team with no opponent in a round goes through without playing."], ["Swiss stage", "Teams with the same record meet; a set number of wins qualifies, of losses eliminates."], ["GSL group", "Four teams: winners' match, elimination match, then a decider for the second place."], ["Triple elimination", "A team is out after its third loss."]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{tr(v)}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
export const FormatsPage = (p) => <LangProvider lang={p.lang}><Formats /></LangProvider>;
