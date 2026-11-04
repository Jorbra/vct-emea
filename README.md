# VCT EMEA Kickoff Qualifier Playoffs

Site de tournoi en Next.js (JavaScript) avec une base SQLite.

- Le public voit le format, le prize pool, les 16 équipes, le tableau Swiss, le bracket et les statistiques.
- Un éditeur se connecte avec un mot de passe, active le **mode édition**, et saisit les équipes et les scores.
- Tout le reste est calculé : bilans, qualifiés (3 victoires), éliminés (3 défaites), rounds suivants,
  bracket, finale, prize pool. La page se met à jour toute seule toutes les 15 secondes.

## En ligne : Vercel, Turso et GitHub

- **Vercel** affiche le site (région `fra1`, voir `vercel.json`). Il n'a pas de disque durable : la base, les fiches et les logos sont dans Turso.
- **Turso** garde la base. Le site lui parle directement, sans copie locale (une copie consomme vite le quota de synchronisation). Pour limiter les lectures, un visiteur peut voir un changement avec 10 secondes de retard ; un éditeur connecté voit toujours le dernier état.
- **GitHub Actions** lance `scripts/worker.mjs` toutes les 10 minutes environ (`.github/workflows/worker.yml`) : une page Liquipedia et une page vlr.gg toutes les 30 secondes pendant quelques minutes, et les annonces Discord. Ce passage peut arriver bien plus tard que prévu : une fiche demandée par un visiteur ne l'attend pas, le site la lit lui-même juste après avoir affiché la page. Les deux partagent un tour de 30 secondes par source. GitHub désactive cette tâche après 60 jours sans activité sur le dépôt.

Variables à définir sur Vercel : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Secrets à définir sur GitHub : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, et `DISCORD_WEBHOOK_URL` si besoin.

Sur son ordinateur, l'adresse et le token de Turso vont dans `.env.turso` (jamais envoyé). Pour recopier des données locales vers Turso, ce qui remplace ce qu'il contient : `node scripts/turso-import.mjs ../vct-kickoff --again`.

**Attention :** les conditions d'utilisation de vlr.gg interdisent la collecte automatique. S'il refuse l'accès, la lecture s'arrête 24 heures sans chercher à contourner. Limites gratuites : voir les pages de Vercel, de Turso et de GitHub.

## Démarrer

Il faut Node.js 20.9 ou plus récent.

```bash
npm install
cp .env.example .env.local     # puis ouvre .env.local et remplis les deux valeurs
npm run dev                    # http://localhost:3000
```

Dans `.env.local` :

- `ADMIN_PASSWORD` : le mot de passe éditeur.
- `SESSION_SECRET` : une longue chaîne aléatoire (`openssl rand -hex 32`).

Au premier lancement, la base `data/kickoff.db` est créée avec les 16 emplacements : 6 équipes invitées connues (avec les joueurs déjà annoncés), 2 invitations à compléter, et 8 places qualifiées (Qualifier 1 et Qualifier 2, de la 1re à la 4e place).
Une base créée avec la première version est mise à niveau automatiquement au démarrage, sans rien perdre.

## Utiliser le site

1. Sur ordinateur, appuie sur la touche **E** ; sur téléphone, touche le bouton **Editor sign in**. Entre ensuite le mot de passe.
2. Active **Edit mode**. Clique sur une équipe pour changer son nom, son tag, son statut (Invited ou Qualified) et son roster (les noms des joueurs, séparés par des virgules).
3. Onglet **Swiss Stage** : **Generate round 1** crée les 8 matchs (invités contre qualifiés). Saisis les scores (Bo3), puis **Generate round 2**, et ainsi de suite jusqu'à 8 équipes à 3 victoires.
4. Onglet **Bracket** : **Generate bracket** crée les groupes A et B. Les vainqueurs des demi-finales passent seuls en finale (Bo5).
5. Le prize pool (places 1 à 23) se remplit seul : les 2 équipes qualifiées pour Kickoff, les places 3 et 4, les perdants de demi-finale (5 à 8, classés selon le tableau Swiss) et les éliminés du Swiss (9 à 16). Les places 17 à 23 restent TBD. **Swap 3rd and 4th place** inverse les places 3 et 4.

Les boutons Reset demandent une confirmation. Réinitialiser le Swiss efface aussi le bracket.

## Tests

```bash
npm test
```

