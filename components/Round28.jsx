"use client";
// Round 28: the team comparison's form, key players and meetings over every season (also on the match page).

import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { EVENT_NAMES, siteHref, teamHref } from "../lib/paths.js";

const scoreOf = (m, tr) => (m.note && m.note.kind === "ff" ? tr("Forfeit") : `${m.sa}–${m.sb}`);

/** Each team's last five results, side by side: W / L squares with the opponent and score on hover. */
export function FormCompare({ a, b, form }) {
  const tr = useT();
  const strip = (list) => (list.length === 0 ? <small className="note">{tr("No result yet.")}</small> : (
    <span className="formstrip">{list.map((m) => (
      <a key={m.event + m.id} href={`/match/${m.event}/${m.id}`} className={"formsq " + (m.won ? "w" : "l")} title={`${m.won ? tr("Win") : tr("Loss")} ${scoreOf(m, tr)} · ${(m.opp && m.opp.name) || ""}`}>
        {m.won ? tr("W") : tr("L")}
      </a>
    ))}</span>
  ));
  return (
    <section className="formcmp">
      <h2>{tr("Recent form")} <small>{tr("Last 5 matches, latest on the left")}</small></h2>
      <div className="formrow"><span className="formteam"><Crest team={a} />{a.name}</span>{strip(form.a)}</div>
      <div className="formrow"><span className="formteam"><Crest team={b} />{b.name}</span>{strip(form.b)}</div>
    </section>
  );
}

/** Each team's three best players by rating (vlr.gg's tables, 2 maps at least). */
export function KeyPlayers({ a, b, stars }) {
  const tr = useT();
  if (!stars || (!stars.a.length && !stars.b.length)) return null;
  const col = (t, list) => (
    <div className="kpcol">
      <h3><Crest team={t} />{t.name}</h3>
      {list.length === 0 ? <small className="note">{tr("No stats yet.")}</small> : (
        <ol>{list.map((p) => (
          <li key={p.slug}><a href={`/player/${p.slug}`}>{p.name}</a><span><b>{p.r != null ? p.r.toFixed(2) : "–"}</b> <small>{tr("rating")}</small> · {p.acs ?? "–"} <small>ACS</small> · {p.kd ?? "–"} <small>K/D</small></span></li>
        ))}</ol>
      )}
    </div>
  );
  return (
    <section className="keyplayers">
      <h2>{tr("Key players")} <small>{tr("Best rating, 2 maps at least")}</small></h2>
      <div className="kpgrid">{col(a, stars.a)}{col(b, stars.b)}</div>
    </section>
  );
}

/** Their meetings over every season: the total, then season by season with each match. */
export function HeadToHeadAll({ a, b, h, title }) {
  const tr = useT();
  if (!h || !h.seasons.length) return null;
  return (
    <section className="h2hall">
      <h2>{title || tr("Head to head, every season")}</h2>
      <div className="h2htotal spoil">
        <a href={teamHref(a.name)}><Crest team={a} />{a.name}</a>
        <b>{h.a} – {h.b}</b>
        <a href={teamHref(b.name)} className="r">{b.name}<Crest team={b} /></a>
        <small>{tr("{n} match(es) · maps {a}–{b}", { n: h.a + h.b, a: h.mapsA, b: h.mapsB })}</small>
      </div>
      {h.seasons.map((s) => (
        <div key={s.slug || "now"} className="h2hseason">
          <h3>{s.slug ? s.name : tr("This season")} <small className="spoil">{s.a} – {s.b}</small></h3>
          <ul className="weeklist">{s.list.map((m) => (
            <li key={m.event + m.id} className={m.won === "a" ? "ok" : "ko"}>
              <span>{m.won === "a" ? "🟢" : "🔴"}</span>
              <a href={s.slug ? `/archives/${s.slug}${siteHref(m.event)}` : `/match/${m.event}/${m.id}`} className="spoil">{a.name} {scoreOf(m, tr)} {b.name}</a>
              <small>{tr(EVENT_NAMES[m.event] || m.event)}{m.at ? ` · ${new Date(m.at).toLocaleDateString(tr.lang === "fr" ? "fr-FR" : tr.lang, { day: "numeric", month: "short", year: "numeric" })}` : ""}</small>
            </li>
          ))}</ul>
        </div>
      ))}
    </section>
  );
}
