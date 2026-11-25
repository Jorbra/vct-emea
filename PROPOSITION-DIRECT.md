# Proposition : un vrai suivi en direct des matchs

Branche : `direct-live`, partie de `main` à jour (817f6dc) et poussée seule sur GitHub. **Rien n'est en ligne.**

## Pourquoi les scores étaient en retard ou à 0-0

J'ai regardé ce qui se jouait le 25/11 vers 17 h sur vlr.gg (2 pages lues) et la copie locale de la base. Il y a quatre causes, qui s'additionnent :

1. **Les playoffs Europe ne sont pas suivies.** vlr.gg leur a créé un évènement à part (n° 3233, « Europe Qualifier Playoffs »). Le site cherchait encore les playoffs dans l'évènement des qualifs (n° 3175), où il n'y en a plus. Les matchs de la phase suisse en cours (UCAM–CGN, NAVI Junior–Aurora…) n'étaient donc jamais lus : score à 0-0.
2. **Les manches suisses et les groupes ne sont pas reconnus.** Pour relier un match vlr.gg à celui du site quand un nom diffère (« Natus Vincere Junior » contre « NAVI Junior »), le site s'aide de la manche. Il ne connaissait que « Round of 64 », « Quarterfinals », etc., pas « Swiss Stage – Round 1 » ni « Opening (B) » / « Decider (A) » des groupes Türkiye et MENA. Ces matchs n'étaient reliés que si les deux noms étaient écrits exactement pareil.
3. **Le rythme est trop lent, et pas dans le bon ordre.** vlr.gg n'était lu que toutes les 2 minutes, après Toornament, à 3 pages par tournée, avec la liste de l'évènement comptée dans ces 3 pages. Pendant les qualifs ouvertes, jusqu'à 30 matchs sont « en cours » en même temps : chacun n'était relu qu'environ toutes les 20 minutes. La copie locale le montre : beaucoup de lectures ont donné « TBD 0-0 », car le site lisait des matchs pas encore commencés sur vlr.gg pendant que les vrais matchs en cours attendaient leur tour.
4. **Un match n'était lu que si le site le croyait déjà en cours** (par Toornament ou par son horaire). Sans horaire, ou avec un match en retard, il n'était pas lu, même si vlr.gg le montrait en direct.

Je n'ai pas pu lire les journaux du serveur pour les échecs occasionnels de la tâche (ex. 18:03). En revanche, une tournée de lectures pouvait dépasser la limite de 55 s de la tâche. C'est corrigé : voir « Ce qui change ».

## Ce qui change

**Le suivi (lib/vlrmatch.js, lib/notify.js)**
- Le site suit l'évènement vlr.gg des playoffs Europe (3233). Il reconnaît les manches de la phase suisse (« Round 2 » → s2-…) et des groupes (« Opening (B) » → gb-o1/gb-o2, « Winners », « Elimination », « Decider »).
- **Les matchs que vlr.gg montre en direct passent en premier**, tous évènements confondus. Chacun est relu **chaque minute**, en commençant par celui lu depuis le plus longtemps. Un match « en cours » sur le site mais pas encore commencé sur vlr.gg n'est relu que toutes les 8 minutes. Un « en cours » oublié depuis plus de 6 h ne prend plus de lectures.
- **vlr.gg a sa propre tournée chaque minute**, à côté de Toornament, au lieu d'attendre derrière lui toutes les 2 minutes. Quand aucun match n'est en cours, le rythme reste celui d'avant (toutes les 2 minutes).
- **La liste de l'évènement est relue toutes les 3 minutes pendant les matchs.** Elle donne en une seule page le score en cartes de tous les matchs en cours. Les matchs dont la page attend son tour ont donc quand même un score à jour.
- **Un match que vlr.gg montre en direct passe « en direct » sur le site**, même sans horaire. Si un éditeur l'a retiré du direct, vlr.gg ne l'y remet pas.
- **Dès que la page montre la série gagnée** (2-0 en Bo3, par exemple), le résultat est enregistré sans attendre la page « terminé ». Il reste annulable dans l'historique, et le tableau complet arrive ensuite comme avant.
- **Respect de vlr.gg** : toujours 10 s au moins entre deux pages. Au plus 4 pages par minute, et seulement pendant les matchs, soit une page toutes les 15 s en moyenne. Un refus de vlr.gg arrête tout pour la journée, comme avant. Une tournée ne commence plus de page après 38 s, pour ne jamais être coupée par la limite de 55 s de la tâche.

