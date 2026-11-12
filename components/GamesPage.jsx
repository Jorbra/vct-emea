"use client";

import { useEffect, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { fanToken } from "./Fans.jsx";
import { confetti } from "./visual.jsx";
import { shareText } from "../lib/gameshare.js";
import ASSETS from "../lib/valorant-assets.json";

async function post(body) {
  const r = await fetch("/api/jeux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Network error.");
  return j;
}

/** Load today's game, then play moves; refreshes the hub's line when a game ends. */
function useGame(game, onEnd) {
  const tr = useT();
  const [g, setG] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { post({ game }).then(setG).catch((e) => setError(tr.server(e.message))); }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const play = async (move) => {
    setBusy(true);
    setError("");
    try {
      const j = await post({ game, move });
      setG(j);
      if (j.done) { onEnd(); if (j.won) confetti(); }
    } catch (e) { setError(tr.server(e.message)); }
    setBusy(false);
  };
  return { g, error, busy, play };
}

function Share({ game, g, day }) {
  const tr = useT();
  const [msg, setMsg] = useState("");
  const share = async () => {
    const text = shareText(game, g, day, window.location.origin);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setMsg(tr("Copied: paste it where you want.")); }
    } catch { /* closed */ }
  };
  return <p className="row"><button type="button" className="btn pri" onClick={share}>📋 {tr("Share my result")}</button>{msg && <span className="hint" role="status"> {msg}</span>}</p>;
}

function Guess({ list, id, onPick, busy, placeholder }) {
  const tr = useT();
  const [v, setV] = useState("");
  const send = (e) => { e.preventDefault(); if (v.trim()) { onPick(v.trim()); setV(""); } };
  return (
    <form className="gguess" onSubmit={send}>
      <input list={id} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" />
      <datalist id={id}>{list.map((x) => <option key={x} value={x} />)}</datalist>
      <button type="submit" className="btn pri" disabled={busy || !v.trim()}>{tr("Guess")}</button>
    </form>
  );
}

// ---- mystery player

const ARROW = { up: "▲", down: "▼", nearup: "▲", neardown: "▼" };
function Clue({ kind, children }) {
  const cls = kind === "ok" ? "ok" : /near/.test(kind) ? "near" : "no";
  return <td className={"gc " + cls}>{children}{ARROW[kind] ? <i>{ARROW[kind]}</i> : null}</td>;
}

