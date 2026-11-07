"use client";

import { useEffect, useState } from "react";
import { useT } from "./lang.jsx";
import { EVENT_NAMES } from "../lib/paths.js";

const TOKEN_KEY = "vct-predictions";
/** The visitor's secret token, the same as the predictions', made once in the browser. */
export function fanToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return "";
  }
}

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) throw new Error(j.error || "Network error");
  return j;
}

/** "Player of the match": the visitors' vote, once the match is over. */
export function MotmVote({ event, id, candidates }) {
  const tr = useT();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let on = true;
    post("/api/motm", { token: fanToken(), event, id }).then((j) => { if (on) setRes(j); }).catch(() => { /* offline */ });
    return () => { on = false; };
  }, [event, id]);
  if (!candidates.length) return null;
  const vote = async (player) => {
    setErr("");
    try { setRes(await post("/api/motm", { token: fanToken(), event, id, player })); } catch (e) { setErr(tr.server(e.message)); }
  };
  const count = (p) => (res ? (res.counts.find((c) => c.player === p) || { n: 0 }).n : 0);
  const shown = res && res.mine;
  return (
    <section className="motm">
      <h3>{tr("Player of the match")} <small>{res ? tr("{n} votes", { n: res.total }) : ""}</small></h3>
      {!shown && <p className="hint">{tr("Vote for the player you liked most. You can change your vote during the week after the match.")}</p>}
      <div className="motmlist">
        {[...candidates].sort((a, b) => (shown ? count(b) - count(a) : 0)).map((p) => {
          const pct = res && res.total ? Math.round((count(p) / res.total) * 100) : 0;
          return (
            <button type="button" key={p} className={"motmbtn" + (res && res.mine === p ? " on" : "")} aria-pressed={!!res && res.mine === p} onClick={() => vote(p)}>
              {shown && <i style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span>{p}</span>{shown && <b>{pct}%</b>}
            </button>
          );
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}

const BADGE = {
  streak: (b, tr) => [`🔥 ${b.n}`, tr("{n} right picks in a row", { n: b.n })],
  champion: (b, tr) => ["👑", tr("Found the winner of {event}", { event: tr(EVENT_NAMES[b.event] || b.event) })],
  perfect: (b, tr) => ["🎯", tr("Found every qualified team of {event}", { event: tr(EVENT_NAMES[b.event] || b.event) })],
  many: (b, tr) => [`📈 ${b.n}`, tr("{n} predictions made", { n: b.n })],
};

/** The season's ranking: predictions and "Who qualifies?" together, with the badges. */
export function SeasonTable({ ranking, me }) {
  const tr = useT();
  if (!ranking.length) return <p className="note">{tr("The ranking starts with the first results.")}</p>;
  return (
    <div className="tablewrap wide">
      <table className="seasontable">
        <thead><tr><th>#</th><th>{tr("Name")}</th><th>{tr("Points")}</th><th>{tr("Right picks")}</th></tr></thead>
        <tbody>{ranking.map((r, i) => (
          <tr key={r.name} className={me && r.name === me ? "me" : ""}>
            <td>{i + 1}</td>
            <td>{r.name}{r.badges.length > 0 && <span className="badges">{r.badges.slice(0, 4).map((b, k) => { const [icon, label] = BADGE[b.kind](b, tr); return <span key={k} className="badge" title={label} aria-label={label}>{icon}</span>; })}</span>}</td>
            <td><b>{r.points}</b>{r.pickem ? <small> ({tr("incl. {n} from Who qualifies?", { n: r.pickem })})</small> : null}</td>
            <td>{r.good} / {r.total}{r.total ? ` · ${Math.round((r.good / r.total) * 100)}%` : ""}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Friends' groups: create one, share its link, join from it, and its own ranking. */
export function Groups({ token, group, named }) {
  const tr = useT();
  const [mine, setMine] = useState([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (!token) return;
    post("/api/groups", { token, action: "mine" }).then((j) => setMine(j.groups)).catch(() => { /* offline */ });
  }, [token]);
  const act = async (body, after) => {
    setMsg({ ok: true, text: "" });
    try {
      const j = await post("/api/groups", { token, ...body });
      setMine(j.groups);
      setMsg({ ok: true, text: tr.server(j.message) });
      if (after) after(j);
    } catch (e) { setMsg({ ok: false, text: tr.server(e.message) }); }
  };
  const link = (code) => `${typeof window !== "undefined" ? window.location.origin : ""}/predictions?g=${code}`;
  const copy = async (code) => {
    try { await navigator.clipboard.writeText(link(code)); setCopied(code); } catch { window.prompt(tr("Link"), link(code)); }
  };
  const inGroup = group && mine.some((g) => g.code === group.code);
  return (
    <section className="groups">
      <h2>{tr("Friends' groups")}</h2>
      {group && (
        <div className="groupbox">
          <h3>{group.name} <small>{tr("{n} members", { n: group.count })}</small></h3>
          {!inGroup && <button type="button" className="btn pri" disabled={!token} onClick={() => act({ action: "join", code: group.code }, () => window.location.reload())}>{tr("Join this group")}</button>}
          {!named && !inGroup && <p className="hint">{tr("Make a first prediction to get your name, then join the group.")}</p>}
          {inGroup && <div className="row"><button type="button" className="btn" onClick={() => copy(group.code)}>{copied === group.code ? tr("Link copied") : tr("Copy the invite link")}</button><button type="button" className="btn" onClick={() => act({ action: "leave", code: group.code }, () => window.location.assign("/predictions"))}>{tr("Leave the group")}</button></div>}
        </div>
      )}
      {mine.length > 0 && (
        <ul className="grouplist">{mine.map((g) => (
          <li key={g.code}><a href={`/predictions?g=${g.code}`}><b>{g.name}</b></a> <small>{tr("{n} members", { n: g.count })}</small> <button type="button" className="btn small" onClick={() => copy(g.code)}>{copied === g.code ? tr("Link copied") : tr("Copy the invite link")}</button></li>
        ))}</ul>
      )}
      <form className="acctform" onSubmit={(e) => { e.preventDefault(); act({ action: "create", name }, (j) => { setName(""); copy(j.code); }); }}>
        <label className="f">{tr("New group")}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={tr("e.g. The Friday crew")} /></label>
        <button className="btn" type="submit" disabled={!token || name.trim().length < 2}>{tr("Create the group")}</button>
      </form>
      <p className="hint">{tr("A group has its own ranking. Share its link: whoever opens it can join.")}</p>
      {msg.text && <p className={msg.ok ? "okmsg" : "err"} role="status">{msg.text}</p>}
    </section>
  );
}

/** "Install the app": the browser's own prompt where there is one, the way to do it on iPhone otherwise. Hidden once installed. */
export function InstallButton() {
  const tr = useT();
  const [prompt, setPrompt] = useState(null);
  const [kind, setKind] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return undefined;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) setKind("ios");
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setKind("prompt"); };
    const onDone = () => setKind("");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onDone);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onDone); };
  }, []);
  if (!kind) return null;
  const go = async () => {
    if (kind === "ios") { setHelp(!help); return; }
    prompt.prompt();
    const r = await prompt.userChoice.catch(() => null);
    if (r && r.outcome === "accepted") setKind("");
  };
  return (
    <span className="installapp">
      <button type="button" className="btn" onClick={go}>📲 {tr("Install the app")}</button>
      {help && <span className="hint" role="status"> {tr("In Safari: Share button, then \"Add to Home Screen\".")}</span>}
    </span>
  );
}
