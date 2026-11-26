# Proposition : les commandes de serveur du bot en anglais

Branche : `bot-anglais`, partie de `main` à jour (f6f41d8) et poussée seule. **Rien n'est en ligne.**

Les 36 commandes de modération, d'administration et de tickets prennent leur nom anglais, comme sur MEE6, Dyno ou Carl-bot, et leurs options aussi. Les **descriptions et les réponses du bot restent en français**. Les commandes propres au site (`/suivre`, `/rappel`, `/pronostic`, `/classement`…) gardent leur nom français.

## Ancien → nouveau nom

| Ancien | Nouveau | | Ancien | Nouveau |
|---|---|---|---|---|
| /avertir | **/warn** | | /roledonner | **/addrole** |
| /avertissements | **/warnings** | | /roleretirer | **/removerole** |
| /retirer-avertissement | **/unwarn** | | /annonce | **/announce** |
| /effacer-avertissements | **/clearwarns** | | /serveur | **/serverinfo** |
| /sanctions | **/modlogs** | | /membre | **/userinfo** |
| /note | /note | | /ticketpanneau | **/ticketpanel** |
| /exclure | **/timeout** | | /ticket | /ticket |
| /expulser | **/kick** | | /fermer | **/close** |
| /bannir | **/ban** | | /ajouter | **/add** |
| /debannir | **/unban** | | /retirer | **/remove** |
| /purge | /purge | | /renommer | **/rename** |
| /lenteur | **/slowmode** | | /priorite | **/priority** |
| /verrouiller | **/lock** | | /prendre | **/claim** |
| /deverrouiller | **/unlock** | | /rolesboutons | **/buttonroles** |
| /pseudo | **/nick** | | /embed | /embed |
| /deplacer | **/move** | | /sondage | **/poll** |
| /couper | **/mute** | | /tirage | **/giveaway** |
| /deconnecter | **/disconnect** | | /rappelmoi | **/remindme** |

**Options** : `membre` devient `user`, `raison` devient `reason`, `duree` devient `duration` et `messages` (bannir) devient `delete_messages`. Pour le reste :

| Ancienne option | Nouvelle |
|---|---|
| `id` (unban) | `user_id` |
| `numero` (unwarn) | `id` |
| `nombre` (purge) | `amount` |
| `secondes` | `seconds` |
| `salon` | `channel` |
| `role`, `role1`…`role5` | inchangées |
| `titre` | `title` |
| `texte` | `text` |
| `mention` | inchangée |
| `equipe` (ticketpanel) | `staff_role` |
| `sujet` | `subject` |
| `pseudo` | `nickname` |
| `micro` (mute) | `action` |
| `nom` | `name` |
| `niveau` | `level` |
| `couleur` | `color` |
| `choix` | `choices` |
| `dans` (remindme) | `in` |
| `prix` | `prize` |
| `gagnants` | `winners` |

## Ce qui suit les nouveaux noms

- **L'aide du bot** (`/aide`) : ses rubriques Modération, Tickets et Vie du serveur listent les nouveaux noms.
- **Les textes qui citaient un ancien nom** : par exemple « visible avec /sanctions » dans l'onglet Serveur de l'éditeur et « voir /sanctions » dans la description de /unwarn. Ils citent maintenant /modlogs.
- **Les commandes coupées dans l'éditeur** : une commande coupée sous son ancien nom reste coupée sous le nouveau. Sans ça, `/bannir` coupée serait redevenue `/ban` active.
- **Les boutons déjà posés** continuent de marcher. Leurs identifiants ne changent pas : `tk|open`, `tk|cat`, `tk|close` et `tk|claim` pour le panneau et les tickets, `rb|` pour les rôles à boutons, `pv|` pour les sondages, `gv|` pour les tirages.

## Les anciennes commandes disparaissent de Discord

Le bouton « Enregistrer les commandes auprès de Discord » envoie toute la liste d'un coup (`PUT /applications/{id}/commands`). Discord **remplace** alors toutes les commandes du bot par cette liste : les noms français qui n'y sont plus sont supprimés, ils ne restent pas en double. J'ai vérifié que le bot n'enregistre aucune commande propre à un serveur, qui aurait pu rester à côté.

Le panneau du bot affiche maintenant, avant l'enregistrement, « 32 à enregistrer · 32 anciennes retirées » (les 4 commandes au même nom ne bougent pas).

## Testé

- **Les tests des commandes** (17 en tout, avec le faux Discord) utilisent les nouveaux noms et options, et un test de plus vérifie trois choses :
  - aucun ancien nom ne reste dans la liste envoyée à Discord ;
  - chaque nouveau nom est connu du bot et réglable dans l'éditeur ;
  - une commande coupée sous son ancien nom reste coupée.
- **Les commandes du site** gardent leur nom français.
- **La liste complète** compte 86 commandes, sans doublon.
- **Les changements de code** : j'ai relu le diff mot par mot, il ne contient que des renommages.
- 317 tests passent et le build passe.
- **Pas testé** : sur le vrai serveur Discord (pas de jeton).

## À refaire sur Discord après la mise en ligne

1. Dans l'éditeur, panneau du bot : cliquer **« Enregistrer les commandes auprès de Discord »**. Les noms anglais apparaissent et les noms français disparaissent. Il faut parfois recharger Discord (Ctrl+R) pour que la liste se mette à jour.
2. Rien d'autre : les droits du bot, les intents, le panneau de tickets et les messages de rôles déjà posés restent tels quels.
