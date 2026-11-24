// French for round 18: tonight's page, match start alerts, team comparison and head-to-head, private leagues, server panel.
export const FR18 = {
  "Tonight": "Ce soir", "Updated at {t}": "Mis à jour à {t}", "The stream shows up here as soon as it starts.": "Le stream s'affiche ici dès que le match commence.",
  "Every match of the day is over.": "Tous les matchs du jour sont terminés.",
  "Recent form": "Forme récente", "Last 5 matches, latest on the left": "5 derniers matchs, le plus récent à gauche", "W": "V", "L": "D", "Loss": "Défaite",
  "No result yet.": "Pas encore de résultat.", "Key players": "Joueurs clés", "Best rating, 2 maps at least": "Meilleur rating, 2 maps au moins", "No stats yet.": "Pas encore de stats.", "rating": "rating",
  "Head to head, every season": "Face-à-face, toutes saisons", "{n} match(es) · maps {a}–{b}": "{n} match(s) · maps {a}–{b}", "This season": "Cette saison",
  "Compare the two teams": "Comparer les deux équipes", "From the site's match details.": "D'après le détail des matchs du site.",
  "Join with a code": "Rejoindre avec un code", "League code": "Code de la ligue", "Join": "Rejoindre", "Code: {code}": "Code : {code}",
  "League ranking": "Classement de la ligue", "Open the league page": "Ouvrir la page de la ligue", "Private league": "Ligue privée",
  "This league does not exist (any more).": "Cette ligue n'existe pas (ou plus).", "Ask its creator for the code, or create your own league from the predictions page.": "Demande le code à celui qui l'a créée, ou crée ta propre ligue depuis la page des pronostics.",
  "Points: 1 per right winner, +1 for the exact score, plus the points of Who qualifies? and of the next map.": "Points : 1 par bon vainqueur, +1 pour le score exact, plus les points de « Qui se qualifie ? » et de la map suivante.",
  "Nobody has scored yet: the ranking fills in as the matches end.": "Personne n'a encore marqué : le classement se remplit à la fin des matchs.", "To the predictions": "Vers les pronostics",
  "just now": "à l'instant", "{n} min ago": "il y a {n} min", "{n} h ago": "il y a {n} h", "{n} days ago": "il y a {n} jours", "Not answering": "Ne répond pas",
  "Last backup": "Dernière sauvegarde", "Every night at 4:00, the last 14 kept": "Chaque nuit à 4 h, les 14 dernières gardées", "{n} kept": "{n} gardées",
  "Background task": "Tâche de fond", "Its last full round (every minute)": "Son dernier passage complet (chaque minute)", "Checked at {t}.": "Vérifié le {t}.", "Check again": "Vérifier à nouveau",
  "An alert as soon as a match of your teams starts, even with the site closed.": "Une alerte dès qu'un match de tes équipes commence, même site fermé.",
};

// Friends' groups are called private leagues in French from now on: these replace the earlier words.
export const FR18_RENAME = {
  "Friends' groups": "Ligues privées", "Join this group": "Rejoindre cette ligue", "Groups": "Ligues", "New group": "Nouvelle ligue", "Create the group": "Créer la ligue",
  "A group has its own ranking. Share its link: whoever opens it can join.": "Une ligue a son propre classement. Partage son lien ou son code : tes amis la rejoignent en un clic.",
  "Leave the group": "Quitter la ligue", "Best groups": "Meilleures ligues", "Group": "Ligue", "Make a first prediction to get your name, then join the group.": "Fais un premier pronostic pour avoir ton nom, puis rejoins la ligue.",
};

export const SERVER18 = [
  [/^Group created\.$/, "Ligue créée."], [/^You joined the group\.$/, "Tu as rejoint la ligue."], [/^This group does not exist\.$/, "Cette ligue n'existe pas."],
  [/^You left the group\.$/, "Tu as quitté la ligue."], [/^Unknown group\.$/, "Ligue inconnue."], [/^This group is full\.$/, "Cette ligue est complète."],
  [/^Make a first prediction to get your name, then (create|join) the group\.$/, (m) => `Fais un premier pronostic pour avoir ton nom, puis ${m[1] === "create" ? "crée" : "rejoins"} la ligue.`],
  [/^A group name has 2 to 30 letters or numbers\.$/, "Le nom d'une ligue a 2 à 30 lettres ou chiffres."], [/^You have made 10 groups already\.$/, "Tu as déjà créé 10 ligues."],
];
