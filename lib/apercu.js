// New things shown first to the main account and the editors, then to everyone with one switch in the editor (no new
// deployment). Each one is a name here; the switch is saved in the kv table ("apercu:<name>" = "public"). Pure but for the db.

/** The new things that can wait in preview: name -> what it changes (French, as the editor shows it). */
export const APERCU = {
  pictos: { title: "Pictos des rounds", text: "Tête de mort, explosion, spike barré et chrono à la place des symboles, sur la page du match et /live." },
  cartes: { title: "Cartes des joueurs", text: "L'agent en entier en haut de la carte, sans le gros rond à initiale par-dessus." },
  perdant: { title: "Perdant lisible", text: "Le nom de l'équipe perdante en gris clair au lieu d'être presque invisible." },
  logos: { title: "Logos sombres lisibles", text: "Un fond clair discret derrière les logos noirs ou très sombres, en mode sombre (TH, UCAM…)." },
  flash: { title: "Flash des scores", text: "Un score qui change à l'écran (round, carte, série) s'illumine un instant." },
  projection: { title: "Classement suisse projeté", text: "Pendant les matchs, un bouton montre le tableau suisse s'ils finissaient maintenant, avec les places gagnées ou perdues." },
  alertes: { title: "Alertes carte décisive et prolongation", text: "Une notification aux fans des deux équipes quand un match va en carte décisive ou qu'une carte part en prolongation. Une notification ne se prévisualise pas : elles partent seulement une fois ouvert à tout le monde." },
  photos: { title: "Photos des joueurs", text: "La photo de chaque joueur (Liquipedia, sinon vlr.gg) sur sa page et sur les cartes de l'effectif. Elles arrivent au fur et à mesure que les fiches sont relues." },
  resume: { title: "Résumé des matchs", text: "En haut de la page d'un match fini : qui gagne, la carte la plus serrée, le meilleur joueur, en trois phrases." },
  fiche: { title: "Nouvelle page joueur", text: "La page d'un joueur comme sur Liquipedia et vlr.gg : bandeau avec photo, nom, pays, équipe et chiffres clés, onglets (Aperçu, Stats, Matchs, Historique) et fiche d'identité (naissance, âge, autres pseudos, agents signature…).", href: "/stats" },
  // the big update (maj-40)
  direct2: { title: "Direct plus détaillé", text: "Pendant un match : « Balle de carte » et « Balle de match », le score à la mi-temps, « UCAM a gagné les 4 derniers rounds », une étoile pour le meilleur joueur, les prolongations marquées et le dernier round qui clignote, sur la page du match et /live.", href: "/live" },
  match2: { title: "Page du match : partage et heure", text: "Le score dans le titre de l'onglet pendant le direct, « dans 2 h 15 » à côté de l'heure d'un match à venir, et des boutons Partager (menu du téléphone) et Copier le résultat.", href: "/live" },
  recherche: { title: "Recherches récentes et 404 utile", text: "La barre de recherche propose tes 5 dernières recherches, et la page « introuvable » suggère les pages qui ressemblent à l'adresse demandée." },
  rss: { title: "Flux RSS des actualités", text: "Un flux RSS des actualités (/news/rss.xml) et un lien « S'abonner (RSS) » sur la page Actualités.", href: "/news" },
  impression: { title: "Impression propre", text: "Imprimer une page (match, tableau, équipe) n'imprime plus le menu, les bandeaux ni les boutons : seulement le contenu, en noir sur blanc." },
  confort: { title: "Confort de lecture", text: "Une ombre sur le bord des tableaux trop larges pour l'écran (il en reste à faire défiler), des barres de défilement fines aux couleurs du thème, le texte sélectionné aux couleurs du site et une barre de lecture en haut des actualités." },
  stories2: { title: "Nouvelles stories", text: "Les stories des résultats de l'accueil : en fond, la carte jouée floutée aux couleurs du vainqueur, les cartes en vignettes, « Victoire » sous le gagnant, une barre qui avance toute seule (6 s par story, appui long pour mettre en pause), glisser pour passer ou vers le bas pour fermer, et un anneau en dégradé pour celles pas encore vues.", href: "/" },
  // the big wave (grande-vague)
  cartes2: { title: "Cartes et scores plus lisibles", text: "Un petit « Prol. » sur les cartes parties en prolongation (pastilles, page du match), le logo du vainqueur de chaque carte sur la page du match, l'image de la carte dans le tableau des cartes, et des points sous le score qui montrent où en est la série (Bo3 : 2 points par équipe).", href: "/" },
  rounds2: { title: "Les rounds des matchs finis", text: "Sur la page d'un match fini (onglet Stats) : la bande des rounds de chaque carte, qui a gagné les pistols, la plus longue série et la plus grosse remontée. Sur la page d'une équipe : son pourcentage de rounds pistol gagnés. Les matchs déjà lus se complètent petit à petit (une page vlr.gg relue toutes les 2 minutes environ).", href: "/" },
  podium: { title: "Podium des qualifiers", text: "En haut de la page d'un qualifier terminé : le vainqueur, le finaliste et le troisième sur un podium, avec leurs logos et un lien vers leur page.", href: "/" },
  ecran: { title: "Écran qui reste allumé", text: "Sur l'écran secondaire et sur /live avec un stream, l'écran du téléphone ne se met plus en veille pendant le match.", href: "/live" },
};

const key = (name) => `apercu:${name}`;

/** { name: true } for the new things open to everyone. */
export function publicApercu(db) {
  const out = {};
  for (const name of Object.keys(APERCU)) {
    const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(key(name));
    out[name] = !!r && r.value === JSON.stringify("public");
  }
  return out;
}

/** The names a visitor sees: every one for an editor, those open to everyone otherwise. */
export function shownApercu(db, editor) {
  const open = publicApercu(db);
  return Object.keys(APERCU).filter((name) => editor || open[name]);
}

/** Opens a new thing to everyone (on: true) or puts it back in preview. { ok, message } | { ok: false, status, error }. */
export function setApercu(db, name, on) {
  if (!APERCU[name]) return { ok: false, status: 400, error: "Unknown new thing." };
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key(name), JSON.stringify(on ? "public" : "preview"));
  return { ok: true, message: on ? `Nouveauté ouverte à tout le monde : ${APERCU[name].title}` : `Nouveauté remise en aperçu éditeurs : ${APERCU[name].title}` };
}
