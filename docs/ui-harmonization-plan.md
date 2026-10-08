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

- Les onglets de navigation à nombre fixe occupent la largeur disponible. Les filtres de salles de longueur/nombre variable peuvent défiler.
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

Captures et reçus de travail : `.local-release/build33/qa`. Les contrôles natifs (roulette tactile, gestes, Live Activity/Dynamic Island, paysage) et la livraison 33 restent à effectuer. Les anciens reçus Apple ne prouvent pas l’état d’une nouvelle soumission.
