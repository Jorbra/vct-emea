"use client";

import { localeOf } from "../lib/i18n.js";
import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { LiveBadge } from "./matchTime.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { allMatches, editorAgenda, eventData, matchesOf } from "../lib/matchlist.js";
import { formatMatchTime, TIME_EVENTS } from "../lib/schedule.js";
import { eventStatus, formatDates } from "../lib/status.js";
import BotPanel from "./BotPanel.jsx";
import { BulkScores, MissingLogos } from "./Round9.jsx";
import { ControlRoom } from "./Round10.jsx";
import { ActivityFeed, EditorKpis, EditorSearch } from "./Round11.jsx";
import { GamesToday, MetaDraft, MissingPictures, SlashToSearch, VlrTables } from "./Round14.jsx";
import { SharePictures } from "./Round16.jsx";
import { SourcesEditor } from "./SourcesEditor.jsx";
import { ScheduledNews, SyncLog, TeamAliases } from "./Editor17.jsx";
import { missingLogos, openMatches } from "../lib/r9pure.js";

const GROUPS = [
  ["Europe", ["q1", "q2", "playoffs"]],
  ["Türkiye", ["trq1", "trq2", "tr"]],
  ["MENA", ["meq1", "meq2", "naq1", "naq2", "mena"]],
  ["Kickoff", ["kickoff"]],
  ["VCT GC EMEA", ["gc"]],
];

