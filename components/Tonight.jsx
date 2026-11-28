"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest, MapWinner } from "./Crest.jsx";
import { Score } from "./visual.jsx";
import { embedUrl } from "../lib/media.js";
import { EVENT_NAMES } from "../lib/paths.js";
import { tonightLists } from "../lib/tonight.js";

const keyOf = (m) => `${m.event}:${m.id}`;
const hourOf = (iso, lang) => new Date(iso).toLocaleTimeString(lang === "fr" ? "fr-FR" : lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** One match of the night: teams, live or final score (it flips when it moves), maps, links. */
function Row({ m, on, onWatch, playable }) {
  const tr = useT();
  const over = m.sa != null;
  const s = m.score || {};
  const label = (m.round || []).map(([k, v]) => tr(k, v)).join(" · ");
  return (
    <div className={"tnrow" + (m.live ? " live" : over ? " over" : "") + (on ? " on" : "")}>
      <div className="tnwhen">{m.live ? <span className="livebadge">{tr("LIVE")}</span> : over ? <small>{tr("Finished")}</small> : <b>{m.at ? hourOf(m.at, tr.lang) : "–"}</b>}</div>
      <div className="tnteams">
        {[["a", m.a, over ? m.sa : s.a], ["b", m.b, over ? m.sb : s.b]].map(([side, t, v]) => (
          <div key={side} className={"tnteam" + (over && m.win === side ? " w" : over ? " lo" : "")}>
            <Crest team={t} /><span>{(t && t.name) || tr("TBD")}</span>
            {(m.live || over) && <Score className="tnscore" value={v ?? 0} />}
          </div>
        ))}
        {m.live && (s.maps || []).length > 0 && <div className="mcchips">{s.maps.map((x, i) => <span key={i} className={"mcchip" + (!x.done && i === s.maps.length - 1 ? " now" : "")}>{!(!x.done && i === s.maps.length - 1) && <MapWinner x={x} a={m.a} b={m.b} />}{x.map} <Score value={`${x.a}–${x.b}`} /></span>)}</div>}
      </div>
      <div className="tnmeta">
        <small>{tr(EVENT_NAMES[m.event] || m.event)}{label ? ` · ${label}` : ""}{m.bo ? ` · Bo${m.bo}` : ""}</small>
        <span className="row">
          {m.live && playable && <button type="button" className={"btn sm" + (on ? " pri" : "")} onClick={onWatch}>{on ? tr("Playing here") : tr("Watch here")}</button>}
          <a className="btn sm" href={`/match/${m.event}/${m.id}`}>{tr("Match page")}</a>
        </span>
      </div>
    </div>
  );
}

function View({ initial }) {
  const tr = useT();
  const [matches, setMatches] = useState(initial);
  const [host, setHost] = useState("");
  const [watch, setWatch] = useState("");
  const [at, setAt] = useState("");
  useEffect(() => setHost(window.location.hostname), []);
  // the scores every 20 seconds while the page is in sight, and at once when it comes back
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/soiree").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (on && j && Array.isArray(j.matches)) { setMatches(j.matches); setAt(hourOf(new Date().toISOString(), tr.lang)); }
    }).catch(() => { /* offline: the last scores stay */ });
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    const back = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", back);
    return () => { on = false; clearInterval(t); document.removeEventListener("visibilitychange", back); };
  }, [tr.lang]);
  const { live, next, done } = useMemo(() => tonightLists(matches), [matches]);
  const canPlay = (m) => !!(host && m.stream && embedUrl(m.stream, host));
  const playing = live.filter(canPlay);
  const current = playing.find((m) => keyOf(m) === watch) || playing[0] || null;
  const src = current ? embedUrl(current.stream, host) : "";
  const total = matches.length;
  const row = (m) => <Row key={keyOf(m)} m={m} on={!!current && keyOf(current) === keyOf(m)} playable={canPlay(m)} onWatch={() => setWatch(keyOf(m))} />;
  const first = next[0];
  return (
    <div className="wrap teampage tonight">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Tonight")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="tnsum">
        {live.length > 0 && <span className="livebadge">{tr("{n} live", { n: live.length })}</span>}{" "}
        {tr("{d} of {n} finished", { d: done.length, n: total })}{at ? ` · ${tr("Updated at {t}", { t: at })}` : ""}
        {" · "}<a href="/soiree">{tr("Second screen")}</a>
      </p>
      {total === 0 ? <p className="note">{tr("No match today.")}</p> : (
        <div className="tngrid">
          <section className="tnstage" aria-label={tr("Stream")}>
            {src ? (
              <>
                <div className="liveplayer"><iframe key={src} src={src} title={`${(current.a && current.a.name) || ""} vs ${(current.b && current.b.name) || ""}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
                <div className="tnnow">
                  <span className="livebadge">{tr("LIVE")}</span>
                  <b className="tnnowteams">
                    <Crest team={current.a} /> {current.a && current.a.name}{" "}
                    <Score className="tnbig" value={current.score ? current.score.a : 0} /> : <Score className="tnbig" value={current.score ? current.score.b : 0} />{" "}
                    {current.b && current.b.name} <Crest team={current.b} />
                  </b>
                  <a className="btn sm" href={current.stream} target="_blank" rel="noopener noreferrer">{tr("Open the stream")}</a>
                </div>
              </>
            ) : (
              <div className="tnwait">
                {live.length > 0 ? <p>{tr("No stream link is known for these matches yet.")}</p>
                  : first ? <p>{tr("Next match")} : <b>{first.a && first.a.name} vs {first.b && first.b.name}</b>{first.at ? ` · ${hourOf(first.at, tr.lang)}` : ""}<br /><small>{tr("The stream shows up here as soon as it starts.")}</small></p>
                    : <p>{tr("Every match of the day is over.")}</p>}
              </div>
            )}
          </section>
          <section className="tnlist">
            {live.length > 0 && <><h2>{tr("Live now")}</h2>{live.map(row)}</>}
            {next.length > 0 && <><h2>{tr("Coming next")}</h2>{next.map(row)}</>}
            {done.length > 0 && <><h2>{tr("Finished")}</h2>{done.map(row)}</>}
          </section>
        </div>
      )}
    </div>
  );
}

export default function Tonight({ lang, matches }) {
  return <LangProvider lang={lang}><View initial={matches} /></LangProvider>;
}
