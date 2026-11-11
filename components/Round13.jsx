"use client";

// Round 13: an agents' tier list on a map, a team's favourite comps as cards, a match's comps and veto, a player's rating map by map,
// the home page's spotlight, the agents' duel.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { AgentIcon, AgentList, agentInfo, mapList, mapSplash } from "./Assets.jsx";
import { readTheme, setTeamTheme } from "./visual.jsx";

const TIER_COLORS = { S: "#ff5c7a", A: "#ffb347", B: "#c9f03c", C: "#6fb8ff" };

/** The agents on a map in tiers S…C. */
export function AgentTierList({ tiers, map }) {
  const tr = useT();
  if (!tiers || !tiers.length) return null;
  return (
    <section>
      <h2>{tr("Agent tier list on {map}", { map })}</h2>
      <div className="tiers">
        {tiers.map((t) => (
          <div key={t.tier} className="tierrow" style={{ "--tc": TIER_COLORS[t.tier] }}>
            <b className="tierl">{t.tier}</b>
            <div className="tieragents">{t.agents.map((a) => (
              <a key={a.name} href={`/agent/${a.name}`} className="tierag" title={tr("{p}% of the teams · {w}% won", { p: a.pick, w: a.win })}>
                <AgentIcon name={a.name} size={40} />
                <small>{a.pick}% · <i>{a.win}%</i></small>
              </a>
            ))}</div>
          </div>
        ))}
      </div>
      <p className="hint">{tr("Ranked mostly by how often teams take it here, a little by how often it wins. 2 maps at least.")}</p>
    </section>
  );
}

/** A team's comps, one card per map with its picture behind. */
export function TeamCompCards({ comps }) {
  const tr = useT();
  if (!comps || !comps.length) return null;
  return (
    <div className="compcards">
      {comps.map((c, i) => (
        <a key={i} className="compcard" href={`/map/${encodeURIComponent(c.map.toLowerCase())}`} style={mapList(c.map) ? { "--mapimg": `url(${mapList(c.map)})` } : undefined}>
          <b>{c.map}</b>
          <AgentList list={c.agents} size={30} />
          <small>{c.played} {tr("played")} · <span className={c.won * 2 >= c.played ? "up" : "down"}>{c.won}–{c.played - c.won}</span></small>
        </a>
      ))}
    </div>
  );
}

/** Each map's two comps in a match, from vlr.gg's table. */
export function MatchComps({ details, a, b }) {
  const tr = useT();
  const maps = ((details && details.maps) || []).filter((mp) => (mp.rows || []).some((r) => (r.agents || []).length));
  if (!maps.length) return null;
  const side = (mp, s) => [...new Set((mp.rows || []).filter((r) => r.side === s).flatMap((r) => r.agents || []))];
  return (
    <section className="mcomps">
      <h3>{tr("Compositions")}</h3>
      {maps.map((mp, i) => (
        <div key={i} className="mcomp" style={mapSplash(mp.map) ? { "--mapimg": `url(${mapList(mp.map)})` } : undefined}>
          <span className={"mcside" + (mp.a > mp.b ? " w" : "")}><AgentList list={side(mp, "a")} size={30} link /><small>{a}</small></span>
          <span className="mcmid"><b>{mp.map}</b><em>{mp.a}–{mp.b}</em></span>
          <span className={"mcside r" + (mp.b > mp.a ? " w" : "")}><AgentList list={side(mp, "b")} size={30} link /><small>{b}</small></span>
        </div>
      ))}
    </section>
  );
}

