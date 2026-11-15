"use client";

// Round 26: a match's win chances (from the power ratings), big on the match page, small on the home page's coming matches.
import { useT } from "./lang.jsx";
import { Crest } from "./Crest.jsx";
import { winChance } from "../lib/proba26.js";

/** The match page's band: both teams' chances, the favourite's side lit. */
export function WinChance({ m, rating }) {
  const tr = useT();
  if (!m || !m.a || !m.b || m.sa != null || !rating) return null;
  const c = winChance(rating, m.a.name, m.b.name, m.bo || 3);
  if (!c) return null;
  const fav = c.a === c.b ? null : c.a > c.b ? "a" : "b";
  return (
    <section className="chance26" aria-label={tr("Win chances")}>
      <h2>🎲 {tr("Win chances")} <small>{tr("From the power ranking (Elo of the season)")}</small></h2>
      <div className="ch26row">
        <span className={"ch26team a" + (fav === "a" ? " fav" : "")}><Crest team={m.a} /><b>{m.a.name}</b><strong>{c.a}%</strong></span>
        <span className="ch26bar" role="img" aria-label={`${m.a.name} ${c.a}% · ${m.b.name} ${c.b}%`}><i className="a" style={{ width: `${c.a}%` }} /><i className="b" style={{ width: `${c.b}%` }} /></span>
        <span className={"ch26team b" + (fav === "b" ? " fav" : "")}><strong>{c.b}%</strong><b>{m.b.name}</b><Crest team={m.b} /></span>
      </div>
      <p className="hint">{fav ? tr("{team} is the favourite.", { team: fav === "a" ? m.a.name : m.b.name }) : tr("A perfectly even match.")} {tr("A series in Bo{n}.", { n: m.bo || 3 })}</p>
    </section>
  );
}

/** The thin bar under a coming match on the home page. */
export function MiniChance({ m, rating }) {
  const tr = useT();
  const c = rating ? winChance(rating, m.a && m.a.name, m.b && m.b.name, m.bo || 3) : null;
  if (!c) return null;
  return (
    <span className="mch26" title={`${tr("Win chances")} : ${m.a.name} ${c.a}% · ${m.b.name} ${c.b}%`}>
      <em className={c.a >= c.b ? "fav" : ""}>{c.a}%</em>
      <span><i style={{ width: `${c.a}%` }} /></span>
      <em className={c.b > c.a ? "fav" : ""}>{c.b}%</em>
    </span>
  );
}
