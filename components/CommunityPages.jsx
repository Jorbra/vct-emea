"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { accountName } from "./account.js";
import SiteNav from "./SiteNav.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import SearchBar from "./SearchBar.jsx";
import { localeOf } from "../lib/i18n.js";
import { EVENT_NAMES } from "../lib/paths.js";
import Pickem from "./Pickem.jsx";
import { GroupBoard, Groups, SeasonTable, ShareCard } from "./Fans.jsx";

function Top({ title, crumbs = [] }) {
  const tr = useT();
  return (
    <>
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{title}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
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

function PredictionsView({ matches, ranking, pickem, group, groups }) {
  const tr = useT();
  const [token, setToken] = useState("");
  const [me, setMe] = useState({ name: "", picks: {}, scores: {} });
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
    setName((x) => x || accountName());
    if (t) load(t);
  }, [load]);
  const pick = async (m, team, score = "") => {
    setErr(""); setOk("");
    if (!me.name && name.trim().length < 2) { setErr(tr("Choose a name first.")); return; }
    const res = await fetch("/api/predictions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: me.name || name, event: m.event, id: m.id, pick: team, score }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(tr.server(j.error || "")); return; }
    setOk(tr.server(j.message));
    setMe((x) => ({ name: x.name || name.trim(), picks: { ...x.picks, [`${m.event}:${m.id}`]: team }, scores: { ...(x.scores || {}), [`${m.event}:${m.id}`]: score } }));
  };
  const fmt = useMemo(() => new Intl.DateTimeFormat(localeOf(tr.lang), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [tr.lang]);
  return (
    <div className="wrap">
      <Top title={tr("Predictions")} crumbs={[[tr("Predictions")]]} />
      <p className="note">{tr("Pick the winner of each match before it starts. A point for every right pick.")}</p>
      {!token && <p className="err">{tr("Your browser blocks what predictions need to be kept.")}</p>}
      {me.name ? <p className="note">{tr("You play as {name}.", { name: me.name })} <ShareCard name={me.name} /></p> : (
        <label className="f predname">{tr("Your name in the ranking")}<input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="okmsg" role="status">{ok}</p>}
      <div className="cols">
        <main>
          {pickem && <Pickem events={pickem.events} boards={pickem.boards} token={token} name={me.name || name.trim()} />}
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
                    {chosen && m.bo > 1 && (
                      <div className="predscore" role="group" aria-label={tr("Exact score (bonus point)")}>
                        <small>{tr("Exact score (bonus point)")} :</small>
                        {Array.from({ length: Math.ceil(m.bo / 2) }, (_, k) => `${Math.ceil(m.bo / 2)}-${k}`).map((s) => {
                          const on = ((me.scores || {})[`${m.event}:${m.id}`] || "") === s;
                          return <button type="button" key={s} className={"btn small" + (on ? " pri" : "")} aria-pressed={on} onClick={() => pick(m, chosen, on ? "" : s)}>{chosen} {s.replace("-", "–")}</button>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </main>
        <aside>
          {group && (
            <section>
              <h2>{tr("Ranking")} · {group.name}</h2>
              <SeasonTable ranking={group.ranking} me={me.name} />
            </section>
          )}
          <Groups token={token} group={group} named={!!me.name} />
          <GroupBoard list={groups} />
          <section>
            <h2>{tr("Season ranking")}</h2>
            <p className="hint">{tr("1 point per right prediction, 1 more for the exact score, plus the points of Who qualifies?.")}</p>
            <SeasonTable ranking={ranking} me={me.name} />
          </section>
        </aside>
      </div>
    </div>
  );
}
export const Predictions = ({ matches, ranking, pickem, group, groups, lang }) => <LangProvider lang={lang}><PredictionsView matches={matches} ranking={ranking} pickem={pickem} group={group} groups={groups} /></LangProvider>;
