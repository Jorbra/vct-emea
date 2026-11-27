"use client";

// The settings of one module of the Discord bot (components/BotPanel.jsx opens one page per module): the moderation log and
// what it records, sanctions, welcome and arrivals, verification, automatic moderation (Discord's AutoMod rules, set from
// here, and the bot's anti-flood), tickets, and the embeds prepared for /embed. Channels and roles are picked from those
// Discord gives (with a search), messages are written with their variables and a preview. Written in French, as the
// server's editors read it.
import { useEffect, useState } from "react";
import { DiscordMessage, EmbedBuilder, MessageEditor, MultiPicker, Picker } from "./BotDash.jsx";

const LOGS = [["messages", "Messages modifiés et supprimés"], ["members", "Arrivées et départs"], ["bans", "Bannissements"], ["nicknames", "Changements de pseudo"], ["roles", "Changements de rôles"], ["timeouts", "Exclusions"], ["automod", "Modération automatique"], ["bot", "Actions faites avec le bot"]];
// the variables of a goodbye (the member is gone: no mention, no inviter)
const GOODBYE_VARS = [["{user.name}", "son pseudo", "Alice"], ["{server}", "le nom du serveur", "VCT EMEA"], ["{membercount}", "le nombre de membres", "1 234"]];
const DM_VARS = [["{user}", "mentionne le membre", "@Alice"], ["{user.name}", "son pseudo", "Alice"], ["{server}", "le nom du serveur", "VCT EMEA"], ["{membercount}", "le nombre de membres", "1 234"]];
const PANEL_VARS = [["{server}", "le nom du serveur", "VCT EMEA"]];

