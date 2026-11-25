# Proposition : thème Sombre / Clair / Auto et logos lisibles en clair

Branche : `theme-auto` (partie de `main`, poussée seule sur GitHub). **Rien n'est en ligne** : `main` n'a pas bougé.

## Ce qui change

### 1. Un choix de thème à trois positions
- Le bouton de thème existant (en haut à droite, à côté des langues) devient un petit menu : **Auto** (comme l'appareil), **Clair**, **Sombre**. Il n'y a pas de deuxième réglage : c'est le même bouton, qui évolue.
- **Auto par défaut** : le site suit le réglage du téléphone ou de l'ordinateur, et change tout seul s'il bascule (par exemple le soir).
- Le choix est retenu sur l'appareil (cookie d'un an), et sur le compte pour les visiteurs connectés (« auto » est maintenant accepté en plus de « clair » et « sombre »).
- **Pas de flash au chargement** : un petit script, placé avant l'affichage de la page, pose le thème avant que quoi que ce soit ne s'affiche.
- Sur téléphone, le bouton fait 40 px (facile au doigt) et le menu a de grandes lignes de 40 px. Il se pilote aussi au clavier (flèches, Échap).
- La couleur de la barre du navigateur sur téléphone suit maintenant le thème choisi, et pas seulement celui de l'appareil.
- Correction au passage : une dizaine de réglages du mode clair (couleurs des scores, badges, onglets, séries…) ne s'appliquaient qu'avec un choix manuel « Clair », pas quand le clair venait de l'appareil. En Auto, ils s'appliquent maintenant aussi.

### 2. Les logos invisibles en clair
- **Détection automatique, sans liste à la main** : chaque image est lue une fois dans le navigateur (part transparente et part de pixels très pâles). Un logo est « pâle » s'il a des zones transparentes et qu'au moins la moitié de ce qui est dessiné est blanc, jaune pâle ou gris clair. Le résultat est gardé sur l'appareil, donc l'analyse ne se refait pas à chaque page.
- **Un fond discret uniquement là où il faut** : un logo pâle reçoit une petite plaque gris très foncé arrondie **seulement si la couleur réellement derrière lui est claire**. Sur le bandeau rouge, sur une carte sombre ou en mode sombre, rien ne change.
- **En mode sombre, les logos ne changent pas** : vérifié, aucune plaque n'est posée en sombre, et elle disparaît si on repasse de Clair à Sombre.
- Cela couvre tous les logos du site, d'où qu'ils viennent : équipes (logos du site, de Toornament et de Liquipedia), le logo EMEA, les ligues et les partenaires. Les drapeaux et les photos ne sont pas concernés (une photo apporte son propre fond).
- Logos trouvés pâles sur la base locale : Vitality, FUT, Team Liquid, M8, MIR, JL, GX, F9 Eicar, Pixel Lumina, CGN Esports, WIP Esports et un logo Toornament. Le logo EMEA est aussi pâle, mais il a déjà son carré sombre : il n'est pas modifié.
- Version sombre Liquipedia : le site utilisait déjà la version « pour fond clair » de Liquipedia quand elle existe (`forlight` / `fordark`). Ça reste en place, et la plaque ne sert que pour les logos qui n'en ont pas.

