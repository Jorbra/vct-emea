"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LangProvider, LangSwitch, useT } from "./lang.jsx";
import { ThemeSwitch } from "./theme.jsx";
import { EmeaMark } from "./Brand.jsx";
import { Crest } from "./Crest.jsx";
import KickoffBoard from "./KickoffBoard.jsx";
import { useAutoRefresh } from "./autoRefresh.js";
import { BO_CHOICES, THIRD, buildBracket, roundsFor } from "../lib/bracket.js";
import { buildKickoff, kickPlacedElsewhere } from "../lib/kickoff.js";
import { buildRegional, isOpening, placedElsewhere } from "../lib/regional.js";
import { adminHref, adminNavForEvent, eventForAdmin, parseAdminPath, siteHrefForAdmin } from "../lib/paths.js";
import AdminHome from "./AdminHome.jsx";
import { INFO_DEFAULTS, INFO_TIERS, TYPE_LABEL } from "../lib/einfo.js";
import { formatDates } from "../lib/status.js";
import { BulkSchedule, ExtraEdit, MatchTimes, RoundTimes, TimeEdit, useMatchTimes } from "./matchTime.jsx";
import { eventData, matchesOf } from "../lib/matchlist.js";
import VALORANT_PLAYERS from "../lib/valorant-players.json"; // refreshed with: npm run players
import VALORANT_TEAMS from "../lib/valorant-teams.json"; // refreshed with: npm run teams
import { COUNTRIES } from "../lib/countries.js"; // country menus (flagcdn codes); any other code already stored is added on the fly
import { bracketDraw, calc, needWins, parseRoster, parseStaff, placedInRound, rosterEntry, planBracket, planSwiss, records, result, rankTeams, standing, swissDraw } from "../lib/tournament.js";


const REGIONS = [["eu", "EU"], ["mena", "MENA"], ["tr", "Türkiye"], ["kickoff", "Kickoff"]];
const TOP = [["q1", "Qualifier 1"], ["q2", "Qualifier 2"], ["playoffs", "Playoffs"]]; // EU stages, translated where shown
const SUBS = [["teams", "Teams"], ["matches", "Matches"], ["tournament", "Tournament"]];
const MAX_PLAYERS = 8; // five starters and up to three subs

async function call(path, body, method = "POST") {
  const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || res.statusText);
  return j;
}

/* ---------- known names: suggested while a player, staff or team name is typed ---------- */

const KnownNames = createContext({ players: new Map(), staff: new Map(), teams: new Map() });
const MAX_SUGGESTIONS = 10;

/**
 * Players, staff and teams saved on the site (Playoffs, Qualifiers, Kickoff, GC), then the ones listed on Liquipedia, by lowercased name.
 * A player's country, and a team's tag and logo, are taken from whichever has one. A team's `img` is what the suggestion shows,
 * `lp` its Liquipedia logo (saved as public/logos/<TAG>.png when the team is picked).
 */
function knownNames(state) {
  const known = { players: new Map(), staff: new Map(), teams: new Map() };
  if (!state) return known;
  const add = (m, name, cc) => {
    const k = name.toLowerCase();
    const old = m.get(k);
    if (!old) m.set(k, { name, cc });
    else if (!old.cc && cc) m.set(k, { name: old.name, cc });
  };
  const addTeam = (name, tag, img, lp) => {
    const k = name.toLowerCase();
    const old = known.teams.get(k);
    if (!old) known.teams.set(k, { name, tag, img, lp });
    else known.teams.set(k, { ...old, tag: old.tag || tag, img: old.img || img, lp: old.lp || lp });
  };
  const teams = [
    ...state.teams,
    ...Object.values(state.qualifiers || {}).flatMap((q) => q.slots || []),
    ...((state.kickoff && state.kickoff.teams) || []),
    ...(state.gc || []),
    ...Object.values(state.regional || {}).flatMap((r) => r.teams),
  ];
  for (const t of teams) {
    if (!t) continue;
    for (const p of parseRoster(t.roster)) add(known.players, p.name, p.cc);
    for (const p of parseStaff(t.staff)) add(known.staff, p.name, p.cc);
    if (t.name) addTeam(t.name, t.tag || "", t.logo || "", "");
  }
  for (const k of ["players", "staff"]) for (const [name, cc] of VALORANT_PLAYERS[k]) add(known[k], name, cc);
  for (const [name, tag, f] of VALORANT_TEAMS) addTeam(name, tag, f ? `/api/lp-logo?${new URLSearchParams({ f })}` : "", f);
  return known;
}

