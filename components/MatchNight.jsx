"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { formatMatchTime } from "../lib/schedule.js";
import { Score } from "./visual.jsx";

/** The match night: every match of the day as tiles, live first, refreshed every 20 seconds. Made for a second screen. */
function Night({ initial }) {
  const tr = useT();
  const [matches, setMatches] = useState(initial);
  const [at, setAt] = useState("");
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/soiree").then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) { setMatches(j.matches); setAt(new Date().toLocaleTimeString(tr.lang === "fr" ? "fr-FR" : undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })); } }).catch(() => { /* offline */ });
    const t = setInterval(load, 20000);
    return () => { on = false; clearInterval(t); };
  }, [tr.lang]);
  const sorted = useMemo(() => [...matches].sort((x, y) => Number(y.live) - Number(x.live) || Number(x.sa != null) - Number(y.sa != null) || (x.at || "").localeCompare(y.at || "")), [matches]);
  const live = sorted.filter((m) => m.live).length;
  const done = sorted.filter((m) => m.sa != null).length;
  return (
    <div className="night">
      <header className="nighthead">
        <a href="/" className="nightback">← VCT EMEA</a>
        <h1>{tr("Match night")}</h1>
        <span className="nightcount">{live > 0 && <span className="livebadge">{tr("{n} live", { n: live })}</span>} {tr("{d} of {n} finished", { d: done, n: sorted.length })}{at ? ` · ${at}` : ""}</span>
      </header>
      {sorted.length === 0 ? <p className="note">{tr("No match today.")}</p> : (
        <div className="nightgrid">
          {sorted.map((m) => {
            const over = m.sa != null;
            const s = m.score || {};
            return (
              <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className={"nighttile" + (m.live ? " live" : over ? " over" : "")}>
                <div className="nttop">{m.live ? <span className="livebadge">{tr("LIVE")}</span> : <span className="ntwhen">{over ? tr("Finished") : m.at ? formatMatchTime(m.at, tr.lang, true) : ""}</span>}<small>{tr(EVENT_NAMES[m.event] || m.event)}</small></div>
                {[["a", m.a, over ? m.sa : s.a], ["b", m.b, over ? m.sb : s.b]].map(([side, t, v]) => (
                  <div key={side} className={"ntteam" + (over && m.win === side ? " w" : over ? " lo" : "")}>
                    <Crest team={t} /><span className="ntname">{(t && t.name) || tr("TBD")}</span>
                    {(m.live || over) && <Score className="ntscore" value={v ?? 0} />}
                  </div>
                ))}
                {m.live && (s.maps || []).length > 0 && <div className="mcchips">{s.maps.map((x, i) => <span key={i} className={"mcchip" + (!x.done && i === s.maps.length - 1 ? " now" : "")}>{x.map} {x.a}–{x.b}</span>)}</div>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MatchNight({ lang, matches }) {
  return <LangProvider lang={lang}><Night initial={matches} /></LangProvider>;
}
