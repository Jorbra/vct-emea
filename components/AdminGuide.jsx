// The editors' page: the whole site's log and how things work. In French.
// LOG holds what came before the log filled itself; every later update comes from its commit (lib/changelog.js).
import { mergeLog, parisDay, parisTime } from "../lib/changelog.js";
import { serverFr } from "../lib/i18n.js";
import { EVENT_NAMES } from "../lib/paths.js";

// Newest day first. kind: Ajout, Modification, Correction or Données. area: Site (what visitors see), Éditeur or Coulisses.
const LOG = [
  {
    date: "5 novembre 2026",
    items: [
      ["01:49", "Ajout", "Éditeur", "Journal complet du site sur cette page, avec les dates et heures."],
      ["01:44", "Ajout", "Éditeur", "Page « Nouveautés et mode d'emploi »."],
      ["01:07", "Ajout", "Site", "Barre de navigation sur toutes les pages publiques."],
      ["01:07", "Ajout", "Site", "Accueil : avancement du jour de chaque tournoi. Les derniers résultats remontent pendant les matchs."],
      ["01:07", "Ajout", "Site", "Bracket : équipes favorites marquées d'une étoile, avec leur prochain match au-dessus."],
      ["01:07", "Ajout", "Site", "Programme : filtres par jour, par round et par équipe."],
      ["01:07", "Ajout", "Site", "Page Parcours d'une équipe, à partager, avec un lien depuis sa fiche."],
      ["01:07", "Ajout", "Site", "Suivi automatique de Toornament pour les qualifiers EU, ME et NA : équipes, line-ups, horaires, matchs en cours et résultats."],
      ["01:07", "Ajout", "Éditeur", "Saisie rapide des scores : un clic par résultat."],
      ["01:07", "Ajout", "Éditeur", "Import de nationalités : une liste « pseudo, pays » à coller."],
      ["01:07", "Ajout", "Éditeur", "Section « Suivi de Toornament » : dernière lecture et points à vérifier."],
      ["01:07", "Modification", "Site", "Les brackets s'adaptent à leur taille, jusqu'à 512 équipes."],
      ["01:07", "Modification", "Coulisses", "Discord : les annonces simultanées sont regroupées en quelques messages."],
      ["01:07", "Modification", "Coulisses", "Les visites du site lancent aussi le suivi et les alertes."],
    ],
  },
  {
    date: "4 novembre 2026",
    items: [
      ["23:14", "Données", "Site", "Qualifier 1 : drapeaux de 167 joueurs, venus de vlr.gg et Liquipedia, et 2 logos de plus."],
      ["23:03", "Ajout", "Site", "Match : les rosters des deux équipes s'affichent."],
      ["22:53", "Ajout", "Site", "Bracket interactif : glisser pour le déplacer, chemin d'une équipe au survol, clic pour ouvrir un match, recherche d'une équipe, noms de rounds toujours visibles."],
      ["", "Données", "Site", "Qualifier 1 : dates et heures de Toornament pour les 256 matchs."],
      ["22:07", "Ajout", "Site", "Qualifier 1 : logos de 180 équipes."],
      ["22:07", "Données", "Site", "Qualifier 1 : rosters des 256 équipes depuis Toornament, et Barça renommé « Barça eSports »."],
      ["21:45", "Ajout", "Site", "Qualifier 1 : bracket de 256 équipes, identique à celui de Toornament."],
      ["21:45", "Ajout", "Éditeur", "Panneau « Jour et heure de chaque round »."],
      ["16:22", "Correction", "Site", "Mobile : le fil d'Ariane n'est plus collé à la recherche."],
      ["16:17", "Correction", "Site", "Mobile : la barre de liens ne bouge plus de haut en bas."],
      ["16:13", "Modification", "Site", "Accueil : la ligne de liens devient une barre de navigation sous l'en-tête."],
      ["15:50", "Ajout", "Site", "Page de chaque match, avec son image de partage."],
      ["15:50", "Ajout", "Site", "Pages Transferts, Comparer, Classements et À propos."],
      ["15:50", "Ajout", "Site", "Calendrier de chaque équipe, à ajouter à son agenda."],
      ["15:50", "Ajout", "Site", "Référencement par les moteurs de recherche."],
      ["15:50", "Ajout", "Éditeur", "« Écarts d'effectif » : comparaison des rosters avec Liquipedia."],
      ["15:31", "Correction", "Site", "L'image du Kickoff s'affiche à la largeur de son cadre."],
      ["15:28", "Modification", "Site", "Nouvelle image du Kickoff."],
      ["15:10", "Ajout", "Site", "Trois alertes séparées par match : à l'heure, en direct et au résultat."],
      ["14:52", "Correction", "Site", "Une équipe sans information la redemande d'elle-même."],
      ["14:52", "Correction", "Éditeur", "Sauvegarde : les images de la base sont bien incluses."],
      ["14:23", "Ajout", "Site", "Alertes de match sur le site en ligne."],
      ["14:23", "Modification", "Coulisses", "Accès direct à la base, pour économiser le quota de Turso."],
      ["13:33", "Ajout", "Éditeur", "Détails d'un match : logo de l'équipe au-dessus de ses joueurs."],
      ["13:28", "Modification", "Éditeur", "Détails d'un match : statistiques des joueurs regroupées par équipe."],
      ["13:18", "Correction", "Éditeur", "Le message « Match enregistré » disparaît après quelques secondes."],
      ["13:09", "Correction", "Éditeur", "Un éditeur voit toujours les dernières données enregistrées."],
      ["13:00", "Modification", "Coulisses", "Les fiches demandées par un visiteur sont lues par le site lui-même. Copie de test sur l'ordinateur."],
      ["11:30", "Ajout", "Coulisses", "Mise en ligne du site sur Vercel, avec la base Turso et GitHub."],
    ],
  },
];

