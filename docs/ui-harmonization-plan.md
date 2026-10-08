# Harmonisation UI Lift — 8 octobre 2026

## Résultat attendu

Conserver le design system Lift (Geologica, surfaces neutres, accent orange par défaut, illustrations 3D) et rendre tous les parcours cohérents. La version web et le prochain build natif doivent contenir les mêmes corrections. Une compilation ou un test de logique ne vaut pas contrôle visuel ou publication Apple.

## Plan et critères de sortie

1. **Inventaire** — relever chaque route, onglet, volet et état vide/erreur. Rapport détaillé dans `ui-audit-2026-10.md`. Aucun écran ne peut être déclaré contrôlé sans preuve.
2. **Composants partagés** — sous-titre dans le bloc du titre ; actions à droite sans chevauchement ; sélecteurs fixes pleine largeur ; champs avec unité visible ; boutons/retours et espacements communs.
3. **Parcours** — calendrier semaine/mois dans une surface cadrée, repos explicites ; Plus avec accès direct aux objectifs et fonctions fréquentes ; choix explicite estimation/cible personnalisée ; préférences physiques conservées sans date limite.
4. **Mesures** — kg, cm, g, kcal, % et durée : unité fixe ; rouleau sur interface tactile/native et saisie directe desktop ; saisie manuelle dans la bande centrale du rouleau ; décimale étroite ; inertie native ; aucune modification au simple ouvrir/annuler ; préserver valeurs exactes et règles de validation.
5. **Vérification** — tests métier/persistance, contrôles clavier/erreurs ; revue visuelle de toutes les familles de pages, états significatifs, FR/EN, clair/sombre, 320/393 px, tablette et desktop. Fixer ensemble les défauts de la passe, puis confirmer les zones modifiées.
6. **Livraison** — capturer les écrans corrigés, compiler/exporter/signature ; publier web et vérifier version servie ; distribuer TestFlight ; valider le build réellement installé sur iPhone, vérifier la vidéo destinée à Apple ; actualiser les éléments nécessaires puis soumettre App Review et vérifier le reçu.

## Règles communes retenues

- Les onglets de navigation à nombre fixe occupent la largeur disponible et portent une icône cohérente avec leur vue. Les groupes de quatre ou cinq options empilent icône/libellé sur petite largeur, puis les alignent horizontalement. Les filtres de salles de longueur/nombre variable peuvent défiler ; les choix de durée, langue et valeur restent textuels.
- Les titres et leurs sous-titres partagent un alignement, les explications longues restent dans leur section.
- Les cadres regroupent une tâche (calendrier et commandes, liste de réglages), sans empiler de cartes décoratives.
- Un réglage quotidien ne doit pas imposer deux sous-menus : Objectifs, Nutrition et Mesures accessibles depuis Plus.
- Les unités restent visibles hors du texte saisi ; ouvrir un sélecteur ne sauvegarde aucune valeur par défaut.
- Les cibles automatiques se choisissent explicitement, sans exiger de vider deux champs.
- Les confirmations protègent les données ou une action réelle ; pas de texte d’avertissement redondant sur le mode sans date.

## État confirmé au 8 octobre 2026, 22 h 03 Paris

