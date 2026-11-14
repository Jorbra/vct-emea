"use client";

import { useEffect, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { LiveBadge } from "./matchTime.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { embedUrl } from "../lib/media.js";
import { EVENT_NAMES } from "../lib/paths.js";
import { formatMatchTime } from "../lib/schedule.js";
import { TvMode } from "./Round9.jsx";
import { EmptyState } from "./Round11.jsx";
import { StreamScore } from "./StreamScore.jsx";

function View({ live, next }) {
  const tr = useT();
  useAutoRefresh(30000);
  const [host, setHost] = useState("");
  const [watch, setWatch] = useState("");
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState([]);
  useEffect(() => setHost(window.location.hostname), []);
  const withStream = live.filter((m) => m.stream);
  const current = withStream.find((m) => `${m.event}:${m.id}` === watch) || withStream[0];
  const src = current && host ? embedUrl(current.stream, host) : "";
  const keyOf = (m) => `${m.event}:${m.id}`;
  // several at once: those ticked, else the first four with a stream that can play here
  const playable = withStream.filter((m) => host && embedUrl(m.stream, host));
  const screens = (picked.length ? playable.filter((m) => picked.includes(keyOf(m))) : playable).slice(0, 4);
  const tick = (m) => setPicked((p) => (p.includes(keyOf(m)) ? p.filter((x) => x !== keyOf(m)) : [...p, keyOf(m)].slice(-4)));
  const label = (m) => m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const card = (m, on) => (
    <div key={`${m.event}:${m.id}`} className={"livecard" + (on ? " on" : "")}>
      <div className="livehead">{m.live ? <LiveBadge /> : <span className="livewhen">{formatMatchTime(m.at, tr.lang, true)}</span>}<span>{tr(EVENT_NAMES[m.event])} · {label(m)}</span></div>
      <div className="liveteams">
        <span><Crest team={m.a} />{(m.a && m.a.name) || tr("TBD")}</span>
        <b>{m.score ? `${m.score.a} – ${m.score.b}` : "vs"}</b>
        <span><Crest team={m.b} />{(m.b && m.b.name) || tr("TBD")}</span>
      </div>
      {m.score && (m.score.maps || []).length > 0 && <div className="livemaps">{m.score.maps.map((x) => <span key={x.map} data-map={x.map} className={x.done ? "done" : "now"}><b>{x.map}</b> {x.a}–{x.b}</span>)}</div>}
      <div className="row">
        {m.stream && m.live && !multi && <button type="button" className={"btn" + (on ? " pri" : "")} onClick={() => setWatch(`${m.event}:${m.id}`)}>{on ? tr("Playing here") : tr("Watch here")}</button>}
        {m.stream && m.live && multi && host && embedUrl(m.stream, host) && <label className="sw"><input type="checkbox" checked={screens.some((s) => keyOf(s) === keyOf(m))} onChange={() => tick(m)} /> {tr("On screen")}</label>}
        {m.stream && <a className="btn" href={m.stream} target="_blank" rel="noopener noreferrer">{tr("Open the stream")}</a>}
        <a className="btn" href={`/match/${m.event}/${m.id}`}>{tr("Match page")}</a>
      </div>
    </div>
  );
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Live")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      {live.length === 0 ? <EmptyState text={tr("No match is being played right now.")} /> : (
        <>
          {playable.length > 1 && (
            <div className="toggles"><label className="sw"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> {tr("Several streams at once (up to 4)")}</label></div>
          )}
          {multi && screens.length > 0 ? (
            <div className={"multistream n" + screens.length}>
              {screens.map((m) => (
                <div key={keyOf(m)} className="mstile">
                  {/* the score above the stream, never over the picture */}
                  <StreamScore m={m} />
                  <div className="liveplayer">
                    <iframe src={embedUrl(m.stream, host).replace(/([?&])autoplay=(true|1)/, "$1autoplay=false")} title={`${(m.a && m.a.name) || ""} vs ${(m.b && m.b.name) || ""}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  </div>
                </div>
              ))}
            </div>
          ) : src ? (
            <div className="liveroom">
              <div className="liveplayer"><iframe src={src} title={tr("Live")} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
              <aside className="liveside">
                <span className="livebadge">{tr("LIVE")}</span>
                <div className="lsteams">
                  <span><Crest team={current.a} />{(current.a && current.a.name) || tr("TBD")}</span>
                  <b className="lsscore">{current.score ? `${current.score.a} : ${current.score.b}` : "vs"}</b>
                  <span><Crest team={current.b} />{(current.b && current.b.name) || tr("TBD")}</span>
                </div>
                <div className="lsmeta">{tr(EVENT_NAMES[current.event])} · {label(current)}{current.bo ? ` · Bo${current.bo}` : ""}</div>
                {current.score && (current.score.maps || []).length > 0 && <div className="livemaps">{current.score.maps.map((x) => <span key={x.map} className={x.done ? "done" : "now"}><b>{x.map}</b> {x.a}–{x.b}</span>)}</div>}
                {current.score && (current.score.feed || []).length > 0 && (
                  <ol className="lsfeed">{[...current.score.feed].reverse().map((f, i) => (
                    <li key={i}><small>{new Date(f.at).toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit" })}</small> {f.kind === "start" ? tr("{map} starts", { map: f.map }) : `${f.map} : ${(f.a > f.b ? current.a : current.b || {}).name || ""} ${Math.max(f.a, f.b)}–${Math.min(f.a, f.b)}`}</li>
                  ))}</ol>
                )}
                <a className="btn" href={`/match/${current.event}/${current.id}`}>{tr("Match page")}</a>
              </aside>
            </div>
          ) : withStream.length === 0 ? <p className="note">{tr("No stream link is known for these matches yet.")}</p> : null}
          <TvMode live={live} />
          <h2>{tr("Live now")} <small>({live.length})</small></h2>
          <div className="livegrid">{live.map((m) => card(m, current && `${m.event}:${m.id}` === `${current.event}:${current.id}`))}</div>
        </>
      )}
      {next.length > 0 && (
        <>
          <h2>{tr("Coming next")}</h2>
          <div className="livegrid">{next.map((m) => card(m, false))}</div>
        </>
      )}
    </div>
  );
}

export default function LivePage({ lang, ...props }) {
  return <LangProvider lang={lang}><View {...props} /></LangProvider>;
}
