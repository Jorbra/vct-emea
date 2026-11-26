"use client";

// The editor's "Server" tab of the Discord bot: the moderation log channel and what it records, welcome and goodbye,
// automatic moderation (Discord's AutoMod rules, set from here, and the bot's anti-flood), and tickets.
// Written in French, as the server's editors read it.
import { useEffect, useState } from "react";

const LOGS = [["messages", "Messages modifiés et supprimés"], ["members", "Arrivées et départs"], ["bans", "Bannissements"], ["nicknames", "Changements de pseudo"], ["roles", "Changements de rôles"], ["timeouts", "Exclusions"], ["automod", "Modération automatique"], ["bot", "Actions faites avec le bot"]];

export default function BotServer({ d, busy, call, onSaved }) {
  const [s, setS] = useState(d && d.server ? JSON.parse(JSON.stringify(d.server)) : null);
  const [saved, setSaved] = useState(d && d.server ? JSON.stringify(d.server) : "");
  useEffect(() => { if (d && d.server && !s) { setS(JSON.parse(JSON.stringify(d.server))); setSaved(JSON.stringify(d.server)); } }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="note">Chargement…</p>;
  const channels = (d && d.channels) || [];
  const roles = (d && d.roles) || [];
  const set = (path, v) => setS((x) => {
    const next = JSON.parse(JSON.stringify(x));
    const keys = path.split(".");
    let o = next;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys[keys.length - 1]] = v;
    return next;
  });
  const dirty = JSON.stringify(s) !== saved;
  const save = () => call({ action: "server", server: s }, (j) => { const next = (j && j.server) || s; setS(next); setSaved(JSON.stringify(next)); onSaved && onSaved(next); });
  const chan = (label, path, value) => (
    <label className="f">{label}
      <select value={value || ""} onChange={(e) => set(path, e.target.value)}>
        <option value="">Aucun</option>
        {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
      </select>
    </label>
  );
  const role = (label, path, value) => (
    <label className="f">{label}
      <select value={value || ""} onChange={(e) => set(path, e.target.value)}>
        <option value="">Aucun</option>
        {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
      </select>
    </label>
  );
  const many = (label, path, list, value, prefix) => (
    <fieldset className="bsmany"><legend>{label}</legend>
      {list.length === 0 ? <small className="note">Choisis d'abord le serveur dans l'onglet Réglages.</small> : list.map((x) => (
        <label key={x.id} className="sw"><input type="checkbox" checked={value.includes(x.id)} onChange={(e) => set(path, e.target.checked ? [...value, x.id] : value.filter((v) => v !== x.id))} /> {prefix}{x.name}</label>
      ))}
    </fieldset>
  );
  const sw = (label, path, value) => <label className="sw"><input type="checkbox" checked={!!value} onChange={(e) => set(path, e.target.checked)} /> {label}</label>;
  const g = d.gateway || {};
  const a = s.automod;
  return (
    <div className="botserver">
      <div className={"note" + (g.on ? "" : " warn")}>
        <b>Connexion en direct au serveur Discord : {g.on ? "active" : "inactive"}</b>{g.on && g.since ? ` depuis ${new Date(g.since).toLocaleString("fr-FR")}` : ""}
        {g.error ? ` · ${g.error}` : ""}
        <br /><small>Elle sert au journal (messages, arrivées, pseudos, rôles), à la bienvenue et à l'anti-flood. Les règles AutoMod (invitations, mots interdits, mentions, spam), les commandes et les tickets marchent sans elle.</small>
      </div>

      <h3 className="sub">📒 Journal de modération</h3>
      {chan("Salon du journal", "logChannel", s.logChannel)}
      <div className="bsgrid">{LOGS.map(([k, l]) => <span key={k}>{sw(l, `logs.${k}`, s.logs[k])}</span>)}</div>

      <h3 className="sub">👋 Bienvenue et au revoir</h3>
      {sw("Message de bienvenue", "welcome.on", s.welcome.on)}
      {s.welcome.on && (
        <>
          {chan("Salon de bienvenue", "welcome.channel", s.welcome.channel)}
          <label className="f">Texte <small>({"{membre}"} mentionne le membre, {"{pseudo}"}, {"{serveur}"}, {"{nombre}"} : le nombre de membres)</small>
            <textarea rows={2} maxLength={1000} value={s.welcome.text} onChange={(e) => set("welcome.text", e.target.value)} />
          </label>
        </>
      )}
      {role("Rôle donné à l'arrivée", "welcome.role", s.welcome.role)}
      {sw("Message d'au revoir", "goodbye.on", s.goodbye.on)}
      {s.goodbye.on && (
        <>
          {chan("Salon d'au revoir", "goodbye.channel", s.goodbye.channel)}
          <label className="f">Texte <textarea rows={2} maxLength={1000} value={s.goodbye.text} onChange={(e) => set("goodbye.text", e.target.value)} /></label>
        </>
      )}

      <h3 className="sub">🛡️ Modération automatique</h3>
      <p className="hint">Les quatre premières règles sont celles de Discord (AutoMod) : le bot les crée ou les change sur le serveur à l'enregistrement, sans toucher aux autres règles du serveur. Le message est bloqué avant d'être vu.</p>
      {sw("Bloquer les invitations vers d'autres serveurs Discord", "automod.invites", a.invites)}
      {sw("Bloquer les mots interdits", "automod.wordsOn", a.wordsOn)}
      {a.wordsOn && (
        <label className="f">Mots interdits <small>(un par ligne ; * pour « commence par » ou « finit par », comme arnaq*)</small>
          <textarea rows={4} value={a.words.join("\n")} onChange={(e) => set("automod.words", e.target.value.split("\n"))} />
        </label>
      )}
      <label className="f">Mentions de masse : bloquer au-delà de <input type="number" min={0} max={50} value={a.mentions} onChange={(e) => set("automod.mentions", Number(e.target.value))} /> mentions par message <small>(0 : non)</small></label>
      {sw("Bloquer ce que Discord reconnaît comme du spam", "automod.spam", a.spam)}
      {sw("Anti-flood : trop de messages d'affilée (par le bot, avec la connexion en direct)", "automod.flood.on", a.flood.on)}
      {a.flood.on && (
        <label className="f">Plus de <input type="number" min={3} max={20} value={a.flood.count} onChange={(e) => set("automod.flood.count", Number(e.target.value))} /> messages en <input type="number" min={2} max={60} value={a.flood.seconds} onChange={(e) => set("automod.flood.seconds", Number(e.target.value))} /> secondes : ses messages sont supprimés</label>
      )}
      <label className="f">Et en plus
        <select value={a.action} onChange={(e) => set("automod.action", e.target.value)}>
          <option value="block">Rien de plus (message bloqué)</option>
          <option value="timeout">Exclure son auteur</option>
        </select>
      </label>
      {a.action === "timeout" && <label className="f">Durée de l'exclusion (minutes) <input type="number" min={1} max={10080} value={a.timeoutMin} onChange={(e) => set("automod.timeoutMin", Number(e.target.value))} /></label>}
      {sw("Ajouter un avertissement au dossier du membre (visible avec /sanctions)", "automod.warn", a.warn)}
      {many("Rôles exemptés", "automod.exemptRoles", roles, a.exemptRoles, "@")}
      {many("Salons exemptés", "automod.exemptChannels", channels, a.exemptChannels, "#")}

      <h3 className="sub">🎫 Tickets</h3>
      {role("Rôle de l'équipe qui répond aux tickets", "tickets.staffRole", s.tickets.staffRole)}
      <label className="f">Sujets proposés à l'ouverture <small>(un par ligne ; un seul : un simple bouton)</small>
        <textarea rows={3} value={s.tickets.categories.join("\n")} onChange={(e) => set("tickets.categories", e.target.value.split("\n"))} />
      </label>
      <label className="f">Fermer un ticket sans réponse depuis <input type="number" min={0} max={60} value={s.tickets.inactiveDays} onChange={(e) => set("tickets.inactiveDays", Number(e.target.value))} /> jours <small>(0 : jamais)</small></label>
      {sw("À la fermeture, envoyer la transcription du ticket dans le salon du journal", "tickets.transcript", s.tickets.transcript)}

      <div className={"bsavebar" + (dirty ? " dirty" : "")}>
        <span>{dirty ? "Modifications pas encore enregistrées" : "Tout est enregistré"}</span>
        {dirty && <button type="button" className="btn" disabled={busy} onClick={() => setS(JSON.parse(saved))}>Annuler les modifications</button>}
        <button type="button" className="btn pri" disabled={busy || !dirty} onClick={save}>Enregistrer les réglages du serveur</button>
      </div>
    </div>
  );
}
