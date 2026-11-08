"use client";

import { useEffect, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Crest } from "./Crest.jsx";
import { useFavorites } from "./favorites.js";
import { deviceToken } from "./account.js";
import { fanToken } from "./Fans.jsx";

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

// ---- the power ranking

function Power({ rows }) {
  const tr = useT();
  const fav = useFavorites();
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 30);
  const top = rows.length ? rows[0].rating : 1500;
  const low = rows.length ? rows[rows.length - 1].rating : 1500;
  return (
    <div className="wrap teampage">
      <Top title={tr("Power ranking")} />
      <p className="note">{tr("Every finished series of the season, in date order: beating a strong team earns more, and a 2–0 more than a 2–1. The arrow: places won or lost in 7 days.")}</p>
      {rows.length === 0 ? <p className="note">{tr("Not enough results yet: 3 series per team at least.")}</p> : (
        <ol className="powerlist">
          {shown.map((t) => (
            <li key={t.slug} className={fav.has(t.slug) ? "fav" : undefined}>
              <span className="prank">{t.rank}</span>
              <Crest team={t} />
              <a className="pname" href={`/team/${t.slug}`}>{t.name}</a>
              <span className="pform" aria-label={tr("Last results")}>{t.form.map((f, i) => <i key={i} className={f} />)}</span>
              <span className="prec">{t.w}–{t.l}</span>
              <span className={"pmove" + (t.move > 0 ? " up" : t.move < 0 ? " down" : "")} title={tr("In 7 days")}>
                {t.move == null ? tr("new") : t.move > 0 ? `▲ ${t.move}` : t.move < 0 ? `▼ ${-t.move}` : "="}
              </span>
              <span className="pbar" aria-hidden="true"><b style={{ width: `${Math.max(6, Math.round(((t.rating - low) / Math.max(1, top - low)) * 100))}%` }} /></span>
              <span className="prate">{t.rating}</span>
            </li>
          ))}
        </ol>
      )}
      {rows.length > 30 && <p><button type="button" className="btn" onClick={() => setAll(!all)}>{all ? tr("Show the top 30") : tr("Show all {n} teams", { n: rows.length })}</button></p>}
    </div>
  );
}

export const PowerPage = ({ rows, lang }) => <LangProvider lang={lang}><Power rows={rows} /></LangProvider>;

// ---- the quiz of the week

function Quiz({ questions, ranking, players, week }) {
  const tr = useT();
  const [picked, setPicked] = useState({});
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = deviceToken();
    if (!token) return;
    fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, mine: true }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.result) setDone(j); }).catch(() => {});
  }, []);
  const send = async () => {
    if (Object.keys(picked).length < questions.length) { setError(tr("Answer every question first.")); return; }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), answers: picked }) });
      const j = await r.json();
      if (!r.ok) setError(tr.server(j.error || "Error"));
      else setDone(j);
    } catch { setError(tr("Network error.")); }
    setBusy(false);
  };
  const res = done ? Object.fromEntries(done.result.map((r) => [r.id, r])) : {};
  return (
    <div className="wrap teampage">
      <Top title={tr("Quiz of the week")} />
      <p className="note">{tr("5 questions on last week's matches, one go per week. A new quiz every Monday.")}</p>
      {questions.length === 0 ? <p className="note">{tr("No quiz this week: no match was played in the last 4 weeks.")}</p> : (
        <>
          {done && <p className="quizscore"><b>{done.good}/{done.total}</b> {tr("right answers")}</p>}
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
        </>
      )}
      <section>
        <h2>{tr("This week's best")} <small className="note">({tr("{n} players", { n: players })})</small></h2>
        {ranking.length === 0 ? <p className="note">{tr("Nobody yet. Your name in the predictions puts you here.")}</p> : (
          <ol className="quizrank">{ranking.map((r, i) => <li key={r.name}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span> {r.name} <b>{r.good}/5</b></li>)}</ol>
        )}
        <p className="hint">{tr("Week of {date}", { date: new Date(`${week}T12:00:00Z`).toLocaleDateString(tr.lang === "en" ? "en-GB" : tr.lang, { day: "numeric", month: "long" }) })}</p>
      </section>
    </div>
  );
}

export const QuizPage = (props) => <LangProvider lang={props.lang}><Quiz {...props} /></LangProvider>;
