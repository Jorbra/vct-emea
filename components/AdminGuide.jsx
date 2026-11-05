// The editor's page of what is new and how things work. Plain text for the editors, in French. To add news: a new entry at the top of NEWS.

const NEWS = [
  {
    date: "5 novembre 2026",
    items: [
      "Suivi automatique de Toornament pour les qualifiers EU, ME et NA : équipes, line-ups, horaires, matchs en cours et résultats.",
      "Saisie rapide des scores : un clic par résultat, sur la page d'un qualifier.",
      "Import de nationalités : une liste « pseudo, pays » à coller, sur l'accueil de l'éditeur.",
      "Barre de navigation sur toutes les pages publiques, et avancement du jour sur l'accueil.",
      "Bracket : équipes favorites marquées, avec leur prochain match. Programme : filtres par jour, round et équipe.",
      "Page Parcours d'une équipe, à partager.",
      "Discord : les annonces simultanées sont regroupées en quelques messages.",
    ],
  },
  {
    date: "4 novembre 2026",
    items: [
      "Qualifier 1 : bracket de 256 équipes, avec les rosters, les logos et les horaires de Toornament.",
      "Bracket interactif : glisser pour le déplacer, survol du chemin d'une équipe, clic pour ouvrir un match, recherche d'une équipe.",
      "Fenêtre et page d'un match : les rosters des deux équipes.",
      "Éditeur : panneau « Jour et heure de chaque round ».",
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
        <a href="#nouveautes">Nouveautés</a>
        {HOW.map((h, i) => <a key={h.title} href={`#aide-${i}`}>{h.title}</a>)}
      </nav>
      <section id="nouveautes">
        <h2>Nouveautés</h2>
        {NEWS.map((n) => (
          <div key={n.date}>
            <h3>{n.date}</h3>
            <ul>{n.items.map((x) => <li key={x}>{x}</li>)}</ul>
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
