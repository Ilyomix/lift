# Audit Lift — logique métier

Date : 7 octobre 2026. Audit du checkout de travail, avec ses corrections précédentes conservées. Aucune publication, aucun changement App Store, aucune modification des données d’un appareil utilisateur.

## Périmètre réellement inspecté

| Domaine | Code et parcours examinés | Contrôles |
|---|---|---|
| Charges et séries | `training.ts` : score, historique, charges connues, paliers, progression, première charge et adaptation en séance ; callers `Session`, `store.completeSet`, `finalizeWorkout` | Unité, salle, machine déclarée, charge absente, petite charge, séries supplémentaires, effort et échec |
| Comparaisons et historique | `comparability.ts`, `compareExercise`, `previousPerformance`, `dropAlert`, `sessionNotes`, `regradeTrainingDiagnostics`, `trainingMigration.ts` | Chronologie, séance antidatée/éditée, même jour, séance Upper/Push distincte, rappel à deux séries, conservation des observations et cibles |
| Synthèses | `strengthSummary`, `averageRir`, volume et durée ; lecture des callers Accueil/Progrès | Contextes homogènes, données non mesurées, unités, moyenne de réserve cohérente avec les séries |
| Programme et calendrier | `program.ts` : périodes, configuration, prescriptions, repos, semaines personnalisées, projection, pauses, séances rouvertes ; callers calendrier/feuille de jour et sauvegarde | Limites de dates, jours réellement valides, comptage des séances/occupation, choix explicite des semaines, reprise/allègement |
| Mesures et nutrition | `stats.ts` : séries de mesures, moyennes, tendances, protéines, conseils caloriques, journal ; `energy.ts`, `onboarding.ts` | Mesures futures/anciennes, fréquence des mesures, cible fixe/adaptative, plancher et délai des ajustements, cohérence aperçu/état initial |
| Persistance liée | Lecture de normalisation/import et des callers du store ; migration diagnostique | Pas de changement des séries, poids, notes, ordre stocké ou cibles lors du recalcul |

Il n’existe pas de modules séparés `nutrition.ts` ou `measurements.ts` : ces calculs sont dans `stats.ts`. Les captures, gestes et services natifs sont traités dans les autres volets de l’audit.

## Anomalies confirmées et corrections

Toutes les anomalies ci-dessous sont classées P2. Aucun P1 établi dans ce périmètre. Chaque anomalie a une entrée reproductible ; les assertions ont échoué avant son correctif.

### L01 — Un allègement pouvait augmenter une petite charge

- Reproduction : élévation latérale à 0,5 kg, incrément de 1 kg, facteur d’allègement de 0,9. La prescription et le démarrage de séance proposaient 1 kg. Au poids du corps, un lest explicitement nul pouvait recevoir un incrément dans la prescription.
- Même défaut dans la première charge proposée : 0,5 kg essayé avec une répétition sous la fourchette devenait une cible de 1 kg.
- Cause : le plancher `Math.max(incrément, ...)` dépassait la charge réellement utilisée.
- Correction : borne supérieure égale à la charge d’origine pour la prescription, le démarrage, les paliers descendants et la première charge sous la fourchette. Aucun changement du poids enregistré ou de la fiche à la simple lecture.
- Preuves : tests sur 0 / 0,5 / 1 / 2 / 2,5 / 20 kg, allègement et reprise, charge corporelle ; chemin réel `startSession` à 0,5 kg.

### L02 — La synthèse de force mélangeait unités et machines

- Reproduction : 80 kg sur machine A, puis 20 et 22 kg sur machine B. La synthèse affichait −72,5 % au lieu de +10 % dans le contexte B. Même résultat avec kg puis kg par main sur un mouvement libre.
- Cause : le regroupement de `strengthSummary` séparait les salles, mais pas les unités ni les conditions déclarées.
- Correction : regroupement par salle applicable, unité et contexte normalisé. L’historique brut et la sélection préexistante du groupe le plus renseigné restent conservés.

### L03 — Une cible de protéines « fixe » changeait pendant la sèche

- Reproduction : protéines fixes 100–110 g, adaptation désactivée. Pendant la sèche, le calcul retournait 185–200 g, contrairement au réglage affiché.
- Cause : la branche fixe appliquait encore les valeurs de phase du programme d’origine.
- Correction : la cible fixe reste la cible enregistrée dans toutes les phases ; elle sert aussi de repli sans pesée. Le calcul adaptatif par poids et son plancher de début de sèche ne changent pas.
- Preuve : parcours de toutes les périodes du plan avec adaptation désactivée, puis sans pesée ; état source inchangé.

### L04 — La réserve moyenne contredisait les séries

