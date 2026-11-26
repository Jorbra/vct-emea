# Proposition : un bot plus complet pour la modération, les tickets et les arrivées

Branche : `bot-plus`, partie de `main` à jour (60e9661) et poussée seule. **Rien n'est en ligne.**

Les noms de commandes et d'options sont en anglais, les descriptions et les messages en français. Tout se règle dans l'onglet « Serveur » du bot de l'éditeur.

## Modération

1. **Durées lisibles partout** : `10m`, `2h`, `1d`, `1w`, `1h30m`. Elles servent pour `/timeout`, `/tempban`, `/poll`, `/giveaway` et `/remindme`, avec des suggestions pendant la saisie. `/timeout user:… duration:0` lève l'exclusion.
2. **`/tempban`** : bannissement pour une durée. Le membre est débanni tout seul par la tâche de chaque minute, même après un redémarrage, car la date de fin est dans la base.
3. **Numéro de cas** pour chaque sanction (`cas #12`), affiché dans chaque réponse :
   - `/case id:12` montre le cas ;
   - `/reason id:12 reason:…` corrige sa raison.
4. **Raisons prédéfinies** : la liste, réglable dans l'éditeur, est proposée pendant qu'on tape la raison. Une autre raison reste possible.
5. **Message privé au membre sanctionné** : quoi, raison, durée, numéro du cas, et le texte « comment contester » réglable. Pour `/kick` et `/ban`, il part *avant* l'action, sinon le bot ne peut plus lui écrire.
6. **Escalade automatique réglable**, par exemple 3 avertissements → exclusion 1 h, 5 → expulsion (5 étapes au plus). **Expiration des avertissements** après X jours : ils restent dans le dossier, marqués « expiré », mais ne comptent plus.
7. **Confirmation par bouton** avant `/ban`, `/kick` et `/tempban`. Elle est valable 5 minutes et seulement pour le modérateur qui l'a demandée.
8. **`/purge` avec filtres** : d'un membre, des bots, contenant un texte, avec liens, avec images (cumulables).
9. **`/lockdown`** : verrouiller ou rouvrir d'un coup les salons choisis dans l'éditeur. Les autres règles de chaque salon sont gardées.
10. **Clic droit** :
    - sur un membre : **Warn** (une fenêtre demande la raison), **Timeout 10 min**, **Modlogs** ;
    - sur un message : **Signaler au staff**, pour tout le monde (une fenêtre demande pourquoi ; le message part dans le salon des signalements avec son texte et un lien) ;
    - sur un message : **Supprimer et avertir**, pour l'équipe.

## Tickets

11. **Formulaire à l'ouverture** (fenêtre Discord : sujet et description), activable pour chaque sujet.
12. **Rôle de l'équipe propre à chaque sujet**, mentionné dans le message d'accueil du ticket avec la description donnée.
13. **Nombre de tickets ouverts par membre** réglable (1 à 5).
14. **Fermeture** :
    - une fenêtre demande la raison (facultative), ou `/close reason:…` ;
    - un bouton **« Rouvrir »** reste dans le ticket, pour son auteur et l'équipe ;
    - le membre reçoit un **message privé** avec la raison.
15. **Transcription en page HTML lisible** (avatars, images, texte rendu sûr) envoyée dans le salon du journal. Une copie texte est gardée dans la base.
16. **Note de satisfaction** de 1 à 5 étoiles, proposée au membre dans le message privé de fermeture. Une seule note est gardée, et seul l'auteur du ticket peut la donner.
17. **Statistiques dans l'éditeur** sur 30 jours : tickets ouverts, fermés et en cours, temps moyen de première réponse, note moyenne.
18. **Panneau de tickets personnalisable** depuis l'éditeur : titre, texte, couleur, image.

## Arrivée d'un membre

19. **Image de bienvenue** : avatar, pseudo, « Tu es le 1 234e membre », aux couleurs du site, jointe au message de bienvenue.
    - Elle est dessinée par le site à une adresse signée, pour que personne d'autre ne puisse faire écrire son propre texte au site.
    - L'avatar ne peut venir que de Discord.