/** The map veto: bans, picks, the one left. */
export function Veto({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  const word = { ban: tr("bans"), pick: tr("picks"), left: tr("left over") };
  return (
    <section className="veto">
      <h3>{tr("Map veto")}</h3>
      <ol>
        {list.map((v, i) => (
          <li key={i} className={"v" + v.act} style={mapList(v.map) ? { "--mapimg": `url(${mapList(v.map)})` } : undefined}>
            <small>{v.who ? `${v.who} ${word[v.act]}` : word[v.act]}</small>
            <b>{v.map}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A player's rating on each map, bars over the maps' pictures. */
export function RatingByMap({ list }) {
  const tr = useT();
  const rows = (list || []).filter((x) => x.r != null);
  if (rows.length < 2) return null;
  const max = Math.max(1.6, ...rows.map((x) => x.r));
  return (
    <div className="rbymap" aria-label={tr("Rating by map")}>
      <h3>{tr("Rating by map")}</h3>
      {rows.map((x) => (
        <a key={x.map} href={`/map/${encodeURIComponent(x.map.toLowerCase())}`} className="rbm" style={mapList(x.map) ? { "--mapimg": `url(${mapList(x.map)})` } : undefined}>
          <span className="rbmname"><b>{x.map}</b><small>{x.n} {tr("maps")} · {x.won}–{x.n - x.won}</small></span>
          <span className="rbmbar"><i className={x.r >= 1 ? "up" : "down"} style={{ width: `${Math.round((x.r / max) * 100)}%` }} /></span>
          <b className="rbmr">{x.r.toFixed(2)}</b>
        </a>
      ))}
    </div>
  );
}

/** The home page's spotlight: the agent and the map of the moment, turning every few seconds. */
export function Spotlight({ list }) {
  const tr = useT();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!list || list.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list]);
  if (!list || !list.length) return null;
  return (
    <section className="spot" aria-label={tr("Spotlight")}>
      <div className="spottrack" style={{ transform: `translateX(-${i * 100}%)` }}>
        {list.map((s, k) => (
          <a key={k} href={s.href} className={"spotslide " + s.kind} style={{ "--spimg": `url(${s.img})`, ...(s.color ? { "--agc": s.color } : {}) }} aria-hidden={k !== i} tabIndex={k === i ? 0 : -1}>
            <small>{tr(s.title)}</small>
            <b>{s.name}</b>
            <span>{tr(s.line.k, { n: s.line.n })}</span>
          </a>
        ))}
      </div>
      {list.length > 1 && <div className="spotdots">{list.map((s, k) => <button key={k} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={tr(s.title)} />)}</div>}
    </section>
  );
}

/** Two agents side by side. */
export function AgentDuel({ duel, all }) {
  const tr = useT();
  const [a, setA] = useState(duel ? duel.a.key : (all[0] || {}).key || "");
  const [b, setB] = useState(duel ? duel.b.key : (all[1] || {}).key || "");
  const go = (e) => { e.preventDefault(); if (a && b) window.location.href = `/agent/duel?a=${a}&b=${b}`; };
  const side = (p) => {
    const info = agentInfo(p.key) || {};
    return (
      <div className="duelag" style={{ "--agc": p.color || "var(--lime)", "--agimg": info.portrait ? `url(${info.portrait})` : "none" }}>
        <a href={`/agent/${p.key}`}><b>{p.name}</b></a>
        <small>{p.role ? tr(p.role) : ""}</small>
        <div className="aghnums"><div><b>{p.picks}</b><span>{tr("maps picked")}</span></div><div><b>{p.pct}%</b><span>{tr("maps won")}</span></div></div>
      </div>
    );
  };
  return (
    <>
      <form className="duelform" onSubmit={go}>
        <select value={a} onChange={(e) => setA(e.target.value)} aria-label={tr("First agent")}>{all.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
        <span>vs</span>
        <select value={b} onChange={(e) => setB(e.target.value)} aria-label={tr("Second agent")}>{all.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select>
        <button type="submit" className="btn pri">{tr("Compare")}</button>
      </form>
      {duel && (
        <>
          <div className="duel">{side(duel.a)}<b className="duelvs">VS</b>{side(duel.b)}</div>
          {duel.maps.length > 0 && (
            <div className="duelmaps">
              <h3>{tr("Where each is picked")}</h3>
              {duel.maps.map((m) => (
                <div key={m.map} className="duelmap">
                  <span className="dl"><i style={{ width: `${m.a}%`, background: duel.a.color || "var(--lime)" }} /><small>{m.a}%</small></span>
                  <b>{m.map}</b>
                  <span className="dr"><i style={{ width: `${m.b}%`, background: duel.b.color || "var(--lime)" }} /><small>{m.b}%</small></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** A nudge on the home page: the site in the colours of a followed team, in one tap (until chosen or closed). */
export function ThemeSuggest({ teams }) {
  const tr = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sync = () => { let off = false; try { off = localStorage.getItem("vct-theme-suggest") === "off"; } catch { /* none */ } setShow(!off && !readTheme()); };
    sync();
    window.addEventListener("vct-team-theme", sync);
    return () => window.removeEventListener("vct-team-theme", sync);
  }, []);
  if (!show || !teams.length) return null;
  const close = () => { try { localStorage.setItem("vct-theme-suggest", "off"); } catch { /* not remembered */ } setShow(false); };
  return (
    <div className="themesug" role="note">
      <span>🎨 {tr("Wear your team's colours on the whole site:")}</span>
      {teams.slice(0, 4).map((t) => <button key={t.name} type="button" className="btn" onClick={() => setTeamTheme(t)}>{t.logo ? <img src={t.logo} alt="" width="18" height="18" /> : null} {t.name}</button>)}
      <button type="button" className="themesugx" onClick={close} aria-label={tr("Close")}>×</button>
    </div>
  );
}
