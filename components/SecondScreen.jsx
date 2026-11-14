"use client";

// The second screen: on a phone beside the stream, a match's score, the map being played round by round and the live chat.
import { useEffect, useState } from "react";
import { LangProvider, useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { Comments } from "./Fans.jsx";
import { RoundChart, TensionBadges } from "./LiveMore.jsx";
import { mapList } from "./Assets.jsx";

function View({ initial, event, id }) {
  const tr = useT();
  const [d, setD] = useState(initial);
  useEffect(() => {
    let on = true;
    const load = () => { if (document.hidden) return; fetch(`/api/overlay?match=${event}:${id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j) setD(j); }).catch(() => {}); };
    const t = setInterval(load, 8000);
    return () => { on = false; clearInterval(t); };
  }, [event, id]);
  const m = d.match;
  if (!m) return <div className="wrap"><p className="note">{tr("This match is not known.")}</p></div>;
  const now = m.maps.find((x) => !x.done && x.map && !/^tbd$/i.test(x.map)) || null;
  return (
    <div className="second">
      <a className="secback" href={`/match/${event}/${id}`}>‹ {tr("Match page")}</a>
      <div className="secscore">
        <span><Crest team={m.a} /><b>{m.a.tag || m.a.name}</b></span>
        <strong>{m.sa ?? 0} – {m.sb ?? 0}</strong>
        <span><b>{m.b.tag || m.b.name}</b><Crest team={m.b} /></span>
      </div>
      <div className="secstate">{m.live ? <><i className="ssdot inline" /> {tr("LIVE")}</> : m.done ? tr("Final") : tr("Upcoming")} · {tr(m.eventName)}{m.bo ? ` · Bo${m.bo}` : ""}</div>
      <TensionBadges t={m.tension} />
      {now && <div className="secmap" style={mapList(now.map) ? { "--mapimg": `url(${mapList(now.map)})` } : undefined}><b>{now.map}</b><strong>{now.a} – {now.b}</strong></div>}
      <RoundChart rounds={m.rounds} a={m.a.tag || m.a.name} b={m.b.tag || m.b.name} />
      {m.maps.filter((x) => x.done).length > 0 && <div className="secmaps">{m.maps.filter((x) => x.done).map((x, i) => <span key={i}>{x.map} <b>{x.a}–{x.b}</b></span>)}</div>}
      <Comments event={event} id={id} live={m.live} />
    </div>
  );
}

export default function SecondScreen({ lang, ...p }) {
  return <LangProvider lang={lang}><View {...p} /></LangProvider>;
}