**L'affichage (page du match et /live)**
- **Carte en cours** : nom, score, statut « En cours » ou « Terminé ». Des boutons permettent de revoir les cartes déjà jouées.
- **Les rounds un par un** : un carré par round, dans la couleur de l'équipe qui l'a gagné. Mi-temps et prolongations sont séparées. Un symbole indique le spike explosé ou désamorcé et le temps écoulé ; au survol, le détail (« Round 7 : UCAM (attaque), éliminations »).
- **Attaque et défense** : rounds gagnés de chaque côté, par équipe.
- **Stats des joueurs** : agent, K/D/A, +/–, ACS et note. Un bouton passe de la carte en cours à toutes les cartes. Sur téléphone, la colonne note est masquée.
- Sur /live, chaque carte de match montre la carte en cours et sa bande de rounds. Le match regardé montre le détail complet à côté du stream.
- La page se met à jour seule chaque minute, comme avant.
- Textes en français et en anglais.

## Vérifié

- Le nouveau lecteur testé sur une vraie page vlr.gg d'un match en cours (UCAM–CGN, 25/11) : il retrouve 21 et 22 rounds pour Sunset (13-8) et Lotus, conformes aux scores, ainsi que la carte en cours, les côtés, les types de fin de round et les 10 joueurs.
- 4 tests automatiques de plus (264 au total, tous passent), dont une tournée complète simulée avec un vlr.gg factice. Elle vérifie que la liste est lue puis chaque match en cours, que le match passe en direct sur le site avec ses détails, que la minute suivante relit les pages sans relire la liste, et qu'un match retiré par un éditeur n'est pas remis. Le build passe.
- Affichage vérifié dans le navigateur intégré, sur une **copie** locale de la base dans laquelle j'ai mis un match « en cours » avec les données lues sur vlr.gg : page du match (ordinateur en sombre, téléphone 375 px en clair) et /live (téléphone en clair). Les boutons « Toutes les cartes » et le changement de carte ont été essayés.

## Captures

- [Page du match, ordinateur, sombre](docs/captures/direct-match-ordinateur-sombre.jpg)
- [Page du match, téléphone, clair : rounds et stats des joueurs](docs/captures/direct-match-telephone-clair.jpg)
- [/live, téléphone, clair : carte en cours et bande de rounds](docs/captures/direct-live-telephone-clair.jpg)

## Ce qui n'a pas pu être vérifié

- **Une vraie tournée chaque minute sur le serveur, pendant un vrai match** : le local n'interroge ni vlr.gg ni Toornament (et ne doit pas toucher la vraie base). À regarder au prochain créneau de matchs : les scores doivent suivre à une minute près.
- **La liste de l'évènement 3233** : je n'ai pas lu sa page « matches ». Sa présentation est la même que celle des autres évènements vlr.gg, mais je ne l'ai pas vu de mes yeux.
- **Les noms des groupes Türkiye et MENA** : « Opening (B) » vu sur vlr.gg. « Winners' Match », « Elimination » et « Decider » sont déduits, pas observés.
- **La phase suisse en local** : dans la copie locale, les affiches de la phase suisse ne sont pas celles de vlr.gg (UCAM y joue La Masia, pas CGN). Si c'est aussi le cas sur la vraie base, ce match ne peut pas être relié, et c'est voulu : mieux vaut aucun score qu'un score sur le mauvais match. À vérifier dans l'éditeur.
- **Sur /live, le détail complet** (avec les joueurs) ne s'affiche qu'à côté du stream du match regardé. Sans lien de stream connu, il n'y a que la version courte sur la carte du match. Je l'ai vu dans ce second cas seulement.
- **Les échecs occasionnels de la tâche** (ex. 18:03) : je n'ai pas lu les journaux du serveur, la cause exacte n'est donc pas confirmée.

## Comment la mettre en ligne

```powershell
git checkout main
```

```powershell
git merge --ff-only direct-live
```

```powershell
git push origin main
```

Coolify redéploie tout seul (5 à 8 minutes). Rien à changer côté serveur, base ou variables : la tâche « travail-de-fond » de chaque minute reste la même.
