"use client";

// The bot dashboard's pages beyond the modules (components/BotPanel.jsx): every command with its rules, the sanctions'
// table, the tickets with their transcripts, the log with filters. Written in French, as the server's editors read it.
import { useCallback, useEffect, useState } from "react";
import { MultiPicker } from "./BotDash.jsx";
import { TicketView } from "./BotTicket.jsx";

/** A call to the bot's API that only reads: its JSON, or { error }. */
export async function ask(body) {
  try {
    const r = await fetch("/api/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || `HTTP ${r.status}` };
  } catch { return { error: "Erreur réseau." }; }
}

const when = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const useDebounced = (v, ms = 300) => { const [x, setX] = useState(v); useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]); return x; };

/** A member's name that opens their file. */
export function Who({ id, names, onMember }) {
  const label = id === "auto" ? "automatique" : id === "editor" ? "éditeur du site" : (names && names[id]) || id;
  if (!onMember || !/^\d{5,25}$/.test(String(id))) return <>{label}</>;
  return <button type="button" className="linkbtn" onClick={(e) => { e.stopPropagation(); onMember(id); }} title="Ouvrir sa fiche">{label}</button>;
}

// ---- commands ----

const EMPTY_RULE = { allowRoles: [], denyRoles: [], allowChannels: [], denyChannels: [], cooldown: 0, visibility: "default" };
const VIS = [["default", "Comme prévu par la commande"], ["public", "Visible par tous"], ["private", "Seulement par l'auteur"]];

