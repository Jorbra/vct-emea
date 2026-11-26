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
        <br /><small>Elle sert au journal (messages, arrivées, pseudos, rôles), à la bienvenue et aux arrivées (quarantaine, anti-raid, invitations, compteur) et à l'anti-flood. Les règles AutoMod, les commandes et les tickets marchent sans elle.</small>
      </div>
      {/* what is missing, said where it matters (lib/botgateway.js) */}
      {g.on && g.privileged === false && (
        <p className="note warn">⚠️ Les <b>intents privilégiés</b> ne sont pas activés dans le portail Discord (discord.com/developers → l'application → Bot → <i>Server Members Intent</i> et <i>Message Content Intent</i>). Sans eux : pas d'arrivées ni de départs, donc pas de bienvenue, de quarantaine, d'anti-raid, de suivi des invitations ni de compteur ; pas de texte des messages modifiés ou supprimés ; pas d'anti-flood.</p>
      )}
      {g.on && s.arrival.invites && g.invitesOk === false && <p className="note warn">⚠️ Suivi des invitations : le bot n'a pas le droit « Gérer le serveur » nécessaire pour lire les invitations.</p>}

      <h3 className="sub">📒 Journal de modération</h3>
      {chan("Salon du journal", "logChannel", s.logChannel)}
      <div className="bsgrid">{LOGS.map(([k, l]) => <span key={k}>{sw(l, `logs.${k}`, s.logs[k])}</span>)}</div>

      <h3 className="sub">⚖️ Sanctions</h3>
      <label className="f">Raisons proposées <small>(une par ligne ; elles apparaissent pendant qu'on tape la raison d'une commande)</small>
        <textarea rows={4} value={s.moderation.reasons.join("\n")} onChange={(e) => set("moderation.reasons", e.target.value.split("\n"))} />
      </label>
      {sw("Envoyer un message privé au membre sanctionné (raison, durée, numéro du cas)", "moderation.dm", s.moderation.dm)}
      {s.moderation.dm && <label className="f">Comment contester <small>(ajouté à la fin du message privé)</small><textarea rows={2} maxLength={500} value={s.moderation.appeal} onChange={(e) => set("moderation.appeal", e.target.value)} /></label>}
      {sw("Demander une confirmation par bouton avant /ban, /kick et /tempban", "moderation.confirm", s.moderation.confirm)}
      <label className="f">Les avertissements expirent après <input type="number" min={0} max={365} value={s.moderation.warnExpireDays} onChange={(e) => set("moderation.warnExpireDays", Number(e.target.value))} /> jours <small>(0 : jamais ; ils restent dans le dossier mais ne comptent plus)</small></label>
      <fieldset className="bsmany bsrules"><legend>Escalade automatique</legend>
        {s.moderation.escalation.map((r, k) => (
          <div key={k} className="bsrule">
            À <input type="number" min={1} max={50} value={r.count} onChange={(e) => set(`moderation.escalation.${k}.count`, Number(e.target.value))} /> avertissements :
            <select value={r.action} onChange={(e) => set(`moderation.escalation.${k}.action`, e.target.value)}><option value="timeout">exclusion</option><option value="kick">expulsion</option><option value="ban">bannissement</option></select>
            {r.action === "timeout" && <> pendant <input type="text" maxLength={10} value={r.duration} onChange={(e) => set(`moderation.escalation.${k}.duration`, e.target.value)} placeholder="1h" /></>}
            <button type="button" className="btn sm" onClick={() => set("moderation.escalation", s.moderation.escalation.filter((_, j) => j !== k))}>Retirer</button>
          </div>
        ))}
        {s.moderation.escalation.length < 5 && <button type="button" className="btn sm" onClick={() => set("moderation.escalation", [...s.moderation.escalation, { count: (s.moderation.escalation.slice(-1)[0] || { count: 1 }).count + 2, action: "timeout", duration: "1h" }])}>Ajouter une étape</button>}
      </fieldset>
      {chan("Salon où arrivent les signalements (clic droit « Signaler au staff » ; sinon le salon du journal)", "moderation.reportChannel", s.moderation.reportChannel)}
      {many("Salons verrouillés par /lockdown (et par l'anti-raid)", "moderation.lockdownChannels", channels, s.moderation.lockdownChannels, "#")}

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
      {sw("Image de bienvenue avec le message (avatar, pseudo, « Tu es le 1 234e membre »)", "arrival.image", s.arrival.image)}
      {role("Rôle donné à l'arrivée", "welcome.role", s.welcome.role)}
      {sw("Message d'au revoir", "goodbye.on", s.goodbye.on)}
      {s.goodbye.on && (
        <>
          {chan("Salon d'au revoir", "goodbye.channel", s.goodbye.channel)}
          <label className="f">Texte <textarea rows={2} maxLength={1000} value={s.goodbye.text} onChange={(e) => set("goodbye.text", e.target.value)} /></label>
        </>
      )}

      <h3 className="sub">🚪 Arrivée des membres</h3>
      {sw("Message privé de bienvenue", "arrival.dm.on", s.arrival.dm.on)}
      {s.arrival.dm.on && <label className="f">Texte du message privé <small>({"{pseudo}"}, {"{serveur}"})</small><textarea rows={2} maxLength={1500} value={s.arrival.dm.text} onChange={(e) => set("arrival.dm.text", e.target.value)} /></label>}
      {role("Vérification : rôle d'accès donné par le bouton « J'accepte le règlement » (pose-le avec /verifypanel ; cache les salons à ceux qui ne l'ont pas)", "arrival.verify.role", s.arrival.verify.role)}
      {s.arrival.verify.role && <label className="f">Délai minimum avant de pouvoir cliquer <input type="number" min={0} max={3600} value={s.arrival.verify.delay} onChange={(e) => set("arrival.verify.delay", Number(e.target.value))} /> secondes</label>}
      <label className="f">Signaler les comptes créés depuis moins de <input type="number" min={0} max={365} value={s.arrival.newAccount.days} onChange={(e) => set("arrival.newAccount.days", Number(e.target.value))} /> jours <small>(0 : non)</small></label>
      {s.arrival.newAccount.days > 0 && sw("Les mettre en quarantaine (rôle ci-dessous, sans le rôle d'arrivée ni la vérification)", "arrival.newAccount.quarantine", s.arrival.newAccount.quarantine)}
      {s.arrival.newAccount.days > 0 && s.arrival.newAccount.quarantine && role("Rôle de quarantaine", "arrival.newAccount.role", s.arrival.newAccount.role)}
      {sw("Anti-raid : alerter l'équipe quand trop de membres arrivent d'un coup", "arrival.raid.on", s.arrival.raid.on)}
      {s.arrival.raid.on && (
        <>
          <label className="f">Plus de <input type="number" min={3} max={100} value={s.arrival.raid.joins} onChange={(e) => set("arrival.raid.joins", Number(e.target.value))} /> arrivées en <input type="number" min={5} max={600} value={s.arrival.raid.seconds} onChange={(e) => set("arrival.raid.seconds", Number(e.target.value))} /> secondes</label>
          {role("Rôle prévenu dans le salon du journal", "arrival.raid.pingRole", s.arrival.raid.pingRole)}
          {sw("Verrouiller aussitôt les salons de /lockdown", "arrival.raid.lock", s.arrival.raid.lock)}
        </>
      )}
      {sw("Suivi des invitations : qui a invité qui, dans le journal (droit « Gérer le serveur »)", "arrival.invites", s.arrival.invites)}
      {chan("Salon compteur de membres (son nom est mis à jour, au plus toutes les 6 minutes)", "arrival.counter.channel", s.arrival.counter.channel)}
      {s.arrival.counter.channel && <label className="f">Nom du salon <small>({"{nombre}"} : le nombre de membres)</small><input type="text" maxLength={90} value={s.arrival.counter.template} onChange={(e) => set("arrival.counter.template", e.target.value)} /></label>}

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
      {sw("Ajouter un avertissement au dossier du membre (visible avec /modlogs)", "automod.warn", a.warn)}
      {many("Rôles exemptés", "automod.exemptRoles", roles, a.exemptRoles, "@")}
      {many("Salons exemptés", "automod.exemptChannels", channels, a.exemptChannels, "#")}

      <h3 className="sub">🎫 Tickets</h3>
      {role("Rôle de l'équipe qui répond aux tickets", "tickets.staffRole", s.tickets.staffRole)}
      {d.ticketStats && (
        <p className="note">📊 30 derniers jours : {d.ticketStats.opened30} ouvert(s), {d.ticketStats.closed30} fermé(s), {d.ticketStats.open} en cours{d.ticketStats.firstReplyMin != null ? ` · première réponse en ${d.ticketStats.firstReplyMin} min en moyenne` : ""}{d.ticketStats.rating != null ? ` · note moyenne ${d.ticketStats.rating}/5 (${d.ticketStats.ratings} note(s))` : ""}</p>
      )}
      <fieldset className="bsmany bsrules"><legend>Sujets proposés à l'ouverture (un seul : un simple bouton)</legend>
        {s.tickets.categories.map((c, k) => (
          <div key={k} className="bsrule">
            <input type="text" maxLength={40} value={c.name} onChange={(e) => set(`tickets.categories.${k}.name`, e.target.value)} />
            <select value={c.role} onChange={(e) => set(`tickets.categories.${k}.role`, e.target.value)}><option value="">Rôle des tickets</option>{roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}</select>
            <label className="sw"><input type="checkbox" checked={c.form} onChange={(e) => set(`tickets.categories.${k}.form`, e.target.checked)} /> formulaire</label>
            <button type="button" className="btn sm" onClick={() => set("tickets.categories", s.tickets.categories.filter((_, j) => j !== k))}>Retirer</button>
          </div>
        ))}
        {s.tickets.categories.length < 10 && <button type="button" className="btn sm" onClick={() => set("tickets.categories", [...s.tickets.categories, { name: "Nouveau sujet", role: "", form: true }])}>Ajouter un sujet</button>}
      </fieldset>
      <label className="f">Tickets ouverts en même temps par membre <input type="number" min={1} max={5} value={s.tickets.maxOpen} onChange={(e) => set("tickets.maxOpen", Number(e.target.value))} /></label>
      {sw("Message privé au membre à la fermeture (avec la raison)", "tickets.dmOnClose", s.tickets.dmOnClose)}
      {s.tickets.dmOnClose && sw("Lui demander une note de 1 à 5 étoiles", "tickets.rating", s.tickets.rating)}
      <fieldset className="bsmany bspanel"><legend>Panneau des tickets (/ticketpanel)</legend>
        <label className="f">Titre <input type="text" maxLength={200} value={s.tickets.panel.title} onChange={(e) => set("tickets.panel.title", e.target.value)} /></label>
        <label className="f">Texte <textarea rows={2} maxLength={1500} value={s.tickets.panel.text} onChange={(e) => set("tickets.panel.text", e.target.value)} /></label>
        <label className="f">Couleur <input type="color" value={s.tickets.panel.color} onChange={(e) => set("tickets.panel.color", e.target.value)} /></label>
        <label className="f">Image <small>(adresse https://…, facultatif)</small><input type="url" maxLength={500} value={s.tickets.panel.image} onChange={(e) => set("tickets.panel.image", e.target.value)} /></label>
      </fieldset>
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
