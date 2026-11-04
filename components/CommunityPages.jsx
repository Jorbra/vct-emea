"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import SearchBar from "./SearchBar.jsx";
import { localeOf } from "../lib/i18n.js";
import { EVENT_NAMES } from "../lib/paths.js";

function Top({ title, crumbs = [] }) {
  const tr = useT();
  return (
    <>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a>{crumbs.map(([t, h]) => <span key={t}> › {h ? <a href={h}>{t}</a> : t}</span>)}</nav>
    </>
  );
}

const dateOf = (tr, at) => new Intl.DateTimeFormat(localeOf(tr.lang), { dateStyle: "long" }).format(new Date(at));

function NewsListView({ news }) {
  const tr = useT();
  return (
    <div className="wrap">
      <Top title={tr("News")} crumbs={[[tr("News")]]} />
      {news.length === 0 ? <p className="note">{tr("No news yet.")}</p> : (
        <div className="newslist">
          {news.map((n) => (
            <a key={n.id} className="newsitem" href={`/news/${n.id}`}>
              <small>{dateOf(tr, n.at)}</small>
              <b>{n.title}</b>
              <span>{n.body.length > 180 ? `${n.body.slice(0, 180)}…` : n.body}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
export const NewsList = ({ news, lang }) => <LangProvider lang={lang}><NewsListView news={news} /></LangProvider>;

function NewsArticleView({ item }) {
  const tr = useT();
  return (
    <div className="wrap">
      <Top title={item.title} crumbs={[[tr("News"), "/news"], [item.title]]} />
      <article className="newsbody">
        <small>{dateOf(tr, item.at)}{item.who ? ` · ${item.who}` : ""}</small>
        <p>{item.body}</p>
      </article>
    </div>
  );
}
export const NewsArticle = ({ item, lang }) => <LangProvider lang={lang}><NewsArticleView item={item} /></LangProvider>;

const TOKEN_KEY = "vct-predictions";
/** The visitor's secret token, created once in the browser. */
function visitorToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      const b = crypto.getRandomValues(new Uint8Array(24));
      t = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return ""; // storage blocked: predictions cannot be kept
  }
}

function PredictionsView({ matches, ranking }) {
  const tr = useT();
  const [token, setToken] = useState("");
  const [me, setMe] = useState({ name: "", picks: {} });
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const load = useCallback((t) => {
    fetch("/api/predictions/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t }) })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setMe(j); }).catch(() => { /* offline: the page stays as it is */ });
  }, []);
  useEffect(() => {
    const t = visitorToken();
    setToken(t);
    if (t) load(t);
  }, [load]);
  const pick = async (m, team) => {
    setErr(""); setOk("");
    if (!me.name && name.trim().length < 2) { setErr(tr("Choose a name first.")); return; }
    const res = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: me.name || name, event: m.event, id: m.id, pick: team }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(tr.server(j.error || "")); return; }
    setOk(tr.server(j.message));
    setMe((x) => ({ name: x.name || name.trim(), picks: { ...x.picks, [`${m.event}:${m.id}`]: team } }));
  };
  const fmt = useMemo(() => new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [tr.lang]);
  return (
    <div className="wrap">
      <Top title={tr("Predictions")} crumbs={[[tr("Predictions")]]} />
      <p className="note">{tr("Pick the winner of each match before it starts. A point for every right pick.")}</p>
      {!token && <p className="err">{tr("Your browser blocks what predictions need to be kept.")}</p>}
      {me.name ? <p className="note">{tr("You play as {name}.", { name: me.name })}</p> : (
        <label className="f predname">{tr("Your name in the ranking")}<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="okmsg" role="status">{ok}</p>}
      <div className="cols">
        <main>
          <section>
            <h2>{tr("Open matches")}</h2>
            {matches.length === 0 && <p className="note">{tr("No match to predict for now.")}</p>}
            <div className="predlist">
              {matches.map((m) => {
                const chosen = me.picks[`${m.event}:${m.id}`];
                const side = (t) => (
                  <button type="button" className={"predteam" + (chosen === t.name ? " on" : "")} aria-pressed={chosen === t.name} disabled={!token} onClick={() => pick(m, t.name)}>
                    <Crest team={t} /><span>{t.name}</span>
                  </button>
                );
                return (
                  <div className="predm" key={m.event + m.id}>
                    <div className="predh"><b>{tr(EVENT_NAMES[m.event])}</b> · {m.round.map(([k, v]) => tr(k, v)).join(" · ")} · Bo{m.bo}{m.at ? ` · ${fmt.format(new Date(m.at))}` : ""}</div>
                    <div className="predvs">{side(m.a)}<span>vs</span>{side(m.b)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
        <aside>
          <section>
            <h2>{tr("Ranking")}</h2>
            {ranking.length === 0 ? <p className="note">{tr("The ranking starts with the first results.")}</p> : (
              <div className="tablewrap wide">
                <table>
                  <thead><tr><th>#</th><th>{tr("Name")}</th><th>{tr("Right picks")}</th></tr></thead>
                  <tbody>{ranking.map((r, i) => <tr key={r.name}><td>{i + 1}</td><td>{r.name}</td><td><b>{r.good}</b> / {r.total}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
export const Predictions = ({ matches, ranking, lang }) => <LangProvider lang={lang}><PredictionsView matches={matches} ranking={ranking} /></LangProvider>;
