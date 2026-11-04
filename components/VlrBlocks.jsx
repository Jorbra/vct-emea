"use client";

import { useT } from "./lang.jsx";

const Name = ({ item }) => (item.href ? <a href={item.href}>{item.name}</a> : item.name);

/** The latest matches from vlr.gg. */
export function VlrResults({ vlr }) {
  const tr = useT();
  if (!vlr || !vlr.results.length) return null;
  return (
    <section>
      <h2>{tr("Recent results")}</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>{tr("Date")}</th><th>{tr("Event")}</th><th>{tr("Match")}</th><th>{tr("Score")}</th></tr></thead>
          <tbody>
            {vlr.results.map((r, i) => (
              <tr key={i} className={r.win ? "w" : "l"}>
                <td className="nowrap">{r.date || "–"}</td>
                <td>{r.event}{r.stage ? <small className="vlrstage"> {r.stage}</small> : null}</td>
                <td><Name item={{ name: r.a, href: r.aHref }} /> vs <Name item={{ name: r.b, href: r.bHref }} /></td>
                <td className="tscore">{r.sa} – {r.sb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A player's numbers from vlr.gg, overall and per agent. */
export function VlrStats({ vlr }) {
  const tr = useT();
  if (!vlr || !vlr.totals) return null;
  const t = vlr.totals;
  return (
    <section>
      <h2>{tr("Career statistics")}</h2>
      <div className="pstatbar">
        <div><b>{t.rating}</b><span>{tr("Rating")}</span></div>
        <div><b>{t.acs}</b><span>ACS</span></div>
        <div><b>{t.kd}</b><span>K/D</span></div>
        <div><b>{t.adr}</b><span>ADR</span></div>
        <div><b>{t.kast}%</b><span>KAST</span></div>
        <div><b>{t.maps}</b><span>{tr("Maps")}</span></div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>{tr("Agent")}</th><th>{tr("Maps")}</th><th>{tr("Rating")}</th><th>ACS</th><th>K/D</th><th>ADR</th><th>KAST</th><th>K</th><th>D</th><th>A</th></tr></thead>
          <tbody>
            {vlr.agents.map((a) => (
              <tr key={a.agent}>
                <td className="vlragent">{a.agent}</td><td className="nowrap">{a.maps} ({a.pick}%)</td><td><b>{a.rating}</b></td><td>{a.acs}</td><td>{a.kd}</td><td>{a.adr}</td><td>{a.kast}%</td><td>{a.k}</td><td>{a.d}</td><td>{a.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Where these numbers come from. */
export function VlrCredit({ vlr }) {
  const tr = useT();
  if (!vlr || !(vlr.results.length || vlr.totals)) return null;
  return <p className="note">{tr("Statistics and recent results from")} <a href={vlr.url} target="_blank" rel="noopener noreferrer">vlr.gg</a>, {tr("as of {date}", { date: vlr.fetched.slice(0, 10) })}.</p>;
}