/** The known names (kind "players", "staff" or "teams") that fit what is typed: names starting with it first, then names containing it. */
function suggest(known, q) {
  const low = q.trim().toLowerCase();
  if (!low) return [];
  const starts = [];
  const has = [];
  for (const [k, p] of known) {
    if (p.name === q.trim()) continue; // already typed in full, with the right capitals
    if (k.startsWith(low)) starts.push(p);
    else if (k.includes(low)) has.push(p);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return [...starts.sort(byName), ...has.sort(byName)].slice(0, MAX_SUGGESTIONS);
}

/** The names of a team's players, without its substitutes. */
const starters = (team) => (team ? parseRoster(team.roster).filter((p) => !p.sub).map((p) => p.name) : []);

const NOTE_FOR = 4000;

/** The answer to an action. "Saved" goes away by itself after a few seconds; an error stays until the next action. */
function SaveNote({ note, inline = false }) {
  const [gone, setGone] = useState(null);
  useEffect(() => {
    if (!note.text || !note.ok) return undefined;
    const t = setTimeout(() => setGone(note), NOTE_FOR);
    return () => clearTimeout(t);
  }, [note]);
  if (!note.text || gone === note) return null;
  const Tag = inline ? "span" : "p";
  return <Tag className={note.ok ? "okmsg" : "err"} role="status">{note.text}</Tag>;
}

/** A name field with a suggestion list under it (flags, or team logos and tags), filled from the known players, staff or teams. onPick(p) replaces onChange(p.name) when given. */
function NameInput({ kind, value, onChange, onPick, ...rest }) {
  const known = useContext(KnownNames)[kind];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = open ? suggest(known, value) : [];
  const pick = (p) => { if (onPick) onPick(p); else onChange(p.name); setOpen(false); };
  // A known name typed in full with other capitals ("derke") takes its exact spelling ("Derke") when the field is left.
  const leave = () => {
    setOpen(false);
    const k = known.get(String(value || "").trim().toLowerCase());
    if (k && k.name !== value) pick(k);
  };
  const onKeyDown = (e) => {
    if (!list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + list.length) % list.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(list[Math.min(active, list.length - 1)]); }
    else if (e.key === "Escape") setOpen(false);
  };
  return (
    <div className="nameac">
      <input {...rest} autoComplete="off" role="combobox" aria-expanded={list.length > 0} aria-autocomplete="list" value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={leave} onKeyDown={onKeyDown} />
      {list.length > 0 && (
        <ul className="nameac-list" role="listbox">
          {list.map((p, i) => (
            <li key={p.name} role="option" aria-selected={i === active} className={i === active ? "on" : ""}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setActive(i)}>
              {kind === "teams" ? (
                <>
                  <span className="sglogo">{p.img && <img src={p.img} alt="" loading="lazy" />}</span>
                  {p.name}{p.tag && <small className="sgtag">{p.tag}</small>}
                </>
              ) : (
                <><Flag cc={p.cc} /> {p.name}</>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * setName(i, value) for a form's "players" or "staff". The flag follows the name: a known name brings its own country
 * (replacing the one of the player who was there before), a name that is no longer that player's drops the country it had brought,
 * and clearing the name clears the country. A country picked by hand for an unknown name is kept.
 */
function useKnownName(setF, key) {
  const known = useContext(KnownNames)[key];
  const ccOf = (name) => { const k = known.get(String(name || "").trim().toLowerCase()); return k ? k.cc : ""; };
  return (i, v) => setF((x) => ({
    ...x,
    [key]: x[key].map((p, j) => {
      if (j !== i) return p;
      if (!v.trim()) return { ...p, name: v, cc: "" };
      const cc = ccOf(v);
      if (cc) return { ...p, name: v, cc };
      return { ...p, name: v, cc: p.cc && p.cc === ccOf(p.name) ? "" : p.cc };
    }),
  }));
}

/**
 * pickTeam(p) for a form with name and tag: picking a known team fills both, and a Liquipedia team's logo is saved
 * for its tag (unless that tag already has one); onLogo() runs once it is there, to refresh the preview.
 */
function useTeamPick(setF, onLogo) {
  return (p) => {
    const tag = (p.tag || "").toUpperCase().slice(0, 7);
    setF((x) => ({ ...x, name: p.name, tag: tag || x.tag }));
    if (p.lp && tag) call("/api/lp-logo", { tag, f: p.lp }).then(() => onLogo && onLogo(), () => {});
  };
}

/**
 * The team menu of a match side chosen by hand. A team already placed in another match (`used`) or on the other side
 * of this one is shown but cannot be picked again.
 */
function TeamPick({ m, k, teams, used, onPick }) {
  const tr = useT();
  const other = m[k === "a" ? "b" : "a"];
  return (
    <select aria-label={k === "a" ? tr("Team A") : tr("Team B")} value={m[k] || ""} onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}>
      <option value="">TBD</option>
      {teams.map((t) => {
        const taken = t.slot !== m[k] && (used.has(t.slot) || t.slot === other);
        const label = t.name || `${t.source || "TBD"} ${t.pos || ""}`.trim();
        return <option key={t.slot} value={t.slot} disabled={taken}>{taken ? `${label} ${tr("(already placed)")}` : label}</option>;
      })}
    </select>
  );
}


/** The team menu of a Swiss or bracket match side: only the teams of its pool (same record, or the 8 qualified), each once per round. */
function DrawPick({ m, k, pool, used, name, onPick }) {
  const tr = useT();
  const other = m[k === "a" ? "b" : "a"];
  return (
    <select aria-label={k === "a" ? tr("Team A") : tr("Team B")} value={m[k] || ""} onChange={(e) => onPick(e.target.value)}>
      <option value="">TBD</option>
      {pool.map((id) => {
        const taken = id !== m[k] && (used.has(id) || id === other);
        return <option key={id} value={id} disabled={taken}>{taken ? `${name(id)} ${tr("(already placed)")}` : name(id)}</option>;
      })}
    </select>
  );
}

/** "Sub" tick box of a player row: a substitute is listed apart from the starting five on the site. */
function SubBox({ p, n, onChange }) {
  const tr = useT();
  return (
    <label className="subbox" title={tr("Substitute")}>
      <input type="checkbox" checked={!!p.sub} onChange={(e) => onChange(e.target.checked)} aria-label={tr("Player {n} is a substitute", { n })} />
      {tr("Sub")}
    </label>
  );
}

function Flag({ cc }) {
  if (!cc) return <span className="aflag none" />;
  return <img className="aflag" src={`https://flagcdn.com/w40/${cc}.png`} alt={cc.toUpperCase()} width="24" height="18" />;
}

function Login() {
  const tr = useT();
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [who, setWho] = useState("");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await call("/api/login", { name: who, password: pw });
      router.refresh();
    } catch (x) {
      setErr(tr.server(x.message) || tr("Login failed."));
    }
  }
  return (
    <div className="adm wrap">
      <div className="topbar"><h1 className="brandh"><EmeaMark /><span>{tr("Editor")}</span></h1><div className="prefs"><ThemeSwitch /><LangSwitch /></div></div>
      <form className="loginform" onSubmit={submit}>
        <label className="f" htmlFor="who">
          {tr("Name (empty for the main account)")}
          <input id="who" autoComplete="username" value={who} onChange={(e) => setWho(e.target.value)} />
        </label>
        <label className="f" htmlFor="pw">
          {tr("Editor password")}
          <input id="pw" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <button className="btn pri" type="submit">{tr("Sign in")}</button>
        <span className="err">{err}</span>
      </form>
      <p><a href="/">{tr("← Back to the site")}</a></p>
    </div>
  );
}

/** One team: name, tag, entry, logo and up to seven players with their country. */
/** The logo file that matches the short tag / name while they are typed (public/logos/<TAG>.png), so the preview updates by itself. */
function useAutoLogo(name, tag, manual, initial, again = 0) {
  const [auto, setAuto] = useState(initial || "");
  useEffect(() => {
    if (manual) return undefined;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/logo-find?${new URLSearchParams({ name, tag })}`, { signal: ctl.signal, credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setAuto(j.logo ? j.logo + (again ? `?v=${again}` : "") : ""))
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [name, tag, manual, again]); // again: bumped when a logo was just added for this tag
  return auto;
}

function TeamForm({ team, onSave }) {
  const tr = useT();
  const [f, setF] = useState(() => {
    const players = parseRoster(team.roster).map((p) => ({ ...p }));
    while (players.length < 5) players.push({ name: "", cc: "" });
    const staff = parseStaff(team.staff).map((p) => ({ ...p }));
    if (!staff.some((p) => p.role === "coach")) staff.unshift({ name: "", cc: "", role: "coach" });
    if (!staff.some((p) => p.role === "assistant")) staff.splice(1, 0, { name: "", cc: "", role: "assistant" });
    return { name: team.name, tag: team.tag, status: team.status, players, staff };
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ ok: true, text: "" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPlayer = (i, k, v) => setF((x) => ({ ...x, players: x.players.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const setName = useKnownName(setF, "players");
  const setStaffName = useKnownName(setF, "staff");
  const setStaff = (i, k, v) => setF((x) => ({ ...x, staff: x.staff.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const clean = (s) => s.replace(/[,|]/g, " ").replace(/\s+/g, " ").trim();

  async function save(reset) {
    setBusy(true);
    setNote({ ok: true, text: "" });
    try {
      const roster = reset
        ? ""
        : f.players.filter((p) => clean(p.name)).map((p) => rosterEntry(clean(p.name), p)).join(", ");
      const staff = reset
        ? ""
        : f.staff.filter((p) => clean(p.name)).map((p) => `${clean(p.name)}|${p.cc}|${p.role}`).join(", ");
      const body = reset
        ? { name: "", tag: "", status: f.status, roster: "", staff: "" }
        : { name: f.name, tag: f.tag, status: f.status, roster, staff };
      const j = await call(`/api/teams/${team.id}`, body, "PATCH");
      setNote({ ok: true, text: tr.server(j.message) || tr("Saved.") });
      onSave();
    } catch (e) {
      setNote({ ok: false, text: tr.server(e.message) });
    } finally {
      setBusy(false);
    }
  }

  async function upload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_500_000) return setNote({ ok: false, text: tr("Logo is too big (1.5 MB maximum).") });
    setBusy(true);
    setNote({ ok: true, text: "" });
    try {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error(tr("Could not read the file.")));
        r.readAsDataURL(file);
      });
      const j = await call("/api/logo-upload", { team: team.id, data });
      setNote({ ok: true, text: tr.server(j.message) });
      onSave();
    } catch (err) {
      setNote({ ok: false, text: tr.server(err.message) });
    } finally {
      setBusy(false);
    }
  }

  const extra = f.players.map((p) => p.cc).filter((c) => c && !COUNTRIES.some(([k]) => k === c));
  const [logoAdded, setLogoAdded] = useState(0);
  const shownLogo = useAutoLogo(f.name, f.tag, false, team.logo, logoAdded);
  const pickTeam = useTeamPick(setF, () => setLogoAdded((n) => n + 1));
  return (
    <fieldset className="tform" disabled={busy}>
      <legend>
        <span className="slot">{team.id.toUpperCase()}</span> {team.name || tr("Empty slot")}
        {team.source && <span className="slotsrc"> · {team.source} #{team.pos}</span>}
      </legend>
      <div className="fgrid">
        <label className="f" htmlFor={`n-${team.id}`}>{tr("Team name")}
          <NameInput kind="teams" id={`n-${team.id}`} value={f.name} maxLength={40} onChange={(v) => set("name", v)} onPick={pickTeam} />
        </label>
        <label className="f" htmlFor={`t-${team.id}`}>{tr("Short tag")}
          <input id={`t-${team.id}`} value={f.tag} maxLength={7} onChange={(e) => set("tag", e.target.value)} />
        </label>
        <label className="f" htmlFor={`s-${team.id}`}>{tr("Entry")}
          <select id={`s-${team.id}`} value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="invited">{tr("Invited")}</option>
            <option value="qualified">{tr("Qualified")}</option>
          </select>
        </label>
      </div>
      <div className="logorow">
        <span className="logoprev">{shownLogo ? <img src={shownLogo + (shownLogo.startsWith("/api/") ? "?v=" + shownLogo.length : "")} alt="" /> : <i>{tr("No logo")}</i>}</span>
        <label className="btn filebtn">
          {tr("Upload a logo…")}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} hidden />
        </label>
        <span className="hint">{tr("PNG, JPG, WebP or SVG, 1.5 MB max. Save your other changes first.")} {tr("The logo follows the short tag: public/logos/<TAG>.png.")}</span>
      </div>
      <div className="plhead">{tr("Players")}</div>
      <div className="plgrid">
        {f.players.map((p, i) => (
          <div className="plrow" key={i}>
            <Flag cc={p.cc} />
            <NameInput kind="players" aria-label={tr("Player {n} name", { n: i + 1 })} placeholder={tr("Player {n}", { n: i + 1 })} maxLength={30} value={p.name} onChange={(v) => setName(i, v)} />
            <select aria-label={tr("Player {n} country", { n: i + 1 })} value={p.cc} onChange={(e) => setPlayer(i, "cc", e.target.value)}>
              <option value="">{tr("Country…")}</option>
              {extra.includes(p.cc) && <option value={p.cc}>{p.cc.toUpperCase()}</option>}
              {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <SubBox p={p} n={i + 1} onChange={(v) => setPlayer(i, "sub", v)} />
          </div>
        ))}
      </div>
      {f.players.length < MAX_PLAYERS && (
        <button type="button" className="linkbtn" onClick={() => set("players", [...f.players, { name: "", cc: "" }])}>{tr("+ Add a player")}</button>
      )}
      <div className="plhead">{tr("Staff")}</div>
      <div className="plgrid">
        {f.staff.map((p, i) => (
          <div className="plrow staffrow" key={i}>
            <Flag cc={p.cc} />
            <NameInput kind="staff" aria-label={tr("Staff member {n}", { n: i + 1 })} placeholder={tr("Staff member {n}", { n: i + 1 })} maxLength={30} value={p.name} onChange={(v) => setStaffName(i, v)} />
            <select aria-label={tr("Staff member {n} role", { n: i + 1 })} value={p.role} onChange={(e) => setStaff(i, "role", e.target.value)}>
              <option value="coach">{tr("Coach")}</option>
              <option value="assistant">{tr("Assistant Coach")}</option>
            </select>
            <select aria-label={tr("Staff member {n} country", { n: i + 1 })} value={p.cc} onChange={(e) => setStaff(i, "cc", e.target.value)}>
              <option value="">{tr("Country…")}</option>
              {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              {p.cc && !COUNTRIES.some(([k]) => k === p.cc) && <option value={p.cc}>{p.cc.toUpperCase()}</option>}
            </select>
          </div>
        ))}
      </div>
      {f.staff.length < 4 && (
        <button type="button" className="linkbtn" onClick={() => set("staff", [...f.staff, { name: "", cc: "", role: "assistant" }])}>{tr("+ Add a staff member")}</button>
      )}
      <div className="row">
        <button type="button" className="btn pri" onClick={() => save(false)}>{tr("Save team")}</button>
        <button type="button" className="btn" onClick={() => save(true)}>{tr("Reset to TBD")}</button>
        <SaveNote note={note} inline />
      </div>
    </fieldset>
  );
}

function ScoreRow({ m, name, teamOf, pickA, pickB, onSaved, endpoint = "/api/matches/score", extra = {} }) {
  const tr = useT();
  const [sa, setSa] = useState(m.sa ?? "");
  const [sb, setSb] = useState(m.sb ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = m.a && m.b;
  const res = result(m);
  const { event, times, live, extra: details, onSaved: onCleared } = useMatchTimes();
  const [sure, setSure] = useState(false); // "Clear" takes a second click: it removes the whole match
  useEffect(() => {
    if (!sure) return undefined;
    const t = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(t);
  }, [sure]);
  // anything "Clear" would remove: a score, teams chosen by hand, a time, the live flag, details
  const canClear = m.sa != null || m.sb != null || sa !== "" || sb !== "" || ((pickA || pickB) && (m.a || m.b)) || !!times[m.id] || !!live[m.id] || !!details[m.id];
  async function clearAll() {
    if (!sure) return setSure(true);
    setSure(false);
    setErr("");
    setBusy(true);
    try {
      const j = await call("/api/mclear", { event, id: m.id });
      setSa(""); setSb("");
      onCleared(tr.server(j.message));
    } catch (e) {
      setErr(tr.server(e.message));
    } finally {
      setBusy(false);
    }
  }
  async function send(quick) {
    setErr("");
    let a;
    let b;
    if (quick) { a = quick[0]; b = quick[1]; setSa(String(a)); setSb(String(b)); }
    else {
      a = sa === "" ? null : parseInt(sa, 10);
      b = sb === "" ? null : parseInt(sb, 10);
      if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b) || !calc(m.bo, a, b, m.a, m.b)) {
        return setErr(tr("One team must reach {n} maps, the other fewer.", { n: needWins(m.bo) }));
      }
    }
    setBusy(true);
    try {
      await call(endpoint, { ...extra, id: m.id, sa: a, sb: b });
      onSaved();
    } catch (e) {
      setErr(tr.server(e.message));
    } finally {
      setBusy(false);
    }
  }
  const max = needWins(m.bo);
  // One-click results: every valid score, team A winning then team B winning.
  const quickA = [];
  const quickB = [];
  for (let k = 0; k < max; k++) quickA.push([max, k]);
  for (let k = max - 1; k >= 0; k--) quickB.push([k, max]);
  const qbtn = (list) => (
    <span className="quick" role="group" aria-label={tr("Quick result")}>
      {list.map(([a, b]) => (
        <button key={a + "-" + b} type="button" className={"qb" + (m.sa === a && m.sb === b ? " on" : "")} disabled={!ready || busy} title={tr("{a} wins {s}", { a: name(a > b ? m.a : m.b), s: a + "-" + b })} onClick={() => send([a, b])}>{a}-{b}</button>
      ))}
    </span>
  );
  return (
    <div className={"mrowa" + (ready ? "" : " off")}>
      <span className={"mt" + (res && res.winner === m.a ? " w" : "")}>{qbtn(quickA)}<span className="tn" title={name(m.a)}>{pickA || name(m.a)}</span>{teamOf && <Crest team={m.a ? teamOf(m.a) : null} />}</span>
      <input type="number" min="0" max={max} aria-label={tr("{name} maps", { name: name(m.a) })} value={sa} disabled={!ready || busy} onChange={(e) => setSa(e.target.value)} />
      <span className="dash">–</span>
      <input type="number" min="0" max={max} aria-label={tr("{name} maps", { name: name(m.b) })} value={sb} disabled={!ready || busy} onChange={(e) => setSb(e.target.value)} />
      <span className={"mt r" + (res && res.winner === m.b ? " w" : "")}>{teamOf && <Crest team={m.b ? teamOf(m.b) : null} />}<span className="tn" title={name(m.b)}>{pickB || name(m.b)}</span>{qbtn(quickB)}</span>
      <span className="bo">Bo{m.bo}</span>
      <TimeEdit id={m.id} call={call} ready={!!ready} done={!!res} max={needWins(m.bo)} />
      <ExtraEdit id={m.id} call={call} bo={m.bo} nameA={m.a ? name(m.a) : ""} nameB={m.b ? name(m.b) : ""}
        teamA={m.a && teamOf ? teamOf(m.a) : null} teamB={m.b && teamOf ? teamOf(m.b) : null}
        playersA={starters(m.a && teamOf ? teamOf(m.a) : null)} playersB={starters(m.b && teamOf ? teamOf(m.b) : null)} />
      {/* no score typed yet: nothing to save (the teams and the time are saved as soon as they are chosen) */}
      <button className="btn pri" disabled={!ready || busy || (sa === "" && sb === "")} title={sa === "" && sb === "" ? tr("Type the score once the match is over. The teams and the time are already saved.") : ""} onClick={() => send()}>{tr("Save")}</button>
      <button className={"btn" + (sure ? " danger" : "")} disabled={busy || !canClear} title={tr("Removes the score, the teams chosen by hand, the time and the details of this match.")} onClick={clearAll}>{sure ? tr("Sure?") : tr("Clear")}</button>
      {err && <span className="err full">{err}</span>}
    </div>
  );
}

/** One Qualifier slot: same fields as a Playoffs team, in a small collapsible card. */
function SlotForm({ event, slot, team, onSaved, endpoint = "/api/q/slot", full = false }) {
  const tr = useT();
  const [f, setF] = useState(() => {
    const players = parseRoster(team ? team.roster : "").map((p) => ({ ...p }));
    while (players.length < 5) players.push({ name: "", cc: "" });
    const staff = parseStaff(team ? team.staff : "").map((p) => ({ ...p }));
    if (!staff.some((p) => p.role === "coach")) staff.unshift({ name: "", cc: "", role: "coach" });
    if (!staff.some((p) => p.role === "assistant")) staff.splice(1, 0, { name: "", cc: "", role: "assistant" });
    return { name: team ? team.name : "", tag: team ? team.tag || "" : "", status: team && team.status ? team.status : "invited", players, staff };
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ ok: true, text: "" });
  const kick = endpoint === "/api/k/team";
  const reg = endpoint === "/api/r/team"; // a regional Qualifier Playoffs team (Türkiye)
  const rich = kick || reg || event === "gc"; // Kickoff and GC cards have an entry (invited / qualified), a logo preview and upload, like the Playoffs
  const [logoAdded, setLogoAdded] = useState(0);
  const shownLogo = useAutoLogo(f.name, f.tag, !rich, team ? team.logo : "", logoAdded);
  const pickTeam = useTeamPick(setF, () => setLogoAdded((n) => n + 1));
  const setPlayer = (i, k, v) => setF((x) => ({ ...x, players: x.players.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const setName = useKnownName(setF, "players");
  const setStaffName = useKnownName(setF, "staff");
  const setStaff = (i, k, v) => setF((x) => ({ ...x, staff: x.staff.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const clean = (s) => s.replace(/[,|;]/g, " ").replace(/\s+/g, " ").trim();
  async function save(empty) {
    setBusy(true);
    setNote({ ok: true, text: "" });
    try {
      const roster = f.players.filter((p) => clean(p.name)).map((p) => rosterEntry(clean(p.name), p)).join(", ");
      const staff = f.staff.filter((p) => clean(p.name)).map((p) => `${clean(p.name)}|${p.cc}|${p.role}`).join(", ");
      const body = { event, slot, name: empty ? "" : f.name, roster: empty ? "" : roster, staff: empty ? "" : staff };
      body.tag = empty ? "" : f.tag;
      if (rich) body.entry = f.status;
      const j = await call(endpoint, body);
      setNote({ ok: true, text: tr.server(j.message) });
      if (empty) setF((x) => ({ ...x, name: "" }));
      onSaved();
    } catch (e) {
      setNote({ ok: false, text: tr.server(e.message) });
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_500_000) return setNote({ ok: false, text: tr("Logo is too big (1.5 MB maximum).") });
    setBusy(true);
    setNote({ ok: true, text: "" });
    try {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error(tr("Could not read the file.")));
        r.readAsDataURL(file);
      });
      const j = await call(kick ? "/api/k/logo" : reg ? "/api/r/logo" : "/api/q/logo", kick ? { slot, data } : { event, slot, data });
      setNote({ ok: true, text: tr.server(j.message) });
      onSaved();
    } catch (err) {
      setNote({ ok: false, text: tr.server(err.message) });
    } finally {
      setBusy(false);
    }
  }
  const nameField = rich ? (
    <>
      <div className="fgrid">
        <label className="f">{tr("Team name")}
          <NameInput kind="teams" value={f.name} maxLength={40} onChange={(v) => setF((x) => ({ ...x, name: v }))} onPick={pickTeam} />
        </label>
        <label className="f">{tr("Short tag")}
          <input value={f.tag} maxLength={7} onChange={(e) => setF({ ...f, tag: e.target.value })} />
        </label>
        {rich && (
          <label className="f">{tr("Entry")}
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="invited">{tr("Invited")}</option>
              <option value="qualified">{tr("Qualified")}</option>
            </select>
          </label>
        )}
      </div>
      <div className="logorow">
        <span className="logoprev">{shownLogo ? <img src={shownLogo + (shownLogo.startsWith("/api/") ? "?v=" + shownLogo.length : "")} alt="" /> : <i>{tr("No logo")}</i>}</span>
        <label className="btn filebtn">
          {tr("Upload a logo…")}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={upload} hidden />
        </label>
        <span className="hint">{tr("PNG, JPG, WebP or SVG, 1.5 MB max. Save your other changes first.")} {tr("The logo follows the short tag: public/logos/<TAG>.png.")}</span>
      </div>
    </>
  ) : (
    <div className="fgrid">
      <label className="f">{tr("Team name")}
        <NameInput kind="teams" value={f.name} maxLength={40} onChange={(v) => setF((x) => ({ ...x, name: v }))} onPick={pickTeam} />
      </label>
      <label className="f">{tr("Short tag")}
        <input value={f.tag} maxLength={7} onChange={(e) => setF({ ...f, tag: e.target.value })} />
      </label>
    </div>
  );
  const inner = (
    <>
        {nameField}
        <div className="plhead">{tr("Players")}</div>
        <div className="plgrid">
          {f.players.map((p, i) => (
            <div className="plrow" key={i}>
              <Flag cc={p.cc} />
              <NameInput kind="players" aria-label={tr("Player {n} name", { n: i + 1 })} placeholder={tr("Player {n}", { n: i + 1 })} maxLength={30} value={p.name} onChange={(v) => setName(i, v)} />
              <select aria-label={tr("Player {n} country", { n: i + 1 })} value={p.cc} onChange={(e) => setPlayer(i, "cc", e.target.value)}>
                <option value="">{tr("Country…")}</option>
                {p.cc && !COUNTRIES.some(([k]) => k === p.cc) && <option value={p.cc}>{p.cc.toUpperCase()}</option>}
                {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
              <SubBox p={p} n={i + 1} onChange={(v) => setPlayer(i, "sub", v)} />
            </div>
          ))}
        </div>
        {f.players.length < MAX_PLAYERS && (
          <button type="button" className="linkbtn" onClick={() => setF({ ...f, players: [...f.players, { name: "", cc: "" }] })}>{tr("+ Add a player")}</button>
        )}
        <div className="plhead">{tr("Staff")}</div>
        <div className="plgrid">
          {f.staff.map((p, i) => (
            <div className="plrow staffrow" key={i}>
              <Flag cc={p.cc} />
              <NameInput kind="staff" aria-label={tr("Staff member {n}", { n: i + 1 })} placeholder={tr("Staff member {n}", { n: i + 1 })} maxLength={30} value={p.name} onChange={(v) => setStaffName(i, v)} />
              <select aria-label={tr("Staff member {n} role", { n: i + 1 })} value={p.role} onChange={(e) => setStaff(i, "role", e.target.value)}>
                <option value="coach">{tr("Coach")}</option>
                <option value="assistant">{tr("Assistant Coach")}</option>
              </select>
              <select aria-label={tr("Staff member {n} country", { n: i + 1 })} value={p.cc} onChange={(e) => setStaff(i, "cc", e.target.value)}>
                <option value="">{tr("Country…")}</option>
                {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                {p.cc && !COUNTRIES.some(([k]) => k === p.cc) && <option value={p.cc}>{p.cc.toUpperCase()}</option>}
              </select>
            </div>
          ))}
        </div>
        {f.staff.length < 4 && (
          <button type="button" className="linkbtn" onClick={() => setF({ ...f, staff: [...f.staff, { name: "", cc: "", role: "assistant" }] })}>{tr("+ Add a staff member")}</button>
        )}
        <div className="row">
          <button type="button" className="btn pri" onClick={() => save(false)}>{tr("Save team")}</button>
          <button type="button" className="btn" onClick={() => save(true)}>{event === "gc" ? tr("Remove team") : tr("Reset to TBD")}</button>
          <SaveNote note={note} inline />
        </div>
    </>
  );
  if (full) {
    return (
      <fieldset className="tform" disabled={busy || !!(team && team.auto)}>
        <legend>
          <span className="slot">{kick ? "K" : ""}{slot}</span> {team ? team.name : event === "gc" ? tr("New team") : tr("Empty slot")}
          {team && team.source && <span className="slotsrc"> · {team.source} #{team.pos}</span>}
        </legend>
        {team && team.auto && (
          <p className="hint">
            {reg
              ? tr("Filled automatically from this place in the Türkiye Qualifier. Edit the team in that Qualifier's tab.")
              : team.source === "TR Qualifier"
              ? tr("Filled automatically from the Türkiye Qualifier Playoffs (winner). Edit the team in the Türkiye tab.")
              : team.source === "MENA Qualifier"
              ? tr("Filled automatically from the MENA Qualifier Playoffs (winner). Edit the team in the MENA tab.")
              : tr("Filled automatically from the Playoffs (final winner). Edit the team in the Playoffs tab.")}
          </p>
        )}
        {inner}
      </fieldset>
    );
  }
  return (
    <details className="tform mini">
      <summary>
        <span className="slot">{slot}</span>
        <Crest team={team || null} />
        <b>{team ? team.name : <i>{tr("Empty")}</i>}</b>
      </summary>
      <fieldset disabled={busy}>
        {inner}
      </fieldset>
    </details>
  );
}

/** Kickoff: the 12 participants, who plays whom where no earlier match decides it, and the scores. */
function KickoffAdmin({ data, onChange, view, setView }) {
  const tr = useT();
  const router = useRouter();
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [sure, setSure] = useState(false);
  const bracket = useMemo(() => buildKickoff(data.manual, data.scores), [data]);
  const name = (n) => (n && data.teams[n - 1] && data.teams[n - 1].name) || "TBD";
  const teamOf = (n) => data.teams[n - 1] || null;
  const [layout, setLayout] = useState("board"); // the matches as a bracket (like the site) or as a list
  async function score(m, sa, sb) {
    try {
      const j = await call("/api/k/score", { id: m.id, sa, sb });
      setMsg({ ok: true, text: tr.server(j.message) });
      onChange();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }
  async function setSides(m, patch) {
    try {
      const j = await call("/api/k/match", { id: m.id, a: m.feed.a ? null : m.a, b: m.feed.b ? null : m.b, ...patch });
      setMsg({ ok: true, text: tr.server(j.message) });
      onChange();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }
  async function reset() {
    try {
      const j = await call("/api/k/reset", {});
      setSure(false);
      setMsg({ ok: true, text: tr.server(j.message) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }
  const pick = (m, k) => <TeamPick m={m} k={k} teams={data.teams} used={kickPlacedElsewhere(data.manual, m.id)} onPick={(v) => setSides(m, { [k]: v })} />;
  return (
    <div className="qadmin">
      <SaveNote note={msg} />
      <div className="nav4" role="tablist" aria-label={tr("Kickoff")}>
        {[["teams", "Teams"], ["matches", "Matches"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{tr(l)}</button>
        ))}
      </div>
      {view === "teams" && (
        <div className="tforms">
          <p className="hint">{tr("Changes are saved team by team. The public site updates by itself within a few seconds.")} {tr("The logo is found by itself in public/logos from the short tag only (for example VIT.png); no tag, no logo.")}</p>
          {data.teams.map((t) => (
            <SlotForm key={t.slot + "|" + t.name + t.tag + t.logo + t.status + t.roster + t.staff + (t.auto ? "a" : "")} full slot={t.slot} team={t} endpoint="/api/k/team" onSaved={onChange} />
          ))}
        </div>
      )}
      {view === "matches" && (
        <>
          <p className="hint">{tr("Choose the 8 teams of Upper Bracket Round 1 and the 4 seeds of the UB Quarterfinals. Everything else fills itself: winners move on, losers drop to the Mid then the Lower Bracket.")}</p>
          <div className="navpills" role="tablist" aria-label={tr("Display")}>
            {[["board", "Bracket"], ["list", "List"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={layout === k} onClick={() => setLayout(k)}>{tr(l)}</button>
            ))}
          </div>
          {layout === "board" && (
            <>
              <p className="hint">{tr("Type the maps of each team; the score is saved as soon as one team has won the series. Empty both to clear it.")}</p>
              <KickoffBoard bracket={bracket} teams={data.teams} pick={(m, k) => (m.feed[k] ? null : pick(m, k))} onScore={score}
                renderDetails={(m) => (
                  <>
                    <TimeEdit id={m.id} call={call} ready={!!(m.a && m.b)} done={m.winner != null} max={needWins(m.bo)} />
                    <ExtraEdit id={m.id} call={call} bo={m.bo} nameA={m.a ? data.teams[m.a - 1].name : ""} nameB={m.b ? data.teams[m.b - 1].name : ""}
                      teamA={m.a ? data.teams[m.a - 1] : null} teamB={m.b ? data.teams[m.b - 1] : null}
                      playersA={starters(m.a ? data.teams[m.a - 1] : null)} playersB={starters(m.b ? data.teams[m.b - 1] : null)} />
                  </>
                )} />
            </>
          )}
          {layout === "list" && bracket.sections.map((sec) => sec.rounds.map((r) => (
            <section key={r.key}>
              <h2>{tr(r.name)}</h2>
              {r.matches.map((m) => (
                <div className="kadm" key={m.id}>
                  <ScoreRow key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} m={m} name={name} teamOf={teamOf} pickA={m.feed.a ? null : pick(m, "a")} pickB={m.feed.b ? null : pick(m, "b")} endpoint="/api/k/score" onSaved={onChange} />
                </div>
              ))}
            </section>
          )))}
        </>
      )}
      <section>
        <div className="row">
          {sure ? (
            <>
              <span className="err">{tr("Delete every Kickoff match and score?")}</span>
              <button className="btn" onClick={reset}>{tr("Yes, delete")}</button>
              <button className="btn" onClick={() => setSure(false)}>{tr("Cancel")}</button>
            </>
          ) : (
            <button className="btn danger" onClick={() => setSure(true)}>{tr("Reset Kickoff matches")}</button>
          )}
        </div>
      </section>
    </div>
  );
}

/** A regional Qualifier Playoffs (Türkiye): the 8 team cards, then the matches (opening matches chosen by hand, scores everywhere). */
function RegionalAdmin({ event, label, data, onChange, view, setView }) {
  const tr = useT();
  const router = useRouter();
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [sure, setSure] = useState(false);
  const bracket = useMemo(() => buildRegional(data.manual, data.scores, event), [data, event]);
  const name = (n) => (n && data.teams[n - 1] && data.teams[n - 1].name) || "TBD";
  const teamOf = (n) => data.teams[n - 1] || null;
  async function setSides(m, patch) {
    try {
      const j = await call("/api/r/match", { event, id: m.id, a: m.a, b: m.b, ...patch });
      setMsg({ ok: true, text: tr.server(j.message) });
      onChange();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }
  async function reset() {
    try {
      const j = await call("/api/r/reset", { event });
      setSure(false);
      setMsg({ ok: true, text: tr.server(j.message) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }
  const pick = (m, k) => <TeamPick m={m} k={k} teams={data.teams} used={placedElsewhere(data.manual, event, m.id)} onPick={(v) => setSides(m, { [k]: v })} />;
  return (
    <div className="qadmin">
      <SaveNote note={msg} />
      <div className="nav4" role="tablist" aria-label={label}>
        {[["teams", "Teams"], ["matches", "Matches"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{tr(l)}</button>
        ))}
      </div>
      {view === "teams" && (
        <div className="tforms">
          <p className="hint">{tr("Changes are saved team by team. The public site updates by itself within a few seconds.")}</p>
          {data.teams.map((t) => (
            <SlotForm key={t.slot + "|" + t.name + t.tag + t.logo + t.status + t.roster + t.staff} full event={event} slot={t.slot} team={t} endpoint="/api/r/team" onSaved={onChange} />
          ))}
        </div>
      )}
      {view === "matches" && (
        <>
          <p className="hint">{bracket.format === "gsl8" ? tr("Choose the two teams of each opening match; every other match fills itself from the results.") : bracket.format === "de8" ? tr("Choose the two teams of each upper quarterfinal; every other match fills itself from the results (losers drop to the lower bracket).") : tr("Choose the two teams of each semifinal; the final fills itself from the results.")}</p>
          {bracket.stages.map((s) => (
            <section key={s.key}>
              <h2>{tr(s.name)}</h2>
              {s.rounds.map((r) => (
                <div key={r.key}>
                  <h3 className="sub">{tr(r.name)}</h3>
                  {r.matches.map((m) => (
                    <div className="kadm" key={m.id}>
                      <ScoreRow key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} m={m} name={name} teamOf={teamOf}
                        pickA={isOpening(m.id, event) ? pick(m, "a") : null} pickB={isOpening(m.id, event) ? pick(m, "b") : null}
                        endpoint="/api/r/score" extra={{ event }} onSaved={onChange} />
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
      <section>
        <div className="row">
          {sure ? (
            <>
              <span className="err">{tr("Delete every {r} match and score?", { r: label })}</span>
              <button className="btn" onClick={reset}>{tr("Yes, delete")}</button>
              <button className="btn" onClick={() => setSure(false)}>{tr("Cancel")}</button>
            </>
          ) : (
            <button className="btn danger" onClick={() => setSure(true)}>{tr("Reset {r} matches", { r: label })}</button>
          )}
        </div>
      </section>
    </div>
  );
}

/** VCT Game Changers EMEA: the team list, one card per team, plus one blank card to add the next. */
function GcAdmin({ teams, onChange }) {
  const tr = useT();
  const [adding, setAdding] = useState(false);
  const used = new Set(teams.map((t) => t.slot));
  let free = 1;
  while (used.has(free)) free++;
  return (
    <div className="qadmin">
      <section>
        <h2>{tr("GC EMEA teams")} <small>{teams.length}</small></h2>
        <p className="hint">{tr("Add the teams one by one. Matches will come once the format is known.")}</p>
        <div className="tforms">
          {teams.map((t) => (
            <SlotForm key={t.slot + "|" + t.name + t.tag + t.logo + t.status + t.roster + t.staff} full event="gc" slot={t.slot} team={t} onSaved={onChange} />
          ))}
          {adding ? (
            <SlotForm key={"new" + free} full event="gc" slot={free} team={null} onSaved={() => { setAdding(false); onChange(); }} />
          ) : free <= 64 && (
            <button type="button" className="linkbtn" onClick={() => setAdding(true)}>{tr("+ Add a team")}</button>
          )}
        </div>
      </section>
    </div>
  );
}

/** One click per result: the matches waiting for one, by start time, in a compact list. */
function QuickScores({ event, todo, name, onChange }) {
  const tr = useT();
  const { times } = useMatchTimes();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [gone, setGone] = useState({});
  const [err, setErr] = useState("");
  const plain = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const wait = todo.filter((m) => m.winner == null && !gone[m.id]).filter((m) => !q || plain(name(m.a)).includes(plain(q)) || plain(name(m.b)).includes(plain(q)));
  if (!todo.some((m) => m.winner == null)) return null;
  const groups = [];
  for (const m of [...wait].sort((a, b) => (times[a.id] || "z").localeCompare(times[b.id] || "z"))) {
    const at = times[m.id] || "";
    const g = groups[groups.length - 1];
    if (g && g.at === at) g.items.push(m); else groups.push({ at, items: [m] });
  }
  const results = (bo) => {
    const need = Math.ceil(bo / 2);
    const lose = Array.from({ length: need }, (_, i) => i);
    return [...lose.map((x) => [need, x]), ...[...lose].reverse().map((x) => [x, need])];
  };
  async function save(m, sa, sb) {
    setBusy(m.id);
    setErr("");
    try {
      await call("/api/q/score", { event, id: m.id, sa, sb });
      setGone((g) => ({ ...g, [m.id]: true }));
      onChange();
    } catch (e) {
      setErr(tr.server(e.message));
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <h2>{tr("Quick scores")} <small>{wait.length}</small></h2>
      <p className="hint">{tr("One click per result; the winner goes through at once. Undo brings the last one back.")}</p>
      <input className="quickfind" type="search" placeholder={tr("Find a team")} aria-label={tr("Find a team")} value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <p className="err">{err}</p>}
      {groups.map((g, i) => (
        <details key={g.at || "none"} className="quickgroup" open={i === 0}>
          <summary><b>{g.at ? new Date(g.at).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : tr("No time")}</b> <small>({g.items.length})</small></summary>
          {g.items.map((m) => (
            <div className="quickrow" key={m.id}>
              <span className="tn qa">{name(m.a)}</span>
              <span className="quickbtns">
                {results(m.bo).map(([sa, sb]) => (
                  <button type="button" key={`${sa}-${sb}`} className={"quickbtn" + (sa > sb ? " a" : " b")} disabled={busy === m.id} onClick={() => save(m, sa, sb)}>{sa}-{sb}</button>
                ))}
              </span>
              <span className="tn qb">{name(m.b)}</span>
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}

/** One Qualifier: paste the teams in bracket order, set the best-of per round, enter scores. */
function QualifierAdmin({ event, data, onChange }) {
  const tr = useT();
  const initialText = useMemo(() => {
    const lines = data.slots.map((t) => (t ? [t.name, t.roster, t.staff].filter((x, i) => i === 0 || x).join(" ; ").replace(/ ; $/, "") : ""));
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return lines.join("\n");
  }, [data]);
  const [text, setText] = useState(initialText);
  const [bo, setBo] = useState({});
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const bracket = useMemo(() => buildBracket(data.slots, data.scores, data.bo), [data]);
  const name = (slot) => (slot && data.slots[slot - 1] ? data.slots[slot - 1].name : "TBD");
  const teamOf = (slot) => data.slots[slot - 1] || null;
  const lines = text.split(/\r?\n/);
  const size = data.slots.length;
  const count = lines.slice(0, size).filter((l) => l.trim()).length;

  async function run(path, body) {
    setBusy(true);
    try {
      const j = await call(path, { event, ...body });
      setMsg({ ok: true, text: tr.server(j.message) });
      onChange();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    } finally {
      setBusy(false);
    }
  }
  const rounds = [...roundsFor(size), THIRD];
  const todo = bracket.matches.filter((m) => m.a && m.b && !m.bye);
  return (
    <div className="qadmin">
      <SaveNote note={msg} />
      <section>
        <h2>{tr("Teams")} <small>{count}/{size}</small></h2>
        <p className="hint">{tr("The logo is found by itself in public/logos from the short tag only (for example VIT.png); no tag, no logo.")}</p>
        <div className="slotgrid">
          {Array.from({ length: size / 2 }, (_, k) => (
            <div className="slotpair" key={k}>
              <div className="plhead">{tr("Match {n}", { n: k + 1 })}</div>
              {[2 * k, 2 * k + 1].map((i) => (
                <SlotForm key={i + "|" + (data.slots[i] ? data.slots[i].name + data.slots[i].tag + data.slots[i].roster + data.slots[i].staff : "")} event={event} slot={i + 1} team={data.slots[i] || null} onSaved={onChange} />
              ))}
            </div>
          ))}
        </div>
        <details className="bulk">
          <summary>{tr("Bulk import (one team per line)")}</summary>
          <p className="hint">{tr("One team per line, in bracket order: lines 1 and 2 meet in the first round, 3 and 4, and so on. A blank line leaves an empty slot (a bye). Up to {n} lines. Optional: Name ; player|fr, player|de ; coach|fr|coach", { n: size })}</p>
          <textarea className="qtext" rows={12} value={text} onChange={(e) => setText(e.target.value)} aria-label={tr("Teams")} spellCheck={false} />
          <div className="row">
            <button className="btn pri" disabled={busy} onClick={() => run("/api/q/teams", { text })}>{tr("Save teams")}</button>
            <span className="hint">{tr("Saving the teams removes the scores that no longer fit.")}</span>
          </div>
        </details>
      </section>
      <section>
        <h2>{tr("Format")}</h2>
        <div className="bogrid">
          {rounds.map((r) => (
            <label className="f" key={r.key} htmlFor={`bo-${event}-${r.key}`}>
              {tr(r.name)}
              <select id={`bo-${event}-${r.key}`} value={bo[r.key] ?? data.bo[r.key] ?? r.bo} onChange={(e) => setBo({ ...bo, [r.key]: Number(e.target.value) })}>
                {BO_CHOICES.map((n) => <option key={n} value={n}>Bo{n}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={() => run("/api/q/config", { bo: Object.fromEntries(rounds.map((r) => [r.key, bo[r.key] ?? data.bo[r.key] ?? r.bo])) })}>{tr("Save formats")}</button>
        </div>
      </section>
      <QuickScores event={event} todo={todo} name={name} onChange={onChange} />
      <section>
        <h2>{tr("Scores")}</h2>
        {todo.length === 0 && <p className="hint">{tr("No match to play yet. Matches appear here once both teams are known.")}</p>}
        {rounds.map((r) => {
          const ms = todo.filter((m) => m.round === r.key);
          if (!ms.length) return null;
          return (
            <div key={r.key}>
              <div className="mlabel">{tr(r.name)} · Bo{ms[0].bo}</div>
              {ms.map((m) => (
                <ScoreRow key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb + "|" + m.bo} m={m} name={name} teamOf={teamOf} endpoint="/api/q/score" extra={{ event }} onSaved={onChange} />
              ))}
            </div>
          );
        })}
      </section>
      <section>
        <div className="toolbar">
          <button className="btn danger" disabled={busy} onClick={() => (sure ? (setSure(false), run("/api/q/reset", {})) : (setSure(true), setTimeout(() => setSure(false), 5000)))}>
            {sure ? tr("Confirm: erase this Qualifier") : tr("Reset this Qualifier")}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Admin(props) {
  const known = useMemo(() => knownNames(props.initial), [props.initial]);
  return (
    <LangProvider lang={props.lang}>
      <KnownNames.Provider value={known}>
        <AdminView {...props} />
      </KnownNames.Provider>
    </LangProvider>
  );
}

/** A date, or only its month while the day is not announced ("2027-01"). Empty: to be announced. */
function DateField({ id, label, value, onChange }) {
  const tr = useT();
  const monthOnly = value.length === 7;
  return (
    <div className="f datef">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={monthOnly ? "month" : "date"} value={value} onChange={(e) => onChange(e.target.value)} />
      <label className="sw small">
        <input type="checkbox" checked={monthOnly} onChange={(e) => onChange(e.target.checked ? value.slice(0, 7) : value ? value + "-01" : "")} /> {tr("Day not known yet")}
      </label>
    </div>
  );
}

/** Dates, type, location, venue and tier of the event the editor is on; shown on the site (navigation, infobox, home page). */
function EventInfoForm({ event, info, onSaved, onError }) {
  const tr = useT();
  const [v, setV] = useState(info);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const changed = JSON.stringify(v) !== JSON.stringify(info);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const j = await call("/api/info", { event, ...v });
      onSaved(tr.server(j.message));
    } catch (err) {
      onError(tr.server(err.message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="einfo" open={open || changed} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <b>{tr("Event information")}</b>
        <span>{formatDates(info, tr.lang) || tr("Dates to be announced")} · {[info.location, tr(TYPE_LABEL[info.type] || "Online"), info.tier].filter(Boolean).join(" · ")}</span>
      </summary>
      <form onSubmit={save}>
        <div className="einfogrid">
          <DateField id={`ei-s-${event}`} label={tr("Start date")} value={v.start} onChange={set("start")} />
          <DateField id={`ei-e-${event}`} label={tr("End date")} value={v.end} onChange={set("end")} />
          <label className="f" htmlFor={`ei-t-${event}`}>{tr("Type")}
            <select id={`ei-t-${event}`} value={v.type} onChange={(e) => set("type")(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
            </select>
          </label>
          <label className="f" htmlFor={`ei-l-${event}`}>{tr("Location")}
            <input id={`ei-l-${event}`} value={v.location} maxLength={40} onChange={(e) => set("location")(e.target.value)} placeholder="Berlin, Europe…" />
          </label>
          <label className="f" htmlFor={`ei-v-${event}`}>{tr("Venue")}
            <input id={`ei-v-${event}`} value={v.venue} maxLength={60} onChange={(e) => set("venue")(e.target.value)} placeholder="Riot Games Arena" />
          </label>
          <label className="f" htmlFor={`ei-r-${event}`}>{tr("Tier")}
            <select id={`ei-r-${event}`} value={v.tier} onChange={(e) => set("tier")(e.target.value)}>
              {INFO_TIERS.map((t) => <option key={t} value={t}>{t || tr("None")}</option>)}
            </select>
          </label>
          <label className="f einfowide" htmlFor={`ei-st-${event}`}>{tr("Default stream link")}
            <input id={`ei-st-${event}`} type="url" value={v.stream || ""} maxLength={300} onChange={(e) => set("stream")(e.target.value)} placeholder="https://twitch.tv/valorant_emea" />
          </label>
        </div>
        <p className="hint">{tr("Leave a date empty while it is not announced. The state follows the dates: Upcoming before the start, Live until the end, Finished after it (or as soon as the winner is known).")}</p>
        <div className="row">
          <button className="btn pri" type="submit" disabled={busy || !changed}>{tr("Save information")}</button>
          {changed && <button className="btn" type="button" onClick={() => setV(info)}>{tr("Cancel")}</button>}
        </div>
      </form>
    </details>
  );
}

function AdminView({ initial, isAdmin, start }) {
  const tr = useT();
  const router = useRouter();
  // Changes made elsewhere (another editor, another tab, the database) show up by themselves; nothing while typing.
  useAutoRefresh(15000, !!isAdmin);
  // Every editor tab has its own address (/admin/qualifier-2, /admin/playoffs/matches, /admin/kickoff...); the back button follows.
  const [nav, setNav] = useState(start || { region: "eu", top: "q1", sub: "teams", kview: "teams" });
  const { region, top, sub, kview, ttop } = nav; // ttop: Türkiye stage ("trq1", "trq2"; none = its Qualifier Playoffs)
  const show = (next) => {
    setNav(next);
    if (typeof window !== "undefined") {
      const href = adminHref(next);
      if (window.location.pathname !== href) window.history.pushState(null, "", href);
    }
  };
  const goNav = (patch) => {
    const { home, ...rest } = nav; // any tab leaves the home page
    show({ ...rest, ...patch });
  };
  const goHome = () => { show({ ...nav, home: true }); window.scrollTo({ top: 0 }); };
  const openEvent = (event, matches) => { show(adminNavForEvent(event, matches)); window.scrollTo({ top: 0 }); };
  const setRegion = (v) => goNav({ region: v });
  const [lastVct, setLastVct] = useState(start && start.region !== "gc" ? start.region : "eu"); // where the "VCT EMEA" tab goes back to
  useEffect(() => { if (region !== "gc") setLastVct(region); }, [region]);
  const setTop = (v) => goNav({ top: v });
  const setSub = (v) => goNav({ sub: v });
  useEffect(() => {
    const onPop = () => {
      const st = parseAdminPath(window.location.pathname);
      if (st) setNav(st);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // a region's own qualifiers are its stage tabs (ttop); none = its Qualifier Playoffs
  const REG_STAGES = {
    tr: [["trq1", "Qualifier 1"], ["trq2", "Qualifier 2"], [undefined, "Qualifier Playoffs"]],
    mena: [["meq1", "ME Qualifier 1"], ["meq2", "ME Qualifier 2"], ["naq1", "NA Qualifier 1"], ["naq2", "NA Qualifier 2"], [undefined, "Qualifier Playoffs"]],
  };
  const stageOf = REG_STAGES[region] && REG_STAGES[region].some(([k]) => k && k === ttop) ? ttop : undefined;
  const home = !!nav.home;
  const tab = home ? "home" : stageOf || (region !== "eu" ? region : top === "playoffs" ? sub : top);
  const [msg, setMsg] = useState({ ok: true, text: "" });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirm) return undefined;
    const t = setTimeout(() => setConfirm(null), 5000);
    return () => clearTimeout(t);
  }, [confirm]);

  const teams = initial ? initial.teams : [];
  const matches = initial ? initial.matches : [];
  const byId = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const name = (id) => (id && byId[id] && byId[id].name) || "TBD";
  const teamOf = (id) => byId[id] || null;
  const rec = useMemo(() => records(teams, matches), [teams, matches]);
  if (!isAdmin) return <Login />;

  const swiss = matches.filter((m) => m.stage === "swiss");
  const elim = matches.filter((m) => m.stage === "elim");
  const swissPlan = planSwiss(teams, matches);
  const bracketPlan = planBracket(teams, matches);
  const ranked = rankTeams(teams, rec);

  async function act(path, body) {
    if (busy) return;
    setBusy(true);
    try {
      const j = await call(path, body);
      setMsg({ ok: true, text: tr.server(j.message) || tr("Done.") });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    } finally {
      setBusy(false);
    }
  }
  const reset = (stage, label) => (
    <button className="btn danger" disabled={busy} onClick={() => (confirm === stage ? (setConfirm(null), act("/api/reset", { stage })) : setConfirm(stage))}>
      {confirm === stage ? tr(`Confirm: delete all ${label}`) : tr(`Reset ${label}`)}
    </button>
  );
  async function undo() {
    setBusy(true);
    try {
      const j = await call("/api/undo", {});
      setMsg({ ok: true, text: tr.server(j.message) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await call("/api/logout", {});
    router.refresh();
  }
  const saved = () => { setMsg({ ok: true, text: tr("Saved.") }); router.refresh(); };
  // places a team in a Swiss match or a bracket semifinal (the other side is sent as it is)
  async function draw(endpoint, m, patch) {
    try {
      const j = await call(endpoint, { id: m.id, a: m.a || "", b: m.b || "", ...patch });
      setMsg({ ok: true, text: tr.server(j.message) });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: tr.server(e.message) });
    }
  }

  return (
    <MatchTimes event={eventForAdmin(nav)} times={initial.times ? initial.times[eventForAdmin(nav)] : {}} live={initial.live ? initial.live[eventForAdmin(nav)] : {}} extra={initial.extra ? initial.extra[eventForAdmin(nav)] : {}} onSaved={(m) => { setMsg({ ok: true, text: m }); router.refresh(); }}>
    <div className="adm wrap">
      <header className="admhead">
        <div>
          <h1 className="brandh"><EmeaMark /><span>{tr("Editor")}</span></h1>
          <div className="sub">VCT EMEA · VCT GC EMEA</div>
        </div>
        <div className="admlinks">
          <div className="prefs"><ThemeSwitch /><LangSwitch /></div>
          {initial.admin && initial.admin.undo && (
            <button className="btn" disabled={busy} title={tr("Undo: {what}", { what: tr.server(initial.admin.undo.label) })} onClick={undo}>↶ {tr("Undo")}</button>
          )}
          <a className="btn pri" href={siteHrefForAdmin(nav)}>{tr("← Back to the site")}</a>
          <button className="btn" onClick={logout}>{tr("Sign out")}</button>
        </div>
      </header>
      <nav className="evnav" aria-label={tr("Circuit")}>
      <div className="nav1" role="tablist" aria-label={tr("Circuit")}>
        <button type="button" className="navhome" title={tr("Editor home")} aria-label={tr("Editor home")} aria-current={home ? "page" : undefined} onClick={goHome}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>
        <button role="tab" aria-selected={!home && region !== "gc"} onClick={() => setRegion(region === "gc" ? lastVct : region)}>VCT EMEA</button>
        <button role="tab" aria-selected={!home && region === "gc"} onClick={() => setRegion("gc")}>VCT GC EMEA</button>
      </div>
      {!home && region !== "gc" && (
        <div className="nav2" role="tablist" aria-label={tr("Region")}>
          {REGIONS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={region === k} onClick={() => setRegion(k)}>{tr(l)}</button>
          ))}
        </div>
      )}
      {!home && region === "eu" && (
        <div className="nav3" role="tablist" aria-label={tr("Stage")}>
          {TOP.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={top === k} onClick={() => setTop(k)}>{tr(l)}</button>
          ))}
        </div>
      )}
      {!home && REG_STAGES[region] && (
        <div className="nav3" role="tablist" aria-label={tr("Stage")}>
          {REG_STAGES[region].map(([k, l]) => (
            <button key={l} role="tab" aria-selected={stageOf === k} onClick={() => goNav({ ttop: k })}>{tr(l)}</button>
          ))}
        </div>
      )}
      </nav>
      {!home && initial.info && (() => {
        const ev = eventForAdmin(nav);
        const info = initial.info[ev] || INFO_DEFAULTS[ev];
        return <EventInfoForm key={ev + JSON.stringify(info)} event={ev} info={info} onSaved={(m) => { setMsg({ ok: true, text: m }); router.refresh(); }} onError={(m) => setMsg({ ok: false, text: m })} />;
      })()}
      {home && <SaveNote note={msg} />}
      {tab === "home" && <AdminHome initial={initial} onOpen={openEvent} call={call} onDone={(m) => { setMsg({ ok: true, text: m }); router.refresh(); }} />}
      {!home && (initial.qualifiers[tab] && tab !== "gc" || tab === "matches" || (["kickoff", "tr", "mena", "gc"].includes(tab) && kview === "matches")) && (
        <>
          <RoundTimes key={`rounds-${eventForAdmin(nav)}`} items={matchesOf(eventForAdmin(nav), eventData(initial, eventForAdmin(nav)))} call={call} />
          <BulkSchedule key={`bulk-${eventForAdmin(nav)}`} items={matchesOf(eventForAdmin(nav), eventData(initial, eventForAdmin(nav)))} call={call} />
        </>
      )}
      {!home && region === "eu" && top === "playoffs" && (
        <div className="nav4" role="tablist" aria-label={tr("Playoffs")}>
          {SUBS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sub === k} onClick={() => setSub(k)}>{tr(l)}</button>
          ))}
        </div>
      )}
      <SaveNote note={msg} />

      {tab === "teams" && (
        <div className="tforms">
          <p className="hint">{tr("Changes are saved team by team. The public site updates by itself within a few seconds.")}</p>
          {teams.map((t) => (
            <TeamForm key={t.id + "|" + t.name + "|" + t.tag + "|" + t.status + "|" + t.roster + "|" + t.logo + "|" + t.staff} team={t} onSave={saved} />
          ))}
        </div>
      )}

      {tab === "matches" && (
        <div>
          <p className="hint">{tr("Choose the two teams of each match, or let the Tournament tab draw a whole round. A team plays once per round, against a team with the same record.")}</p>
          {[1, 2, 3, 4, 5].map((r) => swissDraw(teams, matches, r)).filter((d) => d.editable || d.slots.some((x) => x.match)).map((d) => (
            <section key={d.round}>
              <h2>{tr("Swiss · Round {n}", { n: d.round })}</h2>
              {d.slots.map((x, i) => {
                const m = x.match || { id: x.id, stage: "swiss", round: d.round, a: "", b: "", sa: null, sb: null, bo: 3 };
                const head = i === 0 || d.slots[i - 1].key !== x.key;
                const pick = (k) => d.editable && <DrawPick m={m} k={k} pool={d.pools[x.key] || []} used={placedInRound(d.slots, x.id)} name={name} onPick={(v) => draw("/api/swiss/match", m, { [k]: v })} />;
                return (
                  <div key={x.id}>
                    {head && <div className="mlabel">{x.key}{x.name ? ` · ${tr(x.name)}` : ""}</div>}
                    <ScoreRow key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} m={m} name={name} teamOf={teamOf} pickA={pick("a")} pickB={pick("b")} onSaved={saved} />
                  </div>
                );
              })}
            </section>
          ))}
          {(() => {
            const d = bracketDraw(teams, matches);
            if (!d.editable && !elim.length) return null;
            const fin = elim.filter((m) => m.round === "final" || m.id.endsWith("-f"));
            return (
              <section>
                <h2>{tr("Bracket")}</h2>
                {d.slots.map((x) => {
                  const m = x.match || { id: x.id, stage: "elim", round: "semi", a: "", b: "", sa: null, sb: null, bo: 3 };
                  const pick = (k) => d.editable && <DrawPick m={m} k={k} pool={d.adv} used={placedInRound(d.slots, x.id)} name={name} onPick={(v) => draw("/api/bracket/match", m, { [k]: v })} />;
                  return (
                    <div key={x.id}>
                      <div className="mlabel">{tr("Group {g}", { g: x.key })} · {tr("Semifinal")}</div>
                      <ScoreRow key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} m={m} name={name} teamOf={teamOf} pickA={pick("a")} pickB={pick("b")} onSaved={saved} />
                    </div>
                  );
                })}
                {fin.map((m) => (
                  <div key={m.id}>
                    <div className="mlabel">{tr("Group {g}", { g: m.id.charAt(1) })} · {tr("Final")}</div>
                    <ScoreRow m={m} name={name} teamOf={teamOf} onSaved={saved} key={m.id + "|" + m.a + "|" + m.b + "|" + m.sa + "|" + m.sb} />
                  </div>
                ))}
              </section>
            );
          })()}
        </div>
      )}

      {(tab === "tr" || tab === "mena") && (
        <RegionalAdmin key={tab} event={tab} label={tab === "tr" ? "Türkiye" : "MENA"} data={initial.regional[tab]} onChange={saved} view={kview} setView={(v) => goNav({ kview: v })} />
      )}
      {tab === "gc" && <RegionalAdmin key="gc" event="gc" label="Game Changers" data={initial.regional.gc} onChange={saved} view={kview} setView={(v) => goNav({ kview: v })} />}
      {tab === "kickoff" && <KickoffAdmin data={initial.kickoff} onChange={saved} view={kview} setView={(v) => goNav({ kview: v })} />}

      {initial.qualifiers[tab] && tab !== "gc" && (
        <QualifierAdmin key={tab} event={tab} data={initial.qualifiers[tab]} onChange={saved} />
      )}

      {tab === "tournament" && (
        <div className="tourn">
          <section>
            <h2>{tr("Swiss Stage")}</h2>
            <div className="toolbar">
              <button className="btn pri" disabled={busy || !!swissPlan.err} onClick={() => act("/api/swiss/generate")}>
                {swissPlan.err ? tr("Generate next round") : tr("Generate round {n}", { n: swissPlan.round })}
              </button>
              <span className="why">{swissPlan.err ? tr.server(swissPlan.err) : `${tr("{n} matches, Bo3.", { n: swissPlan.pairs.length })}${swissPlan.warning ? " " + tr.server(swissPlan.warning) : ""}`}</span>
              {swiss.length > 0 && reset("swiss", "Swiss matches")}
            </div>
            <ol className="stand">
              {ranked.map((t) => {
                const R = rec[t.id];
                const st = standing(rec, t.id);
                return (
                  <li key={t.id} className={st}>
                    <Crest team={t} /><b>{t.name || "TBD"}</b> <span>{R.w}-{R.l}</span> {st === "adv" && <em>{tr("advances")}</em>} {st === "out" && <em>{tr("out")}</em>}
                  </li>
                );
              })}
            </ol>
          </section>
          <section>
            <h2>{tr("Single Elimination")}</h2>
            <div className="toolbar">
              <button className="btn pri" disabled={busy || !!bracketPlan.err} onClick={() => act("/api/bracket/generate")}>{tr("Generate bracket")}</button>
              <span className="why">{bracketPlan.err ? tr.server(bracketPlan.err) : tr("8 teams, 2 groups of 4.")}</span>
              {elim.length > 0 && reset("elim", "bracket matches")}
              {elim.length > 0 && <button className="btn" disabled={busy} onClick={() => act("/api/placements/swap")}>{tr("Swap 3rd and 4th place")}</button>}
            </div>
          </section>
        </div>
      )}
    </div>
    </MatchTimes>
  );
}