/** Every command by category: on or off, and who may use it where (roles, channels), how often, who sees the answer. */
export function CommandsPage({ d, settings, busy, call, onSaved }) {
  const [disabled, setDisabled] = useState(settings.disabled || []);
  const [rules, setRules] = useState((d.server && d.server.commandRules) || {});
  const [saved, setSaved] = useState(JSON.stringify([settings.disabled || [], (d.server && d.server.commandRules) || {}]));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(-1);
  const [open, setOpen] = useState("");
  const [order, setOrder] = useState("cat");
  const use = (n) => (d.cmdUse && d.cmdUse[n]) || 0;
  const dirty = JSON.stringify([disabled, rules]) !== saved;
  const rule = (n) => ({ ...EMPTY_RULE, ...(rules[n] || {}) });
  const setRule = (n, patch) => setRules((r) => ({ ...r, [n]: { ...EMPTY_RULE, ...(r[n] || {}), ...patch } }));
  const hasRule = (n) => { const r = rules[n]; return !!r && (r.allowRoles.length || r.denyRoles.length || r.allowChannels.length || r.denyChannels.length || r.cooldown || r.visibility !== "default"); };
  const query = q.trim().toLowerCase();
  const cats = (d.commandCats || []).map((g, k) => ({ ...g, k, list: g.list.filter((c) => !query || `${c.name} ${c.description} ${c.subs.map((x) => x.name).join(" ")}`.toLowerCase().includes(query)) })).filter((g) => (cat < 0 || g.k === cat) && g.list.length)
    .map((g) => (order === "use" ? { ...g, list: [...g.list].sort((x, y) => use(y.name) - use(x.name)) } : order === "unused" ? { ...g, list: g.list.filter((c) => !use(c.name)) } : g)).filter((g) => g.list.length);
  const total = (d.commandCats || []).reduce((n, g) => n + g.list.length, 0);
  const save = () => call({ action: "commands", disabled, rules }, (j) => { setSaved(JSON.stringify([disabled, rules])); onSaved && onSaved(j); });
  return (
    <div className="bpage" data-unsaved-unit="">
      <div className="bfilters" data-nodirty="">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une commande" aria-label="Chercher une commande" />
        <select value={cat} onChange={(e) => setCat(Number(e.target.value))} aria-label="Catégorie">
          <option value={-1}>Toutes les catégories</option>
          {(d.commandCats || []).map((g, k) => <option key={k} value={k}>{g.label}</option>)}
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value)} aria-label="Ordre">
          <option value="cat">Ordre des catégories</option><option value="use">Les plus utilisées d'abord</option><option value="unused">Jamais utilisées (30 j)</option>
        </select>
        <span className="bmuted">{total - disabled.filter((n) => (d.commandCats || []).some((g) => g.list.some((c) => c.name === n))).length}/{total} activées</span>
      </div>
      <p className="hint">Le nombre à droite de chaque commande compte ses utilisations sur les 30 derniers jours. Chaque commande peut être réservée à des rôles ou des salons, avoir un délai entre deux utilisations, et répondre à tous ou seulement à son auteur. Les membres qui peuvent « Gérer le serveur » passent toutes ces règles. Les permissions de Discord (Paramètres du serveur → Intégrations) restent valables en plus.</p>
      {cats.map((g) => (
        <section key={g.k} className="bsect">
          <h3 className="sub">{g.label} <small className="bmuted">{g.list.length}</small></h3>
          <ul className="bcmds">
            {g.list.map((c) => {
              const on = !disabled.includes(c.name);
              const r = rule(c.name);
              return (
                <li key={c.name} className={"bcmd" + (on ? "" : " off") + (open === c.name ? " open" : "")}>
                  <div className="bcmdrow">
                    <label className={"btoggle mini" + (on ? " on" : "")}>
                      <input type="checkbox" role="switch" checked={on} onChange={(e) => setDisabled((x) => (e.target.checked ? x.filter((n) => n !== c.name) : [...x, c.name]))} aria-label={`/${c.name} ${on ? "activée" : "désactivée"}`} />
                      <span className="btsw" aria-hidden="true" />
                    </label>
                    <div className="bcmdtext">
                      <b>{c.type === 1 ? "/" : ""}{c.name}</b>{c.subs.length > 0 && <small className="bsubs"> {c.subs.map((x) => x.name).join(" · ")}</small>}
                      <small>{c.description || (c.type === 2 ? "Clic droit sur un membre → Applications" : "Clic droit sur un message → Applications")}</small>
                    </div>
                    <small className={"buse" + (use(c.name) ? "" : " none")} title="Utilisations sur les 30 derniers jours">{use(c.name) ? `${use(c.name)} utilisation${use(c.name) > 1 ? "s" : ""}` : "pas utilisée"}</small>
                    {hasRule(c.name) && <span className="bbadge">règles</span>}
                    <button type="button" className="btn small" aria-expanded={open === c.name} onClick={() => setOpen(open === c.name ? "" : c.name)}>{open === c.name ? "Fermer" : "Règles"}</button>
                  </div>
                  {open === c.name && (
                    <div className="bcmdrules">
                      <MultiPicker label="Réservée à ces rôles" items={d.roles || []} value={r.allowRoles} prefix="@" onChange={(v) => setRule(c.name, { allowRoles: v })} />
                      <MultiPicker label="Interdite à ces rôles" items={d.roles || []} value={r.denyRoles} prefix="@" onChange={(v) => setRule(c.name, { denyRoles: v })} />
                      <MultiPicker label="Seulement dans ces salons" items={d.channels || []} value={r.allowChannels} prefix="#" onChange={(v) => setRule(c.name, { allowChannels: v })} />
                      <MultiPicker label="Interdite dans ces salons" items={d.channels || []} value={r.denyChannels} prefix="#" onChange={(v) => setRule(c.name, { denyChannels: v })} />
                      <label className="f">Délai entre deux utilisations par membre <span><input type="number" min={0} max={86400} value={r.cooldown} onChange={(e) => setRule(c.name, { cooldown: Number(e.target.value) })} /> secondes <small>(0 : aucun)</small></span></label>
                      <label className="f">Réponse
                        <select value={r.visibility} onChange={(e) => setRule(c.name, { visibility: e.target.value })}>{VIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      </label>
                      {hasRule(c.name) && <button type="button" className="btn small" onClick={() => setRules((x) => { const { [c.name]: _gone, ...rest } = x; return rest; })}>Enlever les règles de cette commande</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!cats.length && <p className="note">Aucune commande ne correspond.</p>}
      <details className="bsect">
        <summary><b>Commandes renommées ou regroupées</b></summary>
        <div className="tablewrap"><table className="btable">
          <thead><tr><th>Avant</th><th>Maintenant</th></tr></thead>
          <tbody>{Object.entries(d.oldToNew || {}).map(([a, b]) => <tr key={a}><td><code>/{a}</code></td><td><code>{b}</code></td></tr>)}</tbody>
        </table></div>
      </details>
      <div className={"bsavebar" + (dirty ? " dirty" : "")}>
        <span>{dirty ? "Modifications pas encore enregistrées" : "Tout est enregistré"}</span>
        {dirty && <button type="button" className="btn" disabled={busy} onClick={() => { const [a, b] = JSON.parse(saved); setDisabled(a); setRules(b); }}>Annuler les modifications</button>}
        <button type="button" className="btn pri" disabled={busy || !dirty} onClick={save}>Enregistrer les commandes</button>
      </div>
    </div>
  );
}

// ---- sanctions ----

export const KIND = { warn: ["⚠️", "Avertissement"], timeout: ["🔇", "Exclusion"], kick: ["👢", "Expulsion"], ban: ["🔨", "Bannissement"], tempban: ["⏳", "Ban temporaire"], unban: ["✅", "Débannissement"], note: ["📝", "Note"] };
const REVOKE = { warn: "Retirer l'avertissement", ban: "Débannir", tempban: "Débannir", timeout: "Lever l'exclusion" };

/** The sanctions' table: search by member, moderator, kind, date; a case's detail, its reason changed, revoked. */
export function CasesPage({ guild, busy, call, onMember }) {
  const [f, setF] = useState({ q: "", kind: "", from: "", to: "" });
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [reason, setReason] = useState("");
  const q = useDebounced(f.q);
  const load = useCallback(() => ask({ action: "cases", guild, q, kind: f.kind, from: f.from, to: f.to }).then(setData), [guild, q, f.kind, f.from, f.to]);
  useEffect(() => { load(); }, [load]);
  const names = (data && data.names) || {};
  const who = (id) => (id === "auto" ? "automatique" : id === "editor" ? "éditeur du site" : names[id] || id);
  const cur = sel && data && data.cases ? data.cases.find((c) => c.id === sel) : null;
  const state = (c) => (c.kind === "warn" ? "dans le dossier" : c.active ? "en cours" : c.done ? "levé" : c.until ? "fini" : "–");
  return (
    <div className="bpage">
      <div className="bfilters" data-nodirty="">
        <input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Membre, modérateur, raison ou #numéro" aria-label="Chercher une sanction" />
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Type"><option value="">Tous les types</option>{Object.entries(KIND).map(([k, [i, l]]) => <option key={k} value={k}>{i} {l}</option>)}</select>
        <label className="bdate">Du <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="bdate">au <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      {!data ? <p className="note">Chargement…</p> : data.error ? <p className="err">{data.error}</p> : data.cases.length === 0 ? <p className="note">Aucune sanction ne correspond.</p> : (
        <div className="tablewrap"><table className="btable bcases">
          <thead><tr><th>Cas</th><th>Type</th><th>Membre</th><th>Modérateur</th><th>Raison</th><th>Date</th><th>État</th></tr></thead>
          <tbody>{data.cases.map((c) => (
            <tr key={c.id} className={sel === c.id ? "sel" : ""} onClick={() => { setSel(c.id); setReason(c.reason.replace(/ \(modifiée par [^)]*\)$/, "")); }} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") { setSel(c.id); setReason(c.reason); } }}>
              <td data-l="Cas"><b>#{c.id}</b></td>
              <td data-l="Type"><span className={`bkind k-${c.kind}`}>{(KIND[c.kind] || ["", c.kind])[0]} {(KIND[c.kind] || ["", c.kind])[1]}</span></td>
              <td data-l="Membre"><Who id={c.user} names={names} onMember={onMember} /></td>
              <td data-l="Modérateur">{who(c.mod)}</td>
              <td data-l="Raison" className="breason">{c.reason || <i className="bmuted">sans raison</i>}</td>
              <td data-l="Date">{when(c.at)}</td>
              <td data-l="État">{state(c)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {cur && (
        <aside className="bdetail" aria-label={`Cas #${cur.id}`}>
          <header><h3 className="sub">Cas #{cur.id} · {(KIND[cur.kind] || ["", cur.kind]).join(" ")}</h3><button type="button" className="btn small" onClick={() => setSel(null)}>Fermer</button></header>
          <dl>
            <dt>Membre</dt><dd><Who id={cur.user} names={names} onMember={onMember} /> <small className="bmuted">{cur.user}</small></dd>
            <dt>Modérateur</dt><dd>{who(cur.mod)}</dd>
            <dt>Date</dt><dd>{when(cur.at)}</dd>
            {cur.until && <><dt>Jusqu&apos;à</dt><dd>{when(cur.until)}</dd></>}
            <dt>État</dt><dd>{state(cur)}</dd>
          </dl>
          <label className="f">Raison<textarea rows={2} maxLength={380} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="row">
            <button type="button" className="btn" disabled={busy || !reason.trim()} onClick={() => call({ action: "case-reason", guild, id: cur.id, reason }, load)}>Enregistrer la raison</button>
            {REVOKE[cur.kind] && (cur.kind === "warn" || cur.active) && (
              <button type="button" className="btn danger" disabled={busy} onClick={() => { if (window.confirm(`${REVOKE[cur.kind]} (cas #${cur.id}) ? C'est fait tout de suite sur Discord.`)) call({ action: "case-revoke", guild, id: cur.id }, () => { setSel(null); load(); }); }}>{REVOKE[cur.kind]}</button>
            )}
          </div>
          <p className="hint">La raison de la révocation va dans le journal d&apos;audit de Discord, le journal du bot et le salon du journal.</p>
        </aside>
      )}
    </div>
  );
}

// ---- tickets ----

/** The tickets: open or closed, subject, author, who took it, rating; a transcript read here; the stats. */
export function TicketsPage({ guild, onMember }) {
  const [f, setF] = useState({ state: "", q: "" });
  const [data, setData] = useState(null);
  const [read, setRead] = useState("");
  const q = useDebounced(f.q);
  const [stamp, setStamp] = useState(0);
  useEffect(() => { ask({ action: "tickets", guild, state: f.state, q }).then(setData); }, [guild, f.state, q, stamp]);
  const names = (data && data.names) || {};
  const st = data && data.stats;
  return (
    <div className="bpage">
      {st && (
        <div className="bstats">
          <span><b>{st.open}</b> en cours</span><span><b>{st.opened30}</b> ouverts (30 j)</span><span><b>{st.closed30}</b> fermés (30 j)</span>
          <span><b>{st.firstReplyMin != null ? `${st.firstReplyMin} min` : "–"}</b> première réponse</span>
          <span><b>{st.rating != null ? `${st.rating}/5` : "–"}</b> note moyenne{st.ratings ? ` (${st.ratings})` : ""}</span>
        </div>
      )}
      <div className="bfilters" data-nodirty="">
        <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} aria-label="État"><option value="">Tous</option><option value="open">Ouverts</option><option value="closed">Fermés</option></select>
        <input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Sujet, auteur, catégorie" aria-label="Chercher un ticket" />
      </div>
      {!data ? <p className="note">Chargement…</p> : data.error ? <p className="err">{data.error}</p> : data.tickets.length === 0 ? <p className="note">Aucun ticket.</p> : (<>
        <p className="hint">Clique sur un ticket pour le lire ici : ses messages, la personne qui l&apos;a pris en charge, la raison de fermeture et la note.</p>
        <div className="tablewrap"><table className="btable">
          <thead><tr><th>Sujet</th><th>Auteur</th><th>Catégorie</th><th>Ouvert</th><th>État</th><th>Pris en charge par</th><th>Note</th><th /></tr></thead>
          <tbody>{data.tickets.map((t) => (
            <tr key={t.thread} className={"bclick" + (read === t.thread ? " sel" : "")} onClick={() => setRead(t.thread)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setRead(t.thread); }} title="Voir le ticket">
              <td data-l="Sujet"><b>{t.subject || "Sans sujet"}</b>{t.priority && <small className="bbadge">{t.priority}</small>}</td>
              <td data-l="Auteur"><Who id={t.user} names={names} onMember={onMember} /></td>
              <td data-l="Catégorie">{t.category || "–"}</td>
              <td data-l="Ouvert">{when(t.opened)}</td>
              <td data-l="État">{t.closed ? <>fermé {when(t.closed)}{t.reason ? <small className="bmuted"> · {t.reason}</small> : null}</> : <span className="bopen">ouvert</span>}</td>
              <td data-l="Pris en charge">{t.claimed ? names[t.claimed] || t.claimed : "–"}</td>
              <td data-l="Note">{t.rating ? "★".repeat(Number(t.rating)) + "☆".repeat(5 - Number(t.rating)) : "–"}</td>
              <td><button type="button" className="btn small" onClick={(e) => { e.stopPropagation(); setRead(t.thread); }}>Voir le ticket</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </>)}
      {read && <TicketView guild={guild} thread={read} onClose={() => setRead("")} onMember={onMember} onChanged={() => setStamp((n) => n + 1)} />}
    </div>
  );
}

// ---- log ----

/** The bot's latest events, with filters. */
export function LogPage() {
  const [f, setF] = useState({ kind: "", errors: false, q: "" });
  const [data, setData] = useState(null);
  const q = useDebounced(f.q);
  useEffect(() => { ask({ action: "log", kind: f.kind, errors: f.errors, q }).then(setData); }, [f.kind, f.errors, q]);
  return (
    <div className="bpage">
      <div className="bfilters" data-nodirty="">
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Type d'événement"><option value="">Tous les événements</option>{((data && data.kinds) || []).map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Chercher dans le journal" aria-label="Chercher dans le journal" />
        <label className="chk"><input type="checkbox" checked={f.errors} onChange={(e) => setF({ ...f, errors: e.target.checked })} /> Seulement les erreurs</label>
      </div>
      {!data ? <p className="note">Chargement…</p> : data.error ? <p className="err">{data.error}</p> : data.log.length === 0 ? <p className="note">Rien dans le journal.</p> : (
        <ul className="blog">{data.log.map((x, k) => <li key={k} className={x.ok ? "" : "bad"}><small>{when(x.at)}</small><span className="bbadge">{x.kind}</span><span>{x.ok ? "" : "⚠️ "}{x.text}</span></li>)}</ul>
      )}
    </div>
  );
}
