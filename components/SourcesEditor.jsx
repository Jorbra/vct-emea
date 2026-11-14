"use client";

// The editor's "Sources" screen: paste an event's Toornament and vlr.gg links, the site follows them at the next round.
import { useState } from "react";
import { useT } from "./lang.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const when = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function Row({ r, call, onDone }) {
  const tr = useT();
  const s = r.set || {};
  const [v, setV] = useState({ toornament: s.toornament || "", vlr: s.vlr || "", stage: s.stage || "", bracket: !!s.bracket });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await call("/api/sources", { event: r.event, ...v }); onDone(tr("Saved: the site follows these links from the next round.")); } catch (err) { onDone(tr.server(err.message)); }
    setBusy(false);
  };
  return (
    <form className="srcrow" onSubmit={save}>
      <b className="srcname">{tr(EVENT_NAMES[r.event] || r.event)}</b>
      <div className="srcnow">
        {r.toornament ? <a href={r.toornament.link} target="_blank" rel="noopener noreferrer">Toornament</a> : <span className="muted">{r.qualifier ? tr("No Toornament") : ""}</span>}
        {r.toornament && <small>{r.toornament.error ? `⚠️ ${r.toornament.error}` : r.toornament.at ? `${tr("read")} ${when(r.toornament.at, tr.lang)}` : tr("not read yet")}</small>}
        {r.vlr ? <a href={r.vlr.link} target="_blank" rel="noopener noreferrer">vlr.gg{r.vlr.stage ? ` · ${r.vlr.stage}` : ""}</a> : <span className="muted">{tr("No vlr.gg")}</span>}
        {r.vlr && <small>{r.vlr.at ? `${r.vlr.matches} ${tr("matches")} · ${tr("read")} ${when(r.vlr.at, tr.lang)}` : tr("not read yet")}</small>}
        {r.bracket && <small>📊 {tr("bracket from vlr.gg")}</small>}
      </div>
      {r.qualifier && <input value={v.toornament} onChange={set("toornament")} placeholder={tr("Toornament link (or off)")} aria-label={tr("Toornament link")} />}
      <input value={v.vlr} onChange={set("vlr")} placeholder={tr("vlr.gg link (or off)")} aria-label={tr("vlr.gg link")} />
      <input value={v.stage} onChange={set("stage")} placeholder={tr("vlr.gg stage, e.g. Qualifier #2")} aria-label={tr("vlr.gg stage")} className="srcstage" />
      {r.qualifier && <label className="sw srcbr"><input type="checkbox" checked={v.bracket} onChange={set("bracket")} /> {tr("Bracket from vlr.gg")}</label>}
      <button type="submit" className="btn pri small" disabled={busy}>{tr("Save")}</button>
    </form>
  );
}

export function SourcesEditor({ list, call, onDone }) {
  const tr = useT();
  return (
    <details className="einfo srcbox">
      <summary><b>🔗 {tr("Sources: Toornament and vlr.gg links")}</b></summary>
      <p className="hint">{tr("Paste a tournament's Toornament page or an event's vlr.gg page: the site follows it from the next round, without changing the code. Empty: back to the default. \"off\": stop following. On vlr.gg, one event often holds several qualifiers: write the words of the stage that are this one's (e.g. \"Qualifier #2\").")}</p>
      <div className="srclist">{list.map((r) => <Row key={r.event} r={r} call={call} onDone={onDone} />)}</div>
    </details>
  );
}
