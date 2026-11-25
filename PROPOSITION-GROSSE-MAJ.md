# Proposition : grosse mise à jour du site VCT EMEA

Branche **`grosse-maj-nuit`**, partie de `main` (d203bf8) le 25/11/2026. **Rien n'est en ligne** : aucun envoi sur `main`, aucun déploiement, serveur, base de production et variables Coolify non touchés.

Tout a été préparé et vérifié en local, avec la copie locale de la base (`data/kickoff.db`, copie du 24/11). Le serveur local tournait sans tâche de fond et sans Discord, donc aucun message n'a pu partir. 250 tests passent, le build passe.

Captures avant/après (téléphone 375 px, sauf mention) : dossier [`docs/captures/`](docs/captures/).

---

## 1. Ce que l'audit a trouvé

Toutes les pages ont été ouvertes sur ordinateur et à 375 px, et mesurées automatiquement : temps de réponse, débordement horizontal, taille des zones tactiles, texte trop petit, images sans texte, boutons sans nom.

| Constat | Gravité | Traité ? |
|---|---|---|
| **Zones tactiles trop petites** partout sur téléphone : boutons « sm » de 21 px, pastilles de couleur de 22 px, interrupteurs de 13 px, étoiles favori de 14 px, tris de tableau de 14 px. Jusqu'à 600 cibles trop petites sur la page LFT. | Forte | Oui |
| **En-tête de 132 px** sur téléphone : le logo, puis une rangée de 4 boutons de langue, puis la recherche. | Moyenne | Oui |
| **Texte de 10 px** sur Ce soir, En direct et Soirée (badges « en direct »). | Moyenne | Oui |
| **Polices chargées depuis Google** à chaque page : requête externe qui bloque l'affichage. | Moyenne | Oui |
| **Sections à moitié transparentes** en bas de l'écran (animation au défilement), très visible sur téléphone. | Moyenne | Oui |
| **Doublon sur l'accueil** les jours de match : deux comptes à rebours vers le même match. | Faible | Oui |
| **« / » ouvrait deux choses à la fois** : la barre de recherche et la palette Ctrl+K. | Faible | Oui |
| **Ce soir** : le badge « en direct » chevauchait le logo de l'équipe ; cadre du stream vide de 170 px. | Moyenne | Oui |
| **Page équipe** : trois liens « X » identiques, « 1 événements », boutons empilés en largeurs irrégulières. | Faible | Oui |
| **Calendrier** : l'agenda démarre au 1er du mois ; sur téléphone, il faut défiler 11 000 px pour arriver à aujourd'hui. | Moyenne | En partie (bouton et bandeau des jours) |
| **Fantasy** : le champ « Joueur ou équipe » n'avait aucun style (gris, bordure du navigateur). | Faible | Oui |
| **Accueil** : 8 boutons « Récap · … » occupaient un écran entier sur téléphone. | Faible | Oui |
| **Classement de puissance** : rien ne montrait les équipes en forme. | — | Ajout |
| Pages lourdes : 450 à 500 Ko de HTML (accueil, calendrier, équipe, match), environ 60 à 80 Ko une fois compressées. | Faible | Non (voir « Pour plus tard ») |
| Aucun débordement horizontal à 375 px, toutes les pages en moins de 0,8 s côté serveur, images toutes avec texte alternatif, un seul titre principal par page. | ✓ | — |

Fausses alertes vérifiées, aucune correction nécessaire :
- le podium des Stats affichait « 0,62 » pendant son animation de compteur ;
- les drapeaux paraissaient vides tant qu'ils n'étaient pas chargés ;
- les liens « vides » du pied de page sont décoratifs et déjà masqués aux lecteurs d'écran.

---

## 2. Ajouts

| Quoi | Pourquoi | Risque |
|---|---|---|
| **Séries en cours** : sur le classement de puissance, les équipes qui enchaînent les victoires (🔥) et les défaites (🧊). Sur la fiche d'une équipe, un badge « 🔥 4 victoires d'affilée » dès 2. | Montre qui est en forme, sans doublon avec la forme « 5 derniers matchs ». | Faible. Calcul pur et testé ; les forfaits sont exclus. |
| **Lexique** (`/lexique`) : 24 mots expliqués (ACS, KAST, rating, Bo3, veto, phase suisse, eco, clutch, IGL…) avec recherche, en français ou en anglais selon la langue. Dans le menu « Plus » et le plan du site. | Le site parle beaucoup en chiffres et en sigles ; un nouveau venu ne sait pas ce qu'est un KAST. | Aucun : page statique. |
| **Aide des raccourcis clavier** : la touche « ? » affiche `/`, `Ctrl K`, `E`, `Échap`. | Les raccourcis existaient mais étaient introuvables. | Aucun. |
| **Calendrier** : le bandeau des jours s'ouvre sur aujourd'hui (ou le prochain jour de match), avec un bouton « Aller à aujourd'hui ↓ ». | Évite de défiler tout le mois. | Faible. |
| **Plan du site** : Récap du jour, Ce soir, Lexique, Comparer des équipes et Format ajoutés. | Référencement. | Aucun. |

