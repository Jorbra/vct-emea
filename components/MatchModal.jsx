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
import { parseRoster } from "../lib/tournament.js";
import { scoreLabel } from "../lib/scoretext.js";
import VlrStats from "./VlrStats.jsx";
import { Flag } from "./TeamCard.jsx";
import { Comments, MotmVote } from "./Fans.jsx";
import { Score, Skeleton, useTeamColor } from "./visual.jsx";

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

/** Their earlier meetings on the site, the latest first. */
function HeadToHead({ m, state }) {
  const tr = useT();
  const c = useMemo(() => compareTeams(state, m.a, m.b, m.id), [state, m.a, m.b, m.id]);
  if (!c.meetings.length) return null;
  return (
    <section className="h2h">
      <h3>{tr("Head to head")} <small>{m.a.name} {c.h2h.a} – {c.h2h.b} {m.b.name}</small></h3>
      <ul>{c.meetings.slice(0, 5).map((x) => (
        <li key={x.event + x.id}><a href={`/match/${x.event}/${x.id}`}>
          <span className="h2hev">{tr(EVENT_NAMES[x.event] || x.event)} · {x.round.map(([k, v]) => tr(k, v)).join(" · ")}</span>
          <b className={x.won === "a" ? "w" : "lo"}>{x.note && x.note.kind === "ff" ? tr("Forfeit") : `${x.sa} – ${x.sb}`}</b>
        </a></li>
      ))}</ul>
    </section>
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

/**
 * The players' numbers, one table per team: a player goes with the team whose roster names them; those no roster names go to the team
 * still short of players. Without rosters at all, one table as before.
 */
export function teamsOf(pstats, m) {
  const names = (t) => new Set(parseRoster(t && t.roster).map((p) => p.name.toLowerCase()));
  const ra = names(m.a);
  const rb = names(m.b);
  if (!ra.size && !rb.size) return [{ list: pstats }];
  const a = [];
  const b = [];
  const rest = [];
  for (const p of pstats) {
    const n = String(p.name).toLowerCase();
    if (ra.has(n)) a.push(p); else if (rb.has(n)) b.push(p); else rest.push(p);
  }
  const half = Math.ceil(pstats.length / 2);
  for (const p of rest) (a.length < half ? a : b).push(p);
  const byAcs = (x, y) => y.acs - x.acs;
  return [{ team: m.a, list: a.sort(byAcs) }, { team: m.b, list: b.sort(byAcs) }].filter((g) => g.list.length);
}

/** The window over the page, or the same content as a page of its own. */
function Shell({ page, title, boxRef, onClose, children }) {
  if (page) return <div className="mm mmpage" ref={boxRef} tabIndex={-1}>{children}</div>;
  return (
    <div className="mmback" onClick={onClose}>
      <div className="mm" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={boxRef} onClick={(ev) => ev.stopPropagation()}>{children}</div>
    </div>
  );
}

/** The players of the two teams, each under its team. Nothing when neither has a roster yet. */
function Rosters({ a, b }) {
  const tr = useT();
  const side = (t, cls) => {
    const list = parseRoster(t && t.roster);
    return (
      <ul className={"mmroster " + cls}>
        {list.map((p) => {
          const href = playerHref(p.name);
          return (
            <li key={p.name}>
              {p.cc && <Flag cc={p.cc} />}
              <span className="tn">{href ? <a href={href}>{p.name}</a> : p.name}</span>
              {p.sub && <small>{tr("Sub")}</small>}
            </li>
          );
        })}
      </ul>
    );
  };
  if (!parseRoster(a && a.roster).length && !parseRoster(b && b.roster).length) return null;
  return <div className="mmrosters">{side(a, "a")}{side(b, "b")}</div>;
}

/** Copies the address of the match's page. */
export function CopyLink({ href }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + href);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch { /* the browser refuses: the address bar still has it */ }
  };
  return <button type="button" className="btn" onClick={copy}>{done ? tr("Link copied") : tr("Copy the link")}</button>;
}

/** A match on a page of its own. */
export const MatchCard = (props) => <MatchModal {...props} page onClose={NOTHING} />;
const NOTHING = () => {};