/** The editor's home page: what needs doing now, the next matches, and where each event stands. */
export default function AdminHome({ initial, onOpen, call, onDone }) {
  const tr = useT();
  const [now, setNow] = useState(null); // the editor's clock, known once on the client
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const status = useMemo(() => eventStatus(initial), [initial]);
  const agenda = useMemo(() => (now == null ? { live: [], late: [], next: [] } : editorAgenda(initial, now)), [initial, now]);
  const counts = useMemo(() => Object.fromEntries(TIME_EVENTS.map((e) => {
    const list = matchesOf(e, eventData(initial, e)).filter((m) => m.a && m.b);
    return [e, { ready: list.length, played: list.filter((m) => m.sa != null).length }];
  })), [initial]);

  const [claims, setClaims] = useState((initial.admin && initial.admin.claims) || {});
  const me = (initial.admin && initial.admin.me) || "";
  const claim = async (m, on) => {
    const key = `${m.event}:${m.id}`;
    try { await call("/api/claim", { event: m.event, id: m.id, on }); setClaims((c) => { const n = { ...c }; if (on) n[key] = me; else delete n[key]; return n; }); } catch (e) { onDone(tr.server(e.message)); }
  };
  const row = (m, badge) => {
    const key = `${m.event}:${m.id}`;
    const who = claims[key];
    const mine = who !== undefined && who === me;
    return (
      <div key={m.event + m.id} className="ahrowwrap">
        <button type="button" className="ahrow" onClick={() => onOpen(m.event, true)}>
          <span className="ahwhen">{badge || (m.at ? formatMatchTime(m.at, tr.lang, true) : "–")}</span>
          <span className="ahteams">{(m.a && m.a.name) || tr("TBD")} vs {(m.b && m.b.name) || tr("TBD")}</span>
          <span className="ahwhere">{tr(EVENT_NAMES[m.event])} · {m.round.map(([k, v]) => tr(k, v)).join(" · ")}</span>
        </button>
        {initial.admin && (who === undefined
          ? <button type="button" className="btn small claimbtn" onClick={() => claim(m, true)}>✋ {tr("I'm on it")}</button>
          : <button type="button" className={"btn small claimbtn" + (mine ? " mine" : "")} onClick={() => mine && claim(m, false)} title={mine ? tr("Let it go") : ""}>👤 {who || tr("Main account")}{mine ? " ×" : ""}</button>)}
      </div>
    );
  };
  const todo = agenda.live.length + agenda.late.length;
  return (
    <div className="adhome">
      <p className="guidelink"><a className="btn" href="/admin/nouveautes">{tr("What's new and how it works")}</a></p>
      {initial.admin && <EditorKpis initial={initial} />}
      {initial.admin && <EditorSearch initial={initial} onOpen={onOpen} />}
      {initial.admin && <SlashToSearch />}
      {initial.admin && initial.admin.r14 && <MissingPictures missing={initial.admin.r14.missing} />}
      {initial.admin && <ControlRoom initial={initial} call={call} onDone={onDone} />}
      {initial.admin && <ActivityFeed />}
      {initial.admin && <QuickLive initial={initial} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.dayBoard && <DayBoard list={initial.admin.dayBoard} onOpen={onOpen} />}
      {initial.admin && initial.admin.checklist && initial.admin.checklist.length > 0 && <Checklist list={initial.admin.checklist} />}
      {initial.admin && initial.admin.health && <Health rows={initial.admin.health} />}
      {initial.admin && initial.admin.sources && <SourcesEditor list={initial.admin.sources} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.teamAliases && <TeamAliases aliases={initial.admin.teamAliases} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.syncLog && <SyncLog list={initial.admin.syncLog} />}
      {initial.admin && initial.admin.scheduled && <ScheduledNews list={initial.admin.scheduled} call={call} onDone={onDone} />}
      {initial.admin && <BotPanel />}
      {initial.admin && initial.admin.r14 && <VlrTables data={initial.admin.r14.vlr} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.r14 && <GamesToday games={initial.admin.r14.games} />}
      {initial.admin && initial.admin.r14 && <MetaDraft text={initial.admin.r14.meta} />}
      {initial.admin && <SharePictures initial={initial} now={now} />}
      {initial.admin && initial.admin.steps && <Journal admin={initial.admin} call={call} onDone={onDone} />}
      {initial.admin && <BannerEditor banner={initial.admin.banner} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.visits && <Visits v={initial.admin.visits} activity={initial.admin.activity} />}
      {initial.admin && <BulkScores list={openMatches(initial)} call={call} onDone={onDone} />}
      {initial.admin && <MissingLogos list={missingLogos(initial)} onOpen={onOpen} />}
      {initial.admin && <Exports />}
      {initial.admin && initial.admin.polls && <PollsEditor polls={initial.admin.polls} call={call} onDone={onDone} />}
      {initial.admin && initial.admin.schedScores && <ScheduledScores list={initial.admin.schedScores} initial={initial} call={call} onDone={onDone} />}
      {initial.admin && <MobilePreview />}
      {initial.admin && initial.admin.comments && <CommentsMod list={initial.admin.comments} call={call} onDone={onDone} />}
      <section>
        <h2>{tr("To do")}</h2>
        {todo === 0 && <p className="note">{now == null ? " " : tr("Nothing waiting: no match is live or waiting for its score.")}</p>}
        {agenda.live.length > 0 && <div className="ahlist">{agenda.live.map((m) => row(m, <LiveBadge />))}</div>}
        {agenda.late.length > 0 && (
          <>
            <h3 className="sub">{tr("Waiting for their score")} <small>({agenda.late.length})</small></h3>
            <div className="ahlist">{agenda.late.map((m) => row(m))}</div>
          </>
        )}
      </section>
      {agenda.next.length > 0 && (
        <section>
          <h2>{tr("Upcoming matches")}</h2>
          <div className="ahlist">{agenda.next.map((m) => row(m))}</div>
        </section>
      )}
      <section>
        <h2>{tr("Events")}</h2>
        {GROUPS.map(([title, events]) => (
          <div className="evgroup" key={title}>
            <h3>{title}</h3>
            <div className="evgrid">
              {events.map((e) => {
                const st = status[e];
                const c = counts[e] || { ready: 0, played: 0 };
                return (
                  <button type="button" key={e} className={"evcard " + st.state} onClick={() => onOpen(e, false)}>
                    <span className="evtop">
                      <span className={"evstate " + st.state}>{tr(st.state === "done" ? "Finished" : st.state === "live" ? "Live" : "Upcoming")}</span>
                      <span className="evcount">{st.of ? `${st.teams}/${st.of}` : st.teams} {tr("teams")}</span>
                    </span>
                    <span className="evtitle">{tr(EVENT_NAMES[e])}</span>
                    <span className="evdates">{formatDates(initial.info && initial.info[e], tr.lang) || tr("Dates to be announced")}</span>
                    <span className="evmeta">{tr("{p} of {n} matches played", { p: c.played, n: c.ready })}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      {initial.admin && <Manage admin={initial.admin} call={call} onDone={onDone} />}
    </div>
  );
}

const HEALTH = {
  cron: ["Outside scheduler (cron-job.org)", "Calls /api/tick every few minutes."],
  toornament: ["Toornament", "Teams, times and results of the qualifiers."],
  vlr: ["vlr.gg", "Maps, players' numbers, streams."],
  liquipedia: ["Liquipedia", "Rosters, logos, transfers, LFT."],
  alerts: ["Alerts", "Last sending: sent / browsers."],
  regular: ["Work started by visits", "Each visit can start a round."],
};

/** On a phone during a match: the maps won so far with big buttons, and the result in one tap. */
function QuickLive({ initial, call, onDone }) {
  const tr = useT();
  const live = allMatches(initial).filter((m) => m.live && m.a && m.b);
  if (!live.length) return null;
  const score = (m) => (initial.live[m.event] || {})[m.id] || { a: 0, b: 0 };
  const set = async (m, a, b) => {
    try { const j = await call("/api/mlive", { event: m.event, id: m.id, live: true, a: Math.max(0, a), b: Math.max(0, b) }); onDone(tr.server(j.message)); } catch (e) { onDone(tr.server(e.message)); }
  };
  return (
    <section>
      <h2>⚡ {tr("Quick live score")} <small>({live.length})</small></h2>
      <div className="quicklive">
        {live.map((m) => {
          const s = score(m);
          const need = Math.ceil((m.bo || 1) / 2);
          return (
            <div key={m.event + m.id} className="qlcard">
              <small>{tr(EVENT_NAMES[m.event])} · Bo{m.bo}</small>
              {[["a", m.a], ["b", m.b]].map(([side, t]) => (
                <div key={side} className="qlrow">
                  <span className="qlname">{t.name}</span>
                  <button type="button" className="btn qlbtn" aria-label={tr("One map less")} onClick={() => set(m, side === "a" ? s.a - 1 : s.a, side === "b" ? s.b - 1 : s.b)}>−</button>
                  <b className="qlscore">{side === "a" ? s.a : s.b}</b>
                  <button type="button" className="btn qlbtn pri" aria-label={tr("One map more")} onClick={() => set(m, side === "a" ? s.a + 1 : s.a, side === "b" ? s.b + 1 : s.b)}>+1</button>
                </div>
              ))}
              {(s.a >= need || s.b >= need) && <p className="hint">{tr("Series decided: enter the result in the event's matches.")}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** What is missing before an event starts (or while it runs). */
function Checklist({ list }) {
  const tr = useT();
  return (
    <section>
      <details className="einfo" open>
        <summary><b>✅ {tr("Before the events")}</b> <small>{list.filter((e) => e.issues.length).length} {tr("to look at")}</small></summary>
        {list.map((e) => (
          <div key={e.event} className="checkev">
            <h3 className="sub">{tr(e.name)} <small>{new Date(e.start).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></h3>
            {e.issues.length === 0 ? <p className="hint">✅ {tr("All set.")}</p> : (
              <ul className="checklist">{e.issues.map((x) => <li key={x.kind}>⚠️ {tr(x.text)}{x.kind !== "stream" && x.kind !== "teams" ? ` : ${x.count}` : ""}{x.items.length > 0 && <small> · {x.items.join(", ")}{x.count > x.items.length ? " …" : ""}</small>}</li>)}</ul>
            )}
          </div>
        ))}
      </details>
    </section>
  );
}

/** The changes, by editor and by event, and going back to before one of them (with every change made after it). */
function Journal({ admin, call, onDone }) {
  const tr = useT();
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");
  const people = [...new Set(admin.history.map((h) => h.who || tr("Main account")))];
  const shown = admin.history.filter((h) => (!who || (h.who || tr("Main account")) === who) && (!q || h.message.toLowerCase().includes(q.toLowerCase())));
  const back = async (s, i) => {
    if (!window.confirm(tr("Undo this change and the {n} made after it?", { n: i }))) return;
    try { const j = await call("/api/undo", { step: s.step }); onDone(tr.server(j.message)); window.location.reload(); } catch (e) { onDone(tr.server(e.message)); }
  };
  const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section>
      <details className="einfo">
        <summary><b>🗂 {tr("Journal of changes")}</b></summary>
        <div className="row" style={{ margin: "8px 0" }}>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label={tr("Editor")}><option value="">{tr("Everyone")}</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Event, team, word…")} aria-label={tr("Search")} />
        </div>
        <ul className="ahhist">{shown.slice(0, 80).map((h, i) => <li key={i}><time>{when(h.at)}</time><b>{h.who || tr("Main account")}</b><span>{h.message}</span></li>)}</ul>
        {admin.steps.length > 0 && (
          <>
            <h3 className="sub">{tr("Go back to before a change")}</h3>
            <ul className="ahhist">{admin.steps.map((s, i) => (
              <li key={s.step}><time>{when(s.at)}</time><b>{s.who || tr("Main account")}</b><span>{s.label}</span>
                <button type="button" className="btn small" onClick={() => back(s, i)}>{i === 0 ? tr("Undo") : tr("Undo back to here")}</button></li>
            ))}</ul>
            <p className="hint">{tr("Going back to a change also undoes every change made after it.")}</p>
          </>
        )}
      </details>
    </section>
  );
}

const keyBytes = (key) => Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** This device told when the cron or Toornament stops, or a part fails. */
function HealthDevice() {
  const tr = useT();
  const [msg, setMsg] = useState("");
  const turnOn = async () => {
    setMsg("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error(tr("This browser cannot show alerts."));
      if ((await Notification.requestPermission()) !== "granted") throw new Error(tr("Notifications are blocked for this site: allow them in the browser's site settings, then try again."));
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const { key } = await fetch("/api/push").then((r) => r.json());
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      const { endpoint, keys } = sub.toJSON();
      const r = await fetch("/api/health", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint, keys }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(tr.server(j.error || "Network error"));
      setMsg(tr.server(j.message));
    } catch (e) { setMsg(e.message); }
  };
  return <p className="row"><button type="button" className="btn" onClick={turnOn}>🔔 {tr("Alert this device when something stops")}</button>{msg && <span className="hint" role="status"> {msg}</span>}</p>;
}

/** The site's own page views: per day, and the pages most seen this week. */
function Visits({ v, activity = [] }) {
  const tr = useT();
  const max = Math.max(1, ...v.days.map((d) => d.n));
  const sum = (k) => activity.slice(7).reduce((s, d) => s + d[k], 0);
  return (
    <section>
      <details className="einfo">
        <summary><b>{tr("Page views")}</b> <small>{tr("{n} today", { n: v.today })} · {tr("{n} in 7 days", { n: v.week })}</small></summary>
        <div className="visitbars" role="img" aria-label={tr("Page views of the last 14 days")}>
          {v.days.map((d) => <div key={d.day} className="vbar" title={`${d.day} : ${d.n}`}><i style={{ height: `${Math.round((d.n / max) * 100)}%` }} /><small>{d.day.slice(8)}</small></div>)}
        </div>
        <div className="tablewrap"><table>
          <thead><tr><th>{tr("Page")}</th><th>{tr("Views (7 days)")}</th></tr></thead>
          <tbody>{v.pages.map((p) => <tr key={p.path}><td><a href={p.path}>{p.path}</a></td><td>{p.n}</td></tr>)}</tbody>
        </table></div>
        {activity.length > 0 && (
          <>
            <h3 className="sub">{tr("What visitors did")}</h3>
            <div className="pcardnums weeknums">
              <div><b>{sum("votes")}</b><span>{tr("Player of the match votes")}</span></div>
              <div><b>{sum("maps")}</b><span>{tr("Map predictions")}</span></div>
              <div><b>{sum("quiz")}</b><span>{tr("Quizzes played")}</span></div>
              <div><b>{sum("comments")}</b><span>{tr("Comments")}</span></div>
            </div>
            <div className="tablewrap"><table>
              <thead><tr><th>{tr("Day")}</th><th>{tr("Votes")}</th><th>{tr("Maps")}</th><th>{tr("Quiz")}</th><th>{tr("Comments")}</th></tr></thead>
              <tbody>{activity.slice().reverse().filter((d) => d.votes + d.maps + d.quiz + d.comments > 0).slice(0, 14).map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.votes}</td><td>{d.maps}</td><td>{d.quiz}</td><td>{d.comments}</td></tr>)}</tbody>
            </table></div>
            <p className="hint">{tr("Totals of the last 7 days; the table shows the last 14 days with something done.")}</p>
          </>
        )}
        <p className="hint">{tr("Counted by the site itself, without cookies or outside tracker: one view per page opened, robots left out.")}</p>
      </details>
    </section>
  );
}

/** Today's matches at a glance: who is on each, what is still missing. */
function DayBoard({ list, onOpen }) {
  const tr = useT();
  if (!list.length) return null;
  const MISS = { score: tr("score"), maps: tr("maps"), mvp: "MVP" };
  const todo = list.filter((m) => m.missing.length).length;
  return (
    <section>
      <h2>📋 {tr("Today")} <small>{list.length} {tr("Matches").toLowerCase()} · {todo ? tr("{n} to complete", { n: todo }) : "✅"}</small></h2>
      <div className="tablewrap"><table className="dayboard">
        <thead><tr><th>{tr("Time")}</th><th>{tr("Match")}</th><th>{tr("Editor")}</th><th>{tr("Missing")}</th></tr></thead>
        <tbody>{list.map((m) => (
          <tr key={m.event + m.id} className={m.missing.length ? "todo" : ""}>
            <td>{new Date(m.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</td>
            <td><button type="button" className="linkbtn" onClick={() => onOpen(m.event, true)}>{m.a} vs {m.b}</button>{m.live ? " 🔴" : m.done ? " ✅" : ""}</td>
            <td>{m.who === undefined ? "–" : m.who || tr("Main account")}</td>
            <td>{m.missing.length ? m.missing.map((x) => MISS[x]).join(", ") : "–"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

/** The site's polls: write one (and relay it on Discord), close one, see the votes. */
function PollsEditor({ polls, call, onDone }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState("");
  const [closes, setCloses] = useState("");
  const [discord, setDiscord] = useState(true);
  const send = async (body) => { try { const j = await call("/api/polls", body); onDone(tr.server(j.message)); window.location.reload(); } catch (e) { onDone(tr.server(e.message)); } };
  return (
    <section>
      <details className="einfo">
        <summary><b>📊 {tr("Polls")}</b> <small>{polls.filter((p) => p.open).length} {tr("open")}</small></summary>
        <div className="bannerform">
          <label className="f">{tr("Question")}<input value={q} onChange={(e) => setQ(e.target.value)} maxLength={140} placeholder={tr("Who wins the Kickoff?")} /></label>
          <label className="f">{tr("Answers (one per line, 6 at most)")}<textarea rows={4} value={opts} onChange={(e) => setOpts(e.target.value)} /></label>
          <label className="f">{tr("Closes (optional)")}<input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
          <label className="f check"><input type="checkbox" checked={discord} onChange={(e) => setDiscord(e.target.checked)} /> {tr("Also post it on Discord")}</label>
        </div>
        <p className="row"><button type="button" className="btn pri" onClick={() => send({ question: q, options: opts, closes: closes ? new Date(closes).toISOString() : "", discord })}>{tr("Publish the poll")}</button></p>
        {polls.length > 0 && (
          <ul className="ahhist">{polls.map((p) => (
            <li key={p.id}><b>{p.question}</b><span>{p.options.map((o, i) => `${o} ${p.counts[i]}`).join(" · ")} · {p.total} {tr("votes")}</span>
              {p.open ? <button type="button" className="btn small" onClick={() => send({ close: p.id })}>{tr("Close")}</button> : <small>{tr("closed")}</small>}</li>
          ))}</ul>
        )}
      </details>
    </section>
  );
}

/** A result entered by itself at a set time (a match shown later on VOD, for example). */
function ScheduledScores({ list, initial, call, onDone }) {
  const tr = useT();
  const open = allMatches(initial).filter((m) => m.a && m.b && m.a.name && m.b.name && m.sa == null).sort((x, y) => (x.at || "9").localeCompare(y.at || "9")).slice(0, 80);
  const [key, setKey] = useState("");
  const [sa, setSa] = useState("");
  const [sb, setSb] = useState("");
  const [at, setAt] = useState("");
  const name = (k) => { const m = allMatches(initial).find((x) => `${x.event}:${x.id}` === k); return m && m.a && m.b ? `${m.a.name} vs ${m.b.name}` : k; };
  const send = async (body) => { try { const j = await call("/api/schedscore", body); onDone(tr.server(j.message)); window.location.reload(); } catch (e) { onDone(tr.server(e.message)); } };
  const [event, id] = key.split(":");
  return (
    <section>
      <details className="einfo">
        <summary><b>⏱️ {tr("Scheduled scores")}</b> <small>{list.length}</small></summary>
        <div className="bannerform">
          <label className="f">{tr("Match")}<select value={key} onChange={(e) => setKey(e.target.value)}><option value="">–</option>{open.map((m) => <option key={m.event + m.id} value={`${m.event}:${m.id}`}>{m.a.name} vs {m.b.name} · {tr(EVENT_NAMES[m.event])}</option>)}</select></label>
          <label className="f">{tr("Score")}<span className="row"><input type="number" min="0" max="5" value={sa} onChange={(e) => setSa(e.target.value)} style={{ width: 60 }} /> – <input type="number" min="0" max="5" value={sb} onChange={(e) => setSb(e.target.value)} style={{ width: 60 }} /></span></label>
          <label className="f">{tr("Published at")}<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
        </div>
        <p className="row"><button type="button" className="btn pri" disabled={!key || sa === "" || sb === "" || !at} onClick={() => send({ event, id, sa: Number(sa), sb: Number(sb), at: new Date(at).toISOString() })}>{tr("Schedule the score")}</button></p>
        {list.length > 0 && <ul className="ahhist">{list.map((s) => <li key={s.event + s.id}><time>{new Date(s.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time><b>{name(`${s.event}:${s.id}`)}</b><span>{s.sa}–{s.sb}</span><button type="button" className="btn small" onClick={() => send({ cancel: true, event: s.event, id: s.id })}>{tr("Remove")}</button></li>)}</ul>}
        <p className="hint">{tr("The score goes on the site by itself at that time (checked every minute or so), with the alerts, as if entered by you.")}</p>
      </details>
    </section>
  );
}

/** The results and the predictions' ranking as spreadsheets. */
function Exports() {
  const tr = useT();
  return (
    <section>
      <details className="einfo">
        <summary><b>📤 {tr("Exports (CSV)")}</b></summary>
        <p className="row" style={{ margin: "8px 0" }}>
          <a className="btn" href="/api/export?kind=results" download>{tr("All the results")}</a>
          <a className="btn" href="/api/export?kind=ranking" download>{tr("The predictions' ranking")}</a>
        </p>
        <p className="hint">{tr("Opens in Excel, LibreOffice or Google Sheets (columns separated by semicolons).")}</p>
      </details>
    </section>
  );
}

/** The banner at the top of every page, now or between two dates. */
function BannerEditor({ banner, call, onDone }) {
  const tr = useT();
  const local = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [f, setF] = useState({ text: (banner && banner.text) || "", url: (banner && banner.url) || "", from: local(banner && banner.from), to: local(banner && banner.to), tone: (banner && banner.tone) || "info" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (clear) => {
    const body = clear ? { text: "" } : { ...f, from: f.from ? new Date(f.from).toISOString() : "", to: f.to ? new Date(f.to).toISOString() : "" };
    try { const j = await call("/api/banner", body); onDone(tr.server(j.message)); if (clear) setF({ ...f, text: "" }); } catch (e) { onDone(tr.server(e.message)); }
  };
  const now = Date.now();
  const state = !banner || !banner.text ? "" : banner.from && new Date(banner.from).getTime() > now ? tr("Scheduled") : banner.to && new Date(banner.to).getTime() <= now ? tr("Over") : tr("Shown now");
  return (
    <section>
      <details className="einfo">
        <summary><b>📣 {tr("Site banner")}</b> {state && <small>{state}</small>}</summary>
        <div className="bannerform">
          <label className="f">{tr("Text")}<input value={f.text} onChange={set("text")} maxLength={200} placeholder={tr("The playoffs start tonight at 6 pm!")} /></label>
          <label className="f">{tr("Link (optional)")}<input value={f.url} onChange={set("url")} placeholder="/soiree" /></label>
          <label className="f">{tr("From")}<input type="datetime-local" value={f.from} onChange={set("from")} /></label>
          <label className="f">{tr("Until")}<input type="datetime-local" value={f.to} onChange={set("to")} /></label>
          <label className="f">{tr("Color")}<select value={f.tone} onChange={set("tone")}><option value="info">{tr("Blue (information)")}</option><option value="live">{tr("Red (live)")}</option><option value="warn">{tr("Green (important)")}</option></select></label>
        </div>
        {f.text && <div className={`sitebanner ${f.tone}`} style={{ margin: "8px 0", borderRadius: 5 }}>{f.text}{f.url ? " ›" : ""}</div>}
        <p className="row"><button type="button" className="btn pri" onClick={() => save(false)}>{f.from ? tr("Schedule the banner") : tr("Show the banner")}</button> {banner && banner.text && <button type="button" className="btn" onClick={() => save(true)}>{tr("Remove the banner")}</button>}</p>
        <p className="hint">{tr("Empty dates: shown at once, until removed. A visitor who closes it sees it again only when the text changes.")}</p>
      </details>
    </section>
  );
}

const PREVIEW_PAGES = [["/", "Home"], ["/live", "Live"], ["/soiree", "Match night"], ["/calendar", "Calendar"], ["/predictions", "Predictions"], ["/quiz", "Quiz of the week"], ["/puissance", "Power ranking"], ["/stats", "Stats"]];

/** A page of the site as a phone shows it, to check it before or after a change. */
function MobilePreview() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("/");
  const [custom, setCustom] = useState("");
  const [n, setN] = useState(0);
  const src = (custom.startsWith("/") ? custom : path) + (n ? `${(custom.startsWith("/") ? custom : path).includes("?") ? "&" : "?"}r=${n}` : "");
  return (
    <section>
      <details className="einfo" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary><b>📱 {tr("Phone preview")}</b></summary>
        <div className="row" style={{ margin: "8px 0" }}>
          <select value={path} onChange={(e) => { setPath(e.target.value); setCustom(""); }} aria-label={tr("Page")}>{PREVIEW_PAGES.map(([p, l]) => <option key={p} value={p}>{tr(l)}</option>)}</select>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="/team/fnatic" aria-label={tr("Other page")} />
          <button type="button" className="btn" onClick={() => setN(n + 1)}>🔄 {tr("Reload")}</button>
        </div>
        {open && <div className="phoneframe"><iframe title={tr("Phone preview")} src={src} width="375" height="720" /></div>}
      </details>
    </section>
  );
}

/** The latest comments, and removing one. */
function CommentsMod({ list, call, onDone }) {
  const tr = useT();
  const [gone, setGone] = useState([]);
  const shown = list.filter((c) => !gone.includes(c.id));
  const remove = async (id) => {
    try {
      const j = await call("/api/comments", { remove: id });
      setGone((g) => [...g, id]);
      onDone(tr.server(j.message));
    } catch (e) { onDone(tr.server(e.message)); }
  };
  return (
    <section>
      <details className="einfo">
        <summary><b>{tr("Comments")}</b> <small>({shown.length})</small></summary>
        {shown.length === 0 ? <p className="note">{tr("No comment yet.")}</p> : (
          <ul className="ahhist">{shown.map((c) => (
            <li key={c.id}><b>{c.name}</b> <small>{new Date(c.at).toLocaleString()} · <a href={`/match/${c.event}/${c.mid}`}>{c.event} {c.mid}</a></small><br />{c.body} <button type="button" className="btn danger small" onClick={() => remove(c.id)}>{tr("Remove")}</button></li>
          ))}</ul>
        )}
      </details>
    </section>
  );
}

/** What runs by itself: when it last worked, and its last problem. */
function Health({ rows }) {
  const tr = useT();
  const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : tr("never"));
  const bad = rows.filter((r) => r.late || (r.problem && r.problem.at && Date.now() - new Date(r.problem.at).getTime() < 6 * 3600000)).length;
  return (
    <section>
      <details className="einfo health" open={bad > 0}>
        <summary><b>{tr("Site health")}</b> <span className={"hstate " + (bad ? "bad" : "ok")}>{bad ? tr("{n} to look at", { n: bad }) : tr("All good")}</span></summary>
        <div className="tablewrap"><table>
          <thead><tr><th>{tr("Part")}</th><th>{tr("Last worked")}</th><th>{tr("Last problem")}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.part} className={r.late ? "late" : ""}>
              <td><b>{tr(HEALTH[r.part][0])}</b><br /><small>{tr(HEALTH[r.part][1])}</small></td>
              <td>{r.late ? "⚠️ " : "✅ "}{when(r.at)}{r.note ? ` · ${r.note}` : ""}</td>
              <td>{r.problem ? <><small>{when(r.problem.at)}</small><br />{r.problem.message}</> : "–"}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="hint">{tr("⚠️: nothing has worked for longer than usual. A problem stays shown until the next one.")}</p>
        <HealthDevice />
      </details>
    </section>
  );
}

/** Writing, editing and removing news. Plain text: line breaks are kept. */
/** Where the rosters typed here and Liquipedia's differ, and a button to follow Liquipedia. */
/** Visitors' accounts: no e-mail exists, so a forgotten password comes through here. Only for the main account. */
function VisitorAccounts({ count, roles, call, onDone }) {
  const tr = useT();
  const [list, setList] = useState(roles);
  const [info, setInfo] = useState("");
  async function role(value) {
    setErr(""); setInfo(""); setGiven(null);
    try {
      const j = await call("/api/accounts", { action: "role", name, role: value });
      setList(j.roles);
      setInfo(tr.server(j.message));
      setName("");
    } catch (e) {
      setErr(tr.server(e.message));
    }
  }
  const [name, setName] = useState("");
  const [given, setGiven] = useState(null);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState("");
  async function reset() {
    setErr(""); setGiven(null);
    try {
      const j = await call("/api/accounts", { action: "reset", name });
      setGiven({ name: j.name, password: j.password });
    } catch (e) {
      setErr(tr.server(e.message));
    }
  }
  async function remove() {
    setErr(""); setGiven(null);
    try {
      const j = await call("/api/accounts", { action: "remove", name });
      setName(""); setSure(false);
      onDone(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  }
  return (
    <details className="einfo">
      <summary><b>{tr("Visitors' accounts")}</b> <small>({count})</small></summary>
      <p className="hint">{tr("Someone has lost their password: write their exact name and give them a new one. It is shown only once. Ask them to change it afterwards.")}</p>
      <div className="row">
        <input aria-label={tr("Name")} placeholder={tr("Name")} value={name} autoCapitalize="none" spellCheck={false} onChange={(e) => { setName(e.target.value); setSure(false); }} />
        <button type="button" className="btn" disabled={!name.trim()} onClick={reset}>{tr("New password")}</button>
        <button type="button" className={"btn" + (sure ? " danger" : "")} disabled={!name.trim()} onClick={() => (sure ? remove() : setSure(true))}>{sure ? tr("Confirm: delete") : tr("Delete the account")}</button>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="row">
        <button type="button" className="btn" disabled={!name.trim()} onClick={() => role("owner")}>{tr("Make it the main account")}</button>
        <button type="button" className="btn" disabled={!name.trim()} onClick={() => role("editor")}>{tr("Give editor access")}</button>
        <button type="button" className="btn" disabled={!name.trim()} onClick={() => role("")}>{tr("Take away the access")}</button>
      </div>
      {info && <p className="hint" role="status">{info}</p>}
      {list.length > 0 && <ul className="acctroles">{list.map((r) => <li key={r.name}><b>{r.name}</b> <small>{r.role === "owner" ? tr("Main account") : tr("Editor")}</small></li>)}</ul>}
      {given && <p className="note" role="status">{tr("New password for {name}:", { name: given.name })} <code>{given.password}</code></p>}
    </details>
  );
}

/** How following Toornament is going, event by event. */
function SyncStatus({ list }) {
  const tr = useT();
  const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
  const events = Object.keys(list);
  return (
    <details className="einfo">
      <summary><b>{tr("Following Toornament")}</b></summary>
      <p className="hint">{tr("Teams, line-ups, times and results follow Toornament by themselves. What you change by hand stays as you wrote it.")}</p>
      {events.length === 0 ? <p className="note">{tr("Not read yet.")}</p> : (
        <div className="tablewrap"><table>
          <thead><tr><th>{tr("Event")}</th><th>{tr("Last read")}</th><th>{tr("Last change")}</th><th>{tr("Teams")}</th><th>{tr("To check")}</th></tr></thead>
          <tbody>{events.map((e) => {
            const m = list[e];
            const notes = [m.error, m.guessed ? tr("{n} scores estimated: only the winner was given", { n: m.guessed }) : "", m.kept ? tr("{n} kept as changed by hand", { n: m.kept }) : "", m.mismatch ? tr("{n} results not placed", { n: m.mismatch }) : ""].filter(Boolean);
            return <tr key={e}><td>{tr(EVENT_NAMES[e] || e)}</td><td>{when(m.at)}</td><td>{when(m.changedAt)}</td><td>{m.teams || "–"}</td><td>{notes.join(" · ") || "–"}</td></tr>;
          })}</tbody>
        </table></div>
      )}
    </details>
  );
}

/** Flags in bulk: one "player, country" per line. */
function FlagImport({ call, onDone }) {
  const tr = useT();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setNote("");
    try {
      const j = await call("/api/q/flags", { text });
      setNote(tr.server(j.message));
      setText("");
      onDone(tr.server(j.message));
    } catch (e) {
      setNote(tr.server(e.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="einfo">
      <summary><b>{tr("Import nationalities")}</b></summary>
      <p className="hint">{tr("One player per line: nickname, country. The country is a two-letter code (fr) or an English name (France). Every qualifier's rosters are updated.")}</p>
      <textarea className="qtext" rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label={tr("Import nationalities")} spellCheck={false} placeholder={"NeFi, pl\nTITOUNE, France"} />
      <div className="row">
        <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={save}>{tr("Save flags")}</button>
        {note && <span className="hint">{note}</span>}
      </div>
    </details>
  );
}

function RosterDiffs({ list, call, onDone }) {
  const tr = useT();
  const [err, setErr] = useState("");
  const follow = async (key) => {
    setErr("");
    try {
      const j = await call("/api/roster-sync", { key });
      onDone(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  };
  return (
    <section>
      <h2>{tr("Roster differences")} <small>({list.length})</small></h2>
      {list.length === 0 ? <p className="note">{tr("Rosters match Liquipedia for the teams read so far.")}</p> : (
        <ul className="ahhist">
          {list.map((d) => (
            <li key={d.key}>
              <b><a href={`/team/${d.key}`}>{d.name}</a></b>
              <span>
                {d.onlySite.length > 0 && <>{tr("Here, not on Liquipedia:")} {d.onlySite.join(", ")}. </>}
                {d.onlyLp.length > 0 && <>{tr("On Liquipedia, not here:")} {d.onlyLp.join(", ")}.</>}
              </span>
              <button type="button" className="btn" onClick={() => follow(d.key)}>{tr("Follow Liquipedia")}</button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}

function NewsEditor({ news, call, onDone, drafts = [] }) {
  const tr = useT();
  const [edit, setEdit] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const send = async (payload) => {
    setErr("");
    try {
      const j = await call("/api/news", payload);
      setEdit(null); setTitle(""); setBody("");
      onDone(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  };
  return (
    <section>
      <h2>{tr("News")}</h2>
      {drafts.length > 0 && (
        <div className="drafts">
          <h3 className="sub">📝 {tr("Drafts ready")}</h3>
          <ul className="ahhist">{drafts.map((d) => <li key={d.event}><b>{d.title}</b><button type="button" className="btn small" onClick={() => { setEdit(null); setTitle(d.title); setBody(d.body); }}>{tr("Use this draft")}</button></li>)}</ul>
          <p className="hint">{tr("Written from a finished event: read it over, change it, then publish.")}</p>
        </div>
      )}
      {news.length > 0 && (
        <ul className="ahhist">
          {news.map((n) => (
            <li key={n.id}>
              <a href={`/news/${n.id}`}><b>{n.title}</b></a>
              <button type="button" className="btn" onClick={() => { setEdit(n.id); setTitle(n.title); setBody(n.body); }}>{tr("Edit")}</button>
              <button type="button" className="btn danger" onClick={() => send({ remove: n.id })}>{tr("Remove")}</button>
            </li>
          ))}
        </ul>
      )}
      <form className="newsform" onSubmit={(e) => { e.preventDefault(); send({ id: edit, title, body }); }}>
        <label className="f">{tr("Title")}<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="f">{tr("Text")}<textarea rows={5} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <div className="row">
          <button className="btn pri" type="submit" disabled={!title.trim() || !body.trim()}>{edit ? tr("Save") : tr("Publish")}</button>
          {edit && <button type="button" className="btn" onClick={() => { setEdit(null); setTitle(""); setBody(""); }}>{tr("Cancel")}</button>}
          {err && <span className="err">{err}</span>}
        </div>
      </form>
    </section>
  );
}

/** Removing a visitor from the predictions, for an unsuitable name. */
function Voters({ voters, call, onDone }) {
  const tr = useT();
  if (!voters.length) return null;
  const remove = async (name) => {
    const j = await call("/api/predictions", { remove: name });
    onDone(tr.server(j.message));
  };
  return (
    <section>
      <h2>{tr("Predictions")} <small>({voters.length})</small></h2>
      <details>
        <summary>{tr("Participants")}</summary>
        <ul className="ahhist">
          {voters.map((v) => <li key={v.name}><b>{v.name}</b><button type="button" className="btn danger" onClick={() => remove(v.name)}>{tr("Remove")}</button></li>)}
        </ul>
      </details>
    </section>
  );
}

/** Freezing the season as an archive, and clearing the results to start the next one. */
function Seasons({ seasons, call, onDone }) {
  const tr = useT();
  const [name, setName] = useState("");
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!sure) return undefined;
    const t = setTimeout(() => setSure(false), 5000);
    return () => clearTimeout(t);
  }, [sure]);
  const send = async (body) => {
    setErr("");
    try {
      const j = await call("/api/seasons", body);
      setName(""); setSure(false);
      onDone(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  };
  return (
    <section>
      <h2>{tr("Seasons")}</h2>
      <p className="note">{tr("Archive a finished season: it stays readable on the site. Then clear the results to start the next one (teams and rosters stay).")}</p>
      {seasons.length > 0 && (
        <ul className="ahhist">
          {seasons.map((s) => (
            <li key={s.slug}><a href={`/archives/${s.slug}/vctemea/eu/playoff/overview`}><b>{s.name}</b></a><button type="button" className="btn danger" onClick={() => send({ remove: s.slug })}>{tr("Remove")}</button></li>
          ))}
        </ul>
      )}
      <form className="ahnew" onSubmit={(e) => { e.preventDefault(); send({ name }); }}>
        <label className="f">{tr("Season name")}<input value={name} maxLength={40} placeholder="VCT 2027" onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn pri" type="submit" disabled={!name.trim()}>{tr("Archive the season")}</button>
        <button type="button" className={"btn" + (sure ? " danger" : "")} onClick={() => (sure ? send({ clear: true }) : setSure(true))}>{sure ? tr("Sure?") : tr("Clear all results")}</button>
        {err && <span className="err">{err}</span>}
      </form>
    </section>
  );
}

/** The change history, the database copy and, for the main account, the other editors' accounts. */
function Manage({ admin, call, onDone }) {
  const tr = useT();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const send = async (body) => {
    setErr("");
    try {
      const j = await call("/api/editors", body);
      setName(""); setPassword("");
      onDone(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    }
  };
  const fmt = (at) => new Intl.DateTimeFormat(localeOf(tr.lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(at));
  const label = (m) => (m.startsWith("Undone: ") ? tr("Undone: {what}", { what: tr.server(m.slice(8)) }) : tr.server(m));
  return (
    <>
      <section>
        <h2>{tr("History")}</h2>
        {admin.history.length === 0 ? <p className="note">{tr("No change yet.")}</p> : (
          <ul className="ahhist">
            {admin.history.map((h, i) => (
              <li key={i}><time>{fmt(h.at)}</time><b>{h.who || tr("Main account")}</b><span>{label(h.message)}</span></li>
            ))}
          </ul>
        )}
      </section>
      <RosterDiffs list={admin.rosterDiffs || []} call={call} onDone={onDone} />
      <SyncStatus list={admin.sync || {}} />
      <FlagImport call={call} onDone={onDone} />
      {!admin.who && <VisitorAccounts count={admin.accounts || 0} roles={admin.roles || []} call={call} onDone={onDone} />}
      <NewsEditor news={admin.news || []} drafts={admin.drafts || []} call={call} onDone={onDone} />
      <Voters voters={admin.voters || []} call={call} onDone={onDone} />
      <Seasons seasons={admin.seasons || []} call={call} onDone={onDone} />
      <section>
        <h2>{tr("Streaming (OBS)")}</h2>
        <p className="note">{tr("In OBS, add a browser source with this page: it shows the live match, or the next one, on a transparent background.")} <a href="/overlay/studio" target="_blank" rel="noopener noreferrer">/overlay/studio</a></p>
      </section>
      <section>
        <h2>{tr("Backups")}</h2>
        <p className="note">{tr("A copy of the database is made every day in data/backups (the last 14 are kept). Keep one somewhere else too.")}</p>
        <a className="btn" href="/api/backup">{tr("Download a copy now")}</a>
      </section>
      {!admin.who && (
        <section>
          <h2>{tr("Editor accounts")}</h2>
          {admin.editors.length > 0 && (
            <ul className="ahhist">
              {admin.editors.map((e) => (
                <li key={e.name}><b>{e.name}</b><span>{fmt(e.created)}</span><button type="button" className="btn danger" onClick={() => send({ remove: e.name })}>{tr("Remove")}</button></li>
              ))}
            </ul>
          )}
          <form className="ahnew" onSubmit={(e) => { e.preventDefault(); send({ name, password }); }}>
            <label className="f">{tr("Name")}<input value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} /></label>
            <label className="f">{tr("Password (at least 4 characters)")}<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn pri" type="submit" disabled={!name || !password}>{tr("Add an account")}</button>
            {err && <span className="err">{err}</span>}
          </form>
        </section>
      )}
    </>
  );
}
