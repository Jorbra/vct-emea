"use client";

// Round 14: back to top, a team's map pool in pictures, the other maps, an agent's role mates, the 404's agent, the stats' shortcuts;
// for the editors: vlr.gg's tables, today's games, the week's meta as a draft, the pictures missing.
import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { VIEW as ASSETS } from "./Assets.jsx";
import { mapList } from "./Assets.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** A round button that takes the page back to the top, once it has been scrolled down. */
export function BackToTop() {
  const tr = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 900);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button type="button" className={"totop" + (show ? " on" : "")} aria-label={tr("Back to top")} tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>↑</button>
  );
}

/** A team's maps as tiles over each map's picture, coloured by how often it wins there. */
export function MapPoolTiles({ list }) {
  const tr = useT();
  if (!list || !list.length) return null;
  return (
    <div className="pooltiles">
      {list.map((m) => {
        const p = Math.round((m.won / m.played) * 100);
        return (
          <a key={m.map} href={`/map/${encodeURIComponent(m.map.toLowerCase())}`} className={"pooltile " + (p >= 60 ? "hot" : p >= 40 ? "mid" : "cold")} style={mapList(m.map) ? { "--mapimg": `url(${mapList(m.map)})` } : undefined}>
            <b>{m.map}</b>
            <span className="poolpct">{p}%</span>
            <small>{m.won}–{m.played - m.won} · {m.played} {tr("played")}</small>
          </a>
        );
      })}
    </div>
  );
}

/** The other maps of the pool, to go from one to the next. */
export function OtherMaps({ current }) {
  const tr = useT();
  const list = Object.entries(ASSETS.maps).filter(([k, v]) => v.icon && norm(k) !== norm(current));
  return (
    <section className="othermaps">
      <h3>{tr("The other maps")}</h3>
      <div>{list.map(([k, v]) => <a key={k} href={`/map/${norm(k)}`} style={{ "--mapimg": `url(${v.list})` }}><b>{k}</b></a>)}</div>
    </section>
  );
}

/** The other agents of the same role. */
export function RoleMates({ name, role }) {
  const tr = useT();
  const list = Object.entries(ASSETS.agents).filter(([, a]) => a.role === role && norm(a.name) !== norm(name));
  if (!role || !list.length) return null;
  return (
    <section className="rolemates">
      <h3>{tr("Other {role}s", { role: tr(role) })}</h3>
      <div>{list.map(([k, a]) => <a key={k} href={`/agent/${k}`} style={{ "--agc": a.color }}><img src={a.icon} alt="" width="40" height="40" loading="lazy" /><span>{a.name}</span></a>)}</div>
    </section>
  );
}

/** The 404's agent: one picked at random once the page is in the browser. */
export function LostAgent() {
  const tr = useT();
  const [a, setA] = useState(null);
  useEffect(() => {
    const list = Object.values(ASSETS.agents).filter((x) => x.portrait);
    setA(list[Math.floor(Math.random() * list.length)] || null);
  }, []);
  if (!a) return null;
  return (
    <div className="lostagent" style={{ "--agc": a.color }}>
      <img src={a.portrait} alt="" loading="lazy" />
      <p>{tr("Even {agent} cannot find this page.", { agent: a.name })}</p>
    </div>
  );
}

/** At the top of the stats: the agents, maps and duel pages in pictures. */
export function StatsShortcuts() {
  const tr = useT();
  const pic = (k) => (ASSETS.agents[k] || {}).portrait || "";
  const items = [
    ["/agent", tr("Agents"), `url(${pic("jett")})`, "agent"],
    ["/map", tr("Maps"), `url(${(ASSETS.maps.Lotus || {}).splash || ""})`, "map"],
    ["/agent/duel", tr("Agent duel"), `url(${pic("viper")})`, "agent"],
    ["/tierlist", tr("Tier list"), `url(${(ASSETS.maps.Ascent || {}).splash || ""})`, "map"],
  ];
  return <nav className="statshort" aria-label={tr("Shortcuts")}>{items.map(([href, label, img, kind]) => <a key={href} href={href} className={kind} style={{ "--img": img }}><b>{label}</b></a>)}</nav>;
}

// ---- for the editors