- **TestFlight : 1.0 (35)**, source figée `07ad65b42bd0771e5f9e42d7a66625331ce2e630`. Apple l’a traité (« Prêt à soumettre ») ; groupe **Validation appareil physique — Internes — 1 testeur** et note bilingue de **3 195 caractères** vérifiés après rechargement. Une seule note FR/EN dans le champ Français, pas deux locales. [Build Apple](https://appstoreconnect.apple.com/teams/f5a57efb-52e9-4de5-88d0-461395d02c61/apps/6818697874/testflight/ios/39e98dc7-9ec7-4df5-aebc-2048cae07824).
- **Web : la même source `07ad65b` est publiée**. Index, bundle `index-C59iQota.js`, service worker/précache et manifeste contrôlés en HTTP à 21 h 44 Paris. L’activation de cette mise à jour dans une ancienne PWA installée reste distincte.
- **App Review : 1.0 (31) reste « En attente de vérification »**, soumis le 7 octobre à 14 h 09 Paris. [Dossier conservé](https://appstoreconnect.apple.com/apps/6818697874/distribution/reviewsubmissions/details/103f5133-84df-4c3b-9274-af5095566b7c), aucun retrait ni remplacement par 35. Distribution TestFlight, notes sauvegardées et soumission sont des actions différentes.
- **Appareil : validation physique 35 non réalisée.** iPhone 14 Pro/iOS 27.0.1 connecté mais verrouillé au dernier constat ; aucune preuve d’installation 35 ni vidéo 35. La vidéo 31 ne valide pas35. L’accès App Store Connect est rétabli.
- **Diffs postérieurs au build 35 : locaux, non livrés.** Tolérance du premier mouvement tactile, bouton de saisie clavier visible au focus, focus de comparaison photo, unité de cible et explication/erreurs nutrition-IA sont encore en QA. Ils ne font partie ni du 35 TestFlight ni du web `07ad65b`.

Reçus : `.local-release/build35/asc/upload-receipt.json`, `asc/testflight35-notes-group-confirmed.{txt,png}`, `web-deployment.json` et `DELIVERY-STATUS.md`. 22 h 03 est l’heure de consignation de ces constats, pas une heure de traitement Apple déduite.

## Couverture acquise et provenance

35 reprend les corrections calendrier/repos, rétablissement des jours habituels, accès direct depuis Cette semaine, mesures/charges/nutrition, persistance, préférences physiques sans date, cibles automatiques/personnalisées, Plus, titres, onglets et fermeture des volets. Il inclut les unités par haltère insécables et le chevron du dock issus de 34, puis le pictogramme de zoom photo. Aucun essai temporaire du diagnostic de défilement n’a été intégré à ce binaire.

La dernière suite complète reste celle de 34 : **446 réussites, 1 ignoré, 0 échec** (447 tests). Elle n’a pas été réexécutée intégralement pour 35 ; typecheck, build natif, archive/export et signature 35 ont été vérifiés. Les preuves de paquet sont dans `build35/packaging-receipt.json`, celles des tests dans `build34/tests-final.log`.

Les contrôles visuels restent ciblés : IAB FR/EN clair/sombre à 320/393 px, calendrier et onglets à 1024 px, accueil iPad natif, onboarding sans date, erreurs de champs, sauvegarde et quelques volets/roues en Debug. Les captures `iab-icons-*` rangées dans `build33/qa` proviennent du code local préparant34, pas du binaire 33. Le profil fictif IAB a été restauré à 0 séance, 1 mesure et 0 photo avant les changements volontaires de langue/thème pour la matrice. La matrice de `ui-audit-2026-10.md` garde les états et combinaisons non parcourus ouverts.

Le focus initial sur Fermer, avec priorité au `data-autofocus`, et le confinement du défilement font partie de 35. Focus, piège clavier, Escape et restitution au déclencheur ont été contrôlés dans l’IAB ; cela n’établit pas la résolution du défilement natif.

## Défaut natif encore ouvert

Dans le **simulateur iOS 26.5, binaire original 35**, la fiche exercice défile au premier geste lors d’une ouverture directe depuis Séance. Après fermeture et réouverture par le même chemin, **le premier et le deuxième glissement peuvent rester sans effet**. Le deuxième geste réussi sur un cas 34 n’est donc pas un contournement fiable. L’échec n’exige pas de remplacer un volet Calendrier. Preuve : `.local-release/build35/qa/scroll-observations.json` et ses trois captures.

Les essais isolés de focus différé, animation d’entrée, écouteurs et rendu 3D statique n’ont pas établi de correction stable. Ne pas généraliser ce défaut au volet Mesures, qui dispose d’un cas séparé réussi, ni transformer un test de logique ou un succès IAB en validation tactile native. La cause reste à confirmer ; les nouveaux essais postérieurs au build 35 ne sont pas livrés.

## Suite et critères restant ouverts

Valider les correctifs locaux puis compiler le candidat retenu ; installer le build effectivement distribué sur iPhone et relever sa version/iOS. Vérifier les ouvertures répétées et le défilement, les roues et le clavier, puis Live Activity/Dynamic Island/paysage. Les cases restantes de la matrice, Android et VoiceOver restent à couvrir selon leur périmètre. Préparer la vidéo physique vérifiée et les médias nécessaires avant de remplacer la soumission 31. Le goal reste actif.

## Références de navigation consultées

- [Strong — ajout de mesures](https://help.strongapp.io/article/238-add-measurements) : accès à l’ajout depuis chaque mesure.
- [Strong — widgets du profil](https://help.strongapp.io/article/239-profile-widgets) : accès aux données de suivi choisies.
- [Hevy — fonctionnalités](https://www.hevyapp.com/features/) : parcours centrés sur séance et progression.

Application à Lift : rapprocher les actions fréquentes de Plus, sans ajouter les fonctions sociales ou commerciales de ces apps.


## Complément de validation du code postérieur au build 35

Le profil fictif IAB a été contrôlé en anglais, clair/bleu à 1024 px puis 320 px : Apparence, Repos et alertes, cibles nutritionnelles, sources et assistance IA. Après correction, l’erreur IA est annoncée et associée au champ ; elle disparaît à la modification. Le comparateur photo conserve un contour visible au focus et répond à la flèche droite (50 → 51). Les deux photos de test sont des icônes publiques du dépôt. Le profil a ensuite été restauré par l’interface depuis `QA-baseline33-iab.json` : 0 séance, 1 mesure, 0 photo, préférences EN/sombre/orange. Cible de poids avec unité, À propos, Confidentialité et explication nutritionnelle inspectés à 320 px. Provenance, états avant/après et hashes dans `.local-release/build35/qa/continued/manifest.json` ; ces captures ne proviennent pas du binaire TestFlight35.

Suite complète locale : **447 tests réussis, 1 ignoré**, typecheck et diff-check réussis. Le seuil de 4 px évite qu’un tremblement initial capture un geste ascendant ; il ne résout pas le défaut natif observé. Le candidat simulateur post35 compile mais sa fiche exercice ignore encore deux gestes ascendants dans le cas contrôlé (`qa/post35/base-open1-drag*.png`). Aucun succès physique ni nouvelle soumission Apple n’est déduit de cette passe.
