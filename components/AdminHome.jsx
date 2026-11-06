"use client";

import { localeOf } from "../lib/i18n.js";
import { useEffect, useMemo, useState } from "react";
import { useT } from "./lang.jsx";
import { LiveBadge } from "./matchTime.jsx";
import { EVENT_NAMES } from "../lib/paths.js";
import { editorAgenda, eventData, matchesOf } from "../lib/matchlist.js";
import { formatMatchTime, TIME_EVENTS } from "../lib/schedule.js";
import { eventStatus, formatDates } from "../lib/status.js";

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

  const row = (m, badge) => (
    <button type="button" key={m.event + m.id} className="ahrow" onClick={() => onOpen(m.event, true)}>
      <span className="ahwhen">{badge || (m.at ? formatMatchTime(m.at, tr.lang, true) : "–")}</span>
      <span className="ahteams">{(m.a && m.a.name) || tr("TBD")} vs {(m.b && m.b.name) || tr("TBD")}</span>
      <span className="ahwhere">{tr(EVENT_NAMES[m.event])} · {m.round.map(([k, v]) => tr(k, v)).join(" · ")}</span>
    </button>
  );
  const todo = agenda.live.length + agenda.late.length;
  return (
    <div className="adhome">
      <p className="guidelink"><a className="btn" href="/admin/nouveautes">{tr("What's new and how it works")}</a></p>
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

function NewsEditor({ news, call, onDone }) {
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
      <NewsEditor news={admin.news || []} call={call} onDone={onDone} />
      <Voters voters={admin.voters || []} call={call} onDone={onDone} />
      <Seasons seasons={admin.seasons || []} call={call} onDone={onDone} />
      <section>
        <h2>{tr("Streaming (OBS)")}</h2>
        <p className="note">{tr("In OBS, add a browser source with this page: it shows the live match, or the next one, on a transparent background.")} <a href="/overlay" target="_blank" rel="noopener noreferrer">/overlay</a></p>
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
