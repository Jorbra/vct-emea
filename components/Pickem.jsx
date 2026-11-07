"use client";

import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

/** One qualifier's "Who qualifies?": the form while it has not started, then the visitor's picks, then the ranking. */
function EventPicks({ ev, board, mine, token, name, onSaved }) {
  const tr = useT();
  const [picks, setPicks] = useState(mine ? mine.picks : Array.from({ length: ev.n }, () => ""));
  const [champion, setChampion] = useState(mine ? mine.champion : "");
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const listId = `pk-${ev.event}`;
  const chosen = picks.filter(Boolean);
  async function save(e) {
    e.preventDefault();
    setMsg({ ok: true, text: "" });
    const res = await fetch("/api/pickem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, event: ev.event, picks, champion: ev.n === 1 ? picks[0] : champion }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setMsg({ ok: false, text: tr.server(j.error || "Network error") }); return; }
    setMsg({ ok: true, text: tr.server(j.message) });
    onSaved();
  }
  const title = tr(EVENT_NAMES[ev.event] || ev.event);
  if (ev.open) {
    return (
      <form className="pickem" onSubmit={save}>
        <h3>{title}</h3>
        <p className="hint">{ev.n === 1 ? tr("Pick the team that goes through: 3 points if right.") : tr("Pick the {n} teams that go through and the winner: 1 point per right team, 2 more for the winner.", { n: ev.n })}</p>
        <datalist id={listId}>{ev.teams.map((t) => <option key={t} value={t} />)}</datalist>
        <div className="pickgrid">
          {picks.map((p, i) => (
            <input key={i} list={listId} value={p} placeholder={tr("Team {n}", { n: i + 1 })} aria-label={tr("Team {n}", { n: i + 1 })} onChange={(e) => setPicks(picks.map((x, k) => (k === i ? e.target.value : x)))} />
          ))}
        </div>
        {ev.n > 1 && (
          <label className="f">{tr("Winner")}
            <select value={champion} onChange={(e) => setChampion(e.target.value)} required>
              <option value="">–</option>
              {chosen.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <div className="row">
          <button className="btn pri" type="submit" disabled={!token}>{mine ? tr("Change my picks") : tr("Save my picks")}</button>
          <span className="hint">{tr("{n} taking part", { n: board.count })}{ev.firstAt ? ` · ${tr("closes when the first match starts")}` : ""}</span>
        </div>
        {msg.text && <p className={msg.ok ? "okmsg" : "err"} role="status">{msg.text}</p>}
      </form>
    );
  }
  return (
    <div className="pickem">
      <h3>{title}</h3>
      {mine ? <p className="note">{tr("Your picks")} : {mine.picks.join(", ")}{ev.n > 1 ? ` · ${tr("Winner")} : ${mine.champion}` : ""}</p> : <p className="note">{tr("Closed: the event has started.")} {tr("{n} taking part", { n: board.count })}</p>}
      {ev.done && (
        <>
          <p className="note">{tr("Qualified")} : {ev.qualified.join(", ")}{ev.n > 1 ? ` · ${tr("Winner")} : ${ev.champion}` : ""}</p>
          {board.ranking.length > 0 && (
            <div className="tablewrap"><table>
              <thead><tr><th>#</th><th>{tr("Name")}</th><th>{tr("Points")}</th></tr></thead>
              <tbody>{board.ranking.map((r, i) => <tr key={r.name}><td>{i + 1}</td><td>{r.name}</td><td><b>{r.points}</b></td></tr>)}</tbody>
            </table></div>
          )}
        </>
      )}
    </div>
  );
}

/** Every qualifier a visitor can pick, or has picked. */
export default function Pickem({ events, boards, token, name }) {
  const tr = useT();
  const [mine, setMine] = useState({});
  const load = () => {
    if (!token) return;
    fetch("/api/pickem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, mine: true }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setMine(j.picks || {}); }).catch(() => { /* offline */ });
  };
  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = events.filter((ev) => ev.open || mine[ev.event] || (boards[ev.event] && boards[ev.event].count));
  return (
    <section>
      <h2>{tr("Who qualifies?")}</h2>
      {shown.length === 0 ? <p className="note">{tr("Opens before each qualifier, once its teams are known.")}</p> : shown.map((ev) => (
        <EventPicks key={ev.event + (mine[ev.event] ? "1" : "0")} ev={ev} board={boards[ev.event] || { count: 0, ranking: [] }} mine={mine[ev.event]} token={token} name={name} onSaved={load} />
      ))}
    </section>
  );
}