Ils simulent des tournois complets (dont 100 Swiss aléatoires) sur une base en mémoire, vérifient la validation des scores et les sessions éditeur.

## Mettre en ligne

SQLite écrit dans un fichier : il faut un hébergement avec un **disque persistant** (un petit VPS, Railway ou Fly.io avec un volume, par exemple).
Vercel ne convient pas tel quel, car son disque est effacé à chaque déploiement.

```bash
npm run build
npm start
```

Mets `ADMIN_PASSWORD` et `SESSION_SECRET` dans les variables d'environnement de l'hébergeur, et sauvegarde le dossier `data/`.
Utilise HTTPS : le cookie éditeur n'est marqué « secure » que sur une connexion HTTPS.

## Structure

```
app/page.js                 page publique (lit la base à chaque requête)
app/api/…                   routes : login, logout, équipes, scores, génération, reset, état public (GET /api/state)
components/Tournament.jsx   toute l'interface (onglets, tableaux, bracket, mode édition)
lib/tournament.js           règles : bilans, pairings suisses, bracket, prize pool
lib/actions.js              écritures validées en base
lib/db.js                   schéma SQLite et lecture
lib/auth.js                 mot de passe, cookie signé, limite de tentatives
tests/                      tests Node
```

Les logos officiels (VCT, équipes) ne sont pas inclus : les équipes ont une pastille avec leurs initiales.

## Logos et drapeaux

- **Logo d'équipe (automatique)** : le logo est lié au **tag court**. Dépose `public/logos/<TAG>.png` (ex. `VIT.png`, `KC.svg`) ; majuscules/minuscules sans importance. Formats : png, svg, webp, jpg. Une équipe sans tag n'a pas de logo automatique.
- **Logo d'équipe (manuel)** : en mode éditeur, champ « Logo link » (lien `https://…` ou chemin `/logos/x.png` si tu poses le fichier dans `public/logos/`). Vide = initiales.
- **Pays des joueurs** : dans le champ Roster, ajoute le code pays après chaque pseudo : `azury|fr, musashi|de, Fizzy|gb-eng`. Les drapeaux viennent de flagcdn.com (connexion internet requise côté visiteur).

## Ne jamais avoir à relancer

- **Données** (base SQLite, scores, rosters, noms) : lues à chaque affichage. Le site **et l'éditeur** se rafraîchissent tout seuls toutes les 5 secondes et quand tu reviens sur l'onglet (jamais pendant que tu tapes dans un champ ; une modification pas encore enregistrée est gardée). Une saisie faite par un autre éditeur, dans un autre onglet ou directement dans la base apparaît donc sans recharger.
- **Logos** : déposés dans `public/logos/`, servis en direct (`/api/logos/…`), aucun redémarrage ni rebuild.
- **Code** : avec `npm run dev`, chaque modification de fichier est appliquée à chaud. Lance-le une fois et laisse la fenêtre ouverte.

## Page d'édition

