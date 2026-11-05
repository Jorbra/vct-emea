// The editors' page: the whole site's log and how things work. In French. Each update: a new line at the top of LOG, with its date and time.

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
      "Les visiteurs choisissent d'être alertés depuis la page d'une équipe : à l'heure du match, quand il passe en direct et au résultat.",
      "Si un lien Discord est réglé sur Vercel (DISCORD_WEBHOOK_URL), les mêmes annonces y partent, regroupées.",
      "Le travail régulier part à chaque visite du site et à chaque appel de https://vct-emea.vercel.app/api/tick. Un service comme cron-job.org qui appelle cette adresse garde tout à l'heure, même sans visiteur.",
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

export default function AdminGuide() {
  return (
    <div className="wrap guide">
      <p><a className="btn" href="/admin">‹ Retour à l'éditeur</a></p>
      <h1>Nouveautés et mode d'emploi</h1>
      <nav className="guidetoc" aria-label="Sommaire">
        <a href="#nouveautes">Journal du site</a>
        {HOW.map((h, i) => <a key={h.title} href={`#aide-${i}`}>{h.title}</a>)}
      </nav>
      <section id="nouveautes">
        <h2>Journal du site</h2>
        <p className="hint">Toutes les mises à jour depuis la mise en ligne sur Vercel, du plus récent au plus ancien. Heures de Paris.</p>
        {LOG.map((n) => (
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
      </section>
      {HOW.map((h, i) => (
        <section key={h.title} id={`aide-${i}`}>
          <h2>{h.title}</h2>
          <ul>{h.points.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
