# Proposition : grande mise à jour (42 changements + 8 de performance + bot de serveur complet + stories)

Branche : `maj-40`, partie de `main` à jour (6aa6c96), poussée seule sur GitHub. **Rien n'est en ligne.**

Chaque idée a été vérifiée dans le code avant d'être faite. Sept existaient déjà et ont été écartées :
- le raccourci « / » de recherche ;
- l'écran d'attente en forme de page ;
- les animations réduites ;
- le lien « Copier le lien » ;
- le calendrier .ics ;
- le cache des logos ;
- le bouton haut de page.

Toute nouveauté **visible par les visiteurs** passe par une entrée d'aperçu (Éditeur → Réglages → Nouveautés en aperçu). Elle reste cachée aux visiteurs tant qu'elle n'est pas ouverte. Sept nouvelles entrées : **Direct plus détaillé**, **Page du match : partage et heure**, **Recherches récentes et 404 utile**, **Flux RSS des actualités**, **Impression propre**, **Confort de lecture**, **Écran qui reste allumé**. Les corrections, l'accessibilité invisible, les performances et les coulisses ne sont pas en aperçu.

## Les changements

### Site — direct (aperçu « Direct plus détaillé »)
1. « Balle de carte · UCAM » quand une équipe est à un round de prendre la carte, en temps réglementaire comme en prolongation.
2. « Balle de match » quand ce round donnerait aussi la série.
3. Le score à la mi-temps de la carte.
4. « UCAM a gagné les 4 derniers rounds » pendant une série de 3 rounds ou plus.
5. Une étoile pour le meilleur score de combat dans le tableau des joueurs.
6. Les rounds de prolongation marqués dans la bande (« Prol. »), et le dernier round qui clignote trois fois.

### Site — page du match (aperçu « Page du match : partage et heure »)
7. Pendant le direct, le score s'affiche dans le titre de l'onglet (« ● 1–0 · UCAM vs La masia »).
8. « dans 2 h 15 » à côté de l'heure d'un match à venir, mis à jour toutes les 30 s.
9. Un bouton Partager qui ouvre le menu de partage du téléphone (là où le navigateur le propose).
10. « Copier le résultat » : un texte prêt à coller (score, évènement, cartes, lien).

### Site — recherche et navigation (aperçu « Recherches récentes et 404 utile »)
11. La barre de recherche propose tes 5 dernières recherches dès qu'on clique dedans. Elles restent sur l'appareil et s'effacent d'un clic.
12. La page introuvable suggère « Tu cherchais peut-être… » : les équipes, joueurs et matchs qui ressemblent à l'adresse demandée.
13. Raccourcis clavier L (matchs en direct) et C (calendrier), ajoutés à l'aide « ? ».
14. Flux RSS des actualités (/news/rss.xml) et un lien « S'abonner (RSS) » sur la page Actualités (aperçu « Flux RSS »).

### Site — confort et visuel (aperçus « Impression propre », « Confort de lecture » et « Écran qui reste allumé »)
15. Impression : une page imprimée ne garde que son contenu, sans menu, bandeaux ni boutons, en noir sur blanc.
16. Les tableaux trop larges pour l'écran montrent une ombre sur le bord qui reste à faire défiler.
17. Barres de défilement fines aux couleurs du thème.
18. Texte sélectionné aux couleurs du site.
19. Une barre de lecture en haut d'un article d'actualité.
20. Sur l'écran secondaire et sur /live avec un stream, l'écran du téléphone ne se met plus en veille.

