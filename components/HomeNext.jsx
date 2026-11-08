"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { countdownText } from "./matchTime.jsx";
import { nextStart } from "../lib/nextstart.js";
import { EVENT_NAMES, siteHref } from "../lib/paths.js";
import { formatMatchTime } from "../lib/schedule.js";
import { localeOf } from "../lib/i18n.js";

const RECAPS = ["q1", "q2", "trq1", "trq2", "meq1", "meq2", "naq1", "naq2"];

/** On the home page: the countdown to the next event and its first matches, and the recaps of the qualifiers already played. */
export default function HomeNext({ initial }) {
  const tr = useT();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = useMemo(() => (now == null ? null : nextStart(initial, now)), [initial, now == null ? 0 : Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const recaps = RECAPS.filter((e) => initial.qualifiers[e] && Object.keys(initial.qualifiers[e].scores || {}).length > 0);
  if (!next && !recaps.length) return null;
  const left = next && now != null ? new Date(next.at).getTime() - now : 0;
  const day = next ? new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "long", day: "numeric", month: "long" }).format(new Date(next.at)) : "";
  const parts = left > 0 ? [[Math.floor(left / 86400000), tr("days")], [Math.floor((left % 86400000) / 3600000), tr("hours")], [Math.floor((left % 3600000) / 60000), "min"], [Math.floor((left % 60000) / 1000), "s"]] : [];
  const q = next && initial.qualifiers[next.event];
  const info = next && initial.info && initial.info[next.event];
  const size = q ? q.slots.filter(Boolean).length || q.slots.length : 0;
  const bo = q && q.bo ? Math.max(...Object.values(q.bo).filter(Number.isFinite), 1) : 0;
  const fmtDay = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Intl.DateTimeFormat(localeOf(tr.lang), { day: "numeric", month: "short" }).format(new Date(`${s}T12:00:00`)) : "");
  const meta = next ? [size ? tr("{n} teams", { n: size }) : "", bo > 1 ? `Bo${bo}` : "", info && info.start ? `${fmtDay(info.start)}${info.end ? ` → ${fmtDay(info.end)}` : ""}` : ""].filter(Boolean).join(" · ") : "";
  return (
    <section className="homenext">
      {next && left > 0 && (
        <a className="nextcard" href={siteHref(next.event)}>
          <span className="nextlabel">{tr("Next event")}</span>
          <span className="nexttitle">{tr(EVENT_NAMES[next.event] || next.event)}</span>
          {meta && <span className="nextmeta">{meta}</span>}
          <span className="nextclock" aria-label={next.exact ? countdownText(left, tr.lang) : tr("starts on {day}", { day })}>
            {parts.map(([v, l]) => <span key={l} className="nextunit"><b>{String(v).padStart(2, "0")}</b><small>{l}</small></span>)}
          </span>
          <span className="nextwhen">{next.exact ? formatMatchTime(next.at, tr.lang, true) : tr("starts on {day}", { day })}</span>
          {next.matches.some((m) => m.a || m.b) && (
            <span className="nextmatches">
              {next.matches.map((m) => (
                <span key={m.id} className="nextm">
                  <span className="nextt"><Crest team={m.a} />{(m.a && m.a.name) || tr("TBD")}</span>
                  <small>vs</small>
                  <span className="nextt"><Crest team={m.b} />{(m.b && m.b.name) || tr("TBD")}</span>
                </span>
              ))}
            </span>
          )}
        </a>
      )}
      {recaps.length > 0 && (
        <div className="recaplinks">
          {recaps.map((e) => <a key={e} className="btn" href={`/recap/${e}`}>📋 {tr("Recap")} · {tr(EVENT_NAMES[e])}</a>)}
        </div>
      )}
    </section>
  );
}