const HOW = [
  {
    title: "Le suivi de Toornament",
    points: [
      "Il relit Toornament tout seul : chaque minute environ, de 2 heures avant le premier match d'un événement jusqu'à 12 heures après le dernier, et toutes les 6 heures sinon. Les line-ups sont relues au plus toutes les 10 minutes.",
      "Il fait gagner le match, remplit le tour suivant et marque les matchs en direct : tu n'as rien à saisir tant que Toornament est à jour.",
      "Ce que tu changes à la main reste comme tu l'as écrit : un score, un horaire ou un nom modifié ici n'est pas écrasé.",
      "Si Toornament donne le gagnant sans score valable (forfait, par exemple), le site met 2-0 en Bo3 et le compte comme « estimé ». Tu peux le corriger à la main.",
      "Ces mises à jour n'entrent pas dans le bouton Annuler. Elles apparaissent dans l'historique sous le nom « Toornament ».",
      "L'état se lit sur l'accueil de l'éditeur, section « Suivi de Toornament » : dernière lecture, dernier changement et points à vérifier.",
      "Les ME, NA et le Q2 s'importent seuls dès que leurs équipes apparaissent, à la bonne taille. Ils gardent le format par défaut du site : règle les Bo dans « Format ». La Türkiye n'est pas sur ce circuit et reste à saisir à la main.",
      "« Réinitialiser ce Qualifier » vide l'événement, et le suivi ne le remplit plus ensuite.",
    ],
  },
  {
    title: "Les détails des matchs (vlr.gg)",
    points: [
      "Pour chaque match terminé du Q1, le site lit sa page vlr.gg : le score en cartes (2-0, 2-1), le score de chaque carte, les statistiques des joueurs (K/D/A, ACS), le stream et la VOD quand elle sort.",
      "Le score en cartes de vlr.gg remplace le score de rounds donné par Toornament, seulement s'il désigne le même gagnant.",
      "Une page toutes les 10 secondes au plus, quelques-unes à chaque passage du cron ou d'une visite. Si vlr.gg refuse, tout s'arrête pour 24 heures.",
      "Les détails qu'un éditeur a saisis ou modifiés à la main ne sont jamais écrasés. Les forfaits n'ont pas de page de statistiques.",
      "Pour un autre tournoi, colle sa page vlr.gg (et sa page Toornament pour un qualifier) dans « Sources : liens Toornament et vlr.gg » sur l'accueil de l'éditeur : le site la suit dès le prochain tour.",
    ],
  },
  {
    title: "La page LFT",
    points: [
      "La page /lft liste les joueurs et le staff de la région EMEA (Europe, Türkiye, MENA et CEI) libérés par leur équipe ces six derniers mois, sans nouvelle équipe annoncée depuis.",
      "Elle se remplit avec les pages de transferts mensuelles de Liquipedia, lues une à la fois pendant le travail régulier. Le mois en cours est relu toutes les 3 heures, les autres une fois par jour.",
      "Un joueur mis sur le banc (« Inactive ») n'y figure pas. Un joueur qui a signé sans que Liquipedia l'ait noté peut y rester.",
    ],
  },
  {
    title: "Bot Discord",
    points: [
      "Commandes : /score, /prochain, /classement, /equipe, /joueur, /bracket (avec l'image du tableau), /match (carte par carte, MVP), /live (avec les streams), /top (ACS, rating, K/D…), /lft, /suivre (messages privés), /pronostic (boutons), /lier. Les noms d'équipe, de joueur et de tournoi se complètent en tapant.",
      "Pronostics depuis Discord : chaque personne joue sous son nom Discord ; pour jouer sous son nom du site, bouton « Jouer depuis Discord » sur la page Pronostics, puis /lier avec le code (15 minutes).",
      "Tableau de bord : section « Bot Discord » de l'accueil de l'éditeur. Salon des annonces, quoi publier (débuts, résultats, images, transferts, actualités), tournois, rôle à mentionner (jamais, tours finaux, tous les matchs), salon du message épinglé (matchs du jour en direct), langue FR/EN, commandes activées, statistiques, message test, et « Enregistrer les commandes » après une mise à jour.",
      "Pour que le bot écrive lui-même (annonces, épinglé, messages privés, listes de salons) : variable Vercel DISCORD_BOT_TOKEN (onglet Bot › Réinitialiser le token), puis redéployer. Sans elle, les commandes marchent et le webhook continue les annonces.",
      "Droits du bot sur le serveur : voir les salons, envoyer des messages, intégrer des liens, gérer les messages (pour épingler), mentionner le rôle choisi.",
      "Boutons sous les réponses : « Voir sur le site », « 🔔 Suivre en MP » (sur /equipe, /match, /score, /prochain avec une équipe), « 🔄 Actualiser » (sur /score, /live, /match).",
      "Onglet Automatique : rappel 15 min avant chaque match (avec le rôle selon le réglage), résumé du soir à 22 h, classement des pronostics le lundi à 10 h, un fil de discussion par match (tours finaux ou tous), salons séparés pour les résultats et les transferts.",
      "Onglet Annonce : aperçu avant envoi, et « Envoyer le » pour programmer (60 jours au plus) ; la liste des annonces programmées permet de les annuler. Onglet Journal : ce que le bot a publié et ses erreurs.",
      "Autres commandes : /carte, /compare (deux joueurs), /h2h (deux équipes), /agent, /records, /recap, /calendrier (aujourd'hui, demain, 7 jours), /mesprono (sa place et ses derniers pronostics), /aide.",
      "Tableau de bord en onglets : Réglages ; Annonce (écrire un message que le bot publie, en texte ou en carte, avec ou sans le rôle) ; Message épinglé (aperçu, mise à jour immédiate) ; Statistiques (par jour, par commande, équipes les plus suivies). En haut, l'état : clé, token, commandes à jour ou à enregistrer.",
    ],
  },
  {
    title: "Direct, stats avancées, commentaires, Discord, visites",
    points: [
      "Direct : pendant un match, vlr.gg est relu toutes les quelques minutes (les plus anciens d'abord). Le score de chaque carte s'affiche sur la carte « En direct », sur la page Live et dans la fenêtre du match, avec un fil (« Lotus commence », « Barça gagne Lotus 13–9 : 1–0 »). Un score de cartes saisi à la main reste prioritaire.",
      "Page Live : « Plusieurs streams à la fois » montre jusqu'à 4 streams côte à côte ; cocher « À l'écran » sur les matchs voulus.",
      "Stats : onglets Agents (choix, victoires, meilleurs joueurs) et Records (plus gros ACS, plus de kills, cartes les plus longues, plus grosses victoires, remontées). Compositions par carte sur la fiche équipe et la fiche carte. Graphiques ACS et rating sur la fiche joueur.",
      "Pronostics : un point bonus pour le score exact (Bo3 et Bo5). Classement des groupes (moyenne par membre, 2 membres au moins). « Partager ma carte » donne un lien dont l'aperçu est une image du parcours.",
      "Commentaires sous chaque match, signés avec le nom des pronostics (280 caractères, un toutes les 20 secondes). Modération : section « Commentaires » de l'accueil de l'éditeur, bouton Supprimer.",
      "Image de résultat : bouton « Image du résultat » dans la fenêtre d'un match terminé ; sur Discord, les résultats arrivent avec leur image quand il y en a 10 au plus à la fois.",
      "Bot Discord (/score, /prochain, /classement) : créer une application sur discord.com/developers, copier sa « Public Key » dans la variable Vercel DISCORD_PUBLIC_KEY, mettre https://vct-emea.vercel.app/api/discord comme « Interactions Endpoint URL », puis lancer une fois sur le PC : DISCORD_APP_ID=… DISCORD_BOT_TOKEN=… node scripts/discord-commands.mjs. Inviter le bot avec le scope applications.commands.",
      "Santé du site : bouton « Prévenir cet appareil » pour recevoir une notification si le cron ou Toornament s'arrête, ou si une partie a une erreur.",
      "Visites : section « Pages vues » de l'éditeur, comptées par le site lui-même (sans cookie ni traqueur, robots exclus), gardées 90 jours.",
      "Le Q2 suit Toornament : 512 places, tout en Bo3, et ses dates (11 au 15 novembre) viennent de Toornament.",
    ],
  },
  {
    title: "Récaps, cartes, communauté, santé du site",
    points: [
      "Récap d'un qualifier : /recap/q1 (lien sur l'accueil et dans Stats). Qualifiés et leur parcours, meilleurs joueurs, plus gros matchs, cartes les plus serrées. Il se remplit pendant le tournoi.",
      "Accueil : compte à rebours du prochain tournoi avec ses premiers matchs (dès que Toornament donne les horaires, sinon sa date de début).",
      "Fiche d'une carte : /map/lotus (lien depuis Stats › Cartes). Part des manches gagnées en attaque et en défense, équipes et joueurs les plus forts. L'attaque et la défense viennent des pages vlr.gg ; les anciens matchs sont relus petit à petit pour les avoir.",
      "Fenêtre d'un match : face-à-face des deux équipes sur le site, MVP automatique (meilleur ACS) si aucun n'est saisi, et vote du public pour le joueur du match (ouvert 7 jours après le match).",
      "Pronostics : classement de la saison (1 point par bon pronostic + les points de « Qui se qualifie ? ») avec badges, et groupes entre amis avec leur propre classement (lien à partager).",
      "Comparer des joueurs : en plus de vlr.gg, les stats de la saison sur les matchs du site.",
      "Appli : bouton « Installer l'appli » sur l'accueil ; les pages déjà ouvertes restent lisibles sans réseau. Alertes : option « un seul résumé à 22 h » pour les résultats.",
      "Recherche : trouve aussi les matchs (« fnatic heretics ») et les cartes.",
      "Santé du site, en haut de l'accueil de l'éditeur : dernière fois que le cron, Toornament, vlr.gg, Liquipedia et les alertes ont marché, et leur dernier problème.",
    ],
  },
  {
    title: "Pronostics, suivi des joueurs",
    points: [
      "« Qui se qualifie ? », sur la page Pronostics : avant le premier match d'un qualifier dont les équipes sont connues, chacun choisit les qualifiés et le vainqueur (1 point par qualifié, 2 pour le vainqueur ; 3 points quand une seule équipe passe). Le classement s'affiche à la fin.",
      "Une étoile sur la fiche d'un joueur ou sur la page LFT permet de le suivre. Avec les alertes activées, on est prévenu quand il devient libre ou quand il signe. Le suivi passe par le compte.",
      "Les statistiques vlr.gg suivent aussi le Q2, les ME, NA, la Türkiye, les playoffs et le Kickoff : vlr.gg les range dans quelques grands événements, la phase écrite sur chaque match dit lequel.",
    ],
  },
  {
    title: "Saisir un score",
    points: [
      "Sur la page d'un qualifier, « Saisie rapide » liste les matchs sans résultat, par heure de début. Un clic sur 2-0, 2-1, 1-2 ou 0-2 enregistre le score à gauche pour l'équipe de gauche.",
      "Le gagnant passe tout de suite au tour suivant. Une erreur ? « Annuler » en haut de l'éditeur revient sur la dernière action.",
      "La section « Scores » en dessous reste disponible pour corriger un score déjà saisi.",
    ],
  },
  {
    title: "Les horaires",
    points: [
      "« Jour et heure de chaque round » donne le même horaire à tous les matchs d'un round. Champ vide puis Enregistrer : l'horaire est retiré.",
      "« Programmer un tour entier » étale les matchs dans le temps, par exemple un match toutes les 2 heures.",
      "Les heures se saisissent et s'affichent dans le fuseau de chaque personne.",
    ],
  },
  {
    title: "Rosters, drapeaux et logos",
    points: [
      "Un roster s'écrit « pseudo|fr, pseudo2|de ». Le code à deux lettres donne le drapeau. Ajoute « |sub » pour un remplaçant : « pseudo|fr|sub ».",
      "« Importer des nationalités » met à jour tous les qualifiers d'un coup : une ligne « pseudo, pays » par joueur, avec un code (fr) ou un nom en anglais (France). Les pseudos introuvables sont listés après l'enregistrement.",
      "Attention aux homonymes : deux joueurs du même pseudo dans deux équipes reçoivent le même drapeau.",
      "Le logo d'un qualifier suit le tag court de l'équipe : le fichier public/logos/<TAG>.png est prioritaire sur le logo venu de Toornament.",
      "« Écarts d'effectif », sur l'accueil, compare les rosters à Liquipedia. « Suivre Liquipedia » remplace le roster dans tous les événements de l'équipe.",
    ],
  },
  {
    title: "Les alertes",
    points: [
      "Un match passe en direct tout seul à son heure, dès que ses deux équipes sont connues, et en sort à l'arrivée du résultat. Sans résultat après 6 heures, il attend son score. Tu peux retirer un direct à la main : il ne revient pas, sauf si tu changes l'horaire.",
      "Les visiteurs choisissent d'être alertés depuis la page d'une équipe : à l'heure du match, quand il passe en direct et au résultat.",
      "Si un lien Discord est réglé sur Vercel (DISCORD_WEBHOOK_URL), les mêmes annonces y partent, regroupées.",
      "Le travail régulier part à chaque visite du site et à chaque appel de https://vct-emea.vercel.app/api/tick. Un service comme cron-job.org qui appelle cette adresse garde tout à l'heure, même sans visiteur.",
    ],
  },
  {
    title: "Les comptes des visiteurs",
    points: [
      "N'importe qui peut créer un compte sur la page « Mon compte » : un pseudo et un mot de passe, sans e-mail. Il retrouve ses équipes favorites, ses pronostics, sa langue, son thème et son choix de compte à rebours sur tous ses appareils.",
      "Les alertes de match restent à activer sur chaque appareil, car chacun demande sa propre autorisation.",
      "Mot de passe oublié : le compte principal de l'éditeur en donne un nouveau dans « Comptes des visiteurs », sur l'accueil. Il s'affiche une seule fois. Vérifie que la demande vient bien de la bonne personne, car le site ne peut pas le prouver.",
      "Un compte peut ouvrir l'éditeur sans second mot de passe : dans « Comptes des visiteurs », « Faire le compte principal » lui donne tous les droits, et « Donner l'accès éditeur » les droits d'un éditeur. Le compte principal peut aussi donner ou retirer l'accès éditeur depuis sa page « Mon compte ». Un retrait agit immédiatement.",
      "Le bouton « Éditer » sur téléphone et la touche E sur ordinateur n'existent que pour les comptes qui ont accès à l'éditeur. Pour les autres, rien ne s'affiche. L'adresse /admin reste disponible et demande le mot de passe.",
      "Se déconnecter de l'éditeur déconnecte aussi le compte. Le mot de passe principal (ADMIN_PASSWORD) reste valable en secours.",
      "Après 8 mauvais mots de passe, un compte est bloqué 15 minutes. Chacun peut supprimer son compte depuis sa page.",
    ],
  },
  {
    title: "Annuler et historique",
    points: [
      "« Annuler » revient sur la dernière action d'un éditeur, puis sur celle d'avant si tu recliques.",
      "L'historique, sur l'accueil de l'éditeur, liste les derniers changements et qui les a faits.",
    ],
  },
];

