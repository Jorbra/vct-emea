"use client";

import { useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { AgentIcon, MapThumb } from "./Assets.jsx";
import { EmptyState, SectionHead } from "./Round11.jsx";
import { AgentDuel } from "./Round13.jsx";
import { RoleMates } from "./Round14.jsx";
import { RoleShare, SortPick } from "./Round15.jsx";

function Top({ title }) {
  const tr = useT();
  return (
    <>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
    </>
  );
}

const ROLE = { Duelist: "Duelist", Initiator: "Initiator", Controller: "Controller", Sentinel: "Sentinel" };

// ---- one agent

function Agent({ a }) {
  const tr = useT();
  // the picture shown in the banner: the classic portrait or the Mastery I pose
  const [look, setLook] = useState("classic");
  const pic = look === "pose" && a.pose ? a.pose : a.portrait;
  return (
    <div className="wrap teampage">
      <Top title={a.name} />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href="/agent">{tr("Agents")}</a> › <span>{a.name}</span></nav>
      <div className={"aghero" + (look === "pose" ? " posed" : "")} style={{ "--agc": a.color || "var(--lime)", ...(pic ? { "--agimg": `url(${pic})` } : {}) }}>
        {a.pose && (
          <div className="lookpick" role="group" aria-label={tr("Picture")}>
            <button type="button" className={look === "classic" ? "on" : ""} aria-pressed={look === "classic"} onClick={() => setLook("classic")}>{tr("Classic")}</button>
            <button type="button" className={look === "pose" ? "on" : ""} aria-pressed={look === "pose"} onClick={() => setLook("pose")}>{tr("Mastery I")}</button>
          </div>
        )}
        <div className="aghtext">
          {a.icon && <img src={a.icon} alt="" width="56" height="56" />}
          <h2>{a.name}</h2>
          {a.role && <span className="agrole">{tr(ROLE[a.role] || a.role)}{a.rank ? ` · ${tr("#{n} most picked", { n: a.rank })}` : ""}</span>}
          <div className="aghnums">
            <div><b>{a.picks}</b><span>{tr("maps picked")}</span></div>
            <div><b>{a.share}%</b><span>{tr("of the teams")}</span></div>
            <div><b>{a.pct}%</b><span>{tr("maps won")}</span></div>
          </div>
        </div>
      </div>
      {a.picks === 0 ? <EmptyState text={tr("Not played on the site's events yet.")} /> : (
        <div className="cols">
          <main>
            <section>
              <SectionHead icon="🗺️" title={tr("Where it is picked")} />
              <div className="agmaps">{a.maps.map((m) => (
                <a key={m.map} href={`/map/${encodeURIComponent(m.map.toLowerCase())}`} className="agmaprow">
                  <MapThumb map={m.map} />
                  <span className="agbar"><i style={{ width: `${m.pct}%` }} /></span>
                  <b>{m.pct}%</b>
                </a>
              ))}</div>
              <p className="hint">{tr("The share of teams that picked it on each map.")}</p>
            </section>
          </main>
          <aside>
            <section>
              <SectionHead icon="⭐" title={tr("Best players")} />
              {a.best.length === 0 ? <p className="hint">{tr("2 maps on it at least.")}</p> : (
                <ol className="agbest">{a.best.map((p) => <li key={p.slug}><a href={`/player/${p.slug}`}>{p.name}</a><span>{p.r != null ? p.r.toFixed(2) : "–"}</span><small>{p.maps} {tr("maps")} · {p.acs ?? "–"} ACS</small></li>)}</ol>
              )}
            </section>
            {(a.teams || []).length > 0 && (
              <section>
                <SectionHead icon="👥" title={tr("Teams that play it most")} />
                <ol className="agbest">{a.teams.map((t) => <li key={t.slug}><a href={`/team/${t.slug}`}>{t.name}</a><span>{t.won}–{t.played - t.won}</span><small>{t.played} {tr("maps")}</small></li>)}</ol>
              </section>
            )}
          </aside>
        </div>
      )}
      {a.pose && (
        <section className="agposes">
          <SectionHead icon="🖼️" title={tr("Poses")} />
          <div>
            <figure style={{ "--agc": a.color || "var(--lime)" }}><img src={a.portrait} alt={`${a.name} · ${tr("Classic")}`} loading="lazy" /><figcaption>{tr("Classic")}</figcaption></figure>
            <figure style={{ "--agc": a.color || "var(--lime)" }}><img src={a.pose} alt={`${a.name} · ${tr("Mastery I")}`} loading="lazy" /><figcaption>{tr("Mastery I")} <small>{tr("Agent Mastery reward")}</small></figcaption></figure>
          </div>
          <p className="hint">{tr("Mastery pose: official VALORANT wiki.")}</p>
        </section>
      )}
      <RoleMates name={a.name} role={a.role} />
      <p className="note">{tr("From vlr.gg's tables of the site's events. Pictures: valorant-api.com.")}</p>
    </div>
  );
}
export const AgentPage = (p) => <LangProvider lang={p.lang}><Agent {...p} /></LangProvider>;

// ---- every agent

function Agents({ list }) {
  const tr = useT();
  // a role to show only its agents
  const [role, setRole] = useState("");
  const roles = [...new Set(list.map((x) => x.role).filter(Boolean))];
  const [sort, setSort] = useState("picks");
  const shown = (role ? list.filter((x) => x.role === role) : list).slice().sort(sort === "win" ? (x, y) => y.pct - x.pct || y.picks - x.picks : sort === "name" ? (x, y) => x.name.localeCompare(y.name) : (x, y) => y.picks - x.picks);
  return (
    <div className="wrap teampage">
      <Top title={tr("Agents")} />
      <p className="note">{tr("The agents played on the site's events, most picked first.")} <a className="btn" href="/agent/duel">⚔️ {tr("Compare two agents")}</a></p>
      {list.length === 0 ? <EmptyState text={tr("Not played on the site's events yet.")} /> : (
        <>
        <div className="chips rolechips" role="group" aria-label={tr("Role")}>
          <button type="button" className={role ? "" : "on"} aria-pressed={!role} onClick={() => setRole("")}>{tr("All")}</button>
          {roles.map((r) => <button key={r} type="button" className={role === r ? "on" : ""} aria-pressed={role === r} onClick={() => setRole(r)}>{tr(r)}</button>)}
          <SortPick value={sort} onChange={setSort} items={[["picks", tr("Most picked")], ["win", tr("Best win rate")], ["name", tr("A to Z")]]} />
        </div>
        <RoleShare list={list} />
        <div className="aggrid">{shown.map((a) => (
          <a key={a.key} href={`/agent/${a.key}`} className={"agcard" + (a.pose ? " haspose" : "")} style={{ "--agc": a.color || "var(--lime)", ...(a.portrait ? { "--agimg": `url(${a.portrait})` } : {}), ...(a.pose ? { "--agpose": `url(${a.pose})` } : {}) }}>
            <b>{a.name}</b>
            <small>{a.role ? tr(ROLE[a.role] || a.role) : ""}</small>
            <span>{a.share}% {tr("of the teams")} · {a.pct}% {tr("won")}</span>
          </a>
        ))}</div>
        </>
      )}
    </div>
  );
}
export const AgentsPage = (p) => <LangProvider lang={p.lang}><Agents {...p} /></LangProvider>;

// ---- every map

function Maps({ list: all }) {
  const tr = useT();
  const [sort, setSort] = useState("played");
  const list = all.slice().sort(sort === "attack" ? (x, y) => (y.attack ?? -1) - (x.attack ?? -1) : sort === "name" ? (x, y) => x.name.localeCompare(y.name) : (x, y) => y.played - x.played || x.name.localeCompare(y.name));
  return (
    <div className="wrap teampage">
      <Top title={tr("Maps")} />
      <p className="note">{tr("The maps of the pool, most played on the site's events first.")}</p>
      <div className="chips rolechips"><SortPick value={sort} onChange={setSort} items={[["played", tr("Most played")], ["attack", tr("Attack-sided first")], ["name", tr("A to Z")]]} /></div>
      <div className="mpgrid">{list.map((m) => (
        <a key={m.key} href={`/map/${m.key}`} className={"mpcard" + (m.played ? "" : " unplayed")} style={{ "--mpimg": `url(${m.splash})` }}>
          <img className="mpmini" src={m.icon} alt="" loading="lazy" />
          <b>{m.name}</b>
          <small>{m.played ? `${m.played} ${tr("maps played")}` : tr("Not played yet")}{m.attack != null ? ` · ${tr("Attack")} ${m.attack}%` : ""}</small>
          {m.agents.length > 0 && <span className="aglist">{m.agents.map((a) => <AgentIcon key={a.name} name={a.name} size={24} />)}</span>}
        </a>
      ))}</div>
    </div>
  );
}
export const MapsPage = (p) => <LangProvider lang={p.lang}><Maps {...p} /></LangProvider>;

// ---- two agents side by side

function Duel({ duel, all }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("Agent duel")} />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href="/agent">{tr("Agents")}</a> › <span>{tr("Agent duel")}</span></nav>
      <AgentDuel duel={duel} all={all} />
    </div>
  );
}
export const AgentDuelPage = (p) => <LangProvider lang={p.lang}><Duel {...p} /></LangProvider>;
