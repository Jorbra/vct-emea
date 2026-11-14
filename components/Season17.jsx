"use client";

// Round 17: the season as a timeline, and the site's match-night look while a big match is live.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { formatDates } from "../lib/status.js";
import { siteHref } from "../lib/paths.js";

/** Lane by lane (Europe, Türkiye, MENA, Kickoff, Game Changers): each event, its dates, where it stands, the teams it sent on. */
export function SeasonTimeline({ lanes }) {
  const tr = useT();
  if (!lanes || !lanes.length) return null;
  const label = { done: tr("Finished"), live: tr("Live"), upcoming: tr("Upcoming") };
  return (
    <section className="frise" aria-label={tr("The season at a glance")}>
      <h2>🗺️ {tr("The season at a glance")}</h2>
      <div className="friselanes">{lanes.map((l) => (
        <div key={l.lane} className="friselane">
          <b className="friselabel">{l.lane}</b>
          <ol className="frisetrack">{l.events.map((e, i) => (
            <li key={e.event} className={"frisestep " + e.state}>
              {i > 0 && <span className="friselink" aria-hidden="true" />}
              <a href={siteHref(e.event)} className="frisenode">
                <span className={"frisedot " + e.state} aria-hidden="true" />
                <b>{tr(e.name)}</b>
                <small>{formatDates(e.info, tr.lang) || tr("Dates to be announced")}</small>
                <em className={"frisestate " + e.state}>{label[e.state] || e.state}{e.of ? ` · ${e.teams}/${e.of}` : ""}</em>
                {e.qualified.length > 0 && <span className="frisequal" title={e.qualified.map((q) => q.team).join(", ")}>{e.qualified.slice(0, 6).map((q) => <Crest key={q.slug} team={{ name: q.team, logo: q.logo }} />)}</span>}
              </a>
            </li>
          ))}</ol>
        </div>
      ))}</div>
    </section>
  );
}

/** While a big match is live (the events after the open qualifiers, or a qualifier's last rounds): the site's match-night look and a slim band. */
export function MatchNightTheme() {
  const tr = useT();
  const [big, setBig] = useState(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(sessionStorage.getItem("vct-night-hidden") === "1"); } catch { /* not remembered */ }
    let on = true;
    const load = () => {
      if (document.hidden || /^\/(admin|overlay|embed|ecran)/.test(window.location.pathname)) return;
      fetch("/api/livescores").then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) setBig((j.live || []).find((m) => m.big) || null); }).catch(() => {});
    };
    const first = setTimeout(load, 2500);
    const t = setInterval(load, 60000);
    return () => { on = false; clearTimeout(first); clearInterval(t); };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (big) root.dataset.matchnight = "1"; else delete root.dataset.matchnight;
    return () => { delete root.dataset.matchnight; };
  }, [big]);
  if (!big || hidden) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem("vct-night-hidden", "1"); } catch { /* not remembered */ } };
  return (
    <div className="nightband" role="status">
      <a href={`/match/${big.event}/${big.id}`}>🔥 <b>{tr("Match night")}</b> · {big.a} <strong>{big.sa}–{big.sb}</strong> {big.b} <span>{tr("live")} ›</span></a>
      <button type="button" onClick={close} aria-label={tr("Close")}>×</button>
    </div>
  );
}
