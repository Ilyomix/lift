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

## État confirmé au 8 octobre 2026, 22 h 25 Paris

- **TestFlight : 1.0 (35)**, source figée `07ad65b42bd0771e5f9e42d7a66625331ce2e630`. Apple l’a traité (« Prêt à soumettre ») ; groupe **Validation appareil physique — Internes — 1 testeur** et note bilingue de **3 195 caractères** vérifiés après rechargement. Une seule note FR/EN dans le champ Français, pas deux locales. [Build Apple](https://appstoreconnect.apple.com/teams/f5a57efb-52e9-4de5-88d0-461395d02c61/apps/6818697874/testflight/ios/39e98dc7-9ec7-4df5-aebc-2048cae07824).
- **Web : source `30a21e994428e8cb0f8e0e8353c64bc865aed0e2` publiée**, bundle `index-CnpSSDyU.js`. Index, bundle, service worker et manifeste contrôlés en HTTP à 22 h 25 Paris ; marqueur de commit et présence dans le précache vérifiés. La CI native `37838761222` est réussie selon le contrôle du responsable. Cette CI ne constitue ni un nouvel envoi TestFlight ni une validation physique. L’activation de cette mise à jour dans une ancienne PWA installée reste distincte.
- **App Review : 1.0 (31) reste « En attente de vérification »**, soumis le 7 octobre à 14 h 09 Paris. [Dossier conservé](https://appstoreconnect.apple.com/apps/6818697874/distribution/reviewsubmissions/details/103f5133-84df-4c3b-9274-af5095566b7c), aucun retrait ni remplacement par 35. Distribution TestFlight, notes sauvegardées et soumission sont des actions différentes.
- **Appareil : validation physique 35 non réalisée.** iPhone 14 Pro/iOS 27.0.1 connecté mais verrouillé au dernier constat ; aucune preuve d’installation 35 ni vidéo 35. La vidéo 31 ne valide pas35. L’accès App Store Connect est rétabli.
- **Corrections postérieures au build 35 publiées sur le web uniquement.** Tolérance du premier mouvement tactile, bouton de saisie clavier visible au focus, focus de comparaison photo, unité de cible et explication/erreurs nutrition-IA font partie de `30a21e9`. Elles ne font pas partie du 35 TestFlight. Les nouveaux changements pause, dock de repos et graphiques restent locaux, en QA, et ne sont inclus dans aucune de ces deux livraisons.

Reçus : `.local-release/build35/asc/upload-receipt.json`, `asc/testflight35-notes-group-confirmed.{txt,png}`, `qa/post35/web-deployment.json` et `DELIVERY-STATUS.md`. Le constat TestFlight a été consigné à 22 h 03 ; cette heure n’est pas une heure de traitement Apple déduite. Le reçu web à 22 h 25 remplace le contrôle antérieur du web `07ad65b`.

## Couverture acquise et provenance

35 reprend les corrections calendrier/repos, rétablissement des jours habituels, accès direct depuis Cette semaine, mesures/charges/nutrition, persistance, préférences physiques sans date, cibles automatiques/personnalisées, Plus, titres, onglets et fermeture des volets. Il inclut les unités par haltère insécables et le chevron du dock issus de 34, puis le pictogramme de zoom photo. Aucun essai temporaire du diagnostic de défilement n’a été intégré à ce binaire.

La preuve complète héritée par le binaire 35 est celle de 34 : **446 réussites, 1 ignoré, 0 échec** (447 tests). Elle n’a pas été réexécutée intégralement pour 35 ; typecheck, build natif, archive/export et signature 35 ont été vérifiés. Les preuves de paquet sont dans `build35/packaging-receipt.json`, celles des tests dans `build34/tests-final.log`. La suite post35 associée au code web `30a21e9` compte ensuite **447 réussites et 1 ignoré** ; elle ne contient pas encore les tests du nouveau correctif de pause.

Les contrôles visuels restent ciblés : IAB FR/EN clair/sombre à 320/393 px, calendrier et onglets à 1024 px, accueil iPad natif, onboarding sans date, erreurs de champs, sauvegarde et quelques volets/roues en Debug. Les captures `iab-icons-*` rangées dans `build33/qa` proviennent du code local préparant34, pas du binaire 33. Le profil fictif IAB a été restauré à 0 séance, 1 mesure et 0 photo avant les changements volontaires de langue/thème pour la matrice. La matrice de `ui-audit-2026-10.md` garde les états et combinaisons non parcourus ouverts.

Le focus initial sur Fermer, avec priorité au `data-autofocus`, et le confinement du défilement font partie de 35. Focus, piège clavier, Escape et restitution au déclencheur ont été contrôlés dans l’IAB ; cela n’établit pas la résolution du défilement natif.

## Défilement natif : observation ouverte, attribution non établie

Dans le **simulateur iOS 26.5, binaire original 35**, la fiche exercice défile au premier geste lors d’une ouverture directe depuis Séance. Après fermeture et réouverture par le même chemin, **le premier et le deuxième glissement peuvent rester sans effet**. Le deuxième geste réussi sur un cas 34 n’est donc pas un contournement fiable. L’échec n’exige pas de remplacer un volet Calendrier. Preuve : `.local-release/build35/qa/scroll-observations.json` et ses trois captures.

Les essais isolés de focus différé, animation d’entrée, écouteurs et rendu 3D statique n’ont pas établi de correction stable. Le diagnostic passif post35 a ensuite relevé **un seul `touchmove` de −286,7 px, `defaultPrevented=false`, aucun défilement**. Le même échec existe sur la page Séance ordinaire, hors volet. Cela ne permet plus d’attribuer le symptôme à un défaut de Lift : une limite d’injection du geste ou de son traitement est plausible, sans être démontrée. Le succès de trois essais sans WebGL ne suffit pas à déterminer la cause.

Ne pas généraliser cette observation au volet Mesures, qui dispose d’un cas séparé réussi, ni convertir un succès IAB en validation tactile native. Aucun patch de diagnostic n’est intégré. Le responsable a restauré et lancé le binaire simulateur original35 (`qa/post35/original35-restored.jpg`, état consigné dans `diagnostics-summary.json`). Il reste à contrôler le geste humain sur iPhone ou un geste continu multipoint vérifié sur page et volet ; aucune validation physique ni correction du défilement n’est annoncée.

## Suite et critères restant ouverts

La liste bornée de huit parcours dans `ui-audit-2026-10.md` distingue les transitions encore non parcourues des écrans déjà inspectés. Ne pas refaire les captures acquises pour remplir artificiellement une matrice : les nouvelles preuves doivent compléter les états manquants, identifier leur source et rester distinctes de l’observation native non attribuée. La revue source des 199 boutons rapportée par le responsable n’a relevé aucun autre écart ; elle n’atteste pas leur comportement visuel ou tactile.

Le démarrage d’une séance pendant une pause terminait la pause sans consentement explicite, y compris après abandon de cette séance. Le correctif local affiche maintenant « Reprendre le programme ? » avec les conséquences et Annuler. Revue indépendante sans anomalie constatée ; 13 tests ciblés réussis (3 démarrage et 10 volets). Dans l’IAB EN320, le responsable a confirmé qu’Annuler conserve la pause et sa fin prévue, puis que Confirmer démarre la séance. Le parcours hors ordre passe de l’exercice3 à4 après achèvement ; l’annulation revient correctement. Ces transitions ciblées sont acquises. La correction de la séance 1 conserve ensuite son numéro,3 séries et 2 exercices : la deuxième série passe de 22,5×10 à22,5×11 et le 1RM est recalculé. Les autres branches de correction ne sont pas déduites de ce cas.

Le dock de repos local affiche les titres et le préfixe de série complets dans les captures FR/EN à320/393 px ; la fin naturelle du repos passe à l’état orange. Il s’agit du repos web : aucune preuve de Live Activity/Dynamic Island n’en découle. Le graphique d’exercice affiche une graduation distincte après correction. Le détail poulie ne présente pas de filtre de salle dans ce profil à une seule salle historique ; aucun test multi-salles n’en est déduit. Captures et provenance : `.local-release/build35/qa/coverage/manifest.json`. Aucun de ces changements locaux n’est annoncé comme livré.

Les contrôles IAB EN393 confirment aussi le rétablissement des jours habituels (vendredi Lower, samedi Push, dimanche repos ; jeudi Upper terminé conservé, cible 5), le lien Cette semaine après consultation de la semaine suivante, le déplacement clavier/reset et ajout/save/remplacement/retrait dans l’éditeur. Rappels exporte 8 événements et désactive l’action sans sélection ; les jours habituels passent5 → 4 → 5. Une salle fictive a été ajoutée, renommée puis sélectionnée. Volume montre2 séries pectoraux/1 dos ; précédent vers 28 septembre puis suivant retourne au 5 octobre. Après la passe, la baseline a été réimportée par l’interface :0 séance,1 mesure,0 photo, résultat Import complete puis Continue.

Dernière suite locale : **454 tests réussis,1 ignoré,0 échec** sur 455, journal `build35/qa/coverage/tests-post35.log` relu. Les captures et interactions restent des preuves web locales, sans validation native/physique ni publication de ces correctifs.

Après ces contrôles, compiler le candidat retenu ; installer le build effectivement distribué sur iPhone et relever sa version/iOS. Vérifier les ouvertures répétées et le défilement, les roues et le clavier, puis Live Activity/Dynamic Island/paysage. Android, VoiceOver réel et activation d’une ancienne PWA restent des preuves distinctes. Préparer la vidéo physique vérifiée et les médias nécessaires avant de remplacer la soumission 31. Le goal reste actif.

## Références de navigation consultées

- [Strong — ajout de mesures](https://help.strongapp.io/article/238-add-measurements) : accès à l’ajout depuis chaque mesure.
- [Strong — widgets du profil](https://help.strongapp.io/article/239-profile-widgets) : accès aux données de suivi choisies.
- [Hevy — fonctionnalités](https://www.hevyapp.com/features/) : parcours centrés sur séance et progression.

Application à Lift : rapprocher les actions fréquentes de Plus, sans ajouter les fonctions sociales ou commerciales de ces apps.


## Complément de validation du code postérieur au build 35

Le profil fictif IAB a été contrôlé en anglais, clair/bleu à 1024 px puis 320 px : Apparence, Repos et alertes, cibles nutritionnelles, sources et assistance IA. Après correction, l’erreur IA est annoncée et associée au champ ; elle disparaît à la modification. Le comparateur photo conserve un contour visible au focus et répond à la flèche droite (50 → 51). Les deux photos de test sont des icônes publiques du dépôt. Le profil a ensuite été restauré par l’interface depuis `QA-baseline33-iab.json` : 0 séance, 1 mesure, 0 photo, préférences EN/sombre/orange. Cible de poids avec unité, À propos, Confidentialité et explication nutritionnelle inspectés à 320 px. Provenance, états avant/après et hashes dans `.local-release/build35/qa/continued/manifest.json` ; ces captures ne proviennent pas du binaire TestFlight35.

Suite complète de cette passe : **447 tests réussis, 1 ignoré**, typecheck et diff-check réussis, avant les corrections locales pause/repos/graphiques. Le seuil de 4 px évite qu’un tremblement initial capture un geste ascendant ; il n’établit pas la résolution de l’observation native. Le candidat simulateur post35 compile mais sa fiche exercice ignore encore deux gestes CUA dans le cas contrôlé (`qa/post35/base-open1-drag*.png`). L’observateur relève ensuite le même échec sur une page ordinaire avec un seul grand mouvement : l’attribution au produit reste indéterminée. Aucun succès physique ni nouvelle soumission Apple n’est déduit de cette passe.
