"use client";

import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { CopyLink } from "./MatchModal.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { useEffect, useState } from "react";
import { formatMatchTime } from "../lib/schedule.js";
import { EVENT_NAMES, teamHref } from "../lib/paths.js";

function When({ iso }) {
  const tr = useT();
  const [text, setText] = useState("");
  useEffect(() => setText(iso ? formatMatchTime(iso, tr.lang, true) : ""), [iso, tr.lang]);
  return <span className="pathwhen">{text}</span>;
}

function View({ event, href, team, rows, slug }) {
  const tr = useT();
  useAutoRefresh();
  const label = (m) => m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const played = rows.filter((m) => m.sa != null);
  const lastPlayed = played[played.length - 1];
  const next = rows.find((m) => m.sa == null);
  let status = tr("Still in the running");
  if (!next && lastPlayed) status = lastPlayed.won ? (lastPlayed.id.startsWith("gf") ? tr("Winner") : tr("Run finished")) : tr("Out in: {round}", { round: label(lastPlayed) });
  const title = tr("{team}'s run", { team: team.name });
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href={href}>{tr(EVENT_NAMES[event])}</a> › <span>{team.name}</span></nav>
      <div className="pathhead">
        <Crest team={team} />
        <div>
          <a className="pathteam" href={teamHref(team.name)}>{team.name}</a>
          <p>{tr(EVENT_NAMES[event])} · <b>{status}</b> · {tr("{w} wins, {l} losses", { w: played.filter((m) => m.won).length, l: played.filter((m) => !m.won).length })}</p>
        </div>
      </div>
      <ol className="pathlist">
        {rows.map((m) => (
          <li key={m.id}>
            <a className={"pathrow" + (m.sa == null ? " todo" : m.won ? " won" : " lost")} href={`/match/${event}/${m.id}`}>
              <span className="pathround">{label(m)}{m.bo ? <small> · Bo{m.bo}</small> : null}<When iso={m.at} /></span>
              <span className="pathopp"><Crest team={m.opp} /><span className="tn">{(m.opp && m.opp.name) || tr("TBD")}</span></span>
              <span className="pathres">{m.sa == null ? tr("To play") : `${m.mine} – ${m.theirs}`}</span>
            </a>
          </li>
        ))}
      </ol>
      <div className="mmlinks">
        <CopyLink href={`/parcours/${event}/${slug}`} />
        <a className="btn" href={href}>{tr("Bracket")}</a>
        <a className="btn" href={teamHref(team.name)}>{tr("Team page")}</a>
      </div>
    </div>
  );
}

export default function PathPage({ lang, ...props }) {
  return <LangProvider lang={lang}><View {...props} /></LangProvider>;
}
