"use client";

// The editor's follow-up during the matches: the "live" marks left behind, the live matches with no stream link, and how
// vlr.gg's reading goes.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { allMatches, eventData, matchesOf } from "../lib/matchlist.js";

const nameOf = (t) => (t && t.name) || "TBD";

/** The matches still marked live long after their time (lib/matchlist.js dropForgottenLive): no longer shown live, cleared here. */
export function ForgottenLive({ initial, call, onDone }) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const list = (initial.forgottenLive || []).map((x) => ({ ...x, m: matchesOf(x.event, eventData(initial, x.event)).find((m) => m.id === x.id) })).filter((x) => x.m);
  if (!list.length) return null;
  const clear = async (items) => {
    setBusy(true);
    let n = 0;
    for (const x of items) {
      try { await call("/api/mlive", { event: x.event, id: x.id, live: false }); n += 1; } catch (e) { onDone(tr.server(e.message)); break; }
    }
    setBusy(false);
    if (n) onDone(tr("{n} matches no longer live", { n }));
  };
  return (
    <section>
      <h2>🕸️ {tr("Forgotten live matches")} <small>({list.length})</small></h2>
      <p className="note">{tr("Still marked live 12 hours after their time, with no news from vlr.gg: visitors no longer see them live. Take them off, or enter their score.")}</p>
      <ul className="forgot">
        {list.slice(0, 40).map((x) => (
          <li key={x.event + x.id}>
            <span><small>{tr(EVENT_NAMES[x.event] || x.event)}</small> {nameOf(x.m.a)} – {nameOf(x.m.b)}</span>
            <button type="button" className="btn sm" disabled={busy} onClick={() => clear([x])}>{tr("No longer live")}</button>
          </li>
        ))}
      </ul>
      {list.length > 1 && <button type="button" className="btn" disabled={busy} onClick={() => clear(list)}>{tr("Take all {n} off live", { n: list.length })}</button>}
    </section>
  );
}

/** The matches being played (or starting within 30 minutes) with no stream link anywhere: visitors cannot watch them from the site. */
export function LiveNoStream({ initial, now, onOpen }) {
  const tr = useT();
  const soon = (m) => m.at && new Date(m.at).getTime() - now < 30 * 60000 && new Date(m.at).getTime() > now - 3 * 3600000;
  const list = allMatches(initial).filter((m) => m.sa == null && m.a && m.b && m.a.name && m.b.name && (m.live || soon(m)))
    .filter((m) => !(((initial.extra || {})[m.event] || {})[m.id] || {}).stream && !((initial.info || {})[m.event] || {}).stream);
  if (!list.length) return null;
  return (
    <section>
      <h2>📺 {tr("Live or starting soon, with no stream")} <small>({list.length})</small></h2>
      <ul className="forgot">
        {list.slice(0, 20).map((m) => (
          <li key={m.event + m.id}>
            <span><small>{tr(EVENT_NAMES[m.event] || m.event)}</small> {nameOf(m.a)} – {nameOf(m.b)}{m.live ? ` · ${tr("LIVE")}` : ""}</span>
            {onOpen && <button type="button" className="btn sm" onClick={() => onOpen(m.event, true)}>{tr("Open")}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const ago = (at, now, tr) => {
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  return s < 90 ? tr("{n} s ago", { n: s }) : s < 5400 ? tr("{n} min ago", { n: Math.round(s / 60) }) : tr("{n} h ago", { n: Math.round(s / 3600) });
};

/** vlr.gg's reading: its last round (pages, time taken, matches being played) and the age of each list it follows. */
export function VlrStatus() {
  const tr = useT();
  const [data, setData] = useState(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/vlrstatus").then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) { setData(j); setNow(Date.now()); } }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (!data) return null;
  const r = data.round;
  return (
    <section>
      <h2>🛰️ {tr("vlr.gg reading")}</h2>
      {r ? (
        <p className={r.error ? "note warn" : "note"}>
          {tr("Last round {ago}: {pages} pages in {s} s, {live} matches being played on vlr.gg.", { ago: ago(r.at, now, tr), pages: r.pages, s: Math.round(r.ms / 100) / 10, live: r.live })}
          {r.error ? ` ${tr("Problem")} : ${r.error}` : ""}
        </p>
      ) : <p className="note">{tr("No round yet since this version.")}</p>}
      {data.lists.length > 0 && (
        <table className="adtable">
          <thead><tr><th scope="col">{tr("vlr.gg event")}</th><th scope="col">{tr("List read")}</th><th scope="col">{tr("Matches")}</th><th scope="col">{tr("LIVE")}</th></tr></thead>
          <tbody>{data.lists.map((l) => (
            <tr key={l.vlr}><td><a href={`https://www.vlr.gg/event/matches/${l.vlr}/?series_id=all`} target="_blank" rel="noopener noreferrer">{l.vlr}</a></td><td>{l.at ? ago(l.at, now, tr) : "–"}</td><td>{l.matches}</td><td>{l.live || ""}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
