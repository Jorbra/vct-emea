"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { LiveBadge } from "./matchTime.jsx";
import { formatMatchTime } from "../lib/schedule.js";
import { EVENT_NAMES, teamHref } from "../lib/paths.js";
import { OpenMatchCtx } from "./openMatch.js";
import { embedUrl, googleCalendarUrl, icsFile } from "../lib/media.js";
import { compareTeams, knownPlayer, playerHref } from "../lib/playerstats.js";

export { EVENT_NAMES };

/**
 * events: [{ event, items (matchesOf), times, live, extra, href, stream (the event's default stream link) }].
 * Children call useOpenMatch()(event, id).
 */
export function MatchModalProvider({ events, children, state = null }) {
  const [cur, setCur] = useState(null);
  const open = useMemo(() => (event, id) => setCur({ event, id }), []);
  const e = cur && events.find((x) => x.event === cur.event);
  const m = e && e.items.find((x) => x.id === cur.id);
  return (
    <OpenMatchCtx.Provider value={open}>
      {children}
      {m && <MatchModal e={e} m={m} state={state} onClose={() => setCur(null)} />}
    </OpenMatchCtx.Provider>
  );
}

/** The two teams side by side: results on the whole site, meetings, and maps. */
function Compare({ m, state }) {
  const tr = useT();
  const c = compareTeams(state, m.a, m.b, m.id);
  const row = (label, a, b, better) => (
    <tr><td className={better > 0 ? "w" : ""}>{a}</td><th scope="row">{label}</th><td className={better < 0 ? "w" : ""}>{b}</td></tr>
  );
  const rate = (r) => (r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0);
  const maps = [...new Set([...c.mapsA, ...c.mapsB].map((x) => x.map))];
  const on = (list, map) => { const x = list.find((y) => y.map === map); return x ? `${x.w} – ${x.l}` : "–"; };
  return (
    <table className="mmcmp">
      <tbody>
        {row(tr("Matches"), `${c.a.w} – ${c.a.l}`, `${c.b.w} – ${c.b.l}`, rate(c.a) - rate(c.b))}
        {row(tr("Win rate"), `${rate(c.a)}%`, `${rate(c.b)}%`, rate(c.a) - rate(c.b))}
        {row(tr("Maps"), `${c.a.mw} – ${c.a.ml}`, `${c.b.mw} – ${c.b.ml}`, c.a.mw - c.a.ml - (c.b.mw - c.b.ml))}
        {row(tr("Head to head"), c.h2h.a, c.h2h.b, c.h2h.a - c.h2h.b)}
        {maps.map((map) => <tr key={map}><td>{on(c.mapsA, map)}</td><th scope="row">{map}</th><td>{on(c.mapsB, map)}</td></tr>)}
      </tbody>
    </table>
  );
}

