"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { localeOf } from "../lib/i18n.js";
import { allMatches } from "../lib/matchlist.js";
import { EVENT_NAMES } from "../lib/paths.js";

/** For OBS (a browser source, transparent background): the match being played, else the next one. Optional ?event=kickoff. */
function View({ initial, event }) {
  const tr = useT();
  useAutoRefresh();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const m = useMemo(() => {
    const list = allMatches(initial).filter((x) => x.sa == null && (!event || x.event === event));
    const live = list.find((x) => x.live);
    if (live || now == null) return live || null;
    return list.filter((x) => x.at && new Date(x.at).getTime() > now - 3 * 3600e3).sort((a, b) => a.at.localeCompare(b.at))[0] || null;
  }, [initial, event, now]);
  if (!m) return <div className="ovl empty" />;
  const when = !m.live && m.at ? new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(m.at)) : "";
  const score = initial.live && initial.live[m.event] && initial.live[m.event][m.id];
  return (
    <div className="ovl">
      <div className="ovlh">
        {m.live ? <span className="livebadge">{tr("LIVE")}</span> : <span>{tr("Next match")}</span>}
        <span>{tr(EVENT_NAMES[m.event])} · Bo{m.bo}</span>
        {when && <span>{when}</span>}
      </div>
      <div className="ovlvs">
        <span className="ovlt a"><span>{(m.a && m.a.name) || tr("TBD")}</span><Crest team={m.a} /></span>
        <b className="ovls">{m.live && score ? `${score.a} : ${score.b}` : "vs"}</b>
        <span className="ovlt"><Crest team={m.b} /><span>{(m.b && m.b.name) || tr("TBD")}</span></span>
      </div>
      <style>{"html,body{background:transparent!important}"}</style>
    </div>
  );
}

export default function Overlay({ initial, lang, event }) {
  return <LangProvider lang={lang}><View initial={initial} event={event} /></LangProvider>;
}