Captures : [`apres-puissance-series-375.jpg`](docs/captures/apres-puissance-series-375.jpg), [`apres-lexique-375.jpg`](docs/captures/apres-lexique-375.jpg), [`apres-raccourcis-ordinateur.jpg`](docs/captures/apres-raccourcis-ordinateur.jpg), [`apres-calendrier-375.jpg`](docs/captures/apres-calendrier-375.jpg) (avant : [`avant-calendrier-375.jpg`](docs/captures/avant-calendrier-375.jpg)).

---

## 3. Retraits

Aucune donnée supprimée. Seuls des affichages en double sont retirés.

| Quoi | Pourquoi | Risque |
|---|---|---|
| Le bloc « match à la une » ne montre plus le **prochain match quand il a lieu aujourd'hui** : il montre alors le dernier résultat. | Le bloc « jour de match » juste au-dessus fait déjà un grand compte à rebours vers ce match. | Faible. Les autres jours, rien ne change. |
| « / » n'ouvre plus la palette Ctrl+K quand la page a une barre de recherche. | Les deux s'ouvraient en même temps. | Aucun. Ctrl+K ouvre toujours la palette. |
| Les 4 boutons de langue sont remplacés, **sur téléphone seulement**, par une liste déroulante. | Gain de place dans l'en-tête. | Aucun. Sur ordinateur, les boutons restent. |

---

## 4. Refonte visuelle

| Quoi | Pourquoi | Risque |
|---|---|---|
| **Polices Barlow servies par le site** (`next/font`) au lieu de Google Fonts. | Plus de requête externe bloquante ; affichage plus rapide, polices identiques. | **Moyen** : le build doit télécharger les polices depuis Google une fois. Si le serveur Coolify n'a pas Internet pendant le build, le build échoue. Le contrôle de santé garde alors l'ancienne version en ligne. |
| **Animations plus sobres** : l'apparition des sections au défilement est plus courte (18 % au lieu de 35 %) et plus légère, et désactivée sur téléphone. | Le bas de l'écran paraissait voilé. | Aucun. |
| **Champs de formulaire** sans style propre : ils prennent l'apparence du site (fond, bordure, coins arrondis, contour au focus). | Le champ de la fantasy et d'autres avaient l'aspect brut du navigateur. | Faible. La règle a une priorité nulle, donc les styles propres d'une page gagnent toujours. |
| **Page équipe** : chaque compte en double porte son nom (« X @KarmineCorp », « X @KarmineLive »…), « 1 événement » au singulier. | Trois liens « X » identiques ne disaient rien. | Aucun. |
| **Page de match** : le lien du bas devient « Comparaison complète, toutes saisons → ». | Il se confondait avec le bouton « Comparer les équipes » de la carte, qui fait une comparaison rapide. | Aucun. |
| **Navigation** : « Comparer » devient « Comparer des joueurs ». | À côté de « Comparer des équipes », c'était ambigu. | Aucun. |

---

## 5. Téléphone

| Quoi | Pourquoi | Risque |
|---|---|---|
| **En-tête compact** : logo et réglages (thème, langue) sur une ligne, recherche pleine largeur en dessous (132 → 92 px). | Plus de contenu visible tout de suite. | Faible. |
| **Zones tactiles d'au moins 40 px** : boutons 40 px (petits boutons 36 px), pastilles de couleur 32 px, étoiles 36 px, cases à cocher 22 px, tris de tableau avec une marge de toucher. | Recommandation d'accessibilité, moins d'erreurs de doigt. | Faible : certains blocs sont un peu plus hauts. |
| **Texte jamais sous 11 px** (badges « en direct », compteurs). | Lisibilité. | Aucun. |
| **Champs en 16 px** : plus de zoom automatique sur iPhone quand on touche un champ. | Le zoom forcé gênait. | Aucun. |
| **Tableaux** : la première colonne (nom du joueur ou de l'équipe) reste visible quand on fait défiler le tableau sur le côté. | On perdait de vue à qui étaient les chiffres. | Faible. |
| **Ce soir** : le badge « en direct » ou l'heure passe au-dessus des équipes, les noms longs vont sur deux lignes au lieu d'être coupés, et le cadre du stream vide est réduit. | Le badge cachait le logo, et « ACİL PARA L… » était coupé. | Aucun. |
| **Accueil** : les récaps des qualifiers sont sur une ligne qui défile au lieu d'un mur de 8 boutons. | Gain d'un écran entier. | Aucun. |
| **Page équipe** : boutons d'action (alertes, calendrier, couleurs, fond d'écran) en grille de 2 colonnes. | Ils étaient empilés en largeurs irrégulières. | Aucun. |
| **Séries en cours** sur une ligne qui défile, pour garder le classement proche. | Lisibilité. | Aucun. |
| **Menu « Plus »** : Récap du jour, Cartes et Lexique ajoutés ; « Quiz » (jour et semaine) au lieu de « Quiz de la semaine ». | Ces pages n'étaient pas accessibles depuis le téléphone. | Aucun. |