La touche **E** (hors d'un champ de saisie) ou le bouton sur téléphone ouvre l'éditeur depuis n'importe quelle page, y compris une page introuvable : sur l'événement affiché, sinon sur son accueil. Connecte-toi avec `ADMIN_PASSWORD`. **L'accueil de l'éditeur** (`/admin`, petite maison de la navigation) montre ce qui est à faire (matchs en direct, matchs dont l'horaire est passé sans score), les prochains matchs et l'état de chaque événement ; un clic ouvre le bon onglet. Trois onglets : **Teams** (nom, tag, entrée, logo, joueurs avec pays), **Matches** (scores) et **Tournament** (générer les tours, bracket, réinitialiser). Le site public se met à jour tout seul.

Chaque joueur a une case **Sub** : les remplaçants apparaissent sur le site dans un onglet **Subs** de la carte d'équipe, à part des 5 titulaires (jusqu'à 8 joueurs par équipe). Dans l'import en masse des Qualifiers, un sub s'écrit `pseudo|pays|sub`.

Quand tu tapes le pseudo d'un joueur ou d'un coach, l'éditeur propose ceux déjà sur le site et tous les joueurs et membres du staff Valorant listés sur [Liquipedia](https://liquipedia.net/valorant/Portal:Players) (licence CC-BY-SA). Choisir un nom remplit aussi le pays, et effacer le nom efface le pays. La liste est dans `lib/valorant-players.json`. Pour la mettre à jour (environ 4 minutes) :

```bash
npm run players
```

Tout le monde a une page sur le site : joueurs, coachs et staff (`/player/<nom>`), toute équipe connue de Liquipedia même si elle ne joue pas ici (`/team/<nom>`), et les tournois des palmarès (`/tournament/...`). Ces pages reprennent de Liquipedia (CC-BY-SA) le vrai nom, la nationalité, le rôle, les gains, les liens, les anciennes équipes, l'effectif, les derniers résultats et le classement des tournois, gardés dans `data/player-info.json`, `data/team-info.json` et `data/tournament-info.json`. Une page encore jamais lue est récupérée quand quelqu'un l'ouvre, en priorité. Le serveur lit une fiche toutes les 30 secondes : ce qu'un visiteur vient d'ouvrir, puis les équipes du site, puis leurs joueurs et leur staff, relus toutes les deux semaines. Les statistiques par agent et les résultats récents viennent de vlr.gg (`data/vlr-info.json`), à une page toutes les 30 secondes, depuis les profils indiqués par Liquipedia et les équipes actuelles des joueurs. **Attention : les conditions d'utilisation de vlr.gg interdisent la collecte automatique** ; il peut bloquer le site ou demander d'arrêter. S'il refuse (403, 429, 503), la lecture s'arrête 24 heures sans chercher à contourner, et les données déjà gardées restent affichées. Pour tout couper : enlever `startVlrWorker` de `instrumentation.js`. La mention « Liquipedia (CC-BY-SA) » en bas de ces pages reste obligatoire : c'est la condition de leur licence. Les pseudos n'étant pas uniques, une page n'est gardée que si sa nationalité ou son équipe correspond à celles du site : sans correspondance, la page joueur reste sans ces informations. L'équipe affichée reste celle du site ; si Liquipedia en indique une autre, elle apparaît à part. Pour tout lire d'un coup (jusqu'à 30 secondes par joueur) : `npm run player-info`.

Le nom d'équipe marche pareil : l'éditeur propose les équipes du site et toutes les équipes Valorant de Liquipedia, avec leur logo et leur tag. Choisir une équipe remplit le nom et le tag, et enregistre son logo dans `public/logos/<TAG>.png` si ce tag n'a pas encore de logo (un logo ajouté à la main n'est jamais remplacé). Les logos affichés dans les suggestions sont gardés dans `data/lp-logos`, pour ne les télécharger qu'une fois. La liste est dans `lib/valorant-teams.json`. Pour la mettre à jour (environ 5 minutes) :

```bash
npm run teams
```

## Langue

Le site est en français par défaut. Le bouton **FR | EN** en haut à droite change la langue (site public et page `/admin`) ; le choix est mémorisé dans un cookie. Les textes sont dans `lib/i18n.js` (l'anglais sert de clé : un texte absent du dictionnaire reste en anglais).

## Staff

Chaque équipe peut avoir un **coach** et un **coach adjoint** (jusqu'à 4 membres du staff). Ils s'ajoutent dans `/admin`, onglet Équipes, section Staff (nom, rôle, pays), et s'affichent dans l'onglet **Staff** du roster sur le site.

## Qualifier 1 et Qualifier 2

Les onglets **Qualifier 1** et **Qualifier 2** sont de vrais tableaux à élimination directe (jusqu'à 64 équipes : tour de 64, 32, huitièmes, quarts, demies, finale + match pour la 3e place ; les 4 premiers se qualifient).

Dans `/admin`, onglets *Qualifier 1* / *Qualifier 2* :
1. Colle les équipes, une par ligne, dans l'ordre du tableau (lignes 1 et 2 = premier match, 3 et 4 = deuxième…). Une ligne vide = emplacement vide (bye). Roster et staff sont facultatifs : `Nom ; joueur|fr, joueur|de, … ; coach|fr|coach, adjoint|de|assistant`.
2. Choisis le format (Bo1 / Bo3 / Bo5) de chaque tour.
3. Saisis les scores : les vainqueurs avancent seuls. Si tu changes un résultat, les matchs qui en dépendaient sont effacés.

Les logos des équipes de Qualifier se trouvent automatiquement dans `public/logos/` d'après le tag court de l'équipe (`JBL.png`…).

La page publique affiche la **dotation** (places 1-4, puis 5-8, 9-16, 17-32, 33-64 repliables), les **participants** (onglets Top 16 / Top 64 / Tout afficher, avec cartes de roster) et le tableau avec le match pour la 3e place. Tout se remplit tout seul au fil des scores.

## Kickoff : qui va où

Triple élimination comme au VCT EMEA Kickoff. Dans l'éditeur, tu ne choisis que les **8 équipes du Tour 1** du tableau supérieur et les **4 têtes de série des quarts**. Tout le reste se remplit seul :

- les vainqueurs avancent dans leur tableau ;
- perdants du Tour 1 et des quarts du tableau supérieur : Tour 1 du tableau intermédiaire (perdant du quart 4 contre perdant du Tour 1 match 1, … quart 1 contre match 4) ;
- perdants des demies supérieures : quarts intermédiaires ; perdant de la finale supérieure : finale intermédiaire ;
- perdants du Tour 1 intermédiaire : Tour 1 inférieur ; du Tour 2 intermédiaire : Tour 2 inférieur (croisés) ; des quarts, de la demie et de la finale intermédiaires : Tour 3, demie et finale inférieures.

Les 3 vainqueurs (supérieur, intermédiaire, inférieur) se qualifient.

## Kickoff dans la base de données

La page **Kickoff** est stockée dans deux vraies tables de `data/kickoff.db`, modifiables dans DB Browser comme les autres :

- `kteams` : les 12 participants (`slot` 1 à 12, `name`, `tag`, `status` invited/qualified, `source`, `pos`, `logo`, `roster`, `staff`).
- `kmatches` : un match par ligne (`id` comme `u1-1`, `u2-3`, `m5`, `l6`), avec `a` / `b` (équipes choisies à la main, numéro de `slot`) et `sa` / `sb` (score, avec `pa` / `pb` = les équipes pour lesquelles il a été saisi).

Les modifications faites dans la base apparaissent sur le site en quelques secondes, sans relancer. Les données de la version précédente sont reprises automatiquement au premier démarrage.

## Türkiye Qualifier Playoffs

8 équipes : 4 invitées (Eternal Fire, PCIFIC Esports, Fire Flux Esports, Beşiktaş Esports) et 4 qualifiées (1er et 2e des Qualifier 1 et 2). Deux groupes GSL de 4, puis un tableau à double élimination de 4 équipes (A1 contre B2, B1 contre A2). Tout en Bo3, la finale en Bo5.

Dans l'éditeur (`/admin/vctemea/turkiye/playoff/teams`) : **Équipes** pour les 8 fiches, **Matchs** pour choisir les deux équipes de chaque match d'ouverture des groupes et saisir les scores. Tout le reste se remplit seul (match des gagnants, d'élimination, décisif, puis le tableau). Le vainqueur prend tout seul la place « TR Qualifier » du Kickoff.

Avant, **Qualifier 1** et **Qualifier 2** de Türkiye : le même tableau ouvert que les Qualifiers EU (jusqu'à 64 équipes, match pour la 3e place, import en masse), mais seuls le **1er et le 2e** vont aux Qualifier Playoffs. Ils remplissent tout seuls les places « Qualifier 1 · 1er / 2e » et « Qualifier 2 · 1er / 2e » des Playoffs (ces fiches sont alors verrouillées dans l'éditeur). Si le résultat disparaît, la place se vide ; une équipe tapée à la main dans une place sans résultat reste.

## MENA Qualifier Playoffs

4 équipes qualifiées : le vainqueur de ME Qualifier 1, ME Qualifier 2, NA Qualifier 1 et NA Qualifier 2. Tableau à élimination directe : demi-finales North Africa #1 contre #2 et Middle East #1 contre #2, puis la finale (jouée en LAN). Tout en Bo5. Places : 1, 2, puis 3-4 partagée.

Dans l'éditeur (`/admin/vctemea/mena/playoff/teams`) : **Équipes** pour les 4 fiches, **Matchs** pour choisir les deux équipes de chaque demi-finale (en général North Africa #1 contre #2, Middle East #1 contre #2) et saisir les scores ; la finale se remplit seule. Le vainqueur prend tout seul la place « MENA Qualifier » du Kickoff. Les pages des 4 Qualifiers MENA n'existent pas encore : leurs vainqueurs se tapent à la main dans les fiches.

Dans la base, Türkiye et MENA partagent les tables `rteams` (une ligne par équipe : `event` `tr` ou `mena`, `slot`, `name`, `tag`, `status`, `source`, `pos`, `roster`, `staff`, `auto`) et `rmatches` (une ligne par match : `event`, `id`, `a` / `b`, `sa` / `sb`, `pa` / `pb`).

Partout où tu choisis les équipes d'un match (matchs d'ouverture de Türkiye, demi-finales MENA, places à la main du Kickoff), une équipe déjà placée est grisée « (déjà placée) » et refusée : une seule fois par événement pour Türkiye et MENA, une seule fois par tableau (supérieur, milieu, inférieur) pour le Kickoff, où une équipe qui perd redescend d'un tableau à l'autre.

Pour les **Playoffs EU** (`/admin/playoffs/matches`), chaque tour de la phase suisse se tire aussi à la main, par bilan comme sur le site (tour 2 : 1-0 et 0-1 ; tour 3 : 2-0, 1-1, 0-2 ; tour 4 : 2-1 et 1-2 ; tour 5 : 2-2). Chaque menu ne propose que les équipes de ce bilan, et une équipe joue une fois par tour. Un tour se tire quand le précédent est complet et joué, et se verrouille dès que le suivant existe. Les demi-finales des groupes A et B se tirent parmi les 8 équipes à 3 victoires. Le bouton « Générer » de l'onglet Tournoi tire toujours tout un tour d'un coup (on peut ensuite corriger à la main).

## Page d'accueil et adresses des onglets

`/` est la **page d'accueil** : les 12 places du Kickoff (logos, places encore à prendre), puis une carte par événement (Europe, Türkiye, MENA, Kickoff, Game Changers) avec son état (*À venir*, *En cours*, *Terminé*), le nombre d'équipes et les équipes qualifiées dès qu'elles sont connues. Elle se met à jour toute seule comme le reste du site. Sur les autres pages, l'onglet **⌂ Accueil** et le logo EMEA du titre y ramènent.

Chaque onglet a sa propre adresse complète, qui suit les rangées d'onglets (circuit / région / phase / section), et le bouton « retour » du navigateur fonctionne :

| Site | Adresse |
|---|---|
| EU Qualifier Playoffs | `/vctemea/eu/playoff/overview`, `…/swiss`, `…/bracket`, `…/stats` |
| EU Qualifier 1 / 2 | `/vctemea/eu/qualifier-1/overview`, `/vctemea/eu/qualifier-2/overview` |
| Türkiye Qualifier Playoffs | `/vctemea/turkiye/playoff/overview`, `…/stats` |
| Türkiye Qualifier 1 / 2 | `/vctemea/turkiye/qualifier-1/overview`, `/vctemea/turkiye/qualifier-2/overview` |
| MENA Qualifier Playoffs | `/vctemea/mena/playoff/overview`, `…/stats` |
| Kickoff | `/vctemea/kickoff/overview` |
| VCT GC EMEA | `/vctgcemea/overview` |

Une adresse raccourcie (`/vctemea`, `/vctemea/turkiye`, `/vctemea/eu/playoff`…) ou ancienne (`/playoffs/swiss`, `/kickoff`, `/gc-emea`…) renvoie toute seule vers l'adresse complète : les anciens liens partagés marchent encore.

La navigation tient dans une seule carte (site et éditeur) : la bande du haut pour le circuit (**VCT EMEA** rassemble EU, MENA, Türkiye et Kickoff ; **VCT GC EMEA** ouvre Game Changers ; sur le site, la petite maison ramène à l'accueil), puis la région, puis la phase en pastilles. Sur le site, le bas de la carte montre l'état de l'événement (*À venir* avant la date de début, *En cours* entre les deux dates, *Terminé* après la date de fin ou dès que le vainqueur est connu ; sans date, d'après les résultats saisis), ses dates, le lieu, le type et le nombre d'équipes.

**Informations de l'événement** : dans l'éditeur, sous la carte de navigation, le bloc « Informations de l'événement » (cliquer pour l'ouvrir) règle pour l'événement affiché la date de début, la date de fin (case « Jour pas encore connu » pour ne donner que le mois ; vide = « Dates à annoncer »), le type (En ligne, Présentiel, les deux), le lieu, la salle et le tier. Ils s'affichent sur le site dans la carte de navigation, l'encadré d'informations, le compte à rebours du bandeau et les cartes de la page d'accueil. Stockés dans la table `einfo` de `data/kickoff.db` (une ligne par événement).

**Date et heure des matchs** : dans l'onglet Matchs de l'éditeur, chaque match a un champ « Horaire » (date et heure, enregistré dès qu'on quitte le champ ; × pour l'effacer). On peut le régler avant même que les équipes du match soient connues. L'heure se tape dans le fuseau de ton ordinateur et chaque visiteur la voit dans le sien. Sur le site : une ligne avec l'horaire dans chaque case du tableau (Kickoff, Türkiye, MENA) et à côté des matchs de l'élimination directe EU, plus une section **Programme** (jour par jour, avec équipes et scores) sur l'Aperçu de chaque événement dès qu'un match a un horaire. Stocké dans la table `mtimes` (événement, id du match, instant en UTC).

**Programmer un match puis le passer en direct** : un match se prépare sans résultat. On choisit ses équipes (là où elles se choisissent à la main) et son horaire, et il apparaît sur le site comme « à venir » (équipe vs équipe). Pendant qu'il se joue, le bouton **« Marquer en direct »** de sa ligne (actif une fois les deux équipes connues) affiche un badge rouge **EN DIRECT** dans sa case, dans le Programme (bloc « En direct » en haut) et sur la page d'accueil. Le badge disparaît tout seul dès que le score est enregistré, ou avec « Arrêter le direct ». Pendant le direct, **« Score en cours »** apparaît à côté du bouton : les boutons **+** ajoutent une map à l'équipe 1 ou 2 (1-0, 1-1…), **↺** revient à 0-0. Le maximum suit le format du match : 0-0 en Bo1, jusqu'à 1-1 en Bo3, jusqu'à 2-2 en Bo5. Chaque carte « Prochains matchs » et chaque ligne du Programme indique aussi le format (Bo1, Bo3 ou Bo5). Ce score s'affiche en rouge sur les cartes « Prochains matchs », dans le Programme et dans les cases du tableau ; ce n'est pas un résultat : à la fin, entre le score final comme d'habitude. Il est gardé dans la table `mlive` (colonnes `la`, `lb`). Les **Prochains matchs** s'affichent en cartes qui défilent (flèches ‹ ›), comme sur Liquipedia : badge EN DIRECT ou compte à rebours (« 21h 43m 8s », « 1j 21h 43m »), tour, les deux équipes. L'interrupteur « Afficher le compte à rebours » montre la date et l'heure à la place (choix gardé dans le navigateur). Sur la page d'accueil : tous les événements (12 cartes au plus, avec le nom de l'événement) ; en haut de chaque page d'événement : ses propres matchs. Un match reste affiché 6 heures après son horaire tant que son score n'est pas entré. Table `mlive` (événement, id du match).
 Les sections de la page (Aperçu, Phase suisse… ou Équipes / Matchs dans l'éditeur) sont juste en dessous. Revenir sur VCT EMEA ramène au dernier onglet ouvert.

Éditeur : `/admin/vctemea/eu/qualifier-1`, `/admin/vctemea/eu/qualifier-2`, `/admin/vctemea/eu/playoff/teams` (`/matches`, `/tournament`), `/admin/vctemea/turkiye/playoff/teams` (`/matches`), `/admin/vctemea/turkiye/qualifier-1` et `/qualifier-2`, `/admin/vctemea/mena/playoff/teams` (`/matches`), `/admin/vctemea/kickoff/teams` (`/matches`), `/admin/vctgcemea` (équipes GC : « + Ajouter une équipe », puis nom, tag, joueuses et staff ; tant qu'il n'y a aucune équipe, le site affiche « bientôt »). `/admin` et les anciennes adresses renvoient vers ces adresses. La touche **E** ouvre l'éditeur sur l'événement affiché, et « ← Retour au site » ramène à la page de l'événement en cours d'édition.

## Détails des matchs, pages équipe, MENA et Game Changers

- **Détails d'un match (éditeur)** : sous chaque match, le bouton **Détails ▾** ouvre le lien du **stream**, le lien de la **VOD** (« Revoir ») et les **maps** (nom, rounds de chaque équipe, qui l'a choisie ou Decider ; autant de lignes que le format : 1, 3 ou 5). Le bloc « Informations de l'événement » a aussi un **lien du stream par défaut**, utilisé quand un match n'a pas le sien. Table `mextra` (et colonne `stream` de `einfo`).
- **Annuler, historique, sauvegardes, comptes** : le bouton **↶ Annuler** de l'éditeur défait la dernière modification (les 50 dernières, une par une ; pas les logos envoyés). L'accueil de l'éditeur montre l'historique (qui a changé quoi). La base est copiée chaque jour dans `data/backups` (14 gardées), et « Télécharger une copie maintenant » permet d'en garder une ailleurs ; pour restaurer, arrête le serveur et remplace `data/kickoff.db` (et supprime `kickoff.db-wal`, `kickoff.db-shm`) par la copie. Le compte principal (`ADMIN_PASSWORD`, nom vide à la connexion) crée et supprime des comptes éditeurs depuis l'accueil de l'éditeur.
- **Saisons** : sur l'accueil de l'éditeur, « Archiver la saison » fige une copie de tout (table `seasons`), consultable sur `/archives` ; « Effacer tous les résultats » prépare la saison suivante et garde les équipes.
- **Liens partagés** : chaque page a son titre et une description (état, dates, équipes), que Discord ou X affichent avec une image (`lib/preview.js`).
- **Suivre les matchs** : l'étoile d'une page équipe l'ajoute aux favoris du visiteur (gardés dans son navigateur) : elle apparaît dans « Mes équipes » sur l'accueil et ses matchs passent en premier. `/calendar` montre tous les matchs par mois, filtrables, avec un abonnement d'agenda (`/api/calendar`). La fenêtre d'un match lit le stream, la VOD et les temps forts (nouveau lien) sur place quand ce sont des liens Twitch ou YouTube. `/overlay` (ou `/overlay?event=kickoff`) est une source navigateur pour OBS. **Discord** : mets `DISCORD_WEBHOOK_URL=<adresse du webhook>` dans `.env.local` et relance le serveur : il annonce les passages en direct et les résultats.
- **Joueurs et statistiques** : `/player/<pseudo>` pour chaque joueur d'une équipe du site. Dans le panneau **Détails** d'un match : **MVP** et statistiques (K, D, A, ACS) des joueurs, proposés d'après les rosters ; ces chiffres se saisissent à la main. Le site en tire le classement des joueurs et des MVP, les maps les plus jouées, le bilan par map d'une équipe, et le bouton **Comparer les équipes** de la fenêtre d'un match.
- **Actualités** : écrites sur l'accueil de l'éditeur, affichées sur l'accueil et sur `/news`.
- **Pronostics** : `/predictions`, sans compte : le visiteur choisit un nom et ses vainqueurs avant le début des matchs ; un code secret reste dans son navigateur. L'accueil de l'éditeur permet de retirer un participant.
- **Alertes** : un bouton sur l'accueil et le calendrier active les alertes du navigateur (favoris s'il y en a, sinon tous les matchs), tant qu'une page du site est ouverte.
- **Saisie rapide** : « Programmer un tour entier » au-dessus des matchs ; le **⋯** d'une case du tableau du Kickoff ouvre son horaire, son stream, ses maps. Les fiches Liquipedia se relisent seules après 7 jours.
- **Effacer un match (éditeur)** : le bouton **Effacer** d'une ligne de match, confirmé par un second clic (« Sûr ? »), enlève tout le match : score, équipes choisies à la main, horaire, direct, stream, VOD et maps. Les équipes qui viennent d'un résultat précédent ou de la liste des équipes d'un qualifier restent, et les scores suivants qui dépendaient de ce match tombent. Une fois le tour suivant de la phase suisse créé, les équipes d'un match restent aussi (le message le dit).
- **Fenêtre d'un match (site)** : un clic sur une carte « Prochains matchs » / « Résultats récents », une ligne du Programme ou une case du tableau ouvre le match : équipes, score (ou score en cours), maps, bouton **Regarder le stream** (avant / pendant), **Revoir (VOD)**, et **Ajouter à Google Agenda** / **Ajouter à mon agenda (.ics)** pour un match à venir. Les cartes en direct ont aussi un bouton « ▶ Regarder ».
- **Résultats récents** : une bande de cartes comme « Prochains matchs », avec les derniers scores, sur l'accueil (tous les événements) et en haut de chaque événement.
- **Pages équipe** : `/team/<nom>` (ex. `/team/eternal-fire`) : roster et staff, prochains matchs, résultats récents, tous ses matchs (clic = fenêtre du match) et sa saison (événements, entrée, bilan matchs et maps). Le nom d'une équipe mène à sa page partout (cartes équipes, cartes de matchs, fenêtre d'un match).
- **Infos des équipes depuis Liquipedia** : les pages équipe affichent les liens (site, X, Twitch…), le pays, la région, le coach, l'IGL, le manager, les gains, les dates de création, les autres équipes de la même organisation (Karmine Corp et Karmine Corp GC…, liées à leur page ici si elles jouent sur le site, sinon à Liquipedia), l'effectif actuel, l'organisation et le palmarès (avec les logos des tournois et des adversaires, gardés dans `data/lp-logos`), avec la source et la date. Tout est dans `data/team-info.json` ; rien n'est écrit dans la base, et le roster tapé dans l'éditeur reste celui des tournois. **Une équipe ajoutée au site** (n'importe quel événement, VCT EMEA ou Game Changers) est recherchée toute seule par le serveur en une minute environ, une à la fois (`instrumentation.js`, `lib/teamfetch.js`). Son nom peut différer un peu de celui de Liquipedia (FUT Esport → FUT Esports) ; sans page d'équipe trouvée, la recherche recommence le lendemain. **Pour tout rafraîchir** : `npm run team-info` relit les équipes lues il y a plus de 7 jours (`npm run team-info -- --force` : toutes), à 30 s par équipe (limite de leur API).
- **Recherche** : la barre en haut des pages du site (touche **/** pour y aller, flèches et Entrée pour choisir) cherche les tournois, les équipes (nom ou tag), les joueurs, les coachs et le staff, sans tenir compte des accents. Après une courte pause dans la frappe, elle interroge aussi Liquipedia et vlr.gg (réponses gardées une heure, chaque site interrogé à son tour) et ajoute ce qu'ils trouvent, gardé dans `data/search-found.json`. Tout résultat mène à une page du site ; l'ouvrir depuis la barre relit sa fiche en priorité, sauf si c'était déjà fait dans l'heure.
- **Qualifiers MENA** : `ME Qualifier 1 / 2` et `NA Qualifier 1 / 2` (`/vctemea/mena/me-qualifier-1/overview`…, éditeur `/admin/vctemea/mena/me-qualifier-1`…) : un tableau comme les autres qualifiers ; le vainqueur de chacun remplit tout seul sa place des MENA Qualifier Playoffs.
- **Game Changers EMEA** : un vrai tournoi à **8 équipes en double élimination** (quarts du tableau supérieur choisis à la main, les perdants descendent dans le tableau inférieur, Grande finale en Bo5), avec Aperçu (format, programme, classement 1-8, participants, tableau) et Statistiques. Les équipes de l'ancienne liste GC ont été reprises dans les 8 places. Éditeur : `/admin/vctgcemea/teams` et `/admin/vctgcemea/matches`.

## Pages ajoutées

- `/match/<événement>/<id>` : la page d'un match, avec son image de partage (`/api/og/...`) et ses données pour les moteurs de recherche.
- `/transfers` : arrivées et départs, d'après les équipes lues sur Liquipedia.
- `/compare?a=...&b=...` : deux joueurs côte à côte. `/rankings` : classements sur les statistiques saisies.
- `/about` : sources, mention de site non officiel, données gardées. `/sitemap.xml` et `/robots.txt` pour les moteurs de recherche.
- `/api/calendar?team=<équipe>` : le calendrier d'une équipe, à s'abonner depuis sa page.
- Page d'accueil de l'éditeur : « Écarts d'effectif », pour suivre Liquipedia en un clic (annulable).

Les alertes partent dans la langue du navigateur abonné ; Discord est en français, ou dans `DISCORD_LANG`.

## Alertes et tâches régulières

Les alertes de match passent par les services de notification des navigateurs (`public/sw.js`, `lib/push.js`) : elles arrivent même site fermé, pour les équipes favorites du visiteur, ou pour tous les matchs s'il n'en a aucune. Elles partent juste après chaque action d'un éditeur. Pour les matchs dont l'heure prévue arrive sans action, il faut un passage régulier : un service gratuit comme cron-job.org peut appeler `/api/tick` chaque minute (à appeler plus souvent, il ne fait rien de plus, chaque tâche ayant son tour dans la base).
