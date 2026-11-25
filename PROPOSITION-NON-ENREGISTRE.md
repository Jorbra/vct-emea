# Proposition : prévenir quand des modifications ne sont pas enregistrées (éditeur)

Branche : `non-enregistre` (partie de `main` à jour, c1b9782), poussée seule sur GitHub. **Rien n'est en ligne.**

## Ce qui change

- **Dès qu'un champ diffère de la valeur enregistrée**, le formulaire est entouré d'un pointillé orange avec une pastille « ● Modifications non enregistrées ». Son bouton principal (Enregistrer) est mis en avant. Une barre en bas de l'écran rappelle « Modifications non enregistrées » (ou « … dans N formulaires »). Son bouton **Afficher** amène au formulaire et au champ modifié.
- **La marque disparaît** après un enregistrement réussi, ou si on remet la valeur d'origine. Si l'enregistrement échoue, elle reste.
- **Avant de perdre les changements**, la question « Tu as des modifications non enregistrées, quitter quand même ? » apparaît, avec **Rester** sélectionné par défaut (Entrée ou Échap = rester). Elle couvre :
  - un lien (dont « Retour au site ») ;
  - les onglets de l'éditeur (EU, Kickoff, Équipes, Matchs…) et le bouton Accueil ;
  - le **retour arrière** du navigateur ou du téléphone ;
  - **replier un bloc** qui contient des changements (« … le replier quand même ? ») ;
  - **recharger ou fermer l'onglet** : dans ce cas, c'est la question du navigateur lui-même, dont le texte ne peut pas être changé.
- **Un seul mécanisme pour tout l'éditeur** : le composant `UnsavedGuard`, posé une fois autour de l'éditeur. Aucun formulaire n'a été modifié pour ça.
  - Il compare chaque champ à sa valeur d'origine.
  - Il reconnaît un enregistrement réussi à la réponse du site.
  - Les formulaires qui s'enregistrent tout seuls (choix d'une équipe dans un match, interrupteurs) ne déclenchent donc pas de faux avertissement.
- **Ne comptent pas comme des modifications** : les champs de recherche et de filtre (journal, horaires, « Chercher une équipe »), la langue, le thème, l'aperçu téléphone et la recherche de compte visiteur.
- Textes en français et en anglais.

## Vérifié

Vérifié dans l'éditeur, sur une **copie** de la base locale, avec un mot de passe de test jetable (jamais le vrai) :
- un changement fait apparaître la marque et la barre, et remettre la valeur l'efface ;
- l'enregistrement efface la marque, et il n'y a pas d'avertissement juste après ;
- un choix d'équipe enregistré tout seul ne laisse pas de marque ;
- la question apparaît pour les onglets, le lien « Retour au site », le retour arrière et le repli d'un bloc ;
- « Rester » garde tout, « Quitter » part ;
- la fermeture d'onglet est bloquée seulement s'il y a des changements.

Testé sur téléphone (375 px) et ordinateur, en clair et en sombre. Il y a 6 tests automatiques de plus ; les 260 tests et le build passent.

## Ce qui n'a pas pu être vérifié

- **La question du navigateur à la fermeture ou au rechargement** : j'ai vérifié qu'elle est demandée, mais pas sa fenêtre elle-même (le navigateur intégré ne l'affiche pas aux outils de test).
- **Un vrai téléphone**, et le geste « retour » d'Android ou d'iPhone : testé en taille téléphone dans le navigateur intégré seulement.
- **Chaque formulaire un par un** : j'ai testé à fond les fiches d'équipe, les informations d'évènement et les choix d'équipe des matchs. Les autres (scores, horaires, sources, actus, sondages, bannière…) passent par le même mécanisme, mais je ne les ai pas tous essayés.
- **Retour arrière** : pendant qu'il y a des changements, la page ajoute une entrée « à la même adresse » dans l'historique. Après un enregistrement, il peut donc falloir appuyer une fois de plus sur Retour. Le site s'en charge tout seul dans la plupart des cas.

## Captures

- [Ordinateur, clair : formulaire modifié](docs/captures/non-enregistre-ordinateur-clair.jpg)
- [Ordinateur : la question avant de quitter](docs/captures/non-enregistre-question-ordinateur.jpg)
- [Téléphone, sombre : pastille près du bouton Enregistrer, barre en bas](docs/captures/non-enregistre-telephone-sombre.jpg)
- [Téléphone, clair : la question](docs/captures/non-enregistre-question-telephone-clair.jpg)

## Comment la mettre en ligne

```powershell
git checkout main
```

```powershell
git merge non-enregistre
```

```powershell
git push origin main
```

Coolify redéploie tout seul (5 à 8 minutes). Rien à changer côté serveur, base ou variables.
