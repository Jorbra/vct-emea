"use client";

// The bot dashboard's "Accès à l'éditeur" (lib/staffaccess.js): the Discord roles that open the site's editor with
// /editeur, and who signed in that way. Only the main account changes them.
import { useEffect, useState } from "react";
import { ask } from "./BotPages.jsx";

const when = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const LEVEL = { editor: ["✏️", "Éditeur", "le site et le bot, comme un compte éditeur"], moderator: ["🛡️", "Modérateur", "le tableau de bord du bot seulement : membres, sanctions, tickets, journal"] };

function RolePick({ roles, value, other, onChange, disabled }) {
  const [add, setAdd] = useState("");
  const byId = Object.fromEntries(roles.map((r) => [r.id, r]));
  return (
    <div className="baccroles">
      {value.length === 0 && <span className="bmuted">Aucun rôle</span>}
      {value.map((id) => (
        <span key={id} className="baccrole" style={byId[id] && byId[id].color ? { borderColor: `#${Number(byId[id].color).toString(16).padStart(6, "0")}` } : undefined}>
          @{byId[id] ? byId[id].name : id}
          {!disabled && <button type="button" aria-label={`Enlever @${byId[id] ? byId[id].name : id}`} onClick={() => onChange(value.filter((x) => x !== id))}>×</button>}
        </span>
      ))}
      {!disabled && (
        <select value={add} aria-label="Ajouter un rôle" onChange={(e) => { const v = e.target.value; setAdd(""); if (v) onChange([...value, v]); }}>
          <option value="">+ Ajouter un rôle…</option>
          {roles.filter((r) => !value.includes(r.id) && !other.includes(r.id)).map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
        </select>
      )}
    </div>
  );
}

export function EditorAccessRoles({ roles = [], busy, call }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  useEffect(() => { ask({ action: "access" }).then((j) => { setData(j); if (j && j.access) setDraft(j.access); }); }, []);
  if (!data) return null;
  if (data.error) return <p className="err">{data.error}</p>;
  const main = data.main;
  const changed = draft && JSON.stringify(draft) !== JSON.stringify(data.access);
  return (
    <section className="bsect baccess">
      <h3 className="sub">🔑 Accès à l&apos;éditeur depuis Discord</h3>
      <p className="hint">
        Les membres qui ont un de ces rôles tapent <code>/editeur</code> sur le serveur : le bot leur donne, à eux seuls, un lien qui ouvre l&apos;éditeur (une fois, pendant 10 minutes).
        Pas de mot de passe à donner. Leur accès est vérifié toutes les 10 minutes : s&apos;ils perdent le rôle, ils sont déconnectés.
      </p>
      {!main && <p className="note">Seul le compte principal du site peut changer ces rôles.</p>}
      {Object.entries(LEVEL).map(([k, [icon, name, text]]) => (
        <div key={k} className="bacclevel">
          <p><b><span aria-hidden="true">{icon}</span> {name}</b> <small className="bmuted">· {text}</small></p>
          <RolePick roles={roles} value={(draft && draft[k]) || []} other={(draft && draft[k === "editor" ? "moderator" : "editor"]) || []} disabled={!main} onChange={(v) => setDraft({ ...draft, [k]: v })} />
        </div>
      ))}
      {main && (
        <div className="row">
          <button type="button" className="btn pri" disabled={busy || !changed} onClick={() => call({ action: "access-save", ...draft }, (j) => { setData({ ...data, access: j.access, staff: j.staff }); setDraft(j.access); })}>Enregistrer les rôles</button>
          {changed && <button type="button" className="btn" onClick={() => setDraft(data.access)}>Annuler</button>}
        </div>
      )}
      <small className="bmuted">Après la mise en ligne, clique sur « Enregistrer les commandes » en haut si <code>/editeur</code> n&apos;apparaît pas encore sur Discord. Les rôles gérés par une appli et @everyone ne peuvent pas être choisis.</small>
      <h4 className="sub">Connectés depuis Discord <small className="bmuted">{data.staff.length}</small></h4>
      {data.staff.length === 0 ? <p className="note">Personne pour le moment.</p> : (
        <ul className="baccstaff">{data.staff.map((x) => (
          <li key={x.id}>
            <span aria-hidden="true">{(LEVEL[x.level] || ["•"])[0]}</span>
            <b>{x.name || x.id}</b>
            <small className="bmuted">{(LEVEL[x.level] || ["", x.level])[1]} · dernière connexion {when(x.last)} · rôle vérifié {when(x.checked)}</small>
            {main && <button type="button" className="btn small" disabled={busy} onClick={() => { if (window.confirm(`Retirer l'accès de ${x.name || x.id} ? Il sera déconnecté tout de suite ; s'il a encore le rôle, il pourra retaper /editeur.`)) call({ action: "staff-drop", id: x.id }, (j) => setData({ ...data, staff: j.staff })); }}>Déconnecter</button>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}
