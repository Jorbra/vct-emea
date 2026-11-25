"use client";
// The quiz of the day: 3 questions, one go per day, and the streak of right answers in a row to keep alive.

import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { deviceToken } from "./account.js";
import { fanToken } from "./Fans.jsx";

export default function DailyQuiz({ questions, ranking }) {
  const tr = useT();
  const [picked, setPicked] = useState({});
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = deviceToken();
    if (!token) return;
    fetch("/api/quiz/day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, mine: true }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setMe(j); }).catch(() => { /* offline */ });
  }, []);
  const send = async () => {
    if (Object.keys(picked).length < questions.length) { setError(tr("Answer every question first.")); return; }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quiz/day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), answers: picked }) });
      const j = await r.json();
      if (!r.ok) setError(tr.server(j.error || "Error"));
      else setMe(j);
    } catch { setError(tr("Network error.")); }
    setBusy(false);
  };
  if (!questions.length) return null;
  const done = me && me.today;
  const res = done ? Object.fromEntries(me.today.map((r) => [r.id, r])) : {};
  return (
    <section className="dquiz">
      <div className="dqhead">
        <h2>{tr("Quiz of the day")}</h2>
        <div className="gstreakbox"><b>🔥 {me ? me.streak : "–"}</b><span>{tr("right answers in a row")}</span></div>
        {me && me.best > 0 && <small className="note">{tr("Best streak: {n}", { n: me.best })}</small>}
      </div>
      <p className="note">{tr("3 questions on the latest matches, a new set every day at midnight. A wrong answer starts your streak again.")}</p>
      {done && <p className="quizscore"><b>{me.today.filter((r) => r.ok).length}/{me.today.length}</b> {tr("right answers")} · {tr("Come back tomorrow to keep your streak going.")}</p>}
      <ol className="quizlist">
        {questions.map((q) => {
          const r = res[q.id];
          return (
            <li key={q.id}>
              <p>{tr(q.text, q.vars)}</p>
              <div className="quizopts">
                {q.options.map((o) => {
                  const cls = r ? (o === r.answer ? " ok" : o === r.given ? " ko" : "") : picked[q.id] === o ? " on" : "";
                  return <button key={o} type="button" className={"btn" + cls} disabled={!!r} aria-pressed={!r && picked[q.id] === o} onClick={() => { setPicked({ ...picked, [q.id]: o }); setError(""); }}>{o}</button>;
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {!done && <p><button type="button" className="btn pri" disabled={busy} onClick={send}>{tr("Check my answers")}</button> {error && <span className="err" role="alert">{error}</span>}</p>}
      {ranking.length > 0 && (
        <>
          <h3>{tr("Longest streaks")}</h3>
          <ol className="quizrank">{ranking.map((r, i) => <li key={r.name}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span> {r.name} <b>🔥 {r.streak}</b></li>)}</ol>
        </>
      )}
    </section>
  );
}