/** vlr.gg's tables, event by event, the finished matches without one, a button to read one again. */
export function VlrTables({ data, call, onDone }) {
  const tr = useT();
  const [asked, setAsked] = useState({});
  if (!data || !data.events.length) return null;
  const again = async (m) => {
    try { await call("/api/vlrreread", { event: m.event, id: m.id }); setAsked((x) => ({ ...x, [`${m.event}:${m.id}`]: true })); onDone(tr("Asked: vlr.gg's page is read again at the next round.")); } catch (e) { onDone(tr.server(e.message)); }
  };
  return (
    <section>
      <h2>📊 {tr("vlr.gg tables")}</h2>
      <div className="vlrbars">{data.events.map((e) => {
        const p = Math.round((e.withStats / e.done) * 100);
        return (
          <div key={e.event} className="vlrbar">
            <span>{tr(EVENT_NAMES[e.event] || e.event)}</span>
            <span className="vbar"><i style={{ width: `${p}%` }} /></span>
            <b>{e.withStats}/{e.done}</b>
            {e.old > 0 && <small title={tr("Read again by themselves for the veto, a few each round")}>⟳ {e.old}</small>}
          </div>
        );
      })}</div>
      {data.missing.length > 0 && (
        <>
          <h3 className="sub">{tr("Finished matches without their table")}</h3>
          <ul className="vlrmiss">{data.missing.map((m) => {
            const k = `${m.event}:${m.id}`;
            return <li key={k}><a href={`/match/${m.event}/${m.id}`}>{m.a} vs {m.b}</a> <small>{tr(EVENT_NAMES[m.event] || m.event)}</small> <button type="button" className="btn small" disabled={asked[k]} onClick={() => again(m)}>{asked[k] ? "✓" : `⟳ ${tr("Read again")}`}</button></li>;
          })}</ul>
        </>
      )}
      <p className="hint">{tr("Tables come from vlr.gg a few pages at a time; a match without one may simply not be on vlr.gg yet.")}</p>
    </section>
  );
}

const GAME_NAMES = { joueur: "Mystery player", duel: "Higher or lower", logo: "Mystery logo", agent: "Mystery agent" };

/** Today's daily games: how many finished, how many won. */
export function GamesToday({ games }) {
  const tr = useT();
  if (!games) return null;
  return (
    <section>
      <h2>🎮 {tr("Today's games")}</h2>
      <div className="gtoday">{Object.keys(GAME_NAMES).map((g) => {
        const x = games[g] || { played: 0, won: 0 };
        return <div key={g}><b>{x.played}</b><span>{tr(GAME_NAMES[g])}</span><small>{x.played ? `${Math.round((x.won / x.played) * 100)}% ${tr("found it")}` : "–"}</small></div>;
      })}</div>
    </section>
  );
}

/** The week's meta, written for a news item: copy it, or open the news editor with it. */
export function MetaDraft({ text }) {
  const tr = useT();
  const [msg, setMsg] = useState("");
  if (!text) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setMsg(tr("Copied: paste it in a news item.")); } catch { setMsg(""); } };
  return (
    <details className="einfo">
      <summary><b>📰 {tr("The week's meta, ready to post")}</b></summary>
      <pre className="metadraft">{text}</pre>
      <p className="row"><button type="button" className="btn" onClick={copy}>📋 {tr("Copy")}</button>{msg && <span className="hint" role="status"> {msg}</span>}</p>
    </details>
  );
}

/** Agents or maps in vlr.gg's tables with no picture on the site (a new agent or map: the pictures need updating). */
export function MissingPictures({ missing }) {
  const tr = useT();
  if (!missing || (!missing.agents.length && !missing.maps.length)) return null;
  return (
    <section className="warnbox">
      <h2>🖼️ {tr("Pictures missing")}</h2>
      <p className="note">{tr("Seen in vlr.gg's tables but with no picture on the site: probably new. Ask for lib/valorant-assets.json to be updated.")}</p>
      {missing.agents.length > 0 && <p>{tr("Agents")} : <b>{missing.agents.join(", ")}</b></p>}
      {missing.maps.length > 0 && <p>{tr("Maps")} : <b>{missing.maps.join(", ")}</b></p>}
    </section>
  );
}

/** "/" anywhere on the editor's home page goes to its search box (not while typing). */
export function SlashToSearch() {
  useEffect(() => {
    const on = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      const box = document.querySelector(".edsearch input");
      if (box) { e.preventDefault(); box.focus(); box.scrollIntoView({ block: "center" }); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return null;
}