Avant / après :

| Page | Avant | Après |
|---|---|---|
| Accueil | [avant](docs/captures/avant-accueil-375.jpg) | [après](docs/captures/apres-accueil-375.jpg) |
| Ce soir | [avant](docs/captures/avant-ce-soir-375.jpg) | [après](docs/captures/apres-ce-soir-375.jpg) |
| Match | [avant](docs/captures/avant-match-375.jpg) | [après](docs/captures/apres-match-375.jpg) |
| Équipe | [avant](docs/captures/avant-equipe-375.jpg) | [après](docs/captures/apres-equipe-375.jpg) |
| Fantasy | [avant](docs/captures/avant-fantasy-375.jpg) | [après](docs/captures/apres-fantasy-375.jpg) |
| Calendrier | [avant](docs/captures/avant-calendrier-375.jpg) | [après](docs/captures/apres-calendrier-375.jpg) |

---

## 6. Améliorations (vitesse, accessibilité, textes)

- **Vitesse** : les polices ne viennent plus de Google ; les animations au défilement sont coupées sur téléphone.
- **Accessibilité** : zones tactiles, tailles de texte, aide des raccourcis, contour visible au focus sur les champs, un seul raccourci par touche.
- **Textes** : singulier « 1 événement », libellés de navigation plus clairs, toutes les nouveautés traduites en français.
- **Éditeur** : il n'a pas pu être audité de l'intérieur, car il demande le mot de passe, que je ne saisis jamais. Il profite quand même des réglages téléphone (boutons, champs, interrupteurs). Je n'ai fait aucune autre modification dedans.

---

## 7. Pour plus tard (non fait cette nuit)

- **Alléger les grosses pages** (accueil, calendrier, équipe, match : environ 500 Ko de HTML) en n'envoyant au navigateur que ce que chaque page affiche. Gain réel sur téléphone, mais touche au cœur des données des pages : à faire avec des tests dédiés.
- **Calendrier rendu par le serveur** : il s'affiche aujourd'hui après le chargement du JavaScript (environ 1 à 3 s sur téléphone).
- **Audit de l'éditeur connecté**, avec toi devant l'écran.

---

## Comment la mettre en ligne

1. Regarder la branche : `git log main..grosse-maj-nuit` (un commit par lot) et les captures.
2. Fusionner puis pousser :

```powershell
git checkout main
```
```powershell
git merge --ff-only grosse-maj-nuit
```
```powershell
git push origin main
```

Coolify redéploie tout seul en 5 à 8 minutes. Si le build ou le contrôle de santé échoue, l'ancienne version reste en ligne.

Pour revenir en arrière après coup : `git revert` des commits concernés, puis pousser.

## Ce qu'il faut vérifier

1. **Le déploiement passe** dans Coolify, surtout l'étape des polices (`next/font` doit joindre Google pendant le build).
2. **Sur ton téléphone** :
   - l'en-tête tient sur une ligne avec la recherche dessous ;
   - la langue se change dans la liste ;
   - les boutons se touchent facilement ;
   - Ce soir et la page d'une équipe s'affichent proprement.
3. **Les polices** : les titres sont toujours en Barlow Condensed, sans police de secours plus large.
4. **L'accueil un jour de match** : un seul compte à rebours ; le bloc du dessous montre le dernier résultat.
5. **Le classement de puissance** : les séries en cours apparaissent en haut.
6. **`/lexique`** s'ouvre, et la touche « ? » affiche les raccourcis sur ordinateur.
7. **Le calendrier** s'ouvre sur aujourd'hui.