function MatchModal({ e, m, state, onClose, page = false }) {
  const tr = useT();
  const ref = useRef(null);
  const at = e.times[m.id] || "";
  const live = !!e.live[m.id] && m.sa == null ? e.live[m.id] : null;
  const ex = e.extra[m.id] || { stream: "", vod: "", maps: [] };
  // vlr.gg's table is fetched when the match is opened; its own page brings it along
  const [details, setDetails] = useState(ex.details || null);
  useEffect(() => {
    if (ex.details || !ex.hasDetails) return undefined;
    let on = true;
    fetch(`/api/details?event=${e.event}&id=${m.id}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) setDetails(j.details); }).catch(() => { /* offline */ });
    return () => { on = false; };
  }, [e.event, m.id, ex.hasDetails, ex.details]);
  const done = m.sa != null && m.sb != null;
  // without an MVP given by an editor: the best ACS of vlr.gg's table
  const autoMvp = useMemo(() => ((details && details.all) || []).filter((r) => r.acs != null).sort((x, y) => y.acs - x.acs || (y.r || 0) - (x.r || 0))[0] || null, [details]);
  const candidates = useMemo(() => {
    const fromTable = ((details && details.all) || []).map((r) => r.name).filter(Boolean);
    return [...new Set(fromTable.length ? fromTable : [...parseRoster(m.a && m.a.roster), ...parseRoster(m.b && m.b.roster)].map((p) => p.name))];
  }, [details, m.a, m.b]);
  const [when, setWhen] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [icsUrl, setIcsUrl] = useState("");
  useEffect(() => setWhen(at ? formatMatchTime(at, tr.lang, true) : ""), [at, tr.lang]);
  const name = (t) => (t && t.name) || tr("TBD");
  const title = `${name(m.a)} vs ${name(m.b)} · ${tr(EVENT_NAMES[e.event] || "")}`;
  const calItem = at && !done ? { uid: `${e.event}-${m.id}`, title, at, bo: m.bo, url: origin + e.href } : null;
  const google = calItem ? googleCalendarUrl(calItem) : "";
  useEffect(() => {
    if (!calItem) return undefined;
    const u = URL.createObjectURL(new Blob([icsFile([calItem])], { type: "text/calendar" }));
    setIcsUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [calItem && calItem.at, title, origin]); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState("");
  const [cmp, setCmp] = useState(false);
  // Escape closes, focus moves into the dialog and back on close
  useEffect(() => {
    const prev = document.activeElement;
    if (!page) ref.current && ref.current.focus();
    const onKey = (ev) => { if (ev.key === "Escape" && !page) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev && prev.focus && prev.focus(); };
  }, [onClose, page]);
  const stream = ex.stream || e.stream || "";
  const label = m.round.map(([k, v]) => tr(k, v)).join(" · ");
  const team = (t, side) => {
    const won = m.win === side;
    const href = t && t.name ? teamHref(t.name) : "";
    const inner = <><Crest team={t} /><span className="tn">{name(t)}</span></>;
    return <div className={"mmteam " + side + (won ? " w" : m.win ? " lo" : "")}>{href ? <a href={href}>{inner}</a> : inner}</div>;
  };
  const score = done ? scoreLabel(m, tr, ":") : live ? `${live.a} : ${live.b}` : "vs";
  const colorA = useTeamColor(m.a && m.a.logo);
  const colorB = useTeamColor(m.b && m.b.logo);
  const who = (player) => (state && knownPlayer(state, player) ? <a href={playerHref(player)}>{player}</a> : player);
  return (
    <Shell page={page} title={title} boxRef={ref} onClose={onClose}>
        {!page && <button type="button" className="mmclose" aria-label={tr("Close")} onClick={onClose}>×</button>}
        <div className="mmhead">
          <a href={e.href}>{tr(EVENT_NAMES[e.event] || "")}</a>
          <span>{label}{m.bo ? ` · Bo${m.bo}` : ""}</span>
        </div>
        <div className="mmstate">{live ? <LiveBadge /> : done ? <span className="evstate done">{tr("Finished")}</span> : <span className="evstate">{tr("Upcoming")}</span>}{when && <span className="mmwhen">{when}</span>}</div>
        <div className="mmvs" style={{ ...(colorA ? { "--ta": colorA } : {}), ...(colorB ? { "--tb": colorB } : {}) }}>
          {team(m.a, "a")}
          <Score className={"mmscore" + (live ? " lv" : "")} value={score} />
          {team(m.b, "b")}
        </div>
        {live && (live.maps || []).length > 0 && (
          <div className="mmlive">
            <div className="mmlivemaps">{live.maps.map((x) => <span key={x.map} className={x.done ? "done" : "now"}><b>{x.map}</b> {x.a}–{x.b}</span>)}</div>
            {(live.feed || []).length > 0 && (
              <ol className="mmfeed" aria-label={tr("Match feed")}>
                {[...live.feed].reverse().map((f, i) => (
                  <li key={i}>
                    <small>{new Date(f.at).toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit" })}</small>{" "}
                    {f.kind === "start" ? tr("{map} starts", { map: f.map }) : tr("{team} wins {map} {a}–{b}: {ta} {sa}–{sb} {tb}", { team: name(f.a > f.b ? m.a : m.b), map: f.map, a: Math.max(f.a, f.b), b: Math.min(f.a, f.b), ta: name(m.a), tb: name(m.b), sa: f.sa, sb: f.sb })}
                  </li>
                ))}
              </ol>
            )}
            <p className="hint">{tr("Scores from vlr.gg, read every few minutes.")}</p>
          </div>
        )}
        <Rosters a={m.a} b={m.b} />
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
        <div className="mmcols">
        <div className="mmmain">
        {ex.mvp && <p className="mmmvp"><b>MVP</b> {who(ex.mvp)}</p>}
        {!ex.mvp && done && autoMvp && <p className="mmmvp"><b>MVP</b> {who(autoMvp.name)} <small>{tr("best ACS: {acs}", { acs: autoMvp.acs })}</small></p>}
        {details && (details.all || []).length > 0 && <VlrStats details={details} m={m} />}
        {ex.hasDetails && !details && <Skeleton lines={6} height={16} />}
        {!(details && (details.all || []).length) && !(ex.hasDetails && !details) && (ex.pstats || []).length > 0 && teamsOf(ex.pstats, m).map((g, i) => (
          <table className="mmstats" key={i}>
            <thead>
              {g.team !== undefined && <tr className="mmstatsteam"><th colSpan={5}><span className="mmstatsname"><Crest team={g.team} />{name(g.team)}</span></th></tr>}
              <tr><th>{tr("Player")}</th><th>K</th><th>D</th><th>A</th><th>ACS</th></tr>
            </thead>
            <tbody>{g.list.map((p) => <tr key={p.name}><td>{who(p.name)}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td><td><b>{p.acs}</b></td></tr>)}</tbody>
          </table>
        ))}
        </div>
        <aside className="mmside">
        {done && state && <MotmVote event={e.event} id={m.id} candidates={candidates} />}
        {state && m.a && m.b && m.a.name && m.b.name && <HeadToHead m={m} state={state} />}
        {cmp && state && m.a && m.b && m.a.name && m.b.name && <Compare m={m} state={state} />}
        {state && m.a && m.b && m.a.name && m.b.name && <Comments event={e.event} id={m.id} />}
        </aside>
        </div>
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
          {done && <a className="btn" href={`/api/og/${e.event}/${m.id}`} target="_blank" rel="noopener noreferrer">🖼 {tr("Result picture")}</a>}
          {google && <a className="btn" href={google} target="_blank" rel="noopener noreferrer">{tr("Add to Google Calendar")}</a>}
          {google && icsUrl && <a className="btn" href={icsUrl} download={`match-${m.id}.ics`}>{tr("Add to my calendar (.ics)")}</a>}
          {page ? <CopyLink href={`/match/${e.event}/${m.id}`} /> : <a className="btn" href={`/match/${e.event}/${m.id}`}>{tr("Match page")}</a>}
        </div>
    </Shell>
  );
}
