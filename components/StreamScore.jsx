"use client";

// The score above a stream played on the site (never over the picture): both teams in their logo's colour,
// the series score, the maps won and the map being played with its rounds. It updates with the page.
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { useTeamColor } from "./visual.jsx";
import { mapList } from "./Assets.jsx";

const tagOf = (t, tr) => (t ? (t.tag || t.name || tr("TBD")) : tr("TBD"));

export function StreamScore({ m }) {
  const tr = useT();
  const ca = useTeamColor(m.a && m.a.logo);
  const cb = useTeamColor(m.b && m.b.logo);
  const s = m.score || {};
  // a map vlr.gg has not named yet ("TBD") is not shown
  const maps = (s.maps || []).filter((x) => x && x.map && !/^tbd$/i.test(String(x.map).trim()));
  const now = maps.find((x) => !x.done) || null;
  const need = m.bo ? Math.ceil(m.bo / 2) : 0;
  const pips = (won, side) => (need > 1 ? <span className={"sspips " + side}>{Array.from({ length: need }, (_, i) => <i key={i} className={i < won ? "on" : ""} />)}</span> : null);
  return (
    <div className="streamscore" style={{ ...(ca ? { "--ta": ca } : {}), ...(cb ? { "--tb": cb } : {}) }}>
      <span className="ssteam a"><Crest team={m.a} /><b>{tagOf(m.a, tr)}</b></span>
      <span className="ssnum a">{s.a ?? 0}</span>
      <span className="ssmid">
        {m.live ? <i className="ssdot" aria-label={tr("LIVE")} /> : null}
        <small>{m.bo ? `Bo${m.bo}` : "vs"}</small>
        <span className="sspipsrow">{pips(s.a || 0, "a")}{pips(s.b || 0, "b")}</span>
      </span>
      <span className="ssnum b">{s.b ?? 0}</span>
      <span className="ssteam b"><b>{tagOf(m.b, tr)}</b><Crest team={m.b} /></span>
      {now && (
        <span className="ssmap" style={mapList(now.map) ? { "--mapimg": `url(${mapList(now.map)})` } : undefined}>
          <b>{now.map}</b>{now.a != null ? <span>{now.a} – {now.b}</span> : null}
        </span>
      )}
      <a className="ssopen" href={`/match/${m.event}/${m.id}`}>{tr("Match page")} ›</a>
    </div>
  );
}
