"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { fanToken } from "./Fans.jsx";
import { teamHref } from "../lib/paths.js";

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

// ---- the simulator

function Simulator({ events, first }) {
  const tr = useT();
  const [event, setEvent] = useState(first);
  const [forced, setForced] = useState({});
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!event) return;
    setBusy(true);
    fetch("/api/simule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, forced }) })
      .then((r) => r.json()).then((j) => { setData(j); setBusy(false); }).catch(() => setBusy(false));
  }, [event, forced]);
  const toggle = (m, slot) => setForced((f) => { const n = { ...f }; if (n[m.id] === slot) delete n[m.id]; else n[m.id] = slot; return n; });
  return (
    <div className="wrap teampage">
      <Top title={tr("Qualification simulator")} />
      <p className="note">{tr("Each team's chances to qualify, from 2,000 draws of the matches left, using the power ranking. Pick winners below to see what changes.")}</p>
      {events.length === 0 ? <p className="note">{tr("No qualifier to simulate for now.")}</p> : (
        <>
          <div className="navpills" role="group" aria-label={tr("Event")}>
            {events.map((e) => <button key={e.event} type="button" data-on={event === e.event} aria-pressed={event === e.event} onClick={() => { setEvent(e.event); setForced({}); }}>{tr(e.name)}</button>)}
          </div>
          {data && data.done && <p className="note">{tr("This qualifier is over.")}</p>}
          {data && (
            <div className={"simlist" + (busy ? " busy" : "")}>
              {data.teams.map((t) => (
                <div key={t.slot} className="simrow">
                  <Crest team={t} /><a href={teamHref(t.name)}>{t.name}</a>
                  <span className="simbar"><i style={{ width: `${t.pct}%` }} /></span><b>{t.pct}%</b>
                </div>
              ))}
            </div>
          )}
          {data && data.next.length > 0 && (
            <section>
              <h2>{tr("Pick the winners")}</h2>
              <div className="simnext">
                {data.next.map((m) => (
                  <div key={m.id} className="simm">
                    {[["a", m.a, m.aName], ["b", m.b, m.bName]].map(([s, slot, name]) => <button key={s} type="button" className={"btn" + (m.forced === slot ? " on" : "")} aria-pressed={m.forced === slot} onClick={() => toggle(m, slot)}>{name}</button>).reduce((acc, b, k) => (k ? [...acc, <span key="vs" className="simvs">vs</span>, b] : [b]), [])}
                  </div>
                ))}
              </div>
              {Object.keys(forced).length > 0 && <p><button type="button" className="btn" onClick={() => setForced({})}>{tr("Clear my picks")}</button></p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
export const SimulatorPage = (p) => <LangProvider lang={p.lang}><Simulator {...p} /></LangProvider>;

// ---- the tier list

const TIERS = ["S", "A", "B", "C", "D"];

function Tierlist({ teams }) {
  const tr = useT();
  const bySlug = useMemo(() => new Map(teams.map((t) => [t.slug, t])), [teams]);
  const [tiers, setTiers] = useState(Object.fromEntries(TIERS.map((k) => [k, []])));
  const [community, setCommunity] = useState(null);
  const [drag, setDrag] = useState(null);
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState("");
  const post = (body) => fetch("/api/tierlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), ...body }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
  useEffect(() => { post({}).then((j) => { if (j.mine) setTiers({ ...Object.fromEntries(TIERS.map((k) => [k, []])), ...j.mine }); setCommunity(j.community); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const placed = new Set(TIERS.flatMap((k) => tiers[k]));
  const pool = teams.filter((t) => !placed.has(t.slug));
  const move = (slug, tier) => setTiers((cur) => { const n = Object.fromEntries(TIERS.map((k) => [k, cur[k].filter((s) => s !== slug)])); if (tier) n[tier] = [...n[tier], slug]; return n; });
  const drop = (tier) => (e) => { e.preventDefault(); if (drag) move(drag, tier); setDrag(null); };
  const chip = (slug) => {
    const t = bySlug.get(slug);
    if (!t) return null;
    return (
      <button key={slug} type="button" className={"tchip" + (sel === slug ? " on" : "")} draggable onDragStart={() => setDrag(slug)} onClick={() => setSel(sel === slug ? null : slug)} title={t.name}>
        <Crest team={t} /><span>{t.tag || t.name}</span>
      </button>
    );
  };
  const row = (k, list, editable) => (
    <div key={k} className={"trow t" + k} onDragOver={editable ? (e) => e.preventDefault() : undefined} onDrop={editable ? drop(k) : undefined} onClick={editable && sel ? () => { move(sel, k); setSel(null); } : undefined}>
      <span className="tlabel">{k}</span>
      <div className="tchips">{list.map((s) => (editable ? chip(s) : bySlug.get(s) && <span key={s} className="tchip" title={bySlug.get(s).name}><Crest team={bySlug.get(s)} /><span>{bySlug.get(s).tag || bySlug.get(s).name}</span></span>))}</div>
    </div>
  );
  const save = async () => { setMsg(""); try { const j = await post({ tiers }); setCommunity(j.community); setMsg(tr("Saved: it counts in the community's tier list.")); } catch (e) { setMsg(tr.server(e.message)); } };
  const param = TIERS.filter((k) => tiers[k].length).map((k) => `${k}:${tiers[k].join(",")}`).join(";");
  const share = async () => {
    const url = `${window.location.origin}/api/og/tier?t=${encodeURIComponent(param)}`;
    try { if (navigator.share) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); setMsg(tr("Link to the picture copied.")); } } catch { /* closed */ }
  };
  return (
    <div className="wrap teampage">
      <Top title={tr("Tier list")} />
      <p className="note">{tr("Drag the teams into the tiers (or tap a team, then a tier). Save it to count in the community's tier list, share it as a picture.")}</p>
      <div className="tierboard">{TIERS.map((k) => row(k, tiers[k], true))}</div>
      <div className="tpool" onDragOver={(e) => e.preventDefault()} onDrop={drop(null)} onClick={sel && placed.has(sel) ? () => { move(sel, null); setSel(null); } : undefined}>{pool.map((t) => chip(t.slug))}</div>
      <p className="row"><button type="button" className="btn pri" onClick={save}>{tr("Save my tier list")}</button> <button type="button" className="btn" disabled={!param} onClick={share}>📷 {tr("Share as a picture")}</button> <button type="button" className="btn" onClick={() => setTiers(Object.fromEntries(TIERS.map((k) => [k, []])))}>{tr("Start over")}</button>{msg && <span className="hint" role="status"> {msg}</span>}</p>
      <section>
        <h2>{tr("The community's tier list")} {community && <small className="note">({tr("{n} lists", { n: community.lists })})</small>}</h2>
        {community && community.lists > 0 ? <div className="tierboard">{TIERS.map((k) => row(k, community.tiers[k], false))}</div> : <p className="note">{tr("No tier list saved yet.")}</p>}
      </section>
    </div>
  );
}
export const TierlistPage = (p) => <LangProvider lang={p.lang}><Tierlist {...p} /></LangProvider>;

// ---- the hall of fame

function HallOfFame({ seasons }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("Hall of fame")} />
      <p className="note">{tr("Each season's winners, its strongest team and its most frequent MVP.")}</p>
      {seasons.map((s) => (
        <section key={s.key} className="hof">
          <h2>{s.name} {s.current && <small className="note">({tr("current season")})</small>}</h2>
          <div className="pcardnums weeknums">
            <div><b>{s.strongest || "–"}</b><span>{tr("Strongest team")}</span></div>
            <div><b>{s.mvp ? s.mvp.name : "–"}</b><span>{s.mvp ? tr("MVP {n} times", { n: s.mvp.n }) : "MVP"}</span></div>
            <div><b>{s.matches}</b><span>{tr("Matches played")}</span></div>
          </div>
          {s.honours.length === 0 ? <p className="note">{tr("No event finished yet.")}</p> : (
            <ul className="hoflist">{s.honours.map((h) => <li key={h.event}><span>{h.kind === "champion" ? "🏆" : "🎟️"}</span><b>{tr(h.name)}</b><span>{h.winner}</span></li>)}</ul>
          )}
          {s.href && <p><a href={s.href}>{tr("Open the archive")} ›</a></p>}
        </section>
      ))}
    </div>
  );
}
export const HallOfFamePage = (p) => <LangProvider lang={p.lang}><HallOfFame {...p} /></LangProvider>;

// ---- rivalries

function Rivalries({ list }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("Rivalries")} />
      <p className="note">{tr("The teams that met the most this season.")}</p>
      {list.length === 0 ? <p className="note">{tr("No two teams have met twice yet.")}</p> : (
        <div className="rivlist">
          {list.map((r) => (
            <div key={r.slugA + r.slugB} className="rivrow">
              <a href={teamHref(r.a)} className={r.wa > r.wb ? "w" : ""}>{r.a}</a>
              <b className="spoil">{r.wa} – {r.wb}</b>
              <a href={teamHref(r.b)} className={r.wb > r.wa ? "w" : ""}>{r.b}</a>
              <small>{tr("{n} meetings", { n: r.meetings })} · <a href={`/match/${r.last.event}/${r.last.id}`}>{tr("last")} : <span className="spoil">{r.last.winner} {r.last.score}</span></a></small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export const RivalriesPage = (p) => <LangProvider lang={p.lang}><Rivalries {...p} /></LangProvider>;
