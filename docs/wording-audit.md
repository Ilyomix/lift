# Audit des textes de Lift — français et anglais

5 octobre 2026. Comparaison avec `469e6b85e2da5928b16041ca4d9e7cbac3d654e4` ; corrections destinées au build 21.

## Règles de rédaction

Tutoiement en français, phrases courtes, action explicite. Un bouton décrit son effet réel : chercher une vidéo, exporter des rappels, prévisualiser une modification, fermer le minuteur. Une erreur indique une prochaine action possible, sans inventer sa cause. Une estimation n’est jamais présentée comme un résultat garanti.

| Sujet | Français | Anglais |
| --- | --- | --- |
| Entraînement réalisé | Séance | Workout |
| Travail enregistré | Série, répétition | Set, rep |
| Effort | Répétitions en réserve ; explication à la première utilisation | Reps in reserve |
| Semaine de récupération | Semaine allégée | Deload week |
| Comparaison initiale | Référence | Baseline |
| Choix non requis | Facultatif | Optional |
| Fin du repos | Repos terminé ; Prêt dans l’espace compact natif | Rest over ; Ready |
| Publications et principes | Sources scientifiques | Scientific sources |

Les noms usuels Upper, Lower, Push, Pull, Legs et les noms d’exercices sont conservés. Les identifiants internes, clés de sauvegarde et valeurs importées ne sont pas renommés avec les textes d’interface. Les abréviations compactes disposent de noms accessibles explicites.

## Couverture et corrections

| Parcours | Points corrigés ou vérifiés |
| --- | --- |
| Onboarding, objectif, équipement | Champs obligatoires/facultatifs, erreurs de bornes, estimations corporelles, date et mode entretien, démarrage explicite de la première séance. |
| Accueil | Séances terminées, force estimée, consignes et liens vers les véritables cibles nutritionnelles. |
| Séance et 78 fiches d’exercice | Série/répétition, réserve expliquée, singulier/pluriel, échec musculaire, recherche YouTube, actions des alternatives, consignes de repos. |
| Calendrier et programme | Terminée/prévue, étapes du programme, semaines allégées, calendrier exporté explicitement, chemins de réglages. Frises et calculs conservés. |
| Progrès, mesures, photos | États vides concrets, définition du 1RM estimé, unités, actions d’ajout, photos gauche/droite sans suggérer un ordre avant/après incorrect. |
| Plus et réglages | Noms identiques entre répertoire et destination, réglages des séances, apparence, cibles nutritionnelles, données et confidentialité. |
| Nutrition et aide IA facultative | Actions de partage/prévisualisation/application, unités des modifications nutritionnelles, messages couvrant aussi une mise à jour nutritionnelle seule. |
| Sauvegarde, stockage, erreurs | Indiquer comment réessayer ou protéger les données. Retrait du message de succès photo qui pouvait masquer une erreur de sauvegarde. |
| Sources scientifiques et textes générés | Jargon développé, niveaux de preuve explicites, retrait de promesses absolues et d’une cible fixe présentée comme personnelle. Protocoles, chiffres scientifiques et références conservés. |
| iOS, Android et notifications web | Libellés natifs compacts, traductions des App Intents, permission caméra FR/EN, description du canal Android, messages de test et repli web. |

Inventaire automatique : 1 797 expressions localisées dans 51 fichiers `src`, complété par la lecture des catalogues métier, ressources natives, notifications et politique de confidentialité. Cet inventaire ne remplace pas une preuve visuelle de chaque état possible. Les changements de la politique publique ne modifient pas ses engagements : vocabulaire et chemin de navigation seulement.

## Compatibilité

Les anciennes phrases générées par Lift restent reconnues en français et en anglais : semaines allégées, comparaisons, cibles et ajustements de charge. Seuls les messages connus sont normalisés à l’affichage ; les notes personnelles et textes inconnus restent intacts. Les tests couvrent les anciennes et nouvelles formes, les unités et le singulier/pluriel.

Aucun changement aux calculs de charge, prescriptions, seuils nutritionnels, identifiants d’exercice, stockage ou délai des notifications. Les changements fonctionnels se limitent aux liens de réglages corrigés et à l’absence de faux succès après un échec photo.

## Vérification

- Suite globale : **216 réussis, 0 échec, 1 ignoré**, sur 217 tests.
- Dernier ajustement du générateur anglais « Deload week » : **12 tests de compatibilité réussis**, puis build TypeScript/Vite réussi.
- **32 rendus serveur**, soit 16 vues en français et en anglais, pour les réglages et pages secondaires.
- Compilation iOS Simulator **App + LiftActivity réussie**, catalogues FR/EN vérifiés dans les deux cibles ; permission caméra localisée dans App.
- Parcours navigateur : onboarding complet et fiche d’exercice à **320 px en français sombre** ; réglages, Calendrier/Programme et état vide Progrès à **402 px en anglais clair**. Aucun débordement horizontal dans les vues mesurées.
- Détecteur statique des fichiers UI modifiés : aucune alerte. Relecture indépendante des changements et `git diff --check` réussis.

Preuves locales dans `.local-release/wording/`, `.local-release/wording-native/`, `.local-release/wording-settings.md` et `.local-release/wording-training.md` ; ces fichiers de travail ne sont pas inclus dans l’application.

## Limites de livraison

La compilation et les contrôles navigateur ne constituent pas une vidéo sur iPhone réel. La vidéo demandée par Apple doit montrer le dernier build installé via TestFlight avant une nouvelle soumission. Le statut de TestFlight et d’App Review doit être vérifié dans App Store Connect ; ce document ne prouve aucun envoi ni aucune approbation.

La modification du point de terminaison serveur de notification de test est présente dans le dépôt, sans déploiement du service push pendant cet audit. Le client courant utilise déjà l’autre point de terminaison localisé pour son test.

Hors wording : le sélecteur de date possède encore une borne HTML 2030 différente de la validation « début du programme + cinq ans ». Ce point existant est consigné, sans modification des règles de date dans cet audit.