- Reproduction : série marquée « échec » avec ancienne valeur RIR 3, puis série RIR 2. Le moteur d’effort lit correctement 0 et 2 ; la moyenne affichait encore 2,5. Des exercices passés ou séries sans répétition pouvaient aussi entrer dans le calcul.
- Correction : `averageRir` réutilise `recordedRir`, ignore les exercices passés, les séries non effectuées et les valeurs de réserve invalides. L’exemple donne 1, sans modifier la saisie originale.

### L05 — Une date objectif impossible était acceptée

- Reproduction : `isValidGoal('2030-02-31')` retournait vrai. La normalisation des réglages importés conservait cette date ; les calculs de calendrier la décalaient ensuite implicitement en mars.
- Correction : la date doit aussi survivre à une conversion calendaire sans changement. Le 29 février 2028 est accepté ; le 29 février 2027 et le 31 avril sont refusés. L’import utilise le même validateur.

### L06 — Un palier automatique pouvait venir d’une autre machine ou du futur

- Reproduction : deux séries à 20,5 kg sur machine A, puis une série trop courte à 22,5 kg sur machine B. L’adaptation proposait 20,5 kg, emprunté à A, au lieu du palier standard 20 kg de B. Le caller du store utilisait aussi des séances futures lors de la correction d’une séance antidatée.
- Correction : `knownLoads` accepte le contexte courant et filtre unité/conditions normalisées. Les callers de séance et de clôture le fournissent. Le store borne ses références via `workoutsBefore` avant l’adaptation.
- Preuves : helper avec trois contextes ; chemin réel `completeSet` pour une autre unité, une autre machine et une séance future. Les séances historiques restent inchangées.

### L07 — Une charge absente devenait une chute de force

- Reproduction : deux séries de 10 répétitions à 80 kg, puis deux séries de 10 répétitions sans poids renseigné. Le calcul utilisait « 10 répétitions » comme s’il s’agissait d’un score de charge et affichait **niveau estimé −91 %**, avec signal de baisse marqué.
- Correction : sans charge mesurée, aucun score de force n’est inventé. Le diagnostic indique « Comparaison indisponible » et explique la charge manquante ; il ne déclenche ni baisse marquée ni record. La synthèse exclut les points sans mesure de force. Les exercices au poids du corps continuent à compter les répétitions sans exiger un lest.
- Le signal d’un changement d’unité/machine reste prioritaire : la charge absente ne masque pas un équipement incompatible.
- La migration des diagnostics passe de la révision 4 à **5**. Elle recalcule les diagnostics stockés et retire seulement les réductions automatiques non justifiées, sans réécrire les séries ou charges cibles. Les textes persistés suivent le changement FR/EN.
- Coordination UI : le parent a aussi filtré les points sans mesure dans les courbes Progrès, en gardant les lignes de l’historique brut. Le test de rendu correspondant passe dans la suite intégrée.

## Défaut transmis au volet UI

Le graphe « Protéines, 14 jours » de `NutritionScreen` se termine aujourd’hui mais utilisait la cible du jour sélectionné dans le formulaire. Consulter une ancienne date changeait donc le seuil du même graphe. Le parent a isolé sa cible actuelle de celle de la saisie quotidienne ; modification vérifiée dans le code intégré, pas d’édition de cet écran dans ce volet métier.

## Vérifications

- Nouveau fichier `tests/business-logic-audit.test.ts` : **11 tests réussis**, dont les deux parcours réels du store. Les sept anomalies ont été reproduites avant correction.
- Suite ciblée intégrée : logique, audit entraînement, chronologie, splits, ajustements, recalcul historique, stockage des semaines flexibles, traductions et historique Progrès. Dernière passe : **126 réussis, 1 ignoré**.
- `npm run typecheck` : réussi après les changements de signatures et de migration.
- Contrôles maintenus : deux baisses dans le même split conservent leur effet, les rappels à deux séries restent comparables, la correction/suppression d’une séance recalcule la suite, les choix hebdomadaires ne changent pas le planning sans enregistrement explicite, les mesures futures ne déterminent pas la tendance courante.

Le résultat global final des tests/build est centralisé par le parent après intégration des autres volets.

## Limites

- Revue de code et données synthétiques, sans accès au contenu privé complet des séances de l’utilisateur. Ce rapport ne certifie donc pas chaque diagnostic de son historique réel.
- Aucune validation physique iOS/Android, TestFlight ou App Store réalisée ici.
- Les modèles physiologiques et références scientifiques préexistants n’ont pas été réévalués médicalement. Les corrections respectent les options choisies et évitent des comparaisons de données incompatibles.
- Audit borné : il couvre les modules/parcours listés, pas toutes les combinaisons possibles de données ou d’imports tiers. Aucune garantie d’absence absolue de bugs.
