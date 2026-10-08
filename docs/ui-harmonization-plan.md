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

## État au démarrage de cette reprise

- Calendrier/restauration des jours : commit fe99a1b, web publié, build 32 traité et distribué au groupe interne TestFlight. Pas soumis à App Review.
- App Review : dernière soumission confirmée = 1.0 (31), dossier 103f5133-84df-4c3b-9274-af5095566b7c. Ne pas retirer avant préparation du remplacement.
- Corrections locales en cours : maintenance, cibles, mesures, en-têtes, Plus, cadres et onglets.
- Premiers contrôles navigateur : onboarding sans date conserve physique et priorités ; cibles personnalisées persistées ; retour à l’estimation indépendant des anciennes cibles ; ordre min/max invalide bloqué ; en-têtes Plus/Réglages/Séance inspectés à 393 px et séance active à 320 px sans débordement.
- Ces captures précèdent l’extension à toutes les unités et le dernier audit ; ne pas les présenter comme validation finale.
- iPhone 14 Pro connecté, iOS 27.0.1 visible dans Device Hub. Nouveau build pas encore installé/validé.

## Références de navigation consultées

- [Strong — ajout de mesures](https://help.strongapp.io/article/238-add-measurements) : accès à l’ajout depuis chaque mesure.
- [Strong — widgets du profil](https://help.strongapp.io/article/239-profile-widgets) : accès aux données de suivi choisies.
- [Hevy — fonctionnalités](https://www.hevyapp.com/features/) : parcours centrés sur séance et progression.

Application à Lift : rapprocher les actions fréquentes de Plus, sans ajouter les fonctions sociales ou commerciales de ces apps.

## Preuves et limites

Captures et reçus : `.local-release/build33/qa`, journal de reprise `evidence-log.json`. Les tests du code figé33 comptent 445 réussites et 1 test ignoré ; web publié et upload Xcode 33 confirmés. Traitement Apple, distribution TestFlight et nouvelle soumission non confirmés. Les anciens reçus Apple ne prouvent pas l’état d’une nouvelle soumission.

Couverture ajoutée : simulateur Debug33, volet jour Pull prévu, fiche exercice 3D/Technique et titre/salle de Séance ; IAB isolé 393 px EN sombre, cinq étapes d’onboarding dont maintien sans date, vidéo invalide et alternatives. L’onboarding finit sur Séance sans entraînement actif ; les options physiques restent présentes en maintien. Le défilement de la fiche fonctionne dans l’IAB, mais reste bloqué par glissement dans le simulateur natif33 (cause non démontrée). Le retour à la ligne de `kg/main` a un correctif local : nouveau build 34 requis, pas encore numéroté ni livré.

Restent la validation physique du build réellement installé, Live Activity/Dynamic Island/paysage, Android, les familles et états encore ouverts dans la matrice de l’audit, puis les médias et la soumission. Les gestes/roues natifs Debug ciblés déjà observés ne couvrent pas tous les contrôles ni la release distribuée.


Complément du code local destiné au build34 : icônes ajoutées aux vues du modèle, aux onglets Progrès et Calendrier/Programme, et aux cinq aperçus de séance. Captures `iab-icons-*` : quatre groupes vérifiés à 320 px EN sombre, Progrès/modèle à 320 px FR clair, Progrès à 1024 px FR clair. Leur dossier `build33/qa` ne change pas cette provenance locale34. Le profil fictif IAB a été restauré (0 séance, 1 mesure, 0 photo), puis langue/thème changés volontairement pour la matrice.

Le correctif de défilement retenu garde `overscroll-contain` et donne le focus initial au contrôle Fermer, avec priorité au `data-autofocus` explicite. La variante isolée a rétabli le défilement du volet Mesures ; 31 tests ciblés Sheet/gestes/Field et typecheck passent. Revalidation native du code intégré, physique et livraison restent distinctes et non acquises par ces preuves.

Contrôle final intégré local34 : 446 tests réussis et 1 ignoré (447 au total). Focus/trap/Escape/restauration vérifiés dans l’IAB réel ; aucune extension de cette preuve au natif physique. À 21 h 06 Paris, authentification App Store Connect et iPhone verrouillé empêchent de confirmer la suite de la livraison.
