# Audit des réglages et des pages secondaires de Lift

Date : 4 octobre 2026. Baseline examiné : `79d002d137758d00ea6efd97757fe2f21293d47b` (build 18). Inventaire par lecture du code, sans QA visuelle ni modification de données. Les numéros de ligne ci-dessous se rapportent au baseline ; les composants sont déplacés pendant l’implémentation qui suit cet audit.

Périmètre : `src/screens/More.tsx`, `NativeActivitySettings.tsx`, écrans Pause/Rappels de `Calendar.tsx`, leurs feuilles, actions du store, partage et notifications. Les pages Objectif visuel et Confidentialité sont des dépendances de navigation ; leur logique complète n’est pas remplacée par cet audit.

## Décision d’architecture

Plus doit être un répertoire court : **Nutrition**, **Réglages**, **Sources scientifiques**, puis **Outils avancés** replié (aide IA facultative) et **À propos**. Les pages de réglages regroupent les préférences stables ; les commandes quotidiennes restent dans leur contexte. Garder les raccourcis utiles depuis Accueil, Séance et Calendrier plutôt que dupliquer les formulaires.

Apple recommande de placer les choix fréquents dans la tâche concernée, de réserver l’espace Réglages aux préférences générales et d’éviter les options inutiles. Cela soutient la séparation journal nutrition / cibles nutritionnelles, sans imposer de remplacer le DS Lift par des composants système. [Apple HIG — Settings](https://developer.apple.com/design/human-interface-guidelines/settings)

| Groupe proposé | Contenu | Destination / contrainte |
|---|---|---|
| Journal nutrition | Saisie quotidienne, date, protéines sur 14 jours | Conserver `#/plus/nutrition` ; lien vers les cibles |
| Entraînement | Date/mode, objectif visuel, jours, équipement, salles, adaptation des charges, pause | Sous-pages Réglages ; feuilles partagées conservées ; raccourcis contextuels |
| Cibles nutritionnelles | Calories, créatine, protéines, adaptation et conseil calorique | `#/plus/reglages/nutrition` ; configuration avant conseil ; explications repliées |
| Repos et alertes | Son, écran éveillé, Live Activity/suivi verrouillé, notification de fin | Distinguer préférence de l’app, disponibilité et autorisation OS |
| Rappels calendrier | Choix de contenu ICS et heures | Page dédiée ; expliquer qu’il s’agit d’un fichier à importer |
| Apparence | Langue, thème, accent | Une même page ; conserver les choix automatiques |
| Données et confidentialité | Sauvegarde, import, effacement, politique | Répertoire `#/plus/reglages/donnees` ; sauvegarde existante `#/plus/donnees` conservée |
| Ressources / À propos | Sources, auteur, version, installation, liens externes | Sources reste une destination principale ; `#/plus/a-propos` pour l’identité de l’app |
| Avancé | Partage volontaire d’un bilan, import de suggestions IA | `#/plus/coach`, replié dans Plus ; jamais nécessaire pour s’entraîner |

Ce regroupement ne crée ni compte, ni connexion, ni synchronisation cloud, ni paiement. Aucun de ces réglages n’existe dans le périmètre examiné.

## Stockage et vocabulaire

- **État persistant** : store Zustand, enregistré dans IndexedDB `golgoth` / `kv`, clé `state`. Les actions `update` synchronisent aussi le plan ; écriture différée puis `flush`. En cas d’échec persistant, un état mémoire et son avertissement existent : ne pas promettre une sauvegarde disque inconditionnelle.
- **Photos** : IndexedDB distinct `golgoth-photos` / `photos`. La photo d’objectif est également gérée par les actions dédiées ; ne pas confondre référence visuelle et photos de progression.
- **Préférences** : `prefs` dans l’état ; certaines valeurs d’apparence sont également mises en cache localement. Langue/thème sont appliqués immédiatement.
- **Brouillon** : état React local, perdu en quittant l’écran, sauf validation explicite. Un switch de sélection d’export n’est pas une préférence système.
- **Autorisation OS** : appartient à iOS/Android ou au navigateur ; elle n’est pas accordée par une écriture dans `prefs`.
- **Sortie volontaire** : feuille de partage ou téléchargement, sans envoi automatique à un assistant IA. L’application destinataire est choisie par la personne.

Sources : `src/lib/store.ts`, `src/lib/share.ts`, `src/lib/native/bridge.ts`, `src/lib/native/sync.ts`, `src/lib/push.ts`.

## Inventaire exhaustif du répertoire Plus au baseline

Route commune : `#/plus`, `MoreScreen` (`More.tsx:45`).

| Élément / action | Destination ou effet actuel | Stockage | Groupe proposé |
|---|---|---|---|
| Nutrition | Ouvre `#/plus/nutrition` | Aucun | Plus / journal |
| Sources scientifiques + nombre d’études | Ouvre `#/plus/preuves` | Lecture seule | Plus / ressources |
| Pause du programme + état actif | Ouvre `#/plus/pause` | Lecture de `programPause` | Réglages / entraînement + raccourcis |
| Rappels calendrier | Ouvre `#/plus/rappels` | Aucun à l’ouverture | Réglages / rappels |
| Sauvegarde + date dernier export | Ouvre `#/plus/donnees` | Lecture `meta.lastBackupAt` | Réglages / données |
| Réglages | Ouvre `#/plus/reglages` | Aucun | Plus |
| Outils avancés | Déplie/replie les outils secondaires | Brouillon du disclosure | Plus, fermé par défaut |
| Aide IA facultative | Ouvre `#/plus/coach` | Aucun à l’ouverture | Outils avancés |
| Auteur + portrait | Ouvre le profil GitHub Ilyomix | Aucun | À propos |
| Version/build/date/commit | Affiche les constantes de compilation | Lecture seule | À propos |
| Note recherche + conservation locale | Texte informatif | Aucun | À propos |
| Code source | Ouvre GitHub Ilyomix/lift | Aucun | À propos |
| Politique de confidentialité | Ouvre `#/plus/confidentialite` | Aucun | Données + À propos |

## Réglages : chaque préférence, commande et feuille

Route du baseline : `#/plus/reglages`, `SettingsScreen` (`More.tsx:361`). Chaque ligne conserve son effet même si elle change de page.

| Paramètre / action | Valeur, stockage et effet | Groupe proposé |
|---|---|---|
| Objectif visuel | Ouvre `#/plus/objectif`. Résumé du look, zones, poids ; en entretien, objectif éventuellement suspendu | Entraînement / objectif |
| Date objectif / mode entretien | Ouvre `GoalSheet`. Affiche date ou absence d’échéance ; ne confondre ni avec le look ni avec le poids cible | Entraînement / plan |
| Lieu d’entraînement | Ouvre `SetupSheet`, résumé salle/maison + équipement | Entraînement / équipement |
| Jours lundi…dimanche | `toggleTrainingDay` → `settings.trainingDays`, recalcul de la fréquence/du plan ; le store conserve au moins deux jours | Entraînement / rythme |
| Résumé fréquence, séries, durée, volume | Calculé via `weekShape`, `templateSets`, préférences ; aucun stockage supplémentaire | Résumé près des jours, détails repliés |
| Séances allongées | Visible si moins de cinq jours ; `prefs.keepWeeklyVolume`, ajout de séries calculé en séance, pas remplacement des séries de base | Entraînement / rythme |
| Poids cible min | `goals.targetWeightMin` ; vide devient `0`, sentinelle de calcul automatique | Entraînement / objectif |
| Poids cible max | `goals.targetWeightMax` ; même règle de vide | Entraînement / objectif |
| Tour de taille cible | `goals.targetWaist`, vide `null` | Entraînement / objectif |
| Aide sur les cibles de poids | Trajectoire du plan ou poids courant ±1 kg en entretien ; estimations explicites | Détail près des champs |
| Adapter les charges automatiquement | `prefs.autoLoad`. Double progression et baisses après séance ; ne pas mélanger adaptation des charges et poids corporel | Entraînement / progression |
| Choisir la salle courante | `setGym(id)` → `gymId`, utilisée pour les prochaines séances | Entraînement / salles |
| Renommer une salle | Ouvre un champ local ; validation OK → `renameGym` | Entraînement / salles |
| Ajouter une salle | Nom local, validation non vide → `addGym`, puis vide le champ ; ne sélectionne pas implicitement la nouvelle salle | Entraînement / salles |
| Supprimer une salle secondaire | `removeGym` supprime la salle et ses charges `gymLoads` des fiches ; historique réalisé conservé ; repli vers salle principale si nécessaire | Entraînement / salles, action destructive explicite |
| Salle principale | Distinction visible ; non supprimable dans cette UI | Entraînement / salles |
| Son de fin de repos | `prefs.sound`. Son web ou option de notification native selon la plateforme | Repos et alertes |
| Garder l’écran éveillé | `prefs.wakeLock`. Utilise la disponibilité de Screen Wake Lock, sans garantie lorsque l’app est cachée ou l’API indisponible | Repos et alertes |
| Activité en direct / suivi verrouillé | Composant natif détaillé ci-dessous ; absent en PWA | Repos et alertes |
| Notifications push web | `PushRow`, absent en natif ; détail ci-dessous | Repos et alertes |
| Alerte app ouverte web | Affichée si `!prefs.push` ; permission navigateur et `prefs.notifications` | Repos et alertes |
| Langue automatique / FR / EN | `prefs.lang`, localisation de l’état via `setPrefs`, application immédiate | Apparence |
| Thème automatique / sombre / clair | `prefs.theme`, application immédiate et cache local | Apparence |
| Accent bleu / orange | `prefs.accent`, application immédiate ; état radio | Apparence |
| Installation | Natif/PWA installée : statut ; sinon instructions Safari/Chrome adaptées à la plateforme | À propos / installation |

### Feuilles appelées depuis Réglages

| Route / feuille | Paramètre ou action | Stockage / effet à préserver |
|---|---|---|
| `#/plus/reglages` → `GoalSheet` | Mode date objectif / entretien | Brouillon jusqu’à Enregistrer ; conserver fermeture sans appliquer |
| Idem | Date cible, raccourcis −1 mois, −2 semaines, +2 semaines, +1 mois, +3 mois | Brouillon ; bornes et validité existantes conservées |
| Idem | Prévisualisation phases, volume, poids et avertissements | Calcul, aucune écriture avant validation |
| Idem | Enregistrer la date | `setGoalDate`, recalcul plan et flush |
| Idem | Entrer en entretien | `enterMaintenance` : entretien, cibles associées, ajustement nutritionnel éventuel et journal d’application ; pas suppression de l’historique |
| `#/plus/reglages` → `SetupSheet` | Salle / maison | Brouillon de setup |
| Idem | Haltères, banc, barre de traction, élastiques | Sélections d’équipement maison ; poids du corps implicite |
| Idem | Aperçu des exercices proposés | Disclosure en lecture seule |
| Idem | Enregistrer / fermer | `setSetup` reconstruit/restaure les fiches, archives par setup et reprise des charges/priorités ; fermeture abandonne le brouillon |
| `#/plus/objectif` | Choix look et zones prioritaires | Brouillon de `VisualGoalScreen`, calcul du plan avant application |
| Idem | Taille, sexe, taux de gras mesuré | Données d’estimation ; ne pas enlever leurs avertissements ni changer les calculs |
| Idem | Ajouter une mesure | Ouvre `#/progres/corps/mesure` |
| Idem | Appliquer / actualiser, échéance suggérée ou garder la date | Actions existantes d’objectif visuel ; changement réel de plan, pas une simple préférence d’apparence |
| Idem | Retirer l’objectif visuel | `clearVisualGoal`, rétablit plan de base |
| Idem | Choisir/changer/retirer une photo de référence | Import local et `setGoalPhoto` ; conserver le choix explicite de fichier |

`GoalSheet` et `SetupSheet` sont réutilisées ailleurs : ne pas créer une seconde logique de calcul ou des champs concurrents sous une autre route.

## Nutrition : journal, cibles et adaptation

Route baseline : `#/plus/nutrition`, `NutritionScreen` (`More.tsx:98`).

| Paramètre / action | Stockage / effet actuel | Destination proposée |
|---|---|---|
| Jour précédent / suivant | Date locale React ; lendemain interdit après aujourd’hui | Journal |
| Phase et conseil nutrition de la date | `contextAt(date)`, lecture seule | Journal |
| Total protéines du jour, saisie directe | `setNutrition(date, {protein})` → `nutritionEntries[date]` | Journal |
| Protéines −10 / +10 / +25 g | Même entrée ; incréments bornés à zéro | Journal |
| Total calories du jour, saisie directe | `setNutrition(date, {calories})` | Journal |
| Calories −100 / +100 / +250 kcal | Même entrée ; incréments bornés à zéro | Journal |
| Créatine prise / non prise | Entrée quotidienne : cible de créatine ou `0` | Journal |
| Jauges, cible et dépassement | Barres bornées visuellement ; valeur/dépassement restent affichés ; protéine adaptative calculée | Journal |
| Graphe protéines 14 jours, nombre de jours à la cible | `nutritionDays(..., today)`, pas la période glissante autour du jour sélectionné | Journal |
| État vide « Renseigner aujourd’hui » | Choisit aujourd’hui et donne le focus au champ protéines | Journal |
| Protéines adaptées au poids | `nutritionTargets.adaptive`; poids moyen, phase et plan déterminent la cible calculée | Cibles |
| Calories cibles | `nutritionTargets.calories` ; changement met à jour `caloriesChangedAt` | Cibles |
| Créatine cible | `nutritionTargets.creatine` | Cibles |
| Protéines min / max fixes | `nutritionTargets.proteinMin/Max`; utilisées en mode fixe ou sans poids ; règles de sèche conservées dans `proteinTargetFor` | Cibles |
| Conseil calorique / statut / détail | `calorieAdvice(state, today)`, calcul d’aujourd’hui, pas du jour du journal | Cibles, après configuration |
| Appliquer hausse / baisse proposée | `setNutritionTargets({calories: advice.target})`, date de changement enregistrée | Cibles |
| Question des trois dernières semaines normales : oui / non | Brouillon `normal`, détermine la proposition ; aucune écriture seule | Cibles |
| Appliquer le pas de sèche proposé | `calorieStepPatch`, conserve la trace de ce pas dans les cibles | Cibles |
| Annuler le pas de sèche | Toast : restaure l’objet précédent `nutritionTargets`, pas uniquement les calories | Cibles |
| Revenir à la question | Réinitialise seulement `normal` | Cibles |
| Méthode, plancher, temps de réaction, références | Textes/recherche existants ; aucune nouvelle règle médicale | Disclosure des cibles |

**Conservation obligatoire** : garder les unités g/kcal, la virgule décimale acceptée, le zéro quotidien, la cible adaptative et son repli fixe, les règles de sèche, la date de changement et l’annulation complète du pas. Ne pas déduire une hausse de charge du poids corporel.

**Piège du baseline** : `NumInput` initialisait un texte local depuis la prop sans se resynchroniser. Un conseil calorique appliqué pouvait changer le store tout en laissant l’ancien nombre dans le champ. Le déplacement est l’occasion d’un vrai brouillon avec validation et enregistrement explicite. Les cibles doivent refuser calories ≤0, créatine/protéines négatives, non-nombres et min > max, sans inventer de nouvelle limite médicale.

## Aide IA facultative

Route : `#/plus/coach`, `CoachScreen` (`More.tsx:269`).

| Action / élément | Stockage / effet | Groupe / préservation |
|---|---|---|
| Bilan de la dernière séance | `sessionPrompt` généré localement puis `shareText`; désactivé sans séance | Avancé ; aucun envoi automatique |
| Bilan global | `globalPrompt` puis partage volontaire | Avancé |
| Données contenues dans bilan de séance | Date/type/contexte, poids/tendance si présent, exercices/cibles/séries/effort/indicateurs/notes, dernières comparaisons et historique pertinent | Ne pas présenter comme anonyme ou dépourvu de données personnelles |
| Données contenues dans bilan global | Objectif/mode, programme, cibles nutrition, état du cycle, poids/tendance, fiches et cinq dernières séances | Même transparence |
| Coller | Lecture explicite du presse-papiers ; erreur → invitation à coller manuellement | Garder fallback |
| Zone de texte réponse | Brouillon local ; bloc JSON détecté par le parseur existant | Libellé accessible requis |
| Analyser | `parsePlanUpdate` et `previewPlanUpdate`, erreur locale ; aucune application | Ne pas réunir Analyser et Appliquer |
| Aperçu | Avant/après des exercices et cibles nutritionnelles proposées | Conserver ajout/suppression/modification visibles |
| Appliquer | `applyPlan`, historique d’application ; vide le texte et l’aperçu | Action explicite après revue |
| Historique des mises à jour | Douze dernières entrées, sources coach/programme/progression, dates et résumé | Disclosure ; ne pas filtrer silencieusement les autres sources |
| Historique vide | Explication, sans imposer d’utiliser l’IA | Garder absence réelle de données |

Le baseline laissait un aperçu analysé actif après modification de la réponse : appliquer pouvait alors utiliser le JSON précédent. Invalider l’aperçu lorsqu’on tape ou colle un nouveau texte évite cette divergence. Le partage ouvre la destination choisie par la personne ; Lift ne contient pas ici de client IA ni de clé de fournisseur.

## Sauvegarde, import, effacement

Route actuelle conservée : `#/plus/donnees`, `DataScreen` (`More.tsx:637`) ; futur retour `#/plus/reglages/donnees`.

| Action / élément | Stockage / effet | Préservation |
|---|---|---|
| Compteurs séances, mesures, photos, dernier export | Lecture de l’état, photoDb et `meta.lastBackupAt` | Pas de compteurs fictifs |
| Exporter | `exportBackup` crée un JSON avec date ; `saveFile` partage en natif/télécharge ou partage en web | Le JSON conserve séances, mesures, nutrition, photos et réglages |
| Export en cours / erreur | Garde `exporting`, bouton bloqué et `try/finally`, toast d’échec | Pas de double export involontaire |
| Date dernier export | Écrite seulement si `saveFile` renvoie vrai, avec `exportedAt` | Indique le résultat du partage/téléchargement, pas une preuve de copie durable dans un cloud |
| Choisir un JSON | Picker fichier ; `parseBackup`, erreurs visibles ; input réinitialisé pour rechoisir le même fichier | Aucun import à la sélection seule |
| Aperçu import | Compteurs séances, mesures, jours nutrition, photos, date | Toujours avant remplacement |
| Migration ancien format | Switch par défaut actif seulement si `parsed.legacy` ; reprend charges/historique, archive ancien programme | Conserver la compatibilité Golgoth et l’option |
| Importer / fermer | Confirmation → `importBackup` remplace état/photos, applique préférences, puis Accueil ; fermer abandonne | Avertissement de remplacement conservé |
| Tout effacer | Ouvre une Sheet, sans effacer immédiatement | Séparer du bouton d’export |
| Confirmer Effacer / Annuler | Effacer → `resetAll` puis Accueil ; Annuler ferme seulement | Garder le texte des données supprimées et conseil export |

L’effacement des données de Lift ne révoque pas les autorisations OS, ne supprime pas les fichiers déjà exportés et ne doit pas être décrit comme tel. La souscription push web possède son propre stockage local ; ne pas supposer que l’effacement d’IndexedDB désinscrit à lui seul le navigateur.

## Pause du programme

Route : `#/plus/pause`, `PauseScreen` (`Calendar.tsx:221`). Ce n’est pas un export de More.tsx.

| Paramètre / action | Stockage / effet | Groupe |
|---|---|---|
| Motif vacances / maladie / blessure / fatigue / autre | Brouillon, défaut vacances ; stocké au démarrage | Entraînement / pause |
| Dernier jour prévu facultatif | Brouillon de date, bornes existantes ; retour prévu le lendemain | Pause |
| Raccourcis 3 / 7 / 14 / 21 jours | Ajustent seulement le brouillon de fin | Pause |
| Effacer la date | Revient à une durée non fixée | Pause |
| Note facultative | Brouillon ; stockée dans `programPause.note` au démarrage | Pause |
| Aperçu de la reprise et absence | Calcul à partir des dates/historique | Pause |
| Démarrer la pause | `startPause` : actif, début horodaté, motif, fin, note ; retour Accueil | Confirmation explicite |
| Pause active / informations | Affiche motif, début, reprise prévue et note | Lecture seule |
| Reprendre | `endPause` archive la pause et prépare la reprise si nécessaire ; retour Accueil | Commande distincte, pas une inversion de switch anonyme |
| Règles de reprise + référence | Lecture seule, plusieurs cas | Disclosure compact après l’action |

La fin prévue est une information de planification ; ne pas promettre une reprise automatique si la personne n’a pas activé Reprendre. La note doit garder un nom accessible. Les pastilles de motif (40 px) et de durée (36 px) du baseline méritent des cibles tactiles plus grandes ; ne pas confondre hauteur visible et hit area effective sans QA.

## Rappels calendrier : export, pas autorisation Lift

Route : `#/plus/rappels`, `RemindersScreen` (`Calendar.tsx:310`).

| Sélection / action | Stockage / effet | Préservation / clarification |
|---|---|---|
| Séances | Sélection locale, vrai par défaut ; séries d’événements sur les jours choisis, rappel avant séance | Filtre du prochain fichier uniquement |
| Pesée | Sélection locale, vrai par défaut ; récurrence quotidienne | Idem |
| Tour de taille | Sélection locale, vrai par défaut ; toutes les deux semaines | Idem |
| Photos | Sélection locale, vrai par défaut ; toutes les quatre semaines | Idem |
| Décharges | Sélection locale, vrai par défaut ; événements/déclencheurs du plan | Idem |
| Phases et objectif / phases en entretien | Sélection locale, vrai par défaut | Respecter le mode du plan |
| Heure des séances | `prefs.trainingTime`, écriture persistante immédiate | Réutilisée par le générateur |
| Heure de pesée et mesures | `prefs.weighInTime`, persistante ; partagée avec taille/photos | Ne pas créer plusieurs heures indépendantes par inadvertance |
| Nombre affiché | Nombre de `VEVENT` générés, y compris règles récurrentes, pas tous leurs déclenchements futurs | Éviter une promesse de nombre exact de notifications |
| Ajouter les rappels | `buildIcs` puis `saveFile(.ics)` | Export seulement ; l’import dans Calendrier est manuel |
| Instructions d’import | iOS natif : fichiers puis calendrier ; autres variantes navigateur | Conserver les différences réelles |
| Liste des prochaines décharges | Calcul en lecture seule | Ne pas transformer en événements confirmés |
| Indication sur la fin de repos | Renvoie conceptuellement au minuteur dans Réglages | Un lien contextuel reste utile ; fonctions distinctes |

Aucun appel EventKit ni autorisation Calendrier n’est utilisé par cette page. Le fichier importé est un instantané ; modifier Lift ne met pas automatiquement à jour le calendrier externe. Les UID stables du générateur aident la réimportation, mais ne garantissent pas le même comportement dans tous les clients. Conserver UID, récurrences, heures locales et alarmes au cours du rangement UI.

## Notifications et suivi natif / PWA

### Natif — `NativeActivitySettings.tsx`

Route baseline `#/plus/reglages`, groupe Repos et alertes proposé. Le composant se rafraîchit au montage, au focus et au retour visible.

| Contrôle / état | Source / effet | Nuance obligatoire |
|---|---|---|
| Activité en direct iOS | `prefs.liveActivity !== false`, envoyé au bridge `WorkoutActivity` | Préférence souhaitée ≠ Live Activities autorisées par iOS |
| Suivi écran verrouillé Android | Même préférence, notification persistante | Nom distinct d’ActivityKit |
| Autorisation nécessaire | `WorkoutActivity.status().enabled` ; texte de chemin Réglages système | `supported` retourné par le bridge n’est pas distingué dans le baseline |
| Notification de fin de repos | Checked = `prefs.notifications && permission` ; activation appelle permission native puis écrit le résultat ; désactivation écrit false | Désactiver Lift ne révoque pas la permission système |
| Bouton Autoriser lorsque non accordé | Appelle la même fonction que le toggle | Doublon ; refus OS ne signifie pas qu’une nouvelle boîte de dialogue peut être affichée |
| Précision du minuteur Android | Ouvre `changeExactNotificationSetting` ; fallback textuel | Seulement Android, pas sur iOS |
| Son | `prefs.sound` utilisé pour l’alerte/les canaux | Respecter aussi les réglages système |
| Réglages revenus du système | Lecture actualisée de permissions et état de l’activité | Ne pas perdre les listeners lors du déplacement |

La programmation des alertes natives vérifie l’autorisation, annule/remplace le rappel connu et ne programme qu’une échéance future. Les actions +30 s/reprise sont liées à la séance et au repos. Le suivi verrouillé et les alertes de fin restent deux fonctions indépendantes.

Apple indique qu’une première demande enregistre l’autorisation ou le refus et que les suivantes ne réaffichent pas l’invite. Elle recommande une demande contextualisée et une lecture de l’état actuel avant de programmer une notification. Afficher donc « refusée, ouvrir les réglages » lorsqu’on dispose de cet état, plutôt qu’un bouton qui paraît redemander sans fin. [Apple — Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)

### PWA / navigateur — `PushRow`, `alerts.ts`, `push.ts`

| Contrôle / état | Source / effet | Nuance obligatoire |
|---|---|---|
| Disponibilité push | SW + PushManager + Notification, et contexte installé sur iOS | Hors natif ; ne pas montrer comme une permission manquante si le navigateur ne le supporte pas |
| Préparation de clé | `preparePush` charge service worker/clé publique | Peut échouer hors ligne ; aucune invite OS au montage |
| Activer le push | Geste utilisateur → souscription ; `prefs.push`, abonnement localStorage `golgoth-push-subscription` | Sert au service `https://golgoth-push.vercel.app/api`, pas au bridge natif |
| Désactiver le push | `prefs.push=false`, désinscription et annulation au serveur | Conserver nettoyage, pas juste masquer l’interrupteur |
| Tester | Demande un rappel dans 8 secondes | Réception non garantie ; texte préférer « Test demandé » |
| Activé / busy | Baseline utilise préférence + souscription et affiche busy comme checked | Ne pas présenter un état de chargement comme autorisation confirmée |
| Alerte app ouverte | Si push désactivé, montre l’état `Notification.permission` | État local mis en cache ; vérifier après retour des réglages navigateur |
| Activer l’alerte locale web | Seulement permission par défaut ; demande puis `prefs.notifications` | Refus → aide système ; non supporté → aide installation |
| Notification en arrière-plan web | Le runtime distingue visibilité et préférence ; un navigateur autorisé peut afficher une alerte à la fin quand caché | Ne pas changer ce comportement en renommant le toggle |
| Garder écran éveillé / son web | APIs disponibles, audio débloqué par interaction | Ne pas promettre la même disponibilité que le natif |

Ne pas regrouper push distant, notification locale native et calendrier importé derrière un unique switch « Notifications ». Les circuits, destinataires et possibilités hors ligne diffèrent. Apple recommande de demander seulement les autorisations nécessaires au moment où la fonction les utilise et d’expliquer leur finalité ; conserver ces étapes contextualisées plutôt que demander tout au lancement. [Apple HIG — Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)

## Duplications, densité et défauts concrets du baseline

| Priorité | Constat vérifiable | Conséquence / correction ciblée |
|---|---|---|
| P2 | Réglages mélange objectif, équipement, salles, permissions et apparence dans un long écran | Pages par intention ; garder le répertoire court, DS identique |
| P2 | Nutrition combine saisie quotidienne, cibles et longue justification | Journal séparé des cibles ; configuration avant conseil ; détails/recherche repliés |
| P2 | `NumInput`/`GoalInput` possèdent un texte initialisé depuis la prop sans mise à jour externe | Affichage ancien après modification par une autre action ; brouillon explicite synchronisé lors d’un changement sauvegardé |
| P2 | Cibles numériques du baseline acceptent des nombres négatifs et une fourchette inversée | Validation avant enregistrement, erreurs par champ ; pas de mutation d’un état incomplet |
| P2 | Coach garde l’aperçu après édition/collage d’un autre texte | Invalider le JSON analysé jusqu’à nouvelle analyse |
| P2 | Zone de réponse IA et note de pause sans label associé | Ajouter un nom accessible explicite ; placeholder ne suffit pas |
| P2 | Supprimer une salle enlève aussi ses charges machine sans confirmation/annulation | Rendre l’effet visible et protéger cette suppression, conserver l’historique réalisé |
| P2 | Native : toggle notification + ligne Autoriser, booléen ne distingue pas refus/prompt | Une seule commande adaptée à l’état, lien système après refus, sans nouvelle demande au lancement |
| P2 | ICS : les sélections ressemblent à des préférences persistantes, action nommée Ajouter | Dire clairement fichier à importer ; rien n’est automatiquement ajouté au calendrier par Lift |
| P2 | Push web : souscription locale ≠ permission actuelle ; test n’atteste pas livraison | Actualiser l’état au retour et ne promettre que la demande de test |
| P3 | Texte d’aide fréquence, charges, pause, nutrition et introduction IA très dense | Résumé d’une phrase + détails accessibles, sans supprimer limites ni unités |
| P3 | « Objectif » désigne look, date, mode et mensurations | Titres précis : plan/date, objectif visuel, mesures cibles |
| P3 | Historique affiché dans Coach contient aussi programme/progression | Conserver toutes les entrées ; le nom « mises à jour » doit rester général |
| P3 | Statut d’installation sur la longue page de réglages | À propos, avec instructions uniquement lorsque pertinentes |
| P3 | Jours sur sept colonnes et petites pastilles de pause/date | Vérifier cibles tactiles à 320 px ; ne pas masquer de choix pour les faire tenir |

Les accès multiples à une même feuille (Accueil/Réglages pour la date, Séance/Réglages pour la salle, Calendrier/Plus pour pause ou rappels) sont des raccourcis utiles, pas des doublons de fonction à supprimer. Préserver l’origine du retour et les liens historiques.

## Mise en œuvre confiée à cet audit : More.tsx seulement

Effectué après autorisation, sans modification du store ni du code natif :

- `MoreScreen` utilise `SettingsMenuRow` partagé : trois entrées principales, IA avancée repliée, À propos.
- Nouvel export `AboutScreen` : auteur/version, politique, source et installation déplacés sans changer de destinataire externe.
- `NutritionScreen` conserve la date, les trois saisies, les jauges et les 14 jours ; lien vers `plus/reglages/nutrition`. La saisie manuelle protéines/calories est bornée à zéro comme les boutons d’incrément, à la demande explicite du parent.
- Nouvel export `NutritionTargetsScreen` : formulaire avant conseil ; méthode/références repliées. Les handlers de conseil, `calorieStepPatch` et son annulation sont conservés.
- Formulaire de cibles en brouillon ; sauvegarde atomique des valeurs saisies valides, erreurs via `Field`. Fourchette fixe disponible même en adaptation comme repli en absence de poids. Aucun plafond médical ajouté.
- `CoachScreen` : introduction courte, partage/local/facultatif explicites, textarea nommée, aperçu invalidé à l’édition, historique replié sans filtrage destructif.
- `DataScreen` : retour de secours `plus/reglages/donnees`, logique export/import/effacement et confirmations conservées. `ImportSheet` reste exporté.
- `SettingsScreen` et ses helpers ont été extraits par le parent, qui possède leurs nouveaux écrans et les routes. Ce document ne prétend pas avoir implémenté toutes les recommandations de son inventaire.

Exports remis au routeur : `MoreScreen`, `AboutScreen`, `NutritionScreen`, `NutritionTargetsScreen`, `CoachScreen`, `DataScreen`, `ImportSheet`.

## Vérifications à réaliser après intégration

1. FR/EN, 320 et 402 px, clair/sombre : aucune troncature des titres/valeurs ; retours normaux et accès direct aux anciennes URL.
2. Plus : trois destinations, IA fermée par défaut, À propos ; Confidentialité reste lisible et son retour conserve le contexte.
3. Nutrition : le journal conserve le jour choisi ; les compteurs et la cible n’utilisent pas la même entrée. Cibles : brouillon incomplet sans écriture, erreurs associées, calories >0, créatine/protéines ≥0, min≤max, virgule acceptée, sauvegarde unique. Conseil/annulation resynchronisent les champs.
4. Coach : pas d’envoi à l’ouverture ; partage déclenché explicitement ; analyser puis changer le texte rend l’ancien aperçu inapplicable ; erreur de parsing ne change rien ; historique encore disponible.
5. Import/effacement : annuler ne modifie rien ; aperçu et avertissement avant remplacement ; export annulé n’avance pas la date.
6. Natif/PWA : tester séparément disponibilité, refus OS, retour des réglages, activation/désactivation ; aucune nouvelle demande hors contexte. Export ICS nommé et décrit comme tel.
7. Aucune différence de formule : `calorieAdvice`, `proteinTargetFor`, `calorieStepPatch`, rotation/volume, progression des charges et générateur ICS restent les références existantes.

Limite de cette passe : inventaire et relecture statique. La QA visuelle, le typecheck intégré et les tests métier sont conduits par le parent après intégration ; ce document ne vaut pas recette physique iOS.
