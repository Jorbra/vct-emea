"use client";

// The bot dashboard's activity (the home) and members' files (components/BotPanel.jsx). Written in French, as the
// server's editors read it.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ask, KIND, Who } from "./BotPages.jsx";
import { TicketView } from "./BotTicket.jsx";

const when = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const longDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const nf = (n) => Number(n || 0).toLocaleString("fr-FR").replace(/ /g, " ");
const short = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const kindName = (k) => (KIND[k] || ["", k])[1];
const kindIcon = (k) => (KIND[k] || ["", k])[0];

const METRICS = [["members", "Arrivées et départs"], ["sanctions", "Sanctions"], ["tickets", "Tickets ouverts"], ["commands", "Commandes"]];

/** "+12 %" against the 30 days before, "" when there is nothing to compare with. */
function delta(now, before) {
  if (!before) return now ? "aucun les 30 jours d'avant" : "";
  const p = Math.round(((now - before) / before) * 100);
  return `${p > 0 ? "+" : ""}${p} % par rapport aux 30 jours d'avant`;
}

/** The home's activity: the last 30 days in figures (against the 30 before), a chart per day, the latest cases and tickets. */
/** "How long ago": 5 min, 3 h, 2 j. */
const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`; };
const inTime = (iso) => { const m = Math.max(1, Math.round((Date.parse(iso) - Date.now()) / 60000)); return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };

/** What needs someone now: open tickets nobody took, modules to set up, commands to register, sanctions ending soon. */
export function TodoBox({ a, setup = [], missing = 0, onMember, go, onTicket }) {
  const t = (a && a.todo) || { unclaimed: [], ending: [] };
  const items = [];
  if (missing > 0) items.push(<li key="reg">⬆️ <b>{missing} commande{missing > 1 ? "s" : ""}</b> à enregistrer sur Discord : bouton « Enregistrer les commandes » en haut.</li>);
  for (const x of t.unclaimed) items.push(<li key={x.thread}>🎫 Ticket ouvert depuis <b>{ago(x.opened)}</b>, personne ne l&apos;a pris : <button type="button" className="linkbtn" onClick={() => onTicket(x.thread)}>{x.subject || "Sans sujet"}</button> <small className="bmuted">· <Who id={x.user} names={a.names} onMember={onMember} /></small></li>);
  for (const m of setup) items.push(<li key={m.key}>{m.state === "missing" ? "⚠️" : "🛠️"} <button type="button" className="linkbtn" onClick={() => go(`mod:${m.key}`)}>{m.name}</button> : {m.why || "à configurer"}</li>);
  for (const r of t.ending) items.push(<li key={`e${r.id}`}>⏳ {r.kind === "tempban" ? "Ban temporaire" : "Exclusion"} de <Who id={r.user} names={a.names} onMember={onMember} /> qui finit dans <b>{inTime(r.until)}</b> <small className="bmuted">(cas #{r.id})</small></li>);
  return (
    <section className={"btodo" + (items.length ? "" : " done")} aria-label="À faire">
      <h3 className="sub">{items.length ? `📌 À faire (${items.length})` : "✅ Rien à faire pour le moment"}</h3>
      {items.length > 0 && <ul>{items}</ul>}
    </section>
  );
}

/** todoAt: the element at the top of the home where the to-do box goes (else it opens the activity). */
export function ActivityPanel({ guild, onMember, go, setup = [], missing = 0, todoAt = null }) {
  const [a, setA] = useState(null);
  const [metric, setMetric] = useState("members");
  const [hover, setHover] = useState(null);
  const [read, setRead] = useState("");
  const [fresh, setFresh] = useState(null); // when the activity was last read
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => {
    setLoading(true);
    return ask({ action: "activity", guild }).then((j) => { if (j && !j.error) { setA(j); setFresh(new Date()); } else setA((x) => x || j); }).finally(() => setLoading(false));
  }, [guild]);
  // read again every 2 minutes while the page is seen, and when one comes back to it after a while
  useEffect(() => {
    refresh();
    let last = Date.now();
    const tick = () => { if (document.visibilityState === "visible" && Date.now() - last > 110000) { last = Date.now(); refresh(); } };
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);
  if (!a) return <p className="note">Chargement de l&apos;activité…</p>;
  if (a.error) return <p className="err">{a.error}</p>;
  const t = a.totals;
  const todo = <TodoBox a={a} setup={setup} missing={missing} onMember={onMember} go={go} onTicket={setRead} />;
  const b = a.before;
  const tiles = [
    ["📥", "Arrivées", t.joins, b.joins], ["📤", "Départs", t.leaves, b.leaves], ["⚖️", "Sanctions", t.sanctions, b.sanctions],
    ["🎫", "Tickets ouverts", t.tickets, b.tickets], ["⌨️", "Commandes", t.commands, b.commands],
  ];
  const net = t.joins - t.leaves;
  const two = metric === "members";
  const val = (d) => (two ? d.joins : d[metric]);
  const top = Math.max(1, ...a.days.map((d) => (two ? Math.max(d.joins, d.leaves) : d[metric])));
  const day = hover != null ? a.days[hover] : null;
  const say = (d) => (two ? `${short(d.day)} : ${d.joins} arrivée${d.joins > 1 ? "s" : ""}, ${d.leaves} départ${d.leaves > 1 ? "s" : ""}` : `${short(d.day)} : ${val(d)}`);
  return (
    <section className="bact" aria-label="Activité du serveur">
      {todoAt ? createPortal(todo, todoAt) : todo}
      <h3 className="sub">Activité des 30 derniers jours</h3>
      <p className="bactfresh" aria-live="polite">
        {fresh && <span>À jour à {fresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · se met à jour toute seule</span>}
        <button type="button" className="btn small" disabled={loading} onClick={refresh} aria-label="Actualiser l'activité">{loading ? "…" : "↻"} Actualiser</button>
      </p>
      <div className="btiles">
        {tiles.map(([i, l, n, before]) => (
          <div key={l} className="btile">
            <span className="bmuted"><span aria-hidden="true">{i}</span> {l}</span>
            <b>{nf(n)}</b>
            {delta(n, before) && <small className="bmuted">{delta(n, before)}</small>}
          </div>
        ))}
        <div className="btile">
          <span className="bmuted"><span aria-hidden="true">👥</span> Solde</span>
          <b>{net > 0 ? "+" : ""}{nf(net)}</b>
          <small className="bmuted">arrivées moins départs</small>
        </div>
      </div>
      <div className="tabs sub" role="tablist" aria-label="Courbe affichée">
        {METRICS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={metric === k} onClick={() => { setMetric(k); setHover(null); }}>{l}</button>)}
      </div>
      {two && <p className="blegend"><span><i className="bsw join" /> Arrivées (vers le haut)</span><span><i className="bsw leave" /> Départs (vers le bas)</span></p>}
      <div className={"bchart" + (two ? " two" : "")} role="group" aria-label={`${METRICS.find((m) => m[0] === metric)[1]} par jour sur 30 jours`} onMouseLeave={() => setHover(null)}>
        {a.days.map((d, k) => (
          <div key={d.day} className={"bcol" + (hover === k ? " on" : "")} onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} tabIndex={0} aria-label={say(d)}>
            <span className="bup"><i style={{ height: `${(val(d) / top) * 100}%` }} /></span>
            {two && <span className="bdown"><i style={{ height: `${(d.leaves / top) * 100}%` }} /></span>}
          </div>
        ))}
      </div>
      <div className="baxis" aria-live="polite"><small>{short(a.days[0].day)}</small><b>{day ? say(day) : <span className="bmuted">Survole ou touche une barre pour le détail · max {top}</span>}</b><small>aujourd&apos;hui</small></div>
      {two && a.counted && a.counted > a.start && <p className="hint">Les arrivées et départs sont comptés depuis le {short(a.counted)}.</p>}
      {two && !a.counted && <p className="hint">Les arrivées et départs sont comptés à partir de cette version (le bot doit être connecté, avec l&apos;intent Server Members).</p>}
      <div className="cols2">
        <div>
          <h3 className="sub">Dernières sanctions</h3>
          {a.recentCases.length === 0 ? <p className="note">Aucune sanction.</p> : (
            <ul className="brecent">{a.recentCases.map((c) => (
              <li key={c.id}><span className={`bkind k-${c.kind}`} aria-hidden="true">{kindIcon(c.kind)}</span> <b>#{c.id}</b> <Who id={c.user} names={a.names} onMember={onMember} /> <small className="bmuted">· {kindName(c.kind).toLowerCase()} · {when(c.at)}</small></li>
            ))}</ul>
          )}
          <button type="button" className="linkbtn" onClick={() => go("cases")}>Toutes les sanctions →</button>
        </div>
        <div>
          <h3 className="sub">Derniers tickets</h3>
          {a.recentTickets.length === 0 ? <p className="note">Aucun ticket.</p> : (
            <ul className="brecent">{a.recentTickets.map((x) => (
              <li key={x.thread}>{x.closed ? <span aria-label="fermé">📁</span> : <span className="bopen">ouvert</span>} <button type="button" className="linkbtn" onClick={() => setRead(x.thread)}><b>{x.subject || "Sans sujet"}</b></button> <small className="bmuted">· <Who id={x.user} names={a.names} onMember={onMember} /> · {when(x.opened)}</small></li>
            ))}</ul>
          )}
          <button type="button" className="linkbtn" onClick={() => go("tickets")}>Tous les tickets →</button>
        </div>
      </div>
      {read && <TicketView guild={guild} thread={read} onClose={() => setRead("")} onMember={onMember} />}
    </section>
  );
}

/** Each moderator's last 30 days: sanctions by kind, tickets taken, average rating. */
export function TeamPanel({ guild, onMember }) {
  const [t, setT] = useState(null);
  useEffect(() => { ask({ action: "team", guild }).then(setT); }, [guild]);
  const KINDS = ["warn", "timeout", "kick", "ban", "tempban", "note"];
  return (
    <section className="bsect" aria-label="Équipe de modération">
      <h3 className="sub">🛡️ L&apos;équipe sur 30 jours</h3>
      {!t ? <p className="note">Chargement…</p> : t.error ? <p className="err">{t.error}</p> : t.team.length === 0 ? <p className="note">Aucune sanction ni ticket pris en charge sur 30 jours.</p> : (
        <div className="tablewrap"><table className="btable bteam">
          <thead><tr><th>Modérateur</th><th>Sanctions</th>{KINDS.map((k) => <th key={k} title={kindName(k)}><span aria-hidden="true">{kindIcon(k)}</span><span className="sr-only">{kindName(k)}</span></th>)}<th>Tickets pris</th><th>Note moyenne</th></tr></thead>
          <tbody>{t.team.map((m) => (
            <tr key={m.mod}>
              <td data-l="Modérateur"><Who id={m.mod} names={t.names} onMember={onMember} /></td>
              <td data-l="Sanctions"><b>{m.total}</b></td>
              {KINDS.map((k) => <td key={k} data-l={kindName(k)}>{m.kinds[k] || <span className="bmuted">–</span>}</td>)}
              <td data-l="Tickets pris">{m.tickets || <span className="bmuted">–</span>}</td>
              <td data-l="Note moyenne">{m.rating != null ? `${String(m.rating).replace(".", ",")}/5 (${m.rated})` : <span className="bmuted">–</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="hint">Les sanctions de l&apos;AutoMod ne sont pas comptées ; les notes, elles, ne comptent pas comme sanctions.</p>
    </section>
  );
}

/** A member's file: found by id, mention or name; their state on the server, sanctions, notes, tickets; a note added. */
// the files opened lately, on this computer, per server
const RECENT_KEY = "botRecentMembers";
function readRecent(guild) {
  try { const all = JSON.parse(localStorage.getItem(RECENT_KEY) || "{}"); return Array.isArray(all[guild]) ? all[guild] : []; } catch { return []; }
}
function keepRecent(guild, one) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(RECENT_KEY) || "{}") || {}; } catch { /* broken: start again */ }
  const list = one ? [one, ...(all[guild] || []).filter((x) => x.id !== one.id)].slice(0, 8) : [];
  all[guild] = list;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(all)); } catch { /* full or blocked */ }
  return list;
}

/** A member's picture, or their initial. */
function Face({ x, size = 28 }) {
  return x.avatar ? <img src={x.avatar} alt="" width={size} height={size} className="bmface" /> : <span className="bavatar" aria-hidden="true" style={{ width: size, height: size }}>{String(x.name || "?").slice(0, 1)}</span>;
}

/** What the server knows of a member found, in small tags: running sanctions, warnings, cases, open tickets. */
function Badges({ b, timeout }) {
  const tags = [];
  if (timeout) tags.push(["warn", "🔇 exclu"]);
  if (b) {
    for (const k of b.running) if (!(k === "timeout" && timeout)) tags.push(["warn", `${kindIcon(k)} ${kindName(k).toLowerCase()} en cours`]);
    if (b.warns) tags.push(["", `⚠️ ${b.warns}`]);
    if (b.cases > b.warns) tags.push(["", `⚖️ ${b.cases - b.warns}`]);
    if (b.open) tags.push(["open", `🎫 ${b.open} ouvert${b.open > 1 ? "s" : ""}`]);
    else if (b.tickets) tags.push(["", `🎫 ${b.tickets}`]);
  }
  if (!tags.length) return <span className="bmtags"><span className="bmtag clean">dossier vide</span></span>;
  return <span className="bmtags" title="Avertissements, autres sanctions, tickets">{tags.map(([c, t]) => <span key={t} className={`bmtag ${c}`}>{t}</span>)}</span>;
}
const score = (x) => (x.timeout ? 100 : 0) + (x.badges ? x.badges.running.length * 50 + x.badges.cases * 5 + x.badges.open * 3 + x.badges.tickets : 0);

export function MembersPage({ guild, busy, call, start = "" }) {
  const [q, setQ] = useState(start);
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [asked, setAsked] = useState("");
  const [read, setRead] = useState("");
  const [watch, setWatch] = useState(null);
  const [act, setAct] = useState({ kind: "", reason: "", duration: "1h", deleteDays: 0 });
  const [sugg, setSugg] = useState(null);
  const [at, setAt] = useState(-1);
  const [recent, setRecent] = useState([]);
  const [copied, setCopied] = useState(false);
  const typed = useRef("");
  useEffect(() => { ask({ action: "watch", guild }).then(setWatch); }, [guild]);
  useEffect(() => { setRecent(readRecent(guild)); }, [guild]);
  const find = useCallback((value) => {
    const v = String(value || "").trim();
    setAsked(v);
    setData(null);
    setSugg(null);
    setAt(-1);
    setCopied(false);
    if (v) ask({ action: "member", guild, q: v }).then(setData);
  }, [guild]);
  useEffect(() => { if (start) { setQ(start); find(start); } }, [start, find]);
  // suggestions while typing: names that start like it, or the member of a case "#12"
  useEffect(() => {
    const v = q.trim();
    typed.current = v;
    if (v === asked || (v.length < 2 && !/^#\d/.test(v)) || /^\d{17,21}$/.test(v)) { setSugg(null); return undefined; }
    const t = setTimeout(() => ask({ action: "member-suggest", guild, q: v }).then((r) => { if (typed.current === v && r && !r.error) { setSugg(r); setAt(-1); } }), 300);
    return () => clearTimeout(t);
  }, [q, guild, asked]);
  // a file opened is kept among the recent ones, on this computer
  useEffect(() => {
    if (!data || !data.file) return;
    const u0 = data.user;
    setRecent(keepRecent(guild, { id: data.file.id, name: (data.member && data.member.nick) || (u0 && u0.name) || data.file.id, avatar: (u0 && u0.avatar) || "" }));
  }, [data, guild]);
  const options = sugg ? [...(sugg.byCase ? [{ id: sugg.byCase.id, name: (sugg.names && sugg.names[sugg.byCase.id]) || sugg.byCase.id, caseNo: sugg.byCase.case }] : []), ...(sugg.matches || [])] : [];
  const pick = (x) => { setQ(x.id); find(x.id); };
  const f = data && data.file;
  const u = data && data.user;
  const names = (data && data.names) || {};
  const m = data && data.member;
  const state = !data || !f ? null : m ? (m.timeout && Date.parse(m.timeout) > Date.now() ? ["🔇", `exclu jusqu'au ${when(m.timeout)}`] : ["🟢", "sur le serveur"]) : data.banned ? ["🔨", "banni"] : data.banned === false ? ["⚪", "n'est plus sur le serveur"] : null;
  const kinds = f ? Object.entries(f.counts).filter(([k]) => k !== "unban") : [];
  const plural = (n, word) => `${word}${n > 1 && !/s$/.test(word) ? "s" : ""}`;
  return (
    <div className="bpage">
      <form className="bfilters bmsearch" data-nodirty="" onSubmit={(e) => { e.preventDefault(); if (at >= 0 && options[at]) pick(options[at]); else find(q); }}>
        <div className="bmsfield">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pseudo, @mention, identifiant ou n° de sanction (#12)" aria-label="Chercher un membre"
            role="combobox" aria-expanded={options.length > 0} aria-controls="bmsugg" aria-autocomplete="list" aria-activedescendant={at >= 0 ? `bms-${at}` : undefined} autoComplete="off"
            onBlur={() => setTimeout(() => setSugg(null), 150)}
            onKeyDown={(e) => {
              if (!options.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => Math.min(options.length - 1, n + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => Math.max(-1, n - 1)); }
              else if (e.key === "Escape") { e.preventDefault(); setSugg(null); }
            }} />
          {options.length > 0 && (
            <ul id="bmsugg" className="bmsugg" role="listbox" aria-label="Suggestions">{options.map((x, k) => (
              <li key={`${x.id}-${k}`} id={`bms-${k}`} role="option" aria-selected={k === at} className={k === at ? "on" : ""} onMouseEnter={() => setAt(k)} onMouseDown={(e) => { e.preventDefault(); pick(x); }}>
                <Face x={x} />
                <span className="bmsname"><b>{x.name}</b> <small className="bmuted">{x.caseNo ? `concerné par la sanction n°${x.caseNo}` : `@${x.user}`}</small></span>
                {!x.caseNo && <Badges b={x.badges} timeout={x.timeout} />}
              </li>
            ))}</ul>
          )}
        </div>
        <button type="submit" className="btn pri" disabled={!q.trim()}>Chercher</button>
        {asked && <button type="button" className="btn" onClick={() => { setQ(""); setAsked(""); setData(null); setSugg(null); }}>Nouvelle recherche</button>}
      </form>
      {!asked && recent.length > 0 && (
        <section className="bsect">
          <h3 className="sub">🕘 Consultés récemment <button type="button" className="linkbtn bmuted bmclear" onClick={() => setRecent(keepRecent(guild, null))}>effacer</button></h3>
          <div className="bmrecent">{recent.map((x) => (
            <button key={x.id} type="button" className="bmchip" onClick={() => pick(x)} title={x.id}><Face x={x} size={22} /> {x.name}</button>
          ))}</div>
        </section>
      )}
      {!asked && watch && !watch.error && (
        <section className="bsect">
          <h3 className="sub">👀 Membres à surveiller <small className="bmuted">{watch.watch.length}</small></h3>
          <p className="hint">Ceux qui ont une sanction en cours (exclusion, bannissement) ou au moins 2 avertissements sur les 30 derniers jours.</p>
          {watch.watch.length === 0 ? <p className="note">Personne pour le moment.</p> : (
            <ul className="bwatch">{watch.watch.map((x) => (
              <li key={x.user}>
                <button type="button" className="bmatch" onClick={() => { setQ(x.user); find(x.user); }}>
                  <span className="bavatar" aria-hidden="true">{((watch.names && watch.names[x.user]) || "?").slice(0, 1)}</span>
                  <span>
                    <b>{(watch.names && watch.names[x.user]) || x.user}</b>
                    <small className="bmuted">{[
                      x.running.length ? `${x.running.map((k) => kindName(k).toLowerCase()).join(", ")} en cours` : "",
                      x.warns30 ? `${x.warns30} avertissement${x.warns30 > 1 ? "s" : ""} en 30 jours` : "",
                      `dernière sanction le ${when(x.last)}`,
                    ].filter(Boolean).join(" · ")}</small>
                  </span>
                </button>
              </li>
            ))}</ul>
          )}
        </section>
      )}
      {!asked && <p className="hint">La fiche d&apos;un membre réunit son état sur le serveur, ses sanctions, les notes de l&apos;équipe et ses tickets. Le nom d&apos;un membre dans l&apos;accueil, les sanctions et les tickets ouvre aussi sa fiche.</p>}
      {asked && !data && <p className="note">Recherche…</p>}
      {data && data.error && <p className="err">{data.error}</p>}
      {data && data.matches && (data.matches.length === 0 ? <p className="note">{data.hint || "Aucun membre trouvé avec ce nom."}</p> : (
        <>
          <p className="hint">{data.matches.length} membres trouvés : choisis-en un. Ceux qui ont déjà un dossier sont en haut.</p>
          <ul className="bmatches">{[...data.matches].sort((x, y) => score(y) - score(x)).map((x) => (
            <li key={x.id}><button type="button" className="bmatch" onClick={() => pick(x)}>
              <Face x={x} size={32} />
              <span><b>{x.name}</b> <small className="bmuted">@{x.user}{x.joined ? ` · arrivé le ${longDate(x.joined)}` : ""}</small></span>
              <Badges b={x.badges} timeout={x.timeout} />
            </button></li>
          ))}</ul>
        </>
      ))}
      {f && (
        <article className="bmember">
          <header className="bmemhead">
            {u && u.avatar ? <img src={u.avatar} alt="" width={56} height={56} /> : <span className="bavatar big" aria-hidden="true">{((u && u.name) || "?").slice(0, 1)}</span>}
            <div>
              <h3>{(m && m.nick) || (u && u.name) || f.id}</h3>
              {(u || (m && m.nick)) && <small className="bmuted">{u ? `@${u.user} · ` : ""}{f.id}</small>}
              {state && <p className="bmstate"><span aria-hidden="true">{state[0]}</span> {state[1]}</p>}
            </div>
            <div className="bmtools">
              <button type="button" className="btn small" onClick={() => { navigator.clipboard.writeText(f.id).then(() => setCopied(true), () => {}); }}>{copied ? "✔ Copié" : "📋 Copier l'identifiant"}</button>
              <a className="btn small" href={`https://discord.com/users/${f.id}`} target="_blank" rel="noopener noreferrer">Profil Discord ↗</a>
            </div>
          </header>
          <dl className="bmfacts">
            <dt>Compte créé</dt><dd>{data.created ? longDate(data.created) : "–"}</dd>
            {m && m.joined && <><dt>Sur le serveur depuis</dt><dd>{longDate(m.joined)}</dd></>}
            {m && <><dt>Rôles</dt><dd>{m.roles.length}</dd></>}
            <dt>Équipes suivies</dt><dd>{f.follows.length ? f.follows.map((x) => x.name).join(", ") : "aucune"}</dd>
          </dl>
          <div className="bstats">
            {kinds.length === 0 ? <span><b>0</b> sanction</span> : kinds.map(([k, n]) => <span key={k}><b>{n}</b> {plural(n, kindName(k).toLowerCase())}</span>)}
            <span><b>{f.tickets.length}</b> {plural(f.tickets.length, "ticket")}</span>
          </div>
          {f.active.length > 0 && <p className="note warn">En cours : {f.active.map((r) => `${kindName(r.kind).toLowerCase()} (cas #${r.id}${r.until ? `, jusqu'au ${when(r.until)}` : ""})`).join(", ")}</p>}
          <h4 className="sub">Dossier</h4>
          {f.sanctions.length === 0 ? <p className="note">Rien dans son dossier.</p> : (
            <ol className="btimeline">{f.sanctions.map((r) => (
              <li key={r.id}>
                <span className={`bkind k-${r.kind}`}>{kindIcon(r.kind)} {kindName(r.kind)}</span>
                <span className="breason">{r.reason || <i className="bmuted">sans raison</i>}</span>
                <small className="bmuted">#{r.id} · {when(r.at)} · par <Who id={r.mod} names={names} />{r.active && r.kind !== "warn" ? " · en cours" : ""}</small>
              </li>
            ))}</ol>
          )}
          {/* acting needs the member on the server: not for one banned or gone (when Discord could tell) */}
          {(m || data.banned == null) && <section className="bmact" aria-label="Sanctionner">
            <h4 className="sub">Agir</h4>
            <div className="row">
              <button type="button" className={"btn small" + (act.kind === "warn" ? " pri" : "")} onClick={() => setAct({ ...act, kind: act.kind === "warn" ? "" : "warn" })}>⚠️ Avertir</button>
              <button type="button" className={"btn small" + (act.kind === "timeout" ? " pri" : "")} onClick={() => setAct({ ...act, kind: act.kind === "timeout" ? "" : "timeout" })}>🔇 Exclure</button>
              <button type="button" className={"btn small" + (act.kind === "kick" ? " pri" : "")} onClick={() => setAct({ ...act, kind: act.kind === "kick" ? "" : "kick" })}>👢 Expulser</button>
              <button type="button" className={"btn small danger" + (act.kind === "ban" ? " pri" : "")} onClick={() => setAct({ ...act, kind: act.kind === "ban" ? "" : "ban" })}>🔨 Bannir</button>
              {m && m.timeout && Date.parse(m.timeout) > Date.now() && (
                <button type="button" className="btn small" disabled={busy} onClick={() => { if (window.confirm("Lever l'exclusion de ce membre ? C'est fait tout de suite sur Discord.")) call({ action: "member-sanction", guild, id: f.id, kind: "untimeout" }, () => find(f.id)); }}>🔊 Lever l&apos;exclusion</button>
              )}
            </div>
            {act.kind && (
              <form className="bmactform" data-nodirty="" onSubmit={(e) => {
                e.preventDefault();
                const label = { warn: "Avertir ce membre", timeout: `Exclure ce membre (${act.duration})`, kick: "Expulser ce membre du serveur", ban: "Bannir ce membre du serveur" }[act.kind];
                if (window.confirm(`${label} ? C'est fait tout de suite sur Discord, et le membre reçoit un message privé.`)) call({ action: "member-sanction", guild, id: f.id, kind: act.kind, reason: act.reason, duration: act.duration, deleteDays: act.deleteDays }, () => { setAct({ kind: "", reason: "", duration: "1h", deleteDays: 0 }); find(f.id); });
              }}>
                {act.kind === "timeout" && (
                  <label className="f">Durée
                    <select value={act.duration} onChange={(e) => setAct({ ...act, duration: e.target.value })}>
                      {[["10m", "10 minutes"], ["1h", "1 heure"], ["6h", "6 heures"], ["1d", "1 jour"], ["3d", "3 jours"], ["1w", "1 semaine"], ["28d", "28 jours"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                )}
                {act.kind === "ban" && (
                  <label className="f">Effacer ses messages
                    <select value={act.deleteDays} onChange={(e) => setAct({ ...act, deleteDays: Number(e.target.value) })}>
                      <option value={0}>Ne rien effacer</option><option value={1}>Ceux des dernières 24 heures</option><option value={7}>Ceux des 7 derniers jours</option>
                    </select>
                  </label>
                )}
                <label className="f">Raison{act.kind === "timeout" ? " (facultative)" : ""}
                  <input type="text" maxLength={300} value={act.reason} onChange={(e) => setAct({ ...act, reason: e.target.value })} list="bmreasons" />
                </label>
                <datalist id="bmreasons">{(data.reasons || []).map((r) => <option key={r} value={r} />)}</datalist>
                <div className="row">
                  <button type="submit" className="btn danger" disabled={busy || (act.kind !== "timeout" && !act.reason.trim())}>{{ warn: "Avertir", timeout: "Exclure", kick: "Expulser", ban: "Bannir" }[act.kind]}</button>
                  <button type="button" className="btn" onClick={() => setAct({ ...act, kind: "" })}>Annuler</button>
                </div>
                <small className="bmuted">Comme avec les commandes : message privé au membre{act.kind === "warn" ? ", sanction automatique si le nombre d'avertissements le prévoit" : act.kind === "ban" || act.kind === "kick" ? " (envoyé avant, tant que le bot peut encore lui écrire)" : ""}, journal du bot et salon du journal. Le journal d&apos;audit de Discord dit que ça vient du site.</small>
              </form>
            )}
          </section>}
          <form className="bnote" data-nodirty="" onSubmit={(e) => { e.preventDefault(); call({ action: "member-note", guild, id: f.id, text: note }, () => { setNote(""); find(f.id); }); }}>
            <label className="f">Ajouter une note pour l&apos;équipe
              <textarea rows={2} maxLength={380} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <small className="bmuted">Visible dans /modlogs et dans cette fiche, jamais envoyée au membre.</small>
            <button type="submit" className="btn" disabled={busy || !note.trim()}>Ajouter la note</button>
          </form>
          <h4 className="sub">Tickets</h4>
          {f.tickets.length === 0 ? <p className="note">Aucun ticket.</p> : (
            <ul className="brecent">{f.tickets.map((x) => <li key={x.thread}>{x.closed ? <span aria-label="fermé">📁</span> : <span className="bopen">ouvert</span>} <button type="button" className="linkbtn" onClick={() => setRead(x.thread)}><b>{x.subject || "Sans sujet"}</b></button> <small className="bmuted">· {when(x.opened)}{x.category ? ` · ${x.category}` : ""}{x.rating ? ` · ${"★".repeat(Number(x.rating))}` : ""}</small></li>)}</ul>
          )}
        </article>
      )}
      {read && <TicketView guild={guild} thread={read} onClose={() => setRead("")} />}
    </div>
  );
}
