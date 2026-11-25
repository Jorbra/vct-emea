"use client";
// The home page on a match day: a giant countdown to the day's first match, then the live mode (today's matches and their
// scores as they go), then a link to the day's recap once everything is over. Nothing on a day without a match.

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { matchDayState } from "../lib/matchday.js";

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
const hourOf = (iso, lang) => new Date(iso).toLocaleTimeString(lang === "fr" ? "fr-FR" : lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const pad = (n) => String(n).padStart(2, "0");

export default function MatchDay({ events }) {
  const tr = useT();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const today = useMemo(() => {
    if (now == null) return [];
    const day = PARIS_DAY.format(new Date(now));
    return events.flatMap((e) => e.items.filter((m) => m.a && m.b && m.a.name && m.b.name && e.times[m.id] && PARIS_DAY.format(new Date(e.times[m.id])) === day)
      .map((m) => ({ ...m, event: e.event, at: e.times[m.id], live: !!e.live[m.id] && m.sa == null, score: e.live[m.id] || null })))
      .sort((x, y) => x.at.localeCompare(y.at));
  }, [events, now == null ? "" : PARIS_DAY.format(new Date(now))]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = now == null ? null : matchDayState(today, now);
  if (!st) return null;
  if (st.kind === "over") {
    return (
      <section className="mday over" aria-label={tr("Match day")}>
        <span className="mdtag">{tr("Match day over")}</span>
        <a className="btn pri" href="/jour">{tr("See the day's recap")}</a>
      </section>
    );
  }
  if (st.kind === "before") {
    const s = Math.max(0, Math.floor(st.left / 1000));
    const h = Math.floor(s / 3600);
    const f = st.first;
    return (
      <section className="mday before" aria-label={tr("Match day")}>
        <span className="mdtag">{tr("Match day")} · {tr("{n} matches today", { n: today.length })}</span>
        <div className="mdclock" role="timer" aria-live="off">
          {h >= 24 ? <span>{Math.floor(h / 24)}<small>{tr("d")}</small></span> : null}
          <span>{pad(h % 24)}<small>h</small></span><span>{pad(Math.floor((s % 3600) / 60))}<small>min</small></span><span>{pad(s % 60)}<small>s</small></span>
        </div>
        <div className="mdfirst">
          <Crest team={f.a} /><b>{f.a.name}</b><span>vs</span><b>{f.b.name}</b><Crest team={f.b} />
        </div>
        <small className="mdwhere">{tr(EVENT_NAMES[f.event] || f.event)} · {hourOf(f.at, tr.lang)}</small>
        <a className="btn pri" href="/ce-soir">{tr("Tonight's matches")}</a>
      </section>
    );
  }
  return (
    <section className="mday live" aria-label={tr("Match day")}>
      <span className="mdtag"><span className="livebadge">{tr("LIVE")}</span> {tr("Match day")}</span>
      <ul className="mdlist">
        {today.map((m) => {
          const a = m.sa != null ? m.sa : m.score ? m.score.a : null;
          const b = m.sb != null ? m.sb : m.score ? m.score.b : null;
          return (
            <li key={m.event + m.id} className={m.live ? "on" : m.sa != null ? "done" : ""}>
              <a href={`/match/${m.event}/${m.id}`}>
                <span className="mdh">{m.live ? "●" : hourOf(m.at, tr.lang)}</span>
                <span className={m.win === "a" ? "w" : ""}>{m.a.name}</span>
                <b>{a != null ? `${a}–${b}` : "vs"}</b>
                <span className={m.win === "b" ? "w" : ""}>{m.b.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="row"><a className="btn pri" href="/ce-soir">{tr("Watch on one screen")}</a> <a className="btn" href="/live">{tr("Live")}</a></p>
    </section>
  );
}