/** A line of the site's history in words: Toornament's rounds name their event. */
const historyText = (message) => {
  const m = /^Toornament: (\w+) updated \((\d+)\)\.$/.exec(message);
  return m ? `${EVENT_NAMES[m[1]] || m[1]} mis à jour depuis Toornament (${m[2]} changements).` : serverFr(message);
};

export default function AdminGuide({ auto = [], stale = false, history = [] }) {
  const log = mergeLog(auto, LOG);
  const dataDays = [];
  for (const h of history) {
    const date = parisDay(h.at);
    let d = dataDays.find((x) => x.date === date);
    if (!d) { d = { date, items: [] }; dataDays.push(d); }
    d.items.push(h);
  }
  return (
    <div className="wrap guide">
      <p><a className="btn" href="/admin">‹ Retour à l'éditeur</a></p>
      <h1>Nouveautés et mode d'emploi</h1>
      <nav className="guidetoc" id="sommaire" aria-label="Sommaire">
        <a href="#nouveautes">Journal du site</a>
        <a href="#donnees">Changements de données</a>
        {HOW.map((h, i) => <a key={h.title} href={`#aide-${i}`}>{h.title}</a>)}
      </nav>
      <section id="nouveautes">
        <h2>Journal du site</h2>
        <p className="hint">Toutes les mises à jour depuis la mise en ligne sur Vercel, du plus récent au plus ancien. Heures de Paris. Chaque envoi sur le site s'ajoute ici tout seul, quelques minutes plus tard.</p>
        {stale && <p className="hint">GitHub ne répond pas pour le moment : les dernières lignes connues sont affichées.</p>}
        {log.map((n) => (
          <div key={n.date}>
            <h3>{n.date}</h3>
            <ul className="loglist">
              {n.items.map(([time, kind, area, text]) => (
                <li key={time + text}>
                  <span className="logtime">{time || "–"}</span>
                  <span className={`logkind ${kind.toLowerCase().replace("é", "e")}`}>{kind}</span>
                  <span className="logarea">{area}</span>
                  <span className="logtext">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <a className="guidetop" href="#sommaire">↑ Sommaire</a>
      </section>
      <section id="donnees">
        <h2>Changements de données</h2>
        <p className="hint">Ce qui change dans le tournoi, tout seul ou par un éditeur : résultats, horaires, équipes. Les 60 derniers.</p>
        {dataDays.length === 0 && <p className="note">Aucun changement pour l'instant.</p>}
        {dataDays.map((d) => (
          <div key={d.date}>
            <h3>{d.date}</h3>
            <ul className="loglist data">
              {d.items.map((h, i) => (
                <li key={i}>
                  <span className="logtime">{parisTime(h.at)}</span>
                  <span className="logarea">{h.who || "Éditeur"}</span>
                  <span className="logtext">{historyText(h.message)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <a className="guidetop" href="#sommaire">↑ Sommaire</a>
      </section>
      {HOW.map((h, i) => (
        <section key={h.title} id={`aide-${i}`}>
          <h2>{h.title}</h2>
          <ul>{h.points.map((x) => <li key={x}>{x}</li>)}</ul>
          <a className="guidetop" href="#sommaire">↑ Sommaire</a>
        </section>
      ))}
    </div>
  );
}