20. **Message privé de bienvenue**, au texte réglable.
21. **Vérification** : `/verifypanel` pose le bouton **« J'accepte le règlement »** qui donne le rôle d'accès. Un délai minimum après l'arrivée est réglable.
22. **Comptes récents** (moins de X jours) signalés dans le journal. En option, ils sont mis en **quarantaine** : un rôle à part, sans le rôle d'arrivée ni la vérification, jusqu'à ce que l'équipe valide.
23. **Anti-raid** : au-delà de X arrivées en Y secondes, une alerte dans le journal mentionne le rôle choisi. En option, les salons de `/lockdown` sont verrouillés aussitôt. Une seule alerte par tranche de 10 minutes.
24. **Suivi des invitations** : « invité par @X (code abc) » dans le journal.
25. **Salon compteur de membres** : son nom est mis à jour (`👥 Membres : 1 234`) au plus toutes les 6 minutes, car Discord limite à 2 renommages par 10 minutes.

**Si un intent ou un droit manque, l'onglet « Serveur » l'explique** et dit ce qui est coupé.

## Règles respectées

- **Permissions** : chaque commande n'est visible que par qui a la permission, et le bot la revérifie (même pour les clics droits et les formulaires).
- **Ordre des rôles** : jamais d'action sur un membre de rang égal ou supérieur, y compris pour « Supprimer et avertir » et les durées.
- **Journaux** : tout est écrit dans le journal d'audit de Discord, avec le numéro du cas, et dans le journal du bot de l'éditeur.
- **Limites de Discord** : 2 renommages de salon par 10 minutes, 28 jours d'exclusion au plus (au-delà, `/tempban`), suppression en masse limitée à 14 jours.

## Testé

- **9 nouveaux tests avec le faux Discord** (`tests/botplus.test.mjs`), un par partie :
  - durées et raisons ;
  - avertissement, message privé, escalade et expiration ;
  - confirmation (message privé envoyé avant le ban) ;
  - tempban et débannissement automatique ;
  - cas, filtres de purge et lockdown ;
  - les 5 clics droits ;
  - tickets : limite, rôle du sujet, raison, note, réouverture, HTML sans script, statistiques ;
  - arrivées : quarantaine, raid, message privé, invitations ;
  - image signée, vérification et compteur.
- **Les anciens tests** sont mis à jour : durées lisibles, numéros de cas, transcription HTML.
- **326 tests passent**, et le build aussi.
- **Onglet « Serveur » vérifié dans l'éditeur local** : les six sections s'affichent, et l'enregistrement marche (escalade 3 → exclusion 1 h, 5 → expulsion ; anti-raid ; nouveau sujet de ticket).
- Captures : [Sanctions](docs/captures/bot-plus-sanctions.jpg) · [Tickets](docs/captures/bot-plus-tickets.jpg).

## Pas testé

- **Un vrai serveur Discord** (pas de jeton), donc pas les vraies fenêtres, menus clic droit et suggestions de Discord.
- **L'image de bienvenue elle-même** : son adresse signée est testée, mais je n'ai pas regardé l'image. Elle dépend aussi de l'adresse publique du site (`VERCEL_PROJECT_PRODUCTION_URL`), déjà réglée en ligne.

## Ce que l'utilisateur doit faire sur Discord après la mise en ligne

1. **Intents** (discord.com/developers → l'application → Bot) : garder **Server Members Intent** et **Message Content Intent** activés. Rien de nouveau à activer : l'intent des invitations n'est pas privilégié.
2. **Droits du bot** : dans l'éditeur, panneau du bot, cliquer **« Donner ces droits au bot »**, utile si un droit manque. Le suivi des invitations demande « Gérer le serveur », déjà inclus.
3. **Enregistrer les commandes** : dans le panneau du bot, cliquer **« Enregistrer les commandes auprès de Discord »**. Il y a 5 nouvelles commandes (`/tempban`, `/case`, `/reason`, `/lockdown`, `/verifypanel`) et 5 menus clic droit. La liste est remplacée, sans doublons.
4. **Onglet « Serveur »** :
   - Sanctions : raisons, escalade, salons de `/lockdown`, salon des signalements.
   - Arrivée : vérification, quarantaine, anti-raid, invitations, compteur.
   - Tickets : sujets et rôles, panneau.
   - Puis enregistrer.
5. **Vérification** :
   - créer un rôle d'accès et retirer à @everyone la vue des salons réservés ;
   - choisir ce rôle dans l'onglet ;
   - taper `/verifypanel` dans le salon du règlement.
6. **Ticket** : retaper `/ticketpanel` pour poser le panneau personnalisé. Les anciens panneaux continuent de marcher.
7. **Rôle du bot** : il doit rester au-dessus des rôles d'accès, de quarantaine et d'arrivée.