function MatchModal({ e, m, state, onClose }) {
  const tr = useT();
  const ref = useRef(null);
  const at = e.times[m.id] || "";
  const live = !!e.live[m.id] && m.sa == null ? e.live[m.id] : null;
  const ex = e.extra[m.id] || { stream: "", vod: "", maps: [] };
  const done = m.sa != null && m.sb != null;
  const [when, setWhen] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  useEffect(() => setWhen(at ? formatMatchTime(at, tr.lang, true) : ""), [at, tr.lang]);
  const name = (t) => (t && t.name) || tr("TBD");
  const title = `${name(m.a)} vs ${name(m.b)} · ${tr(EVENT_NAMES[e.event] || "")}`;
  const calItem = at && !done ? { uid: `${e.event}-${m.id}`, title, at, bo: m.bo, url: typeof window !== "undefined" ? window.location.origin + e.href : e.href } : null;
  const google = calItem ? googleCalendarUrl(calItem) : "";
  useEffect(() => {
    if (!calItem) return undefined;
    const u = URL.createObjectURL(new Blob([icsFile([calItem])], { type: "text/calendar" }));
    setIcsUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [calItem && calItem.at, title]); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState("");
  const [cmp, setCmp] = useState(false);
  // Escape closes, focus moves into the dialog and back on close
  useEffect(() => {
    const prev = document.activeElement;
    ref.current && ref.current.focus();
    const onKey = (ev) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev && prev.focus && prev.focus(); };
  }, [onClose]);
  const stream = ex.stream || e.stream || "";
  const label = m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const team = (t, side) => {
    const won = m.win === side;
    const href = t && t.name ? teamHref(t.name) : "";
    const inner = <><Crest team={t} /><span className="tn">{name(t)}</span></>;
    return <div className={"mmteam " + side + (won ? " w" : m.win ? " lo" : "")}>{href ? <a href={href}>{inner}</a> : inner}</div>;
  };
  const score = done ? `${m.sa} : ${m.sb}` : live ? `${live.a} : ${live.b}` : "vs";
  const who = (player) => (state && knownPlayer(state, player) ? <a href={playerHref(player)}>{player}</a> : player);
  return (
    <div className="mmback" onClick={onClose}>
      <div className="mm" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="mmclose" aria-label={tr("Close")} onClick={onClose}>×</button>
        <div className="mmhead">
          <a href={e.href}>{tr(EVENT_NAMES[e.event] || "")}</a>
          <span>{label}{m.bo ? ` · Bo${m.bo}` : ""}</span>
        </div>
        <div className="mmstate">{live ? <LiveBadge /> : done ? <span className="evstate done">{tr("Finished")}</span> : <span className="evstate">{tr("Upcoming")}</span>}{when && <span className="mmwhen">{when}</span>}</div>
        <div className="mmvs">
          {team(m.a, "a")}
          <div className={"mmscore" + (live ? " lv" : "")}>{score}</div>
          {team(m.b, "b")}
        </div>
        {ex.maps.length > 0 && (
          <table className="mmmaps">
            <tbody>
              {ex.maps.map((x, i) => {
                const wa = x.a != null && x.b != null && x.a > x.b;
                const wb = x.a != null && x.b != null && x.b > x.a;
                return (
                  <tr key={i}>
                    <td className={"mms" + (wa ? " w" : "")}>{x.a ?? "–"}</td>
                    <td className="mmmap">
                      <b>{x.map || tr("Map {n}", { n: i + 1 })}</b>
                      {x.pick && <small>{x.pick === "d" ? tr("Decider") : tr("Pick: {team}", { team: name(x.pick === "a" ? m.a : m.b) })}</small>}
                    </td>
                    <td className={"mms" + (wb ? " w" : "")}>{x.b ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {ex.mvp && <p className="mmmvp"><b>MVP</b> {who(ex.mvp)}</p>}
        {(ex.pstats || []).length > 0 && (
          <table className="mmstats">
            <thead><tr><th>{tr("Player")}</th><th>K</th><th>D</th><th>A</th><th>ACS</th></tr></thead>
            <tbody>{ex.pstats.map((p) => <tr key={p.name}><td>{who(p.name)}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td><td><b>{p.acs}</b></td></tr>)}</tbody>
          </table>
        )}
        {cmp && state && m.a && m.b && m.a.name && m.b.name && <Compare m={m} state={state} />}
        {playing && (
          <div className="mmplayer">
            <iframe src={playing} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        )}
        <div className="mmlinks">
          {[stream && !done ? [stream, `▶ ${tr("Watch the stream")}`] : null, ex.vod ? [ex.vod, `↺ ${tr("Watch again (VOD)")}`] : null, ex.highlights ? [ex.highlights, `★ ${tr("Highlights")}`] : null].filter(Boolean).map(([url, text]) => {
            // inside the site when Twitch or YouTube allow it, else on their site
            const inside = embedUrl(url, typeof window !== "undefined" ? window.location.hostname : "localhost");
            return inside
              ? <button type="button" key={url} className="btn pri" onClick={() => setPlaying(playing === inside ? "" : inside)}>{text}</button>
              : <a key={url} className="btn pri" href={url} target="_blank" rel="noopener noreferrer">{text}</a>;
          })}
          {state && m.a && m.b && m.a.name && m.b.name && <button type="button" className="btn" aria-pressed={cmp} onClick={() => setCmp(!cmp)}>{tr("Compare the teams")}</button>}
          {google && <a className="btn" href={google} target="_blank" rel="noopener noreferrer">{tr("Add to Google Calendar")}</a>}
          {google && icsUrl && <a className="btn" href={icsUrl} download={`match-${m.id}.ics`}>{tr("Add to my calendar (.ics)")}</a>}
        </div>
      </div>
    </div>
  );
}
