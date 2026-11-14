"use client";

// Setting up the stream overlays: choose one, see it live, copy its address into OBS.
import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const TYPES = [
  ["scoreboard", "Scoreboard", "The bar with both teams, the series score and the map being played."],
  ["next", "Next match", "The next match with a countdown."],
  ["ticker", "Ticker", "A band at the bottom: live matches, results and what is coming."],
  ["standby", "Standby screen", "The whole screen before the stream or during a break, with a countdown and the next matches."],
  ["result", "Result", "The card at the end of a match: score, maps and winner."],
  ["maps", "Maps", "The match's maps: played, being played and left."],
];

function Studio({ base }) {
  const tr = useT();
  const [p, setP] = useState({ type: "scoreboard", event: "", match: "", theme: "dark", accent: "c9f03c", pos: "top", scale: "1", title: "", until: "", lang: tr.lang === "en" ? "en" : "fr" });
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value, ...(k === "event" ? { match: "" } : {}) }));
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    fetch(`/api/overlay${p.event ? `?event=${p.event}` : ""}`).then((r) => r.json()).then((d) => setMatches([...d.live, ...d.upcoming, ...d.results.slice(0, 6)])).catch(() => setMatches([]));
  }, [p.event]);
  const url = useMemo(() => {
    const q = new URLSearchParams({ type: p.type });
    if (p.event) q.set("event", p.event);
    if (p.match) q.set("match", p.match);
    if (p.theme !== "dark") q.set("theme", p.theme);
    if (p.accent && p.accent.toLowerCase() !== "c9f03c") q.set("accent", p.accent.replace("#", ""));
    if (p.type === "scoreboard" && p.pos !== "top") q.set("pos", p.pos);
    if (p.scale !== "1") q.set("scale", p.scale);
    if (p.type === "standby" && p.title) q.set("title", p.title);
    if (p.type === "standby" && p.until) q.set("until", p.until);
    q.set("lang", p.lang);
    return `${base}/overlay?${q.toString()}`;
  }, [p, base]);
  const [msg, setMsg] = useState("");
  const copy = async () => { try { await navigator.clipboard.writeText(url); setMsg(tr("Copied: paste it in OBS.")); } catch { setMsg(""); } };
  return (
    <div className="wrap teampage studio">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Stream overlays")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("Overlays for your stream, updated live from the site: pick one, set it up, copy its address into OBS.")}</p>
      <div className="studiotypes">{TYPES.map(([k, name, desc]) => (
        <button key={k} type="button" className={"studiotype" + (p.type === k ? " on" : "")} aria-pressed={p.type === k} onClick={() => setP((x) => ({ ...x, type: k }))}>
          <b>{tr(name)}</b><small>{tr(desc)}</small>
        </button>
      ))}</div>
      <div className="studiogrid">
        <form className="studioform" onSubmit={(e) => e.preventDefault()}>
          <label className="f">{tr("Event")}
            <select value={p.event} onChange={set("event")}><option value="">{tr("All events")}</option>{Object.entries(EVENT_NAMES).map(([k, n]) => <option key={k} value={k}>{tr(n)}</option>)}</select>
          </label>
          {["scoreboard", "result", "maps", "next"].includes(p.type) && (
            <label className="f">{tr("Match")}
              <select value={p.match} onChange={set("match")}>
                <option value="">{tr("Automatic: the live match, else the next one")}</option>
                {matches.map((m) => <option key={m.event + m.id} value={`${m.event}:${m.id}`}>{m.live ? "🔴 " : m.done ? "✓ " : ""}{m.a.name} vs {m.b.name}</option>)}
              </select>
            </label>
          )}
          <label className="f">{tr("Look")}
            <select value={p.theme} onChange={set("theme")}><option value="dark">{tr("Dark")}</option><option value="light">{tr("Light")}</option><option value="glass">{tr("Glass")}</option></select>
          </label>
          <label className="f">{tr("Accent colour")}<input type="color" value={`#${p.accent.replace("#", "")}`} onChange={(e) => setP((x) => ({ ...x, accent: e.target.value.slice(1) }))} /></label>
          {p.type === "scoreboard" && (
            <label className="f">{tr("Position")}
              <select value={p.pos} onChange={set("pos")}><option value="top">{tr("Top")}</option><option value="bottom">{tr("Bottom")}</option></select>
            </label>
          )}
          <label className="f">{tr("Size")}
            <select value={p.scale} onChange={set("scale")}>{["0.75", "1", "1.25", "1.5"].map((s) => <option key={s} value={s}>{Math.round(Number(s) * 100)} %</option>)}</select>
          </label>
          {p.type === "standby" && (
            <>
              <label className="f">{tr("Title")}<input value={p.title} maxLength={60} placeholder={tr("The stream starts soon")} onChange={set("title")} /></label>
              <label className="f">{tr("Countdown to (HH:MM, optional)")}<input value={p.until} placeholder="20:00" maxLength={5} onChange={set("until")} /></label>
            </>
          )}
          <label className="f">{tr("Language")}
            <select value={p.lang} onChange={set("lang")}><option value="fr">Français</option><option value="en">English</option><option value="tr">Türkçe</option><option value="ar">العربية</option></select>
          </label>
        </form>
        <div className="studiopreview">
          <div className="studioframe"><iframe key={url} src={url} title={tr("Preview")} width="1920" height="1080" loading="lazy" /></div>
          <div className="studiourl"><input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={tr("Address")} /><button type="button" className="btn pri" onClick={copy}>📋 {tr("Copy")}</button></div>
          {msg && <p className="hint" role="status">{msg}</p>}
        </div>
      </div>
      <section className="studiohelp">
        <h2>{tr("In OBS")}</h2>
        <ol>
          <li>{tr("Sources → + → Browser.")}</li>
          <li>{tr("Paste the address, width 1920, height 1080.")}</li>
          <li>{tr("Leave the custom CSS empty: the background is already transparent.")}</li>
          <li>{tr("The overlay updates by itself every 10 seconds.")}</li>
        </ol>
      </section>
    </div>
  );
}

export default function OverlayStudio({ lang, base }) {
  return <LangProvider lang={lang}><Studio base={base} /></LangProvider>;
}
