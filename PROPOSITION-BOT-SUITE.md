# Proposition : la suite du bot (pendant ton absence)

Branche `bot-suite`, partie de `main` (571d5db, déjà en ligne). Poussée seule : **rien n'est en ligne**. Mettre en ligne redéploie le site public, donc c'est toi qui décides.

## 1. Les délais des commandes ne repartent plus à zéro

Le délai entre deux utilisations d'une commande (page « Commandes » → Règles) était gardé en mémoire : chaque redémarrage du site l'effaçait, et un membre pouvait refaire la commande tout de suite. Il est maintenant **gardé en base**. Les délais finis depuis plus d'un jour sont effacés de temps en temps.

## 2. Réponses enregistrées pour les tickets

- Dans le module **Tickets**, une nouvelle rubrique « 💬 Réponses enregistrées » : un titre et un texte, 20 au plus.
- Dans le panneau d'un ticket ouvert, une liste « 💬 Réponse enregistrée… » au-dessus de la zone de réponse met le texte dans la réponse. Si quelque chose est déjà écrit, le texte s'ajoute à la suite. On peut retoucher avant d'envoyer.

## 3. Membres à surveiller

Sur la page **Membres**, avant toute recherche : la liste de ceux qui ont **une sanction en cours** (exclusion, bannissement) ou **au moins 2 avertissements sur 30 jours**. Les sanctions en cours passent en premier. Un clic ouvre la fiche du membre.

## 4. Sanctions : chiffres et export

Au-dessus du tableau des sanctions, pour ce qui est affiché (donc avec les filtres) :

- le nombre de cas ;
- le compte **par type** et **par modérateur** ;
- un bouton **« ⬇️ Exporter (CSV) »** qui télécharge le tableau, lisible dans Excel ou LibreOffice : cas, type, membre et son identifiant, modérateur, raison, dates, état.

## Testé

- **3 nouveaux tests** (`tests/botsuite.test.mjs`) :
  - un délai qui tient après un « redémarrage » (mémoire vide), sans bloquer un autre membre ;
  - les réponses enregistrées sans titre ou sans texte écartées, 20 au plus ;
  - la liste des membres à surveiller : avertissements trop anciens et exclusions finies écartés, sanctions en cours d'abord.
- **348 tests passent, build vert.**
- **Éditeur local** (copie de base), vérifié en lisant le contenu des pages, parce que les captures du volet ne se rafraîchissaient plus :
  - la liste des membres à surveiller (3 membres) ;
  - les chiffres des sanctions par type et par modérateur ;
  - les réponses enregistrées dans le module Tickets, et leur insertion dans la réponse d'un ticket.

## Pas testé

- L'export CSV ouvert dans Excel (le fichier est fait dans le navigateur, en UTF-8 avec séparateur « ; », comme Excel en français l'attend).
- Avec le vrai bot : le délai gardé en base sur un vrai serveur.

Rien à refaire sur Discord.