export default function BotServer({ d, busy, call, onSaved, section = "" }) {
  const [s, setS] = useState(d && d.server ? JSON.parse(JSON.stringify(d.server)) : null);
  const [saved, setSaved] = useState(d && d.server ? JSON.stringify(d.server) : "");
  useEffect(() => { if (d && d.server && !s) { setS(JSON.parse(JSON.stringify(d.server))); setSaved(JSON.stringify(d.server)); } }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="note">Chargement…</p>;
  const channels = (d && d.channels) || [];
  const roles = (d && d.roles) || [];
  const show = (k) => !section || section === k;
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
  const chan = (label, path, value) => <Picker label={label} items={channels} value={value || ""} onChange={(v) => set(path, v)} prefix="#" />;
  const role = (label, path, value) => <Picker label={label} items={roles} value={value || ""} onChange={(v) => set(path, v)} prefix="@" />;
  const many = (label, path, list, value, prefix) => <MultiPicker label={label} items={list} value={value} onChange={(v) => set(path, v)} prefix={prefix} />;
  const sw = (label, path, value) => (
    <label className={"btoggle" + (value ? " on" : "")}>
      <input type="checkbox" role="switch" checked={!!value} onChange={(e) => set(path, e.target.checked)} />
      <span className="btsw" aria-hidden="true" /><span className="btlabel">{label}</span>
    </label>
  );
  const g = d.gateway || {};
  const a = s.automod;
  const cats = s.tickets.categories;
  return (
    <div className="botserver" data-unsaved-unit="">
      {/* what is missing, said where it matters (lib/botgateway.js) */}
      {(show("logs") || show("welcome") || show("automod")) && !g.on && (
        <p className="note warn">La connexion en direct au serveur Discord est inactive{g.error ? ` : ${g.error}` : ""}. Elle sert au journal, à la bienvenue, aux arrivées et à l&apos;anti-flood ; les commandes, les règles AutoMod et les tickets marchent sans elle.</p>
      )}
      {(show("logs") || show("welcome") || show("automod")) && g.on && g.privileged === false && (
        <p className="note warn">⚠️ Les <b>intents privilégiés</b> ne sont pas activés dans le portail Discord (discord.com/developers → l&apos;application → Bot → <i>Server Members Intent</i> et <i>Message Content Intent</i>). Sans eux : pas d&apos;arrivées ni de départs, donc pas de bienvenue, de quarantaine, d&apos;anti-raid, de suivi des invitations ni de compteur ; pas de texte des messages modifiés ou supprimés ; pas d&apos;anti-flood.</p>
      )}
      {show("welcome") && g.on && s.arrival.invites && g.invitesOk === false && <p className="note warn">⚠️ Suivi des invitations : le bot n&apos;a pas le droit « Gérer le serveur » nécessaire pour lire les invitations.</p>}

      {(show("logs") || show("moderation")) && (
        <section className="bsect">
          <h3 className="sub">📒 Journal de modération</h3>
          {chan("Salon du journal (réservé à l'équipe)", "logChannel", s.logChannel)}
          {show("logs") && <div className="bsgrid">{LOGS.map(([k, l]) => <span key={k}>{sw(l, `logs.${k}`, s.logs[k])}</span>)}</div>}
        </section>
      )}

      {show("moderation") && (
        <section className="bsect">
          <h3 className="sub">⚖️ Sanctions</h3>
          <label className="f">Raisons proposées <small>(une par ligne ; elles apparaissent pendant qu&apos;on tape la raison d&apos;une commande)</small>
            <textarea rows={4} value={s.moderation.reasons.join("\n")} onChange={(e) => set("moderation.reasons", e.target.value.split("\n"))} />
          </label>
          {sw("Envoyer un message privé au membre sanctionné (raison, durée, numéro du cas)", "moderation.dm", s.moderation.dm)}
          {s.moderation.dm && <label className="f">Comment contester <small>(ajouté à la fin du message privé)</small><textarea rows={2} maxLength={500} value={s.moderation.appeal} onChange={(e) => set("moderation.appeal", e.target.value)} /></label>}
          {sw("Demander une confirmation par bouton avant /ban, /kick et /tempban", "moderation.confirm", s.moderation.confirm)}
          <label className="f">Les avertissements expirent après <input type="number" min={0} max={365} value={s.moderation.warnExpireDays} onChange={(e) => set("moderation.warnExpireDays", Number(e.target.value))} /> jours <small>(0 : jamais ; ils restent dans le dossier mais ne comptent plus)</small></label>
          <fieldset className="bsmany bsrules"><legend>Escalade automatique</legend>
            {s.moderation.escalation.map((r, k) => (
              <div key={k} className="bsrule">
                À <input type="number" min={1} max={50} value={r.count} onChange={(e) => set(`moderation.escalation.${k}.count`, Number(e.target.value))} aria-label="Nombre d'avertissements" /> avertissements :
                <select value={r.action} onChange={(e) => set(`moderation.escalation.${k}.action`, e.target.value)} aria-label="Sanction"><option value="timeout">exclusion</option><option value="kick">expulsion</option><option value="ban">bannissement</option></select>
                {r.action === "timeout" && <> pendant <input type="text" maxLength={10} value={r.duration} onChange={(e) => set(`moderation.escalation.${k}.duration`, e.target.value)} placeholder="1h" aria-label="Durée" /></>}
                <button type="button" className="btn small" onClick={() => set("moderation.escalation", s.moderation.escalation.filter((_, j) => j !== k))}>Retirer</button>
              </div>
            ))}
            {s.moderation.escalation.length < 5 && <button type="button" className="btn small" onClick={() => set("moderation.escalation", [...s.moderation.escalation, { count: (s.moderation.escalation.slice(-1)[0] || { count: 1 }).count + 2, action: "timeout", duration: "1h" }])}>Ajouter une étape</button>}
          </fieldset>
          {chan("Salon où arrivent les signalements (clic droit « Signaler au staff » ; sinon le salon du journal)", "moderation.reportChannel", s.moderation.reportChannel)}
          {many("Salons verrouillés par /lockdown (et par l'anti-raid)", "moderation.lockdownChannels", channels, s.moderation.lockdownChannels, "#")}
        </section>
      )}

      {show("welcome") && (
        <>
          <section className="bsect">
            <h3 className="sub">👋 Bienvenue</h3>
            {sw("Message de bienvenue dans un salon", "welcome.on", s.welcome.on)}
            {s.welcome.on && (
              <>
                {chan("Salon de bienvenue", "welcome.channel", s.welcome.channel)}
                {sw("Avec une image de bienvenue (avatar, pseudo, « Tu es le 1 234e membre »)", "arrival.image", s.arrival.image)}
                <MessageEditor label="Message de bienvenue" value={s.welcome.text} max={1000} onChange={(v) => set("welcome.text", v)} embedsBelow={s.arrival.image ? [{ color: "#ff4655", text: "🖼️ *image de bienvenue*" }] : []} />
              </>
            )}
            {role("Rôle donné à l'arrivée", "welcome.role", s.welcome.role)}
            {sw("Message privé de bienvenue", "arrival.dm.on", s.arrival.dm.on)}
            {s.arrival.dm.on && <MessageEditor label="Message privé" value={s.arrival.dm.text} max={1500} vars={DM_VARS} onChange={(v) => set("arrival.dm.text", v)} />}
          </section>
          <section className="bsect">
            <h3 className="sub">🚪 Au revoir</h3>
            {sw("Message quand un membre part", "goodbye.on", s.goodbye.on)}
            {s.goodbye.on && (
              <>
                {chan("Salon d'au revoir", "goodbye.channel", s.goodbye.channel)}
                <MessageEditor label="Message d'au revoir" value={s.goodbye.text} max={1000} vars={GOODBYE_VARS} onChange={(v) => set("goodbye.text", v)} />
              </>
            )}
          </section>
          <section className="bsect">
            <h3 className="sub">🛡️ Arrivées sous surveillance</h3>
            <label className="f">Signaler les comptes créés depuis moins de <input type="number" min={0} max={365} value={s.arrival.newAccount.days} onChange={(e) => set("arrival.newAccount.days", Number(e.target.value))} /> jours <small>(0 : non)</small></label>
            {s.arrival.newAccount.days > 0 && sw("Les mettre en quarantaine (rôle ci-dessous, sans le rôle d'arrivée ni la vérification)", "arrival.newAccount.quarantine", s.arrival.newAccount.quarantine)}
            {s.arrival.newAccount.days > 0 && s.arrival.newAccount.quarantine && role("Rôle de quarantaine", "arrival.newAccount.role", s.arrival.newAccount.role)}
            {sw("Anti-raid : alerter l'équipe quand trop de membres arrivent d'un coup", "arrival.raid.on", s.arrival.raid.on)}
            {s.arrival.raid.on && (
              <>
                <label className="f">Plus de <input type="number" min={3} max={100} value={s.arrival.raid.joins} onChange={(e) => set("arrival.raid.joins", Number(e.target.value))} /> arrivées en <input type="number" min={5} max={600} value={s.arrival.raid.seconds} onChange={(e) => set("arrival.raid.seconds", Number(e.target.value))} /> secondes</label>
                {role("Rôle prévenu dans le salon du journal", "arrival.raid.pingRole", s.arrival.raid.pingRole)}
                {sw("Verrouiller aussitôt les salons de /lockdown (module Modération)", "arrival.raid.lock", s.arrival.raid.lock)}
              </>
            )}
            {sw("Suivi des invitations : qui a invité qui, dans le journal, et {inviter} dans la bienvenue (droit « Gérer le serveur »)", "arrival.invites", s.arrival.invites)}
            {chan("Salon compteur de membres (son nom est mis à jour, au plus toutes les 6 minutes)", "arrival.counter.channel", s.arrival.counter.channel)}
            {s.arrival.counter.channel && <label className="f">Nom du salon <small>({"{membercount}"} : le nombre de membres)</small><input type="text" maxLength={90} value={s.arrival.counter.template} onChange={(e) => set("arrival.counter.template", e.target.value)} /></label>}
          </section>
        </>
      )}

      {show("verify") && (
        <section className="bsect">
          <h3 className="sub">✅ Vérification</h3>
          <p className="hint">Les nouveaux membres cliquent sur « J&apos;accepte le règlement » pour recevoir le rôle d&apos;accès. Cache les salons à ceux qui ne l&apos;ont pas (réglages des salons sur Discord), puis tape <code>/verifypanel</code> dans le salon du règlement.</p>
          {role("Rôle d'accès donné par le bouton", "arrival.verify.role", s.arrival.verify.role)}
          <label className="f">Délai minimum après l&apos;arrivée avant de pouvoir cliquer <input type="number" min={0} max={3600} value={s.arrival.verify.delay} onChange={(e) => set("arrival.verify.delay", Number(e.target.value))} /> secondes</label>
          <h4 className="bsub">Le message du panneau</h4>
          <EmbedBuilder value={s.arrival.verify.panel} vars={PANEL_VARS} onChange={(v) => set("arrival.verify.panel", v)} buttons={[{ label: "✅ J'accepte le règlement", style: "green" }]} />
        </section>
      )}

      {show("automod") && (
        <section className="bsect">
          <h3 className="sub">🤖 Modération automatique</h3>
          <p className="hint">Les quatre premières règles sont celles de Discord (AutoMod) : le bot les crée ou les change sur le serveur à l&apos;enregistrement, sans toucher aux autres règles du serveur. Le message est bloqué avant d&apos;être vu.</p>
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
          {a.action === "timeout" && <label className="f">Durée de l&apos;exclusion (minutes) <input type="number" min={1} max={10080} value={a.timeoutMin} onChange={(e) => set("automod.timeoutMin", Number(e.target.value))} /></label>}
          {sw("Ajouter un avertissement au dossier du membre (visible avec /modlogs)", "automod.warn", a.warn)}
          {many("Rôles exemptés", "automod.exemptRoles", roles, a.exemptRoles, "@")}
          {many("Salons exemptés", "automod.exemptChannels", channels, a.exemptChannels, "#")}
        </section>
      )}

      {show("tickets") && (
        <>
          <section className="bsect">
            <h3 className="sub">🎫 Tickets</h3>
            {role("Rôle de l'équipe qui répond aux tickets", "tickets.staffRole", s.tickets.staffRole)}
            <fieldset className="bsmany bsrules"><legend>Sujets proposés à l&apos;ouverture (un seul : un simple bouton)</legend>
              {cats.map((c, k) => (
                <div key={k} className="bsrule bcat">
                  <input type="text" maxLength={40} value={c.name} onChange={(e) => set(`tickets.categories.${k}.name`, e.target.value)} aria-label={`Sujet ${k + 1}`} />
                  <Picker items={roles} value={c.role} onChange={(v) => set(`tickets.categories.${k}.role`, v)} prefix="@" placeholder="Rôle des tickets" />
                  <label className="chk"><input type="checkbox" checked={c.form} onChange={(e) => set(`tickets.categories.${k}.form`, e.target.checked)} /> formulaire</label>
                  <button type="button" className="btn small" onClick={() => set("tickets.categories", cats.filter((_, j) => j !== k))}>Retirer</button>
                </div>
              ))}
              {cats.length < 10 && <button type="button" className="btn small" onClick={() => set("tickets.categories", [...cats, { name: "Nouveau sujet", role: "", form: true }])}>Ajouter un sujet</button>}
            </fieldset>
            <label className="f">Tickets ouverts en même temps par membre <input type="number" min={1} max={5} value={s.tickets.maxOpen} onChange={(e) => set("tickets.maxOpen", Number(e.target.value))} /></label>
            {sw("Message privé au membre à la fermeture (avec la raison)", "tickets.dmOnClose", s.tickets.dmOnClose)}
            {s.tickets.dmOnClose && sw("Lui demander une note de 1 à 5 étoiles", "tickets.rating", s.tickets.rating)}
            <label className="f">Fermer un ticket sans réponse depuis <input type="number" min={0} max={60} value={s.tickets.inactiveDays} onChange={(e) => set("tickets.inactiveDays", Number(e.target.value))} /> jours <small>(0 : jamais)</small></label>
            {sw("À la fermeture, envoyer la transcription du ticket dans le salon du journal", "tickets.transcript", s.tickets.transcript)}
          </section>
          <section className="bsect">
            <h3 className="sub">💬 Réponses enregistrées</h3>
            <p className="hint">Les réponses que l&apos;équipe écrit souvent. Dans le panneau d&apos;un ticket (page « Tickets »), elles se choisissent dans la liste au-dessus de la zone de réponse. 20 au plus.</p>
            <ul className="bcanned">
              {(s.tickets.canned || []).map((c, k) => (
                <li key={k}>
                  <input type="text" maxLength={60} value={c.title} placeholder="Titre (par exemple : Compte à lier)" onChange={(e) => set(`tickets.canned.${k}.title`, e.target.value)} aria-label={`Titre de la réponse ${k + 1}`} />
                  <textarea rows={2} maxLength={1800} value={c.text} placeholder="Le texte de la réponse" onChange={(e) => set(`tickets.canned.${k}.text`, e.target.value)} aria-label={`Texte de la réponse ${k + 1}`} />
                  <button type="button" className="btn small" onClick={() => set("tickets.canned", s.tickets.canned.filter((_, j) => j !== k))}>Retirer</button>
                </li>
              ))}
            </ul>
            {(s.tickets.canned || []).length < 20 && <button type="button" className="btn small" onClick={() => set("tickets.canned", [...(s.tickets.canned || []), { title: "", text: "" }])}>Ajouter une réponse</button>}
            <p className="hint">Une réponse sans titre ou sans texte n&apos;est pas gardée.</p>
          </section>
          <section className="bsect">
            <h3 className="sub">🪧 Panneau d&apos;ouverture</h3>
            <p className="hint">Posé avec <code>/ticket panel</code> dans le salon de ton choix ; retape-la après un changement.</p>
            <EmbedBuilder value={s.tickets.panel} vars={PANEL_VARS} onChange={(v) => set("tickets.panel", v)} buttons={cats.length > 1 ? [{ label: "🎫 Ouvrir un ticket : choisis le sujet ▾", style: "select" }] : [{ label: "🎫 Ouvrir un ticket" }]} />
          </section>
        </>
      )}

      {show("embeds") && (
        <section className="bsect">
          <h3 className="sub">🧩 Messages préparés pour /embed</h3>
          <p className="hint">Prépare un message mis en forme ici, puis publie-le sur Discord avec <code>/embed template:</code> (le nom est proposé pendant la saisie). 20 au plus.</p>
          {s.embeds.length === 0 && <p className="note">Aucun message préparé pour l&apos;instant.</p>}
          {s.embeds.map((e, k) => (
            <details key={k} className="btpl" open={k === s.embeds.length - 1 && !e.title && !e.text}>
              <summary><b>{e.name || "Sans nom"}</b> <small className="bmuted">{e.title || e.text.slice(0, 60)}</small></summary>
              <EmbedBuilder withName value={e} onChange={(v) => set(`embeds.${k}`, v)} />
              <button type="button" className="btn small danger" onClick={() => set("embeds", s.embeds.filter((_, j) => j !== k))}>Supprimer ce modèle</button>
            </details>
          ))}
          {s.embeds.length < 20 && <button type="button" className="btn" onClick={() => set("embeds", [...s.embeds, { name: `Modèle ${s.embeds.length + 1}`, title: "", text: "", color: "#ff4655", image: "", fields: [] }])}>Nouveau message préparé</button>}
          {s.embeds.some((e) => !e.title && !e.text) && <p className="hint">Un modèle sans titre ni texte n&apos;est pas gardé à l&apos;enregistrement.</p>}
        </section>
      )}

      {show("buttonroles") && (
        <section className="bsect">
          <h3 className="sub">🎭 Rôles à boutons</h3>
          <p className="hint">Sur Discord, tape <code>/buttonroles role1:@Fnatic role2:@Vitality title:Choisis ton équipe</code> dans le salon voulu : chacun prend ou rend un rôle d&apos;un clic. Le bot ne donne que les rôles sous le sien, et jamais un rôle avec des permissions de modération.</p>
          <DiscordMessage embeds={[{ title: "Choisis ton équipe", text: "Clique sur un bouton pour prendre le rôle, encore une fois pour le rendre.", color: "#ff4655" }]} buttons={[{ label: "Fnatic", style: "grey" }, { label: "Vitality", style: "grey" }]} />
        </section>
      )}

      {show("polls") && (
        <section className="bsect">
          <h3 className="sub">📊 Sondages & concours</h3>
          <p className="hint"><code>/poll question:Qui gagne ? choices:Fnatic ; Vitality duration:1d</code> pose un sondage à boutons, fermé tout seul avec ses résultats. <code>/giveaway prize:Un maillot duration:3d winners:1</code> lance un tirage au sort : le bot tire les gagnants à la fin et les annonce.</p>
          <DiscordMessage embeds={[{ title: "📊 Qui gagne ?", text: "Fin <t:1:R>", color: "#ff4655" }]} buttons={[{ label: "Fnatic", style: "grey" }, { label: "Vitality", style: "grey" }]} />
        </section>
      )}

      {!["buttonroles", "polls"].includes(section) && (
        <div className={"bsavebar" + (dirty ? " dirty" : "")}>
          <span>{dirty ? "Modifications pas encore enregistrées" : "Tout est enregistré"}</span>
          {dirty && <button type="button" className="btn" disabled={busy} onClick={() => setS(JSON.parse(saved))}>Annuler les modifications</button>}
          <button type="button" className="btn pri" disabled={busy || !dirty} onClick={save}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}
