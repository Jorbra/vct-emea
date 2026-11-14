"use client";

// Round 17, for the editors: teams' names, the syncs' log, news to publish later.
import { useState } from "react";
import { useT } from "./lang.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const when = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** Teams' names as the site writes them when Toornament writes them another way (Barça → Barça eSports). */
export function TeamAliases({ aliases, call, onDone }) {
  const tr = useT();
  const [list, setList] = useState(aliases || {});
  const [v, setV] = useState({ from: "", name: "", tag: "" });
  const save = async (entry) => {
    try { const j = await call("/api/aliases", entry); setList(j.aliases || {}); onDone(tr("Saved: the next Toornament round renames the team.")); setV({ from: "", name: "", tag: "" }); } catch (e) { onDone(tr.server(e.message)); }
  };
  return (
    <details className="einfo">
      <summary><b>🏷️ {tr("Teams' names")}</b> <small>{Object.keys(list).length}</small></summary>
      <p className="hint">{tr("When Toornament writes a team another way than the site (\"Barça\" for \"Barça eSports\"), write both: every event uses the site's name from the next round.")}</p>
      {Object.keys(list).length > 0 && (
        <ul className="aliaslist">{Object.entries(list).map(([from, a]) => (
          <li key={from}><span>{from}</span> → <b>{a.name}</b>{a.tag ? <small> [{a.tag}]</small> : null} <button type="button" className="btn small" onClick={() => save({ from, name: "" })}>{tr("Remove")}</button></li>
        ))}</ul>
      )}
      <form className="aliasform" onSubmit={(e) => { e.preventDefault(); save(v); }}>
        <input value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} placeholder={tr("Name on Toornament")} aria-label={tr("Name on Toornament")} />
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={tr("Name on the site")} aria-label={tr("Name on the site")} />
        <input value={v.tag} onChange={(e) => setV({ ...v, tag: e.target.value })} placeholder={tr("Tag (optional)")} aria-label={tr("Tag (optional)")} maxLength={8} className="aliastag" />
        <button type="submit" className="btn pri small" disabled={!v.from.trim() || !v.name.trim()}>{tr("Save")}</button>
      </form>
    </details>
  );
}

/** What Toornament and vlr.gg changed, line by line, latest first. */
export function SyncLog({ list }) {
  const tr = useT();
  const [src, setSrc] = useState("");
  const shown = list.filter((x) => !src || x.source === src).slice(0, 60);
  return (
    <details className="einfo">
      <summary><b>🛰️ {tr("Syncs' log")}</b> <small>{list.length}</small></summary>
      <p className="hint">{tr("What Toornament and vlr.gg changed by themselves, latest first, to check it at a glance.")}</p>
      <div className="chips rolechips">
        {["", "Toornament", "vlr.gg"].map((s) => <button key={s || "all"} type="button" className={src === s ? "on" : ""} onClick={() => setSrc(s)}>{s || tr("All")}</button>)}
      </div>
      {shown.length === 0 ? <p className="note">{tr("Nothing yet.")}</p> : (
        <ul className="synclog">{shown.map((x, i) => (
          <li key={i}><small>{when(x.at, tr.lang)}</small><span className={"src " + (x.source === "vlr.gg" ? "vlr" : "tor")}>{x.source}</span><span>{tr(EVENT_NAMES[x.event] || x.event)}</span><b>{x.text}</b></li>
        ))}</ul>
      )}
    </details>
  );
}

/** News written now, published at their time (and posted on Discord like the others). */
export function ScheduledNews({ list, call, onDone }) {
  const tr = useT();
  const [items, setItems] = useState(list || []);
  const [v, setV] = useState({ title: "", body: "", at: "" });
  const add = async (e) => {
    e.preventDefault();
    try {
      await call("/api/news", { title: v.title, body: v.body, scheduleAt: new Date(v.at).toISOString() });
      setItems((x) => [...x, { id: `new${Date.now()}`, title: v.title, at: new Date(v.at).toISOString() }].sort((a, b) => a.at.localeCompare(b.at)));
      setV({ title: "", body: "", at: "" });
      onDone(tr("Scheduled: it is published at its time."));
    } catch (err) { onDone(tr.server(err.message)); }
  };
  const cancel = async (id) => { try { await call("/api/news", { cancelScheduled: id }); setItems((x) => x.filter((n) => n.id !== id)); } catch (err) { onDone(tr.server(err.message)); } };
  return (
    <details className="einfo">
      <summary><b>🗓️ {tr("News to publish later")}</b> <small>{items.length}</small></summary>
      {items.length > 0 && <ul className="aliaslist">{items.map((n) => <li key={n.id}><small>{when(n.at, tr.lang)}</small> <b>{n.title}</b> <button type="button" className="btn small" onClick={() => cancel(n.id)}>{tr("Cancel")}</button></li>)}</ul>}
      <form className="schedform" onSubmit={add}>
        <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={tr("Title")} maxLength={120} aria-label={tr("Title")} />
        <textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder={tr("Text")} rows={4} maxLength={10000} aria-label={tr("Text")} />
        <label className="f">{tr("Publish on")}<input type="datetime-local" value={v.at} onChange={(e) => setV({ ...v, at: e.target.value })} /></label>
        <button type="submit" className="btn pri" disabled={!v.title.trim() || !v.body.trim() || !v.at}>{tr("Schedule")}</button>
      </form>
    </details>
  );
}