### 3. Vérification de toutes les pages
- **Contrôle automatique du contraste** sur 37 pages (accueil, calendrier, actus, pronostics, transferts, LFT, stats, en direct, comparer, à propos, tournoi, équipe, match, agents, cartes, jeux, fantasy, quiz, tier list, puissance, récap du jour, ce soir, lexique, équipes, format, palmarès, rivalités, simulateur, saison, compte, ma page, pays, mvp, archives…). Chaque texte visible est comparé à la couleur réellement derrière lui, en **clair et en sombre**, sur **téléphone (375 px) et ordinateur (1280 px)**.
- **Ce qui a été trouvé et corrigé** :
  - Le vert-jaune du site, utilisé comme couleur de texte à 73 endroits (scores, chiffres, séries 🔥, gagnant d'une rivalité, « Terminé » sur le fil de la saison, statistiques d'agents, « Ma page »…), était presque illisible sur fond clair (contraste 1,5:1). En clair, ces textes prennent maintenant une version foncée de la même couleur, qui suit aussi les couleurs d'équipe choisies. En sombre, rien ne change. Les zones qui restent sombres en mode clair (bandeau, grande bannière de l'accueil, mur TV, diaporama) gardent la couleur vive.
  - « Arrivée » sur la page transferts : vert trop pâle en clair, foncé.
  - « En direct » sur le fil de la saison et les baisses sur l'accueil : rouge trop pâle en clair, foncé.
  - Calendrier : sur les jours très chargés (case bleu foncé), le nombre de matchs était peu lisible, en clair comme en sombre. Il est maintenant écrit dans la couleur du texte.
- Après correction, **plus aucun texte sous le seuil** dans les quatre combinaisons.
- Vérifié à l'œil en plus : menu du thème (ordinateur et téléphone, souris et clavier), tier list, classement de puissance, accueil, page équipe et fil de la saison.

## Captures

| | Avant | Après |
|---|---|---|
| Tier list, ordinateur, clair | [avant](docs/captures/avant-clair-tierlist-ordinateur.jpg) | [après](docs/captures/apres-clair-tierlist-ordinateur.jpg) |
| Classement de puissance, téléphone, clair | [avant](docs/captures/avant-clair-puissance-375.jpg) | [après](docs/captures/apres-clair-puissance-375.png) |
| Menu du thème, ordinateur | — | [après](docs/captures/apres-menu-theme-ordinateur.jpg) |
| Menu du thème, téléphone | — | [après](docs/captures/apres-menu-theme-375.png) |
| Tier list, ordinateur, sombre (inchangé) | — | [après](docs/captures/apres-sombre-tierlist-ordinateur.jpg) |

## Ce qui n'a pas pu être vérifié

- **Les graphiques** (courbes, barres en SVG) ne passent pas dans le contrôle automatique, qui ne lit que le texte. Je n'en ai regardé que quelques-uns à l'œil.
- **Un vrai téléphone** : tout a été testé dans le navigateur intégré, en taille téléphone, avec un mode clair/sombre simulé. Le changement automatique en Auto quand le téléphone bascule a été testé en simulation, pas sur un appareil.
- **Le compte connecté** : l'enregistrement du choix « auto » sur le compte est couvert par un test, mais pas essayé en étant connecté.
- **Les logos sur la vraie base** : les logos ont été vérifiés sur la copie locale de la base. Les logos ajoutés depuis seront détectés de la même façon, mais je ne les ai pas vus.
- **Hors sujet, remarqué en passant** : en mode sombre, quelques logos noirs (TH, UCAM) sont peu visibles. Comme demandé, je n'ai rien changé en sombre.

## Comment la mettre en ligne

Depuis le dossier du site, une fois d'accord :

```powershell
git checkout main
```

```powershell
git merge --ff-only theme-auto
```

```powershell
git push origin main
```

Coolify redéploie tout seul (5 à 8 minutes). Si le contrôle de santé échoue, l'ancienne version reste en ligne. Rien à changer côté serveur, base de données ou variables.

## Ce qu'il faut vérifier

- Sur un téléphone en mode clair : ouvrir la tier list ou le classement de puissance. Les logos blancs (Vitality, M8, FUT…) ont une petite plaque sombre.
- Toucher le bouton de thème : trois choix. Prendre « Sombre », recharger : ça reste sombre, sans flash blanc.
- Remettre « Auto », puis changer le mode clair/sombre du téléphone : le site suit sans recharger.
- Si un logo coloré reçoit une plaque alors qu'il n'en a pas besoin (ou l'inverse), me donner son nom : on ajuste le seuil, pas une liste.
