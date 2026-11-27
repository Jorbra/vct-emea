"use client";

// The bot dashboard's activity (the home) and members' files (components/BotPanel.jsx). Written in French, as the
// server's editors read it.
import { useCallback, useEffect, useState } from "react";
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
  useEffect(() => { ask({ action: "activity", guild }).then(setA); }, [guild]);
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

/** A member's file: found by id, mention or name; their state on the server, sanctions, notes, tickets; a note added. */
export function MembersPage({ guild, busy, call, start = "" }) {
  const [q, setQ] = useState(start);
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [asked, setAsked] = useState("");
  const [read, setRead] = useState("");
  const [watch, setWatch] = useState(null);
  const [act, setAct] = useState({ kind: "", reason: "", duration: "1h" });
  useEffect(() => { ask({ action: "watch", guild }).then(setWatch); }, [guild]);
  const find = useCallback((value) => {
    const v = String(value || "").trim();
    setAsked(v);
    setData(null);
    if (v) ask({ action: "member", guild, q: v }).then(setData);
  }, [guild]);
  useEffect(() => { if (start) { setQ(start); find(start); } }, [start, find]);
  const f = data && data.file;
  const u = data && data.user;
  const names = (data && data.names) || {};
  const m = data && data.member;
  const state = !data || !f ? null : m ? (m.timeout && Date.parse(m.timeout) > Date.now() ? ["🔇", `exclu jusqu'au ${when(m.timeout)}`] : ["🟢", "sur le serveur"]) : data.banned ? ["🔨", "banni"] : data.banned === false ? ["⚪", "n'est plus sur le serveur"] : null;
  const kinds = f ? Object.entries(f.counts).filter(([k]) => k !== "unban") : [];
  const plural = (n, word) => `${word}${n > 1 && !/s$/.test(word) ? "s" : ""}`;
  return (
    <div className="bpage">
      <form className="bfilters" data-nodirty="" onSubmit={(e) => { e.preventDefault(); find(q); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pseudo, @mention ou identifiant" aria-label="Chercher un membre" />
        <button type="submit" className="btn pri" disabled={!q.trim()}>Chercher</button>
      </form>
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
          <p className="hint">{data.matches.length} membres trouvés : choisis-en un.</p>
          <ul className="bmatches">{data.matches.map((x) => (
            <li key={x.id}><button type="button" className="bmatch" onClick={() => { setQ(x.id); find(x.id); }}>
              {x.avatar ? <img src={x.avatar} alt="" width={32} height={32} /> : <span className="bavatar" aria-hidden="true">{x.name.slice(0, 1)}</span>}
              <span><b>{x.name}</b> <small className="bmuted">@{x.user}</small></span>
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
              {m && m.timeout && Date.parse(m.timeout) > Date.now() && (
                <button type="button" className="btn small" disabled={busy} onClick={() => { if (window.confirm("Lever l'exclusion de ce membre ? C'est fait tout de suite sur Discord.")) call({ action: "member-sanction", guild, id: f.id, kind: "untimeout" }, () => find(f.id)); }}>🔊 Lever l&apos;exclusion</button>
              )}
            </div>
            {act.kind && (
              <form className="bmactform" data-nodirty="" onSubmit={(e) => {
                e.preventDefault();
                const label = act.kind === "warn" ? "Avertir ce membre" : `Exclure ce membre (${act.duration})`;
                if (window.confirm(`${label} ? C'est fait tout de suite sur Discord, et le membre reçoit un message privé.`)) call({ action: "member-sanction", guild, id: f.id, kind: act.kind, reason: act.reason, duration: act.duration }, () => { setAct({ kind: "", reason: "", duration: "1h" }); find(f.id); });
              }}>
                {act.kind === "timeout" && (
                  <label className="f">Durée
                    <select value={act.duration} onChange={(e) => setAct({ ...act, duration: e.target.value })}>
                      {[["10m", "10 minutes"], ["1h", "1 heure"], ["6h", "6 heures"], ["1d", "1 jour"], ["3d", "3 jours"], ["1w", "1 semaine"], ["28d", "28 jours"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                )}
                <label className="f">Raison{act.kind === "warn" ? "" : " (facultative)"}
                  <input type="text" maxLength={300} value={act.reason} onChange={(e) => setAct({ ...act, reason: e.target.value })} list="bmreasons" />
                </label>
                <datalist id="bmreasons">{(data.reasons || []).map((r) => <option key={r} value={r} />)}</datalist>
                <div className="row">
                  <button type="submit" className="btn danger" disabled={busy || (act.kind === "warn" && !act.reason.trim())}>{act.kind === "warn" ? "Avertir" : "Exclure"}</button>
                  <button type="button" className="btn" onClick={() => setAct({ ...act, kind: "" })}>Annuler</button>
                </div>
                <small className="bmuted">Comme avec les commandes : message privé au membre{act.kind === "warn" ? ", sanction automatique si le nombre d'avertissements le prévoit" : ""}, journal du bot et salon du journal. Le journal d&apos;audit de Discord dit que ça vient du site.</small>
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