function MysteryPlayer({ players, day, onEnd }) {
  const tr = useT();
  const { g, error, busy, play } = useGame("joueur", onEnd);
  if (!g) return error ? <p className="note">{error}</p> : <p className="note">…</p>;
  return (
    <>
      <p className="note">{tr("Find today's player in 6 guesses. Green: same; yellow: close; the arrow: the answer is higher or lower.")}</p>
      {!g.done && <Guess id="gplayers" list={players} onPick={play} busy={busy} placeholder={tr("A player's name")} />}
      {error && <p className="err" role="alert">{error}</p>}
      {g.guesses.length > 0 && (
        <div className="tablewrap"><table className="gtable">
          <thead><tr><th>{tr("Player")}</th><th>{tr("Team")}</th><th>{tr("Country")}</th><th>{tr("Main agent")}</th><th>Rating</th><th>ACS</th><th>{tr("Maps")}</th></tr></thead>
          <tbody>{g.guesses.map((x) => (
            <tr key={x.name}>
              <th scope="row">{x.name}</th>
              <Clue kind={x.clues.team}>{x.team}</Clue>
              <Clue kind={x.clues.cc}>{x.cc ? x.cc.toUpperCase() : "–"}</Clue>
              <Clue kind={x.clues.agent}>{x.agent || "–"}</Clue>
              <Clue kind={x.clues.r}>{Number(x.r).toFixed(2)}</Clue>
              <Clue kind={x.clues.acs}>{x.acs}</Clue>
              <Clue kind={x.clues.maps}>{x.maps}</Clue>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {!g.done && <p className="hint">{tr("{n} guesses left", { n: 6 - g.guesses.length })}</p>}
      {g.done && (
        <>
          <p className={"gend " + (g.won ? "ok" : "ko")}>{g.won ? tr("Found in {n}!", { n: g.guesses.length }) : tr("Missed. It was:")} <a href={`/player/${g.reveal.slug}`}>{g.reveal.name}</a> ({g.reveal.team})</p>
          <Share game="joueur" g={g} day={day} />
        </>
      )}
    </>
  );
}

// ---- higher or lower

function HigherLower({ day, onEnd }) {
  const tr = useT();
  const { g, error, busy, play } = useGame("duel", onEnd);
  if (!g) return error ? <p className="note">{error}</p> : <p className="note">…</p>;
  const cur = g.done ? null : g.rounds[g.answers.length];
  const show = (r, side) => (r[side].value == null ? "?" : Number(r[side].value).toFixed(r.digits));
  return (
    <>
      <p className="note">{tr("Who has the higher number this season? One mistake and it's over: go as far as you can, 10 at most.")}</p>
      <p className="gstreak"><b>{g.answers.filter((x) => x.ok).length}</b> / {g.rounds.length}</p>
      {cur && (
        <div className="gduel">
          <p>{tr("Who has the higher {stat}?", { stat: cur.label })}</p>
          <div className="gduelbtns">
            {["a", "b"].map((s) => <button key={s} type="button" className="btn gside" disabled={busy} onClick={() => play(s)}><b>{cur[s].name}</b><small>{cur[s].team}</small></button>)}
          </div>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      {g.answers.length > 0 && (
        <ol className="gdone">{g.answers.map((x, i) => {
          const r = g.rounds[i];
          return <li key={i} className={x.ok ? "ok" : "ko"}>{x.ok ? "✅" : "❌"} {r.label} · <b className={r.a.value > r.b.value ? "w" : ""}>{r.a.name} {show(r, "a")}</b> vs <b className={r.b.value > r.a.value ? "w" : ""}>{r.b.name} {show(r, "b")}</b></li>;
        })}</ol>
      )}
      {g.done && (
        <>
          <p className={"gend " + (g.won ? "ok" : "ko")}>{g.won ? tr("Perfect: 10 out of 10!") : tr("Streak of {n}.", { n: g.answers.filter((x) => x.ok).length })}</p>
          <Share game="duel" g={g} day={day} />
        </>
      )}
    </>
  );
}

// ---- mystery logo

/** How light a logo is (0 dark … 1 light), from its visible pixels; null when it cannot be read. */
function logoLightness(img) {
  try {
    const c = document.createElement("canvas");
    const w = (c.width = 48);
    const h = (c.height = 48);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) continue; // transparent: not part of the logo
      sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      n += 1;
    }
    return n ? sum / n : null;
  } catch {
    return null;
  }
}

function MysteryLogo({ teams, day, onEnd }) {
  const tr = useT();
  const { g, error, busy, play } = useGame("logo", onEnd);
  // a light logo on a dark background, a dark one on a light background: never white on white
  const [bg, setBg] = useState("mid");
  const readBg = (el) => { const l = logoLightness(el); setBg(l == null ? "mid" : l > 0.62 ? "dark" : l < 0.38 ? "light" : "mid"); };
  // an image already in the cache can be loaded before the page listens: read it as soon as it is there
  const imgRef = (el) => { if (el && el.complete && el.naturalWidth && !el.dataset.read) { el.dataset.read = "1"; readBg(el); } };
  if (!g) return error ? <p className="note">{error}</p> : <p className="note">…</p>;
  return (
    <>
      <p className="note">{tr("Which team is this? 5 guesses, the logo gets clearer after each one.")}</p>
      <div className={"glogo " + bg}><img src={`/api/jeux/logo?d=${day}`} alt={tr("Mystery logo")} style={{ filter: `blur(${g.blur}px) ${g.done ? "" : "grayscale(.6)"}` }} draggable={false} ref={imgRef} onLoad={(e) => { e.currentTarget.dataset.read = "1"; readBg(e.currentTarget); }} /></div>
      {!g.done && <Guess id="gteams" list={teams} onPick={play} busy={busy} placeholder={tr("A team's name")} />}
      {error && <p className="err" role="alert">{error}</p>}
      {g.guesses.length > 0 && <ul className="gtries">{g.guesses.map((x) => <li key={x.name} className={x.ok ? "ok" : "ko"}>{x.ok ? "✅" : "❌"} {x.name}</li>)}</ul>}
      {!g.done && <p className="hint">{tr("{n} guesses left", { n: 5 - g.guesses.length })}</p>}
      {g.done && (
        <>
          <p className={"gend " + (g.won ? "ok" : "ko")}>{g.won ? tr("Found in {n}!", { n: g.guesses.length }) : tr("Missed. It was:")} <a href={`/team/${g.reveal.slug}`}>{g.reveal.name}</a></p>
          <Share game="logo" g={g} day={day} />
        </>
      )}
    </>
  );
}

// ---- mystery agent

function MysteryAgent({ agents, day, onEnd }) {
  const tr = useT();
  const { g, error, busy, play } = useGame("agent", onEnd);
  if (!g) return error ? <p className="note">{error}</p> : <p className="note">…</p>;
  return (
    <>
      <p className="note">{tr("Which agent is this? 5 guesses, the picture widens after each one.")}</p>
      <div className={"gagent" + (g.done ? " done" : "")}><img src={`/api/jeux/agent?d=${day}`} alt={tr("Mystery agent")} style={{ transform: `scale(${g.zoom})`, transformOrigin: g.at }} draggable={false} /></div>
      {g.role && !g.done && <p className="hint">💡 {tr("Role")} : <b>{tr(g.role)}</b></p>}
      {!g.done && <Guess id="gagents" list={agents} onPick={play} busy={busy} placeholder={tr("An agent's name")} />}
      {error && <p className="err" role="alert">{error}</p>}
      {g.guesses.length > 0 && <ul className="gtries">{g.guesses.map((x) => <li key={x.name} className={x.ok ? "ok" : "ko"}>{x.ok ? "✅" : "❌"} {x.name}</li>)}</ul>}
      {!g.done && <p className="hint">{tr("{n} guesses left", { n: 5 - g.guesses.length })}</p>}
      {g.done && (
        <>
          <p className={"gend " + (g.won ? "ok" : "ko")}>{g.won ? tr("Found in {n}!", { n: g.guesses.length }) : tr("Missed. It was:")} <a href={`/agent/${g.reveal.key}`}>{g.reveal.name}</a></p>
          <Share game="agent" g={g} day={day} />
        </>
      )}
    </>
  );
}

// ---- the page

// a picture behind each game's card
const GAME_ART = { joueur: (ASSETS.agents.cypher || {}).portrait, duel: (ASSETS.maps.Ascent || {}).splash, logo: (ASSETS.maps.Lotus || {}).splash, agent: (ASSETS.agents.reyna || {}).portrait };

const NAMES = { joueur: "Mystery player", duel: "Higher or lower", logo: "Mystery logo", agent: "Mystery agent" };
const ICONS = { joueur: "🕵️", duel: "⚖️", logo: "🛡️", agent: "🦸" };

function Games({ day, available, players, teams, agents = [], rankings, counts }) {
  const tr = useT();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(available[0] || "");
  const refresh = () => post({ mine: true }).then(setMe).catch(() => {});
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const status = (k) => { const t = me && me.today[k]; return !t ? tr("To play") : !t.done ? tr("Under way") : t.won ? `✅ ${tr("Won")}` : `❌ ${tr("Lost")}`; };
  return (
    <div className="wrap teampage">
      <div className="topbar">
        <h1 className="brandh"><a className="homelink" href="/" title={tr("Home")}><EmeaMark /></a><span>{tr("Games of the day")}</span></h1>
        <SearchBar />
        <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
      </div>
      <SiteNav />
      <p className="note">{tr("Four new games every day at midnight, the same for everyone. Play each one once, share your result, and keep your streak going.")}</p>
      <div className="ghub">
        <div className="gstreakbox"><b>🔥 {me ? me.streak : "–"}</b><span>{tr("days in a row")}</span></div>
        {available.map((k) => (
          <button key={k} type="button" className={"gcard art " + k + (open === k ? " on" : "")} onClick={() => setOpen(k)} aria-pressed={open === k} style={GAME_ART[k] ? { "--art": `url(${GAME_ART[k]})` } : undefined}>
            <span className="gicon" aria-hidden="true">{ICONS[k]}</span>
            <b>{tr(NAMES[k])}</b>
            <small>{status(k)} · {tr("{n} players", { n: counts[k] || 0 })}</small>
          </button>
        ))}
        <a className="gcard" href="/quiz"><span className="gicon" aria-hidden="true">❓</span><b>{tr("Quiz of the week")}</b><small>{tr("5 questions, every Monday")}</small></a>
      </div>
      {available.length === 0 && <p className="note">{tr("No game today: not enough data yet.")}</p>}
      {open && (
        <section className="gpanel">
          <h2>{ICONS[open]} {tr(NAMES[open])}</h2>
          {open === "joueur" && <MysteryPlayer players={players} day={day} onEnd={refresh} />}
          {open === "duel" && <HigherLower day={day} onEnd={refresh} />}
          {open === "logo" && <MysteryLogo teams={teams} day={day} onEnd={refresh} />}
          {open === "agent" && <MysteryAgent agents={agents} day={day} onEnd={refresh} />}
          <h3 className="sub">{tr("Today's best")}</h3>
          {(rankings[open] || []).length === 0 ? <p className="hint">{tr("Nobody yet. Your name in the predictions puts you here.")}</p> : (
            <ol className="quizrank">{rankings[open].map((r, i) => <li key={r.name}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span> {r.name} <b>{open === "duel" ? `${r.score}/10` : `${r.score} pts`}</b></li>)}</ol>
          )}
        </section>
      )}
    </div>
  );
}

export default function GamesPage(props) {
  return <LangProvider lang={props.lang}><Games {...props} /></LangProvider>;
}
