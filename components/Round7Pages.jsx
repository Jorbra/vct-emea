"use client";

import { useEffect, useMemo, useState } from "react";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import SearchBar from "./SearchBar.jsx";
import SiteNav from "./SiteNav.jsx";
import { Flag } from "./TeamCard.jsx";
import { fanToken } from "./Fans.jsx";
import { teamHref } from "../lib/paths.js";
import { AgentIcon } from "./Assets.jsx";

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

// ---- fantasy

const ROLES = ["duelist", "initiator", "controller", "sentinel", "joker"];
const ROLE_NAME = { duelist: "Duelist", initiator: "Initiator", controller: "Controller", sentinel: "Sentinel", joker: "Joker (any role)", flex: "Flex" };

function Fantasy({ pool, budget, season, week }) {
  const tr = useT();
  const bySlug = useMemo(() => new Map(pool.map((p) => [p.slug, p])), [pool]);
  const [team, setTeam] = useState(null);
  const [slots, setSlots] = useState({});
  const [role, setRole] = useState("duelist");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [board, setBoard] = useState("week");
  const load = (body = {}) => fetch("/api/fantasy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: fanToken(), ...body }) })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error"); return j; });
  useEffect(() => {
    load().then((j) => {
      setTeam(j.team);
      if (j.team) setSlots(Object.fromEntries(ROLES.map((k) => [k, j.team.players[k] && j.team.players[k].slug]).filter(([, v]) => v)));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = ROLES.map((k) => slots[k] && bySlug.get(slots[k])).filter(Boolean);
  const spent = chosen.reduce((s, p) => s + p.price, 0);
  const left = budget - spent;
  const save = async () => {
    setErr(""); setMsg("");
    try { const j = await load({ slots }); setTeam(j.team); setMsg(tr("Team saved: its players count from now on.")); } catch (e) { setErr(tr.server(e.message)); }
  };
  const list = pool.filter((p) => (role === "joker" || p.role === role) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.team.toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
  return (
    <div className="wrap teampage">
      <Top title="Fantasy" />
      <p className="note">{tr("Pick 5 players with 100 credits: one per role and a joker, 2 of the same team at most. They earn points in their real matches from the moment you pick them: kill +1, assist +0.5, death −0.5, series won +3, best ACS of the match +5.")}</p>
      {team && <div className="pcardnums weeknums"><div><b>{team.week}</b><span>{tr("Points this week")}</span></div><div><b>{team.season}</b><span>{tr("Season points")}</span></div></div>}
      <div className="fslots">
        {ROLES.map((k) => {
          const p = slots[k] && bySlug.get(slots[k]);
          const cur = team && team.players[k];
          return (
            <button key={k} type="button" className={"fslot" + (role === k ? " on" : "") + (p ? "" : " empty")} onClick={() => setRole(k)} aria-pressed={role === k}>
              <small>{tr(ROLE_NAME[k])}</small>
              <b>{p ? p.name : `+ ${tr("Pick")}`}</b>
              {p && <span>{p.team} · {p.price} cr{cur && cur.slug === p.slug ? ` · ${cur.pts} pts` : ""}</span>}
            </button>
          );
        })}
      </div>
      <p className={"fbudget" + (left < 0 ? " over" : "")}>{tr("Credits left: {n}", { n: left })}</p>
      <p className="row"><button type="button" className="btn pri" disabled={chosen.length < 5 || left < 0} onClick={save}>{tr("Save my team")}</button>{msg && <span className="hint" role="status"> {msg}</span>}{err && <span className="err" role="alert"> {err}</span>}</p>
      <section>
        <h2>{tr(ROLE_NAME[role])}</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Player or team")} aria-label={tr("Search")} />
        <div className="tablewrap"><table>
          <thead><tr><th>{tr("Player")}</th><th>{tr("Team")}</th><th>Rating</th><th>ACS</th><th>{tr("Price")}</th><th /></tr></thead>
          <tbody>{list.map((p) => {
            const taken = Object.values(slots).includes(p.slug);
            return (
              <tr key={p.slug}>
                <td>{p.agent ? <AgentIcon name={p.agent} size={20} /> : null} <a href={`/player/${p.slug}`}>{p.name}</a>{role === "joker" && <small className="hint"> · {tr(ROLE_NAME[p.role])}</small>}</td><td>{p.team}</td><td>{p.r != null ? p.r.toFixed(2) : "–"}</td><td>{p.acs ?? "–"}</td><td><b>{p.price}</b></td>
                <td><button type="button" className="btn small" disabled={taken} onClick={() => setSlots({ ...slots, [role]: p.slug })}>{taken ? "✓" : tr("Pick")}</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
      <section>
        <h2>{tr("Ranking")}</h2>
        <div className="navpills" role="group"><button type="button" data-on={board === "week"} aria-pressed={board === "week"} onClick={() => setBoard("week")}>{tr("This week")}</button><button type="button" data-on={board === "season"} aria-pressed={board === "season"} onClick={() => setBoard("season")}>{tr("Season")}</button></div>
        {(board === "week" ? week : season).length === 0 ? <p className="note">{tr("Nobody yet. Your name in the predictions puts you here.")}</p> : (
          <ol className="quizrank">{(board === "week" ? week : season).map((r, i) => <li key={r.name}><span>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span> {r.name} <b>{board === "week" ? r.week : r.season} pts</b></li>)}</ol>
        )}
      </section>
    </div>
  );
}

export const FantasyPage = (props) => <LangProvider lang={props.lang}><Fantasy {...props} /></LangProvider>;

// ---- countries

function Countries({ list }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={tr("Countries")} />
      <p className="note">{tr("The players of the site's events by country (from vlr.gg's tables).")}</p>
      <div className="clist">
        {list.map((c, i) => (
          <a key={c.cc} className="ccard" href={`/pays/${c.cc}`}>
            <span className="crank">{i + 1}</span><Flag cc={c.cc} /><b>{c.name}</b>
            <small>{tr("{n} players", { n: c.count })} · {tr("{n} teams", { n: c.teams })}{c.rating != null ? ` · ${c.rating.toFixed(2)}` : ""}</small>
            {c.best && <small>⭐ {c.best.name}</small>}
          </a>
        ))}
      </div>
    </div>
  );
}
export const CountriesPage = (props) => <LangProvider lang={props.lang}><Countries {...props} /></LangProvider>;

function Country({ c, rank, of }) {
  const tr = useT();
  return (
    <div className="wrap teampage">
      <Top title={c.name} />
      <nav className="crumbs" aria-label={tr("Breadcrumb")}><a href="/">{tr("Home")}</a> › <a href="/pays">{tr("Countries")}</a> › <span>{c.name}</span></nav>
      <div className="chead"><Flag cc={c.cc} /><h2>{c.name}</h2><span className="note">#{rank} / {of}</span></div>
      <div className="pcardnums weeknums">
        <div><b>{c.players.length}</b><span>{tr("Players")}</span></div>
        <div><b>{c.teams.length}</b><span>{tr("Teams")}</span></div>
        <div><b>{c.rating != null ? c.rating.toFixed(2) : "–"}</b><span>{tr("Average rating")}</span></div>
      </div>
      {c.best && <p>⭐ {tr("Best player")} : <a href={`/player/${c.best.slug}`}><b>{c.best.name}</b></a> ({c.best.team}) · {c.best.r != null ? c.best.r.toFixed(2) : "–"}</p>}
      <div className="tablewrap"><table>
        <thead><tr><th>{tr("Player")}</th><th>{tr("Team")}</th><th>Rating</th><th>ACS</th><th>{tr("Maps")}</th></tr></thead>
        <tbody>{c.players.map((p) => <tr key={p.slug}><td><a href={`/player/${p.slug}`}>{p.name}</a></td><td>{p.team ? <a href={teamHref(p.team)}>{p.team}</a> : "–"}</td><td>{p.r != null ? p.r.toFixed(2) : "–"}</td><td>{p.acs ?? "–"}</td><td>{p.maps}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
export const CountryPage = (props) => <LangProvider lang={props.lang}><Country {...props} /></LangProvider>;

// ---- achievements, on the visitor's public card

function Achievements({ list }) {
  const tr = useT();
  const got = list.filter((a) => a.got).length;
  return (
    <section className="achv">
      <h2>{tr("Achievements")} <small className="note">{got}/{list.length}</small></h2>
      <ul>{list.map((a) => <li key={a.key} className={a.got ? "got" : ""}><b>{a.got ? "🏅" : "🔒"} {tr(a.name)}</b><small>{tr(a.text)}</small></li>)}</ul>
    </section>
  );
}
export const AchievementsBlock = (props) => <LangProvider lang={props.lang}><Achievements {...props} /></LangProvider>;