### Site — corrections, accessibilité, performances (sans aperçu)
21. **Les vieux « en direct » ne s'affichent plus.** Un match encore marqué « en direct » 12 h après son horaire, sans nouvelles de vlr.gg, n'apparaît plus en direct. Sans horaire, le délai compte depuis la dernière lecture vlr.gg. Sur la copie locale, l'accueil affichait « 33 en direct » pour 32 matchs du 11 novembre ; il affiche maintenant 1.
22. Fil du direct en français : « UCAM Esports gagne Sunset 13–8 » au lieu de « wins ».
23. Lecteurs d'écran : la bande de rounds est lue en une phrase (« Rounds gagnés : UCAM 12, La masia 10 »).
24. Lecteurs d'écran : le score d'un match en direct est annoncé quand il change.
25. Les abréviations du tableau du direct (K/D/A, +/–, ACS, R) sont expliquées au survol et pour les lecteurs d'écran.
26. En mode contraste élevé de Windows, les carrés de rounds et les badges gardent un bord visible.
27. Pages plus légères : la liste des actualités et le pied de page ne sont dessinés qu'à l'approche, et les logos se décodent sans bloquer la page.
28. /live : la connexion au lecteur Twitch se prépare pendant le chargement, le stream démarre plus vite.

### Éditeur
29. Aujourd'hui : la liste des matchs « en direct » oubliés, à retirer un par un ou tous d'un coup.
30. Aujourd'hui : les matchs en direct, ou qui commencent dans 30 min, sans lien de stream, avec un bouton pour les ouvrir.
31. Suivi : « Lecture de vlr.gg » montre la dernière tournée (pages lues, durée, matchs en cours vus) et l'âge de chaque liste suivie.
32. Aperçu : un lien « Voir » vers la page où regarder chaque nouveauté.
33. Aperçu : « Voir le site comme un visiteur » cache les nouveautés en aperçu dans son navigateur (une journée au plus), pour vérifier ce que voient les visiteurs.
34. Ctrl+S (Cmd+S sur Mac) enregistre le formulaire en cours de modification. C'est rappelé dans la barre « Modifications non enregistrées ».
35. Les champs limités (bannière, titre d'actualité, sondage…) affichent « 36 / 200 » pendant la saisie, en orange puis en rouge près de la limite.
36. Correction : « Modifications non enregistrées » disparaît bien après l'enregistrement des formulaires sans cadre, comme le bandeau du site. La marque restait affichée, même en enregistrant à la souris.

### Coulisses
37. vlr.gg : tous les caractères spéciaux des noms et des manches sont lus correctement (tirets, guillemets, lettres accentuées codées comme dans « Beşiktaş »).
38. vlr.gg : une page qui ne répond pas est redemandée une fois, 2 s plus tard, si le temps le permet. Jamais après un refus.
39. Les logos Liquipedia et les messages Discord ne bloquent plus la tâche de fond quand le site d'en face ne répond pas (10 s au plus).
40. En-têtes de sécurité sur toutes les pages : type de fichier imposé, adresse envoyée aux autres sites réduite au domaine, ni caméra, ni micro, ni position. Aucune règle d'encadrement, pour que les overlays et embeds restent utilisables.
41. Référencement : une adresse officielle (canonique) pour chaque match, équipe, joueur et pour les actualités, plus le fil d'Ariane des pages de match décrit pour les moteurs de recherche.
42. robots.txt et le plan du site donnent l'adresse réelle du site au lieu de l'ancienne adresse vercel.app, quand aucune adresse de production n'est réglée. Le plan du site liste aussi les pages des joueurs.

En plus, sans être compté :
- chaque tournée vlr.gg laisse un résumé (celui qu'affiche le n° 31) ;
- un test vérifie que chaque texte des nouveaux éléments a sa traduction française. C'est lui qui a trouvé l'oubli du n° 22.

Il y a 71 lignes « Journal: » en tout (44 pour les 42 changements, 9 pour la performance, 15 pour le bot, 3 pour les stories), réparties sur les commits de la branche : certains changements ont deux lignes.

## Performance : pour un site plus fluide (8 changements de plus)

J'ai d'abord mesuré, puis corrigé les postes les plus coûteux. Toutes les mesures ont été faites en local, sur la copie de la base, en taille téléphone (375 px), avant et après, avec les mêmes pages.

### Ce qui coûtait le plus

- **Les images** : 1,5 Mo sur l'accueil et 2,7 Mo sur le tableau d'un qualifier.
  - Sur l'accueil, le diaporama du bandeau chargeait ses 12 fonds de cartes d'un coup, alors qu'un seul est visible.
  - Les logos d'équipes étaient des PNG de 8 à 48 Ko, affichés entre 22 et 72 px.
- **Les rafraîchissements automatiques** : chaque page retéléchargeait tout son contenu (67 à 72 Ko compressés) toutes les 60 s, et toutes les 20 s pendant un match, même quand rien n'avait changé.
- **Le JavaScript commun à toutes les pages** : le morceau le plus lourd (70 Ko compressés) contenait le français, le turc et l'arabe, que chaque visiteur téléchargeait.
- **Les comptes à rebours** : la bande des prochains matchs était redessinée en entier chaque seconde, et cinq minuteries tournaient en parallèle, même onglet caché.
- **Le tableau d'un qualifier** : 512 cases et 8 300 éléments dessinés d'un coup, même hors de l'écran.

### Ce qui change

43. **Diaporama de l'accueil** : seule l'image affichée et la suivante sont chargées.
44. **Logos d'équipes en WebP**, à la taille de l'écran, par l'outil d'images intégré au site. Si l'outil échoue, le fichier d'origine est affiché.
45. **Tableau d'un qualifier** : seules les cases proches de l'écran sont dessinées, et leurs logos chargés à l'approche. Les traits entre les cases restent toujours dessinés.
46. **Soir de match** : le halo rouge est sur un calque fixe, et non plus un fond fixe que le téléphone redessinait à chaque défilement.
47. **Rafraîchissement intelligent** : la page demande une empreinte du site (33 octets). Elle ne se recharge que si l'empreinte a changé, et de toute façon toutes les 5 min. L'éditeur se recharge comme avant.
48. **Une seule horloge par page**, à l'arrêt quand l'onglet est caché. Dans la bande des prochains matchs, seul le compte à rebours de chaque carte est redessiné chaque seconde.
49. **Le turc et l'arabe** ne sont plus dans les scripts : la page n'apporte que la langue choisie. Passer en turc ou en arabe recharge la page une fois.
50. **Widgets chargés après la page** : palette Ctrl+K, aide « ? », bienvenue, alertes et note de mise à jour.

### Avant / après

| Mesure (téléphone, copie locale) | Avant | Après |
|---|---|---|
| Accueil : images chargées | 1 530 Ko (23 images) | 103 Ko (2 images) |
| Accueil : requêtes | 58 | 37 |
| Accueil : chargement complet | 539 ms | 399 ms |
| Qualifier 2 : images au chargement | 2 721 Ko (211 images) | 60 Ko (2 images) |
| Qualifier 2 : requêtes | 251 | 40 |
| Qualifier 2 : mise en page complète | 20,1 ms | 0,4 ms |
| Qualifier 2 : chargement complet | 1 499 ms | 637 ms |
| Page d'un match : images / requêtes | 205 Ko / 77 | 3 Ko / 38 |
| Logo le plus lourd (Los Alfas) | 48,7 Ko (PNG) | 5,4 Ko (WebP) |
| JavaScript commun à toutes les pages (compressé) | 70,3 Ko | 53,0 Ko |
| JavaScript au premier chargement : accueil / équipe / match / direct | 259 / 257 / 246 / 240 Ko | 243 / 242 / 231 / 225 Ko |
| Page d'un match en direct pendant 50 s sans changement | 2 rechargements de 68 Ko | 3 vérifications de 33 octets, 0 rechargement |
| Le même match après une nouvelle lecture vlr.gg | — | 1 rechargement, score à jour au tour suivant (≤ 20 s) |

Les requêtes et les images comptent ce qui est chargé à l'ouverture de la page. Les logos du tableau arrivent ensuite, au fil du défilement, à 1 à 5 Ko chacun.

## Bot Discord : modération, serveur et tickets

18 commandes de plus. Discord ne montre chacune qu'aux membres qui ont la permission correspondante, et le bot la revérifie lui-même.

- **Modération** : `/avertir` (gardé dans le dossier du membre, qui reçoit un message privé), `/avertissements`, `/exclure` (1 min à 1 semaine, ou lever), `/expulser`, `/bannir` (en effaçant ou non ses messages récents), `/debannir`, `/purge` (2 à 100 messages, d'un membre si tu veux), `/lenteur` (mode lent), `/verrouiller` et `/deverrouiller` (le salon).
- **Serveur** : `/roledonner`, `/roleretirer`, `/annonce` (message mis en forme dans un salon, avec un rôle à prévenir), `/serveur` et `/membre` (cartes d'infos).
- **Tickets** : `/ticketpanneau` pose un bouton « Ouvrir un ticket » dans un salon, avec en option le rôle de l'équipe qui répond.
  - Chaque ticket est un **fil privé** entre le membre et l'équipe, un seul ouvert à la fois par membre.
  - On le ferme avec `/fermer` ou le bouton, uniquement si on est son auteur ou dans l'équipe.
  - `/ticket` ouvre aussi un ticket sans passer par le bouton.
- **Sécurité** :
  - Un modérateur ne peut jamais agir sur un membre dont le rôle est égal ou supérieur au sien, ni donner un rôle au-dessus du sien. Discord, lui, ne vérifie que le rôle du bot.
  - Chaque action est écrite dans le journal d'audit du serveur Discord (qui, pourquoi) et dans le journal du bot de l'éditeur.
- **Éditeur** : un lien « Donner ces droits au bot » dans le panneau du bot. Les 18 commandes apparaissent dans « à enregistrer » : il suffit de cliquer sur « Enregistrer les commandes auprès de Discord ».
- **Vérifié** : 6 tests avec un faux Discord. Ils couvrent les permissions, l'ordre des rôles, l'avertissement et son message privé, l'exclusion, l'expulsion refusée au-dessus de son rôle, le bannissement avec sa raison dans le journal, `/purge`, le verrouillage qui garde les autres règles du salon, les rôles et les tickets (un à la fois, fil privé, fermeture).
- **Pas vérifié** : un vrai serveur Discord. Je n'ai pas le jeton du bot et je ne l'ai pas demandé. Après la mise en ligne, il faut cliquer sur « Donner ces droits au bot », placer le rôle du bot au-dessus des membres à modérer, puis enregistrer les commandes.

## Bot Discord : le bot de serveur complet (deuxième lot)

18 commandes de plus, soit **36 commandes de serveur en tout**, plus ce que le bot fait tout seul sur le serveur. Il a maintenant 86 commandes ; Discord en accepte 100.

### Nouvelles commandes

- **Dossier de modération** :
  - `/sanctions` montre tout l'historique d'un membre : avertissements, exclusions, expulsions, bans et notes, chacun avec son numéro.
  - `/note` ajoute une note privée de l'équipe.
  - `/retirer-avertissement <numéro>` et `/effacer-avertissements` retirent des avertissements.
  - Les 18 premières commandes écrivent aussi dans ce dossier.
- **Pseudo et vocal** : `/pseudo` (vide pour remettre à zéro), `/deplacer` vers un autre salon vocal, `/couper` ou rendre le micro, `/deconnecter` du vocal.
- **Tickets** :
  - `/ajouter` et `/retirer` un membre du ticket ; l'auteur du ticket ne peut pas être retiré.
  - `/renommer` le ticket, et `/priorite` (basse, normale, haute, urgente), affichée par une pastille de couleur dans son nom.
  - `/prendre`, ou le bouton « Je m'en occupe » posé dans chaque ticket, pour qu'un membre de l'équipe le prenne en charge.
- **Vie du serveur** :
  - `/rolesboutons` : jusqu'à 5 rôles que les membres prennent ou rendent d'un clic. Un rôle qui donne des pouvoirs (administration, modération, gestion des salons ou des messages) est refusé, à la création comme à chaque clic.
  - `/embed` : message mis en forme, avec titre, couleur et image.
  - `/sondage` : 2 à 5 choix à boutons, résultats en barres, un vote par membre (qu'il peut changer), fermé tout seul à la fin avec le gagnant.
  - `/tirage` : bouton « Participer », tirage au sort et annonce des gagnants à la fin.
  - `/rappelmoi` : un message privé plus tard (dans le salon si les messages privés sont fermés). Le nom `/rappel` était déjà pris par le rappel de match.

### Ce que le bot fait tout seul (réglé dans l'éditeur, onglet « Serveur » du bot)

- **Journal de modération** dans le salon choisi, avec chaque catégorie activable : messages modifiés (avant/après) et supprimés (avec leur texte), arrivées (avec l'âge du compte) et départs, bans, exclusions, pseudos, rôles, modération automatique, actions faites avec le bot.
- **Bienvenue et au revoir** : salon et texte au choix (`{membre}`, `{pseudo}`, `{serveur}`, `{nombre}`), et un rôle donné à l'arrivée.
- **Modération automatique** :
  - Invitations vers d'autres serveurs, mots interdits (avec `*`), mentions de masse et spam : ce sont des règles **AutoMod de Discord**. Le bot les crée ou les met à jour sur le serveur quand on enregistre, sans toucher aux autres règles. Discord bloque le message avant qu'il soit vu et prévient le salon du journal.
  - **Anti-flood** (trop de messages en peu de temps), fait par le bot : ses messages sont supprimés.
  - Action en plus au choix : rien, ou exclure l'auteur X minutes. On peut aussi ajouter un avertissement à son dossier.
  - Rôles et salons exemptés au choix.
- **Tickets** : le rôle de l'équipe, les sujets proposés à l'ouverture (une liste dans le panneau s'il y en a plusieurs), la fermeture automatique après X jours sans réponse, et la transcription du ticket gardée et envoyée en fichier dans le salon du journal à la fermeture.

### Sécurité (comme pour les 18 premières)

- Chaque commande n'est visible que par les membres qui ont la permission, et le bot la revérifie.
- Jamais d'action sur un membre de rang égal ou supérieur.
- Chaque action est écrite dans le journal d'audit du serveur Discord (qui, pourquoi), dans le journal du bot de l'éditeur et dans le salon du journal.
- Le texte des messages n'est gardé qu'en mémoire (les 5 000 derniers), jamais dans la base. Les transcriptions de tickets sont gardées dans la base avec le ticket.

### Testé

- 11 tests avec le faux Discord :
  - dossier, notes et retrait d'avertissements ;
  - pseudo et vocal, refusés au-dessus de son rang ou sans la permission ;
  - tickets : sujet, ajout et retrait de membre, priorité, renommage, prise en charge, transcription envoyée au journal, fermeture automatique ;
  - rôles à boutons : rôle à pouvoirs refusé, prise et rendu d'un rôle, refus si le rôle a reçu des pouvoirs entre-temps ;
  - sondages, tirages et rappels, du vote à la fermeture par la tâche de fond ;
  - règles AutoMod construites et synchronisées sans toucher aux autres ;
  - événements du serveur : bienvenue et rôle, au revoir, message modifié puis supprimé avec son texte, pseudo et rôles, autre serveur ignoré, catégorie de journal coupée ;
  - anti-flood, avec les rôles exemptés.
- 1 test de la connexion permanente avec un faux WebSocket : identification, prêt, reconnexion sans les intents privilégiés après le code 4014, pas de boucle si le jeton est refusé.
- L'onglet « Serveur » de l'éditeur, vérifié dans l'éditeur local : affichage, et enregistrement des réglages.
- 316 tests passent et le build passe.

### Pas testé

- **Un vrai serveur Discord** : pas de jeton, pas de vrai serveur, comme demandé.
- **La vraie connexion permanente**, en particulier sur le serveur Coolify. Elle demande Node 22 ou plus (WebSocket intégré) : la version de Node du serveur n'est réglée nulle part dans le projet. Si elle est plus ancienne, l'onglet « Serveur » l'indique, et seuls le journal, la bienvenue et l'anti-flood restent éteints. Les commandes, les tickets et les règles AutoMod marchent sans elle.
- **Pendant une mise en ligne**, deux serveurs du site peuvent être connectés quelques secondes. Les événements sont dédoublonnés, mais un message de flood pourrait être traité deux fois.
- **Le fichier de transcription** (envoi multipart) : testé avec un faux envoi seulement.

### Ce que l'utilisateur doit faire sur Discord après la mise en ligne

1. **Portail développeur Discord** (discord.com/developers/applications → l'application du bot → onglet **Bot** → *Privileged Gateway Intents*) : activer **Server Members Intent** (arrivées, départs, pseudos, rôles, bienvenue) et **Message Content Intent** (texte des messages modifiés ou supprimés, anti-flood). Sans eux, le bot marche quand même : ces parties restent éteintes, et l'onglet « Serveur » le dit.
2. **Droits du bot** : dans l'éditeur, panneau du bot, cliquer « Donner ces droits au bot » et valider pour le serveur. Le lien ajoute maintenant « Gérer le serveur » (pour les règles AutoMod), « Gérer les pseudos », « Rendre muet » et « Déplacer des membres ».
3. **Rôle du bot** : dans les réglages du serveur Discord, le placer **au-dessus** des rôles des membres à modérer, du rôle d'arrivée et des rôles à boutons.
4. **Commandes** : dans le panneau du bot, cliquer « Enregistrer les commandes auprès de Discord » : 36 commandes sont à enregistrer.
5. **Onglet « Serveur »** : choisir le salon du journal, la bienvenue, les règles de modération automatique et les tickets, puis enregistrer : les règles AutoMod sont posées à ce moment-là.
6. **Tickets** : taper `/ticketpanneau` dans le salon voulu. Les membres ont alors le choix du sujet.

Capture : [onglet « Serveur » du bot dans l'éditeur](docs/captures/maj40-bot-onglet-serveur.jpg).

## Stories plus belles (aperçu « Nouvelles stories »)

- **En fond** : la dernière carte jouée, floutée et teintée aux couleurs du vainqueur, au lieu du fond noir uni.
- **Les cartes du match en vignettes** avec leur image. Celles gagnées par le vainqueur sont soulignées à sa couleur, les autres atténuées.
- **« Victoire »** sous le gagnant, son logo entouré, et « il y a 2 h ».
- **Lecture automatique** : 6 s par story, une barre qui se remplit, appui long pour mettre en pause, glisser pour passer, vers le bas pour fermer.
- **Anneau en dégradé** pour les stories pas encore vues.
- **Vérifié** sur la copie locale (trois résultats remis dans les dernières 24 h), sur téléphone en sombre et sur ordinateur en clair. La lecture automatique enchaîne les trois stories puis se ferme.
- **Capture** : [stories, téléphone](docs/captures/maj40-stories-telephone.jpg).

## Vérifié

- **Tests** : 316 tests passent, dont 10 nouveaux dans `tests/maj40.test.mjs` et 3 dans `tests/perf.test.mjs` (empreinte, langues, adresses des logos). Ils couvrent les balles de carte et de match, la mi-temps, les séries de rounds, les vieux « en direct », le décodage vlr.gg, le flux RSS, le fil d'Ariane, l'adresse du site, l'heure restante, le texte du résultat, les mots d'une adresse 404 et les traductions. Le build passe.
- **Navigateur intégré, sur une copie locale de la base** (jamais la vraie, pas de secret) :
  - **Côté visiteurs** : les nouveautés y ont été ouvertes, et un match « en cours » rempli avec les données lues sur vlr.gg. Vérifiés sur ordinateur en sombre et sur téléphone en clair : page du match (titre d'onglet, balle de match, mi-temps, série, étoile), /live, accueil (1 en direct au lieu de 33), 404 avec suggestions, recherches récentes, page Actualités et lien RSS, barre de lecture, flux RSS, robots.txt, plan du site et en-têtes.
  - **Côté éditeur** : connexion avec un mot de passe de test jetable. Vérifiés : liste des « en direct » oubliés (un retiré : 32 → 31), « sans stream », Lecture de vlr.gg, liens « Voir », « Voir comme un visiteur » (la nouveauté en aperçu disparaît, les autres restent), compteur « 36 / 200 », Ctrl+S, puis la correction n° 36 après rebuild.

## Captures

- [Page du match, direct détaillé, ordinateur, sombre](docs/captures/maj40-direct-ordinateur-sombre.jpg)
- [404 avec suggestions, téléphone, clair](docs/captures/maj40-404-telephone-clair.jpg)
- [Éditeur : matchs « en direct » oubliés](docs/captures/maj40-editeur-en-direct-oublies.jpg)
- [Éditeur : compteur de caractères et Ctrl+S](docs/captures/maj40-editeur-compteur-ctrls.jpg)

## Ce qui n'a pas été vérifié

**Performance :**
- **Le temps de réponse du serveur** n'a pas bougé dans mes mesures (accueil environ 0,25 s, match environ 0,6 s). En local, le site relit toute sa base à chaque page, ce que le serveur en ligne évite déjà grâce à son cache de 10 s. Les écarts mesurés relèvent du bruit.
- **Le poids du HTML** reste de 79 à 86 Ko compressés pour l'accueil, un match ou une équipe : ces pages embarquent tout l'état du site (333 Ko). C'est le plus gros gain encore possible, mais il demande de revoir page par page ce que chacune utilise. Je ne l'ai pas fait ici pour ne rien casser.
- **La fluidité image par image sur un vrai téléphone** : le navigateur intégré était masqué, ce qui ralentit ses animations. J'ai mesuré le temps de mise en page à la place (20,1 → 0,4 ms sur le tableau).
- **L'outil d'images sur le serveur** : il garde ses copies dans `.next/cache/images` et a besoin du module `sharp`, normalement installé avec Next.js. À vérifier après la mise en ligne : les logos s'affichent, sinon le fichier d'origine prend le relais.
- **Le turc et l'arabe** : vérifiés en turc sur l'accueil. Les mots déjà non traduits avant (« More », « Go to the content ») le restent.

**Le reste :**

- **Le partage du téléphone (n° 9) et l'écran qui reste allumé (n° 20)** : le navigateur intégré ne les propose pas. Ils sont branchés mais pas vus. Sans eux, le bouton ne s'affiche pas et l'écran se met en veille comme avant.
- **L'impression (n° 15)** : pas d'aperçu avant impression avec le navigateur intégré ; seules les règles ont été relues.
- **La lecture de vlr.gg sur le serveur (n° 31, 38)** : le local ne lit pas vlr.gg, donc pas de vraie tournée. Le tableau affiche « Pas encore de tournée depuis cette version ».
- **Les en-têtes de sécurité derrière Coolify** : vus en local seulement. Si le proxy de Coolify en ajoute d'autres, ils s'additionnent.
- **Les lecteurs d'écran (n° 23 à 25)** : le texte prévu est présent dans la page, mais il n'a pas été écouté avec un vrai lecteur d'écran.
- **Les vieux « en direct »** : sur la vraie base, le nombre dépend de ce qui y traîne. Rien n'est supprimé de la base : les matchs sont seulement cachés aux visiteurs, et l'éditeur les retire d'un clic.
- **Le turc et l'arabe** : les nouveaux textes sont en français et en anglais seulement.

## Comment la mettre en ligne

La session principale s'en charge après l'OK de l'utilisateur :

```powershell
git checkout main
```

```powershell
git merge --ff-only maj-40
```

```powershell
git push origin main
```

Coolify redéploie tout seul (5 à 8 minutes). Rien à changer côté serveur, base ou variables. Ensuite, ouvrir les nouveautés une par une dans Éditeur → Réglages → Nouveautés en aperçu.
