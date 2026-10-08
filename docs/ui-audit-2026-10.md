# Inventaire UI Lift — 8 octobre 2026

## Portée et niveau de preuve

Inventaire du code de travail pendant la préparation du build 33, complément de [ui-harmonization-plan.md](ui-harmonization-plan.md). Les routes viennent de `src/App.tsx`, les options des composants effectivement rendus. L’arborescence ci-dessous décrit l’interface disponible ; elle ne vaut pas validation visuelle. Les libellés peuvent encore évoluer pendant cette passe.

Lecture effectuée : App, écrans Home/Session/Calendar/ProgramScreen/Progress/More/Settings/Goal/Onboarding/Privacy, composants de réglage et volets, infrastructure Sheet/navigation et présentations natives. Aucun contrôle CUA ou appareil réalisé par l’auteur de cet inventaire. Les observations visuelles ci-dessous sont celles du responsable de la QA ; les fichiers sont dans `.local-release/build33/qa`. La première passe web finale porte sur le code `5f5e31e26a7c03f5a922867f244877fc060a2162`. La QA native a d’abord utilisé Debug32, puis le simulateur Debug33 avec les assets de l’archive33. Les reprises IAB utilisent un profil isolé sur le code local au moment du contrôle ; l’état de livraison courant est précisé ci-dessous. Les sections de preuves conservent le build de chaque observation ; aucune de ces passes ne constitue une validation physique du build 35 distribué.

## État courant de livraison et de validation

État consigné le **8 octobre à 22 h 03 Paris**, d’après les contrôles Apple du responsable : **35 traité (« Prêt à soumettre »), distribué au groupe Validation appareil physique — Internes — 1 testeur**. Une note bilingue de **3 195 caractères** est sauvegardée dans le champ Français et vérifiée après rechargement. Source figée : `07ad65b42bd0771e5f9e42d7a66625331ce2e630`. Reçus : `.local-release/build35/asc/upload-receipt.json` et `testflight35-notes-group-confirmed.{txt,png}`.

Le web public sert désormais **`30a21e994428e8cb0f8e0e8353c64bc865aed0e2`**, bundle `index-CnpSSDyU.js`, contrôlé à **22 h 25 Paris** (`build35/qa/post35/web-deployment.json`) : index/bundle/service worker/manifeste HTTP 200, marqueur de commit et précache vérifiés. La CI native `37838761222` est réussie selon le responsable ; elle ne vaut pas nouvel envoi Apple. Ce contrôle HTTP ne vérifie pas l’activation d’une ancienne PWA installée. **App Review reste sur 31, « En attente de vérification » ; le dossier 103f5133-84df-4c3b-9274-af5095566b7c n’a pas été retiré.** TestFlight 35 ne vaut pas soumission 35.

La validation physique 35 et sa vidéo restent à faire. L’absence de défilement après des gestes CUA est observée dans le simulateur 35 ; **répéter le geste n’est pas un contournement fiable**. Le diagnostic passif post35 retrouve un unique grand `touchmove` sans annulation JavaScript et le même échec sur une page ordinaire : l’attribution à Lift ou à l’injection des gestes reste indéterminée. Les corrections postérieures au build 35 — gestes, focus clavier/photo, unité de cible et contenu/accessibilité nutrition-IA — sont publiées dans le web `30a21e9`, mais ne font pas partie du binaire 35. Les changements supplémentaires pause, dock de repos et graphiques restent locaux et en QA.

## Routes et accès

Les chemins sont des routes hash, préfixées par `#/`. Les cinq onglets principaux restent Aujourd’hui, Séance, Calendrier, Progrès, Plus.

| Route | Contenu et accès secondaires | États à couvrir |
|---|---|---|
| `/` | Progression du programme ; objectif/date ; accès Programme ; séance active ou prochaine séance ; semaine ; indicateurs corporels/assiduité/force ; nutrition ; tâches utiles | Premier jour, repos, séance prévue, séance active, pause, programme terminé, objectifs sans date, mesures absentes ; tâche installation uniquement web |
| `seance` | Aperçu des cinq types de séances et salle ; puis exercice actif avec démonstration, séries, effort, repos, précédent/suivant, liste des exercices et options | Sans séance active, séance d’essai, exercice sans charge connue, remplacement, exercice sauté, exercice terminé, séance antidatée/correction, toutes séries terminées |
| `seance/bilan` | Bilan, performances, ajustements, avertissements, détails ; organiser la semaine après entraînement un jour de repos | Aucun bilan ; records ; ajustement appliqué/annulé ; comparaison indisponible ; proposition de semaine |
| `seance/:id` | Séance enregistrée, performances, séries et ajustements ; corriger ou supprimer | ID introuvable ; correction avec séance déjà active ; confirmation de suppression |
| `calendrier` | Semaine par défaut, affichage du mois, précédent/suivant/aujourd’hui ; jour détaillé ; onglet Programme | Jour terminé/actif/prévu/repos/pause/hors programme ; semaine personnalisée ; semaines passées/futures ; retour depuis détail |
| `calendrier/programme` | Étapes du programme, séances types ; semaine type, volume hebdomadaire et règles de progression | Maintien/date ; étape actuelle/future ; programmes personnalisés ; passage calendrier/programme sans perdre la semaine |
| `calendrier/programme/:type` | Éditeur de séance : ordre, ordre par défaut, ajout, édition, remplacement et retrait d’exercice | Liste modifiée ; exercice ajouté ; doublon d’alternative ; validation des valeurs ; type absent/invalide |
| `progres` | Force, liste des exercices et évolution comparable | Aucune performance ; séance sans charge ; salles/contextes différents |
| `progres/exercice/:id` | Courbe, salle/contexte, historique brut, accès fiche exercice | Aucun historique ; exercice absent du programme ; unités/contextes différents ; filtre salle variable |
| `progres/corps` | Poids, moyenne, cible, tour de taille et autres mensurations ; photos | Aucun relevé ; une valeur ; série complète ; pas de cible ; photo absente/chargement/échec |
| `progres/corps/mesure` | Même écran, volet Ajouter des mesures ouvert | Valeurs vides/invalides ; date ; annulation ; sauvegarde et réouverture |
| `progres/volume` | Semaine consultée, séries par muscle, effort, évolution | Aucun entraînement ; semaine sans série ; semaine remplie ; retour semaine actuelle |
| `progres/seances` | Historique groupé par mois, accès aux séances | Historique vide ; plusieurs séances le même jour ; historique long |
| `plus` | Accès directs Nutrition, Objectifs, Ajouter des mesures ; Programme, Salles et matériel ; Réglages ; Ressources | Maintien/date ; largeur étroite ; groupes développés/repliés |
| `plus/nutrition` | Date ; protéines/calories avec saisie et incréments ; créatine ; cibles et historique | Jour vide/rempli, valeur invalide, cible fixe/adaptative, pas de poids récent |
| `plus/objectif` | Physique et priorités : silhouette, zones, profil, référence photo ; préférences ou estimation selon le mode | Maintien sans poids/taille ; mode daté ; photo présente/absente ; invalidité ; reset ; sauvegarde/annulation |
| `plus/preuves` | Sources scientifiques, principes, références externes | Références repliées/développées ; textes FR/EN longs |
| `plus/coach` | Aide IA facultative : partage du bilan séance/programme, réponse collée, aperçu des changements, application, historique | Aucune séance ; presse-papiers refusé ; texte/JSON invalide ; proposition vide/remplie ; historique vide |
| `plus/pause` | Déclarer une pause, motif, date/fin prévue/note ; reprendre ; historique | Aucune pause, pause ouverte, pause avec fin, reprise progressive |
| `plus/rappels` | Choix des événements, horaires et export du calendrier | Aucun événement sélectionné ; horaires ; export ; explications iOS/Android/calendrier |
| `plus/a-propos` | Présentation, auteur, version/build, ressources utiles | Web/native ; informations de version longues |
| `plus/donnees` | Sauvegarde/export/import, aperçu d’import, effacement | Jamais exporté ; export récent ; import invalide/incomplet/valide ; stockage indisponible ; confirmation destructive |
| `plus/confidentialite` | Informations de confidentialité | Long texte, liens et retour |
| `plus/reglages` | Index des six familles de réglages | FR/EN, résumé des préférences actuelles |
| `plus/reglages/:section` | Sous-écrans détaillés ci-dessous | Valeurs initiales/modifiées, retour et rechargement |

Compatibilité : `plus/programme[/type]` redirige par remplacement vers `calendrier/programme[/type]`. Une route principale inconnue retourne à l’accueil ; une section Réglages inconnue retourne à l’index. L’onboarding remplace toutes les routes tant qu’aucun profil n’existe.

## Arborescence complète des réglages

```text
Réglages
├─ Objectifs — /plus/reglages/objectifs
│  ├─ Durée du programme → volet date ou maintien sans échéance
│  ├─ Physique et priorités → /plus/objectif
│  │  ├─ Silhouette souhaitée ; zones prioritaires (maximum 3)
│  │  ├─ Sexe ; taille ; masse grasse facultative
│  │  ├─ Référence photo : ajouter/remplacer/retirer
│  │  ├─ Maintien : enregistrer les préférences sans date, sèche ni cible imposée
│  │  └─ Mode daté : estimation/application ; réinitialiser les préférences
│  └─ Cibles de mesures
│     ├─ Estimation du programme OU Cible personnalisée
│     ├─ Poids minimum/maximum seulement si cible personnalisée
│     ├─ Définir une cible de tour de taille → valeur facultative
│     └─ Enregistrer : brouillon sans écriture avant validation
├─ Séances et matériel — /plus/reglages/seances
│  ├─ Jours et fréquence — /plus/reglages/jours
│  │  ├─ Jours habituels ; aperçu nombre de séances/durée/volume
│  │  └─ Conservation du volume hebdomadaire lors du changement de fréquence
│  ├─ Séances du programme → /calendrier/programme
│  ├─ Matériel et salles — /plus/reglages/materiel
│  │  ├─ Salle ou domicile ; matériel disponible
│  │  └─ Salles : ajouter, renommer, sélectionner, retirer
│  ├─ Pause du programme → /plus/pause
│  ├─ Rappels du calendrier → /plus/rappels
│  │  ├─ Séances, pesées, tour de taille, photos, semaines allégées, phases/objectif
│  │  ├─ Horaires séance/pesée
│  │  └─ Export .ics et instructions d’ajout au calendrier
│  └─ Ajustement automatique des charges ; explication de la progression
├─ Repos et alertes — /plus/reglages/repos
│  ├─ Son de fin de repos
│  ├─ Garder l’écran allumé
│  ├─ iOS : Live Activity ; notification de fin de repos ; état des autorisations
│  ├─ Android : suivi de séance ; notification ; réglage alarmes exactes
│  └─ Web : notifications selon navigateur/installation, activation/test/désactivation
├─ Cibles nutritionnelles — /plus/reglages/nutrition
│  ├─ Calories ; créatine
│  ├─ Protéines adaptées au poids OU fourchette fixe minimum/maximum
│  ├─ Fourchette avant la première pesée si mode adaptatif
│  ├─ Conseils nutritionnels et éventuels ajustements/annulation
│  └─ Explication du calcul des cibles
├─ Apparence — /plus/reglages/apparence
│  ├─ Langue automatique/français/anglais
│  ├─ Thème système/clair/sombre
│  └─ Accent orange/bleu
└─ Données et confidentialité — /plus/reglages/donnees
   ├─ Sauvegarde/restauration → /plus/donnees
   └─ Confidentialité → /plus/confidentialite
```

Le réglage exceptionnel d’une seule semaine est dans le volet d’un jour du Calendrier ou dans le bilan après une séance un jour de repos. Il ne remplace pas Jours et fréquence. Les jours occupés restent représentés et l’action Rétablir les jours habituels retire seulement l’exception de la semaine.

## Volets, contrôles et interactions secondaires

| Famille / source | Inventaire | États et interactions à vérifier |
|---|---|---|
| `GoalSheet`, `PlanMode` | Mode daté/maintien, date et raccourcis, aperçu, enregistrement | Brouillon annulé, date impossible/hors limites, maintien sans échéance, conservation préférences |
| `CalendarDaySheet`, `WeekScheduleSheet` | Détail jour, séance prévue/enregistrée/active, organiser semaine, enregistrer/reset | Repos explicite ; jours verrouillés ; pause ; semaine hors limites ; données changées pendant édition |
| `Calendar` | Volet étape du programme | Titre/description de l’étape ; fermeture sans déplacement vers un jour arbitraire |
| `useSessionStart` | Confirmation de démarrage un jour de repos ou de reprise d’une pause | Annuler ne démarre rien et garde la pause ; accepter termine explicitement la pause et démarre la séance choisie ; abandonner ensuite ne réactive pas la pause |
| `Session` | Liste des exercices, menu séance, date/notes, fin anticipée, abandon, correction, suppression | Exercice actif hors ordre ; retour après annulation ; séries non terminées ; séance existante conservée |
| `Session` | Menu exercice, contexte technique, note, remplacement, ignorer ; détails série | Échec, technique dégradée/douleur, répétitions propres, note ; valeurs vides/invalides ; série validée puis annulée |
| `ExerciseSheet`, `ExerciseAlternatives`, `EffortGuidance` | Prescription, technique, démonstration, vidéos, alternatives, sources, aide sur les répétitions en réserve | Vidéo personnelle valide/invalide ; lien Techniques sur YouTube ; aucune alternative ; doublon ; exercice déjà commencé ; choix séance/programme |
| `ExerciseDemo` | Lecture/pause, mouvement/avant/arrière, rotation | Chargement, échec/fallback, interaction tactile, animations réduites |
| `RestTimer` | Bannière/dock et minuterie développée, ajustements, passer/reprendre | Décompte, fin naturelle, zéro, ajout de temps, retour séance ; fermer/swiper sans arrêter le repos |
| `ProgramScreen` | Ajouter exercice ; éditer prescription/charge/repos/notes ; remplacer/retirer ; ordre par défaut | Charge inconnue, PDC/lest, unités, fourchettes incorrectes, nombre de séries/répétitions invalide |
| `GymSheet`, `SetupSheet`, `GymManager` | Salle courante, ajout, renommage, retrait ; lieu/matériel | Première salle, plusieurs salles, domicile ; charge/historique de chaque salle conservés |
| `Progress` | Ajouter mesures ; confirmer suppression ; photo ; confirmer suppression photo ; comparer photos | Aucune mesure, saisie partielle/erreur ; photo absente/chargement/échec ; comparaison avec moins de deux photos ; référence conservée |
| `More.ImportSheet`, `Onboarding.ImportResultSheet` | Aperçu sauvegarde, option mise à niveau du programme, import, résultat | JSON invalide, sauvegarde partielle, import valide, stockage en échec, données remplacées explicitement |
| `More.DataScreen` | Confirmation d’effacement | Annuler conserve tout ; bouton destructif différencié |
| `MeasurementPicker` | Saisie desktop, rouleau tactile/native, saisie centrale, unité fixe, Valider/Annuler | Vide, zéro autorisé/interdit selon champ, décimales, hors limites, valeur existante exacte, clavier, ouverture sans écriture |
| `ui.DateInput`, `TimeInput` | Calendrier intégré pour date ; heure | Bornes, date supprimée/invalide, sélection mois/jour, navigation clavier ; annulation |
| `ui.Sheet` et confirmations spécifiques | Overlay, scrim, fermeture, focus, clavier, glissement bas | Entrée/sortie, fermeture par bouton parent, seuil de swipe, empilement, réouverture pendant sortie, reduced motion |
| `SwipeNavigation`, `RouteFocus`, `TabBar` | Retour/avance par geste, changement d’onglet, historique | Aperçu par entrée historique, scroll conservé, fin sans flash ; onglet sans faux swipe de page ; contenu sous safe areas |

## Onboarding et états globaux

| Surface | Contenu / branche |
|---|---|
| Accueil onboarding | Langue, démarrage, import d’une sauvegarde |
| Lieu/matériel | Salle ou domicile, matériel |
| Rythme | Jours habituels et aperçu |
| Profil | Sexe, âge, taille, poids, tour de taille ; mesures facultatives selon champ |
| Objectif | Date ou maintien ; mêmes choix de silhouette/zones dans les deux modes |
| Résumé | Programme et préférences ; invitation notifications ; création du profil |
| Chargement initial | État busy avec identité Lift |
| Stockage inaccessible sans profil | Message explicite sans effacement ; Réessayer |
| Stockage indisponible après modification | Erreurs/toasts de persistance ; ne pas présenter une sauvegarde comme réussie |
| Mise à jour web | Nouvelle version ; Plus tard/Mettre à jour ; absent en natif |
| Notifications | Permission inconnue/accordée/refusée/non disponible ; attente et erreur ; réglages système |
| Toaster | Succès, erreur, information et éventuelle annulation |

## Surfaces natives distinctes

`ios/App/LiftActivity/LiftActivity.swift` définit une palette dérivée du thème/accent, une vue verrouillage et les régions Dynamic Island étendue/compacte/minimale. Le verrouillage suit clair/sombre ; l’Island conserve sa surface sombre. Le code distingue couleur du décompte et couleur d’expiration, statut de repos, progression, +30 s/Passer/Reprendre, marges horizontales et verticales. Ces intentions de code ne prouvent pas le rendu ni l’actualisation en arrière-plan.

À reprendre sur le build réellement installé : 01:00→00:59 (chiffres/segments), 00:01→00:00 (texte Repos terminé et couleur), ajout de temps, passer/reprendre, compact/étendu/minimal, paysage et largeur limitée, FR/EN, orange/bleu, thème verrouillage, alignements des bords et du nom de séance. Vérifier séparément téléphone verrouillé et app en arrière-plan. Le clignotement et les délais système demandent une observation physique, pas une déduction depuis SwiftUI.

Android possède sa propre notification persistante (`WorkoutService.java`) et les permissions système ; son rendu et sa vie en arrière-plan restent à contrôler sur Android. Un succès iOS n’atteste pas Android.

## Constats actionnables de cette passe

| Priorité | Constat démontré par le code/les tests | État / preuve |
|---|---|---|
| P2 | En maintien, l’ancien onboarding abandonnait silhouette/zones ; la page de critères imposait un changement de mode pour sauvegarder. | Corrigé dans le travail courant : préférences sans changement de date/cibles/calories, sauvegarde et rechargement. `maintenance-preferences.test.ts`, `maintenance-goal-ui.test.ts`, `logic.test.ts`. |
| P2 | Réinitialiser les préférences en conservant une photo gardait l’ancienne silhouette, contrairement au reset annoncé. | Corrigé : silhouette par défaut, zones/masse grasse réinitialisées, photo conservée. Tests de reset puis réouverture/sauvegarde. |
| P2 | Cibles automatiques/personnalisées ambiguës ; une ancienne cible pouvait contaminer l’aperçu d’estimation. | Nouveau choix explicite ; tests `target-measurements-ui.test.ts` : estimation indépendante, brouillon annulé, sauvegarde 0/0, taille facultative, invalidité min/max, rechargement. |
| P2 | Les bornes du sélecteur de cibles (35–250 kg, 50–200 cm) doivent aussi être appliquées par la validation parent : la saisie manuelle n’est volontairement pas tronquée par le rouleau. | Correction parent intégrée ; régression hors bornes et limites exactes réussie dans `target-measurements-ui.test.ts`. Ne pas remplacer silencieusement une saisie invalide par une valeur bornée. |
| P2 | Une fermeture pilotée par `open=false` peut démonter un `Sheet` avant sa sortie vers le bas, contrairement aux fermetures déclenchées par le volet. | Corrigé : présence et contenu retenus pendant la sortie ; actions fermantes des parents conditionnels différées explicitement. `sheet-presence.test.ts` : 9 cas, dont StrictMode, réouverture, échec asynchrone, validation unique, absence de seconde sortie, Escape/focus/scroll du volet supérieur. QA native Debug ciblée : petit glissement de 30 px revient en place, grand glissement de 383 px ferme ; mesure enregistrée conservée. |
| P3 | Les actions de confirmation doivent avoir les mêmes icônes Annuler/Confirmer que les autres actions. | Les confirmations sont des `Sheet` spécifiques (aucun composant `ConfirmDialog`). Icônes raccordées par le responsable, icône de l’action du toast ajoutée ; contrôle visuel restant. |
| P2 | `Field` enveloppait un sélecteur composite dans `<label>` : toucher une valeur non labelable de la roue activait implicitement le premier bouton et refermait le sélecteur. | Reproduit en QA native par le responsable. Corrigé : label implicite réservé aux contrôles natifs directs ; composite avec son nom accessible hors label. `field-accessibility.test.ts` couvre les deux structures. QA native Debug après correction : toucher le centre permet la saisie manuelle de 81, unité kg fixe ; Valider transmet au brouillon. |
| P2 | L’unité `kg/main` revient à la ligne dans la page Séance native 33. | Constat sur 33 (`native33-session-page-fr-dark.png`) ; unité insécable intégrée au code 34 puis au 35 web/TestFlight. La livraison ne remplace pas la revalidation visuelle sur iPhone physique. |
| P2 à qualifier | Des glissements CUA ne font pas défiler `ExerciseSheet` dans le simulateur. | Observation répétée sur35, mais diagnostic post35 : un seul grand `touchmove` de −286,7 px, `defaultPrevented=false`, aucun scroll ; échec aussi sur page ordinaire. Origine produit/injection indéterminée, aucun défaut WebKit ou physique établi. Répéter le geste n’est pas fiable. Original35 restauré et lancé par le responsable ; preuve humaine ou multipoint vérifiée nécessaire. `qa/post35/diagnostics-summary.json`. |
| P2 | Pendant une pause, Commencer depuis l’accueil terminait implicitement la pause ; abandonner la séance ne la rétablissait pas. | Reproduction rapportée par le responsable. Correctif local dans `useSessionStart` : confirmation FR/EN explicite avec conséquences et Annuler, commune à Home/Séance/Calendrier. Aucun changement de store. Revue indépendante sans anomalie constatée ; 3 tests de démarrage + 10 tests Sheet réussis. IAB EN320 : Annuler conserve la pause/fin prévue ; Confirmer démarre. Correctif non livré ; autres entrées non validées visuellement par ce seul contrôle. |

Ne pas interpréter les différences propres aux filtres de salles, notifications système ou vues natives comme des défauts de style sans vérifier leur fonction. Aucun autre bug métier n’a été déclaré sur la seule apparence du code.

## Matrice de validation visuelle à compléter

La couverture est **partielle**. Une mention de langue, largeur ou thème ne valide que cette combinaison et les écrans cités dans les preuves ci-dessous ; elle ne vaut pas validation de toute la famille. Les tests de composants sont une preuve de comportement, pas d’alignement, contraste ou geste physique. Les cellules « À faire » restent ouvertes.

| Famille | FR/EN | Clair/sombre + orange/bleu | 320/393 px | Tablette/desktop | Vide/erreur/rempli | Clavier/focus/reduced motion | Natif/gestes |
|---|---|---|---|---|---|---|---|
| Onboarding, import, permissions | Onboarding EN ciblé | IAB sombre ciblé | 393 EN sombre | À faire | Cinq étapes, maintien, import valide/invalide IAB ; permissions à faire | À faire | Permissions natives et physique à faire |
| Home, repos, semaine, tâches | EN ciblé | Clair web ; sombre natif ciblés | 320 EN clair | Home iPad natif EN sombre | États supplémentaires à faire | À faire | Home Debug inspecté ; autres gestes à faire |
| Séance aperçu/active/bilan/historique | FR/EN ciblés | Clair web/sombre natif ciblés | 320 EN clair ; aperçu natif FR ; correction EN393 | À faire | Charge -5 refusée ; hors ordre3→4 puis annulation ; correction séance 1 conserve numéro/3 séries/2 exercices et recalcule 1RM ; autres états à faire | À faire | Salle alignée sur 33 ; unité insécable livrée 35, physique à revalider |
| Exercice, 3D, technique, alternatives | FR natif / EN IAB ciblés | Sombre ciblé | IAB393 ; fiche native 33 | À faire | Vidéo invalide et alternatives IAB ; autres états à faire | À faire | 3D/Technique visibles ; absence de défilement CUA observée, origine produit/injection indéterminée ; physique à faire |
| Calendrier semaine/mois/jour/programme | FR/EN ciblés | Clair/sombre ciblés ; bleu à faire | 320 EN clair ; 393 FR sombre ; restauration EN393 | 1024 px sans débordement ; iPad33 clair ciblé | Rétablissement des jours après exception validé : terminé conservé, repos et cible 5 corrects ; Home Cette semaine revient à5–11 octobre ; autres états à faire | À faire | Volet jour natif33 ciblé ; autres gestes à faire |
| Éditeur programme et salles | EN ciblé | IAB sombre ciblé | 393 EN sombre | À faire | Ordre/reset, ajout/save 32,5kg+note, remplacement efface ancien contexte, retrait vers8exercices acquis ; salle ajoutée/renommée/sélectionnée | Réordre au clavier acquis | Natif à faire |
| Progrès : quatre onglets, mesures/photos | EN ciblé | Clair ciblé | Quatre onglets 320 EN clair ; exercice rempli EN393 | 1024 px : onglets sans débordement | Mesure -12 refusée ; champs vides, photos/comparaison/annulation ; détail exercice et graduation distincte ; volume rempli et semaine précédente/suivante acquis ; contexte multi-salles à faire | Comparaison photo au clavier acquise | Sélecteur de poids Debug ciblé |
| Plus, réglages, objectifs et critères | FR/EN ciblés | Clair/sombre ciblés ; Apparence/Repos EN clair bleu ciblés | 320 EN clair ; Plus/cibles 393 FR sombre ; À propos/Confidentialité 320 EN sombre | Apparence/Repos 1024 EN clair bleu ciblés | Estimation/personnalisé ciblés ; autres états à faire | À faire | À faire |
| Nutrition/cibles, sauvegarde, IA, sources | EN ciblé, dont IA/sources post35 | Clair/bleu et sombre/orange ciblés | Nutrition/cibles 320 EN ; erreur IA et explication corrigées 320 EN | Nutrition/IA/sources 1024 EN clair bleu ciblés | 1444 kcal conservées ; import {} rejeté sans changement métier ; erreur IA associée ; proposition valide à faire | Association d’erreur IA vérifiée ; lecture réelle à faire | À faire |
| Tous sélecteurs de valeurs et volets | Poids et cm natifs ciblés | Combinaisons restantes à faire | Sélecteur natif ciblé | À faire | Poids ciblé ; cm saisi/validé dans le brouillon puis abandonné | Saisie manuelle ciblée ; reste à faire | Debug : petit/grand swipe ; autres volets à faire |
| Repos web, Live Activity, Dynamic Island | Repos web FR/EN ciblé | IAB sombre/orange ciblé | Dock : titres/préfixe série complets sur captures320/393 | Selon surface | Dock et minuteur visibles ; expiration naturelle web orange acquise ; expiration native à faire | À faire | Appareil requis pour Live Activity/Island |
| Notification Android et permissions | À faire | Système + accent | Appareil | Sans objet | À faire | À faire | Android requis |

Critères de chaque case : titres/sous-titres alignés, icônes adaptées, actions identifiables et accessibles, unité visible, absence de débordement/troncature dommageable, hauteur tactile cohérente, densité/espacement, information non répétée, état sélectionné et erreurs lisibles. Pour les volets : contenu suit le doigt, seuil d’abandon cohérent, animation jusqu’en bas puis démontage, retour du focus. Pour les pages : retour avec aperçu de la bonne entrée, pas de flash à l’arrivée, onglets sans animation de navigation inadaptée.

### Complément borné de couverture

La matrice décrit des familles ; elle ne doit pas annuler les preuves ciblées des compléments ci-dessous. Huit parcours restent à compléter, avec un profil fictif et restauration après les modifications de données. Une capture d’un écran ne valide pas les actions qui suivent.

| Parcours restant | Critères de réussite | Support possible sans iPhone physique |
|---|---|---|
| 1. Calendrier : branches supplémentaires après séance sur repos | Rétablissement après exception et lien Home Cette semaine acquis, sans les refaire. Restent confirmation de démarrage sur repos et proposition de fin comme parcours UI complet | Navigateur |
| 2. Branches de fin/correction restantes ; déclinaison native du parcours actif | Hors ordre3→4/annulation et correction séance 1 acquis : numéro,3 séries/2 exercices conservés. Ne pas étendre à toutes les corrections, changement de date ou fin anticipée non rapportés | Navigateur puis simulateur |
| 3. Salles : contextes multiples et branches restantes | Éditeur ordre/reset/ajout/save/remplacement/retrait acquis ; salle fictive ajoutée, renommée, sélectionnée. Suppression et conservation de charges sur plusieurs salles historiques non déduites | Navigateur |
| 4. Compléments pause/reprise et contrôles système | Annuler/Confirmer pause EN320, export 8 événements puis sélection vide désactivée et jours5 → 4 → 5 acquis. Restent autres entrées/états de pause, import calendrier système et permissions | Navigateur ; dialogues natifs via simulateur seulement comme preuve de simulateur |
| 5. Contexte multi-salles et proposition IA valide | Progression/détail et graduation distincte acquis ; Volume 2 pectoraux/1 dos et aller-retour semaine28 septembre→5 octobre acquis. Pas de filtre sur le cas à une seule salle historique ; autre contexte et IA valide restent distincts | Navigateur avec fixtures |
| 6. Mesures restantes : g/kcal/% et charge par haltère, zéro permis, exactitude et clavier | Unité visible, aucun arrondi implicite, annulation du brouillon, aucun débordement avec clavier | Navigateur tactile et simulateur |
| 7. Navigation retour/avance et annulation, onglets, volets empilés, mouvement réduit | Bonne entrée visible pendant le geste, aucun flash, onglet sans faux swipe, sortie et focus corrects | Navigateur et simulateur ; observation CUA ExerciseSheet séparée, attribution produit/injection non établie |
| 8. Responsive ciblé : onboarding FR320, séance/éditeur/volet/exercice tablette, exercice clair/bleu | Aucun texte coupé ou contrôle inaccessible dans ces combinaisons encore manquantes | Navigateur et iPad simulateur |

À ne pas refaire sans changement concerné : onboarding EN ciblé, imports valide/invalide et restauration, refus de charge/mesure négative, persistance nutrition, roue kg/cm ciblée, focus/Escape du volet, comparaison photo au clavier, erreur IA, Apparence/Repos/cibles nutrition/Sources EN clair bleu1024, À propos/Confidentialité/cible kg320, confirmation de pause EN320, hors ordre3→4/annulation, correction séance 1, restauration des jours et lien Cette semaine, éditeur complet ciblé, export rappels8 événements/vide, fréquence5 → 4 → 5, graduation du graphique et dock de repos FR/EN320/393 avec expiration web. La revue source des **199 boutons**, rapportée par le responsable, n’a relevé aucun autre écart ; ce décompte ne certifie ni le rendu ni la réponse tactile de ces boutons.

Restent hors de cette fermeture de couverture web/simulateur : build réellement installé sur iPhone, permissions/notifications, inertie tactile et rotation3D à deux doigts, Live Activity/Dynamic Island en arrière-plan/verrouillé/paysage et thèmes, VoiceOver réel, notification/permissions Android, activation sur ancienne PWA installée. Chaque preuve garde son appareil et sa version ; aucune réussite navigateur ne ferme ces lignes.

## Limites et prochaine preuve

Validation automatisée de cette passe : suite ciblée de 72 tests réussie avant le dernier correctif Field/StrictMode ; puis 26 tests réussis (5 accessibilité,12 sélecteur,9 présence Sheet) et typecheck réussi. La suite du code 33 compte **445 tests réussis et 1 ignoré** ; celle de 34 compte **446 réussis et 1 ignoré**. Le build 35 hérite de cette preuve sans nouvelle exécution complète ; son typecheck/build et paquet signé ont été vérifiés séparément. Le web `30a21e9` a ensuite passé **447 tests,1 ignoré**. La dernière suite locale incluant les correctifs pause/repos/graphiques compte maintenant **455 tests :454 réussis, 1 ignoré,0 échec**, journal `build35/qa/coverage/tests-post35.log` vérifié indépendamment. Cela ne remplace pas le contrôle natif tactile et ne prouve pas une livraison de ces corrections.

Cet inventaire couvre les routes et familles de contrôles présentes dans le code. Il ne certifie ni toutes les combinaisons de données historiques, ni les rendus des notifications/permissions du système, ni les moteurs 3D de chaque appareil. Les comptes rendus Apple/builds précédents ne valident pas le fonctionnement physique de 35. La preuve finale doit indiquer source/build, appareil ou navigateur, langue/thème, chemin, état et capture ; les défauts résolus doivent être revérifiés après les dernières modifications communes.

## Preuves finales transmises par le responsable

Le 8 octobre, après correction du `Field`, le responsable a constaté dans l’interface native Debug : toucher la valeur centrale laisse le sélecteur ouvert et permet la saisie manuelle ; l’unité kg reste fixe ; Valider transmet `81` au brouillon ; après défilement, Annuler conserve ce brouillon `81`. Un petit glissement du volet de 30 px revient en place ; un glissement de 383 px le ferme. Après abandon du brouillon, la mesure enregistrée reste `80,1` et `81` n’est pas sauvegardé. Ces observations valident ces parcours précis, pas toutes les unités ni tous les appareils. Un geste rapide automatisé a fait passer la roue de `81` à son plafond `250` : l’inertie système est active, mais la finesse du geste et la vitesse sur appareil physique ne sont pas certifiées.

Les premières captures Chrome, y compris la première passe 393 px FR sombre sur douze familles, sont conservées pour le cadrage seulement : Dark Reader injectait ses styles. Elles sont invalidées pour juger la palette ; cette contamination ne constitue pas un défaut CSS de Lift. Dark Reader a ensuite été désactivé **uniquement pour `127.0.0.1:5185`**. L’absence de styles Dark Reader a été contrôlée (`0`) avant les nouvelles captures préfixées `clean-` ; les surfaces CSS Lift étaient correctes.

La planche `clean-light-contact.jpg`, inspectée par le responsable, présente la passe 320 px EN clair : accueil, séance, calendrier/programme, quatre onglets Progrès, Plus, réglages, objectifs/critères et nutrition. Les captures `clean-plus-393-fr-dark.jpg`, `clean-calendrier-393-fr-dark.jpg`, `clean-targets-393-fr-dark.jpg` et `clean-targets-custom-393-fr-dark.jpg` documentent les contrôles propres en 393 px FR sombre. Elles ne valident pas toutes les permutations FR/EN, clair/sombre et orange/bleu.

À 1024 px, Calendrier et Progrès ont été contrôlés sans débordement : barre d’onglets de 608 px dans une zone de contenu de 640 px (`clean-calendar-desktop-fr-dark.jpg`, `clean-progress-desktop-fr-dark.jpg`). L’accueil iPad natif EN sombre a été inspecté et enregistré dans `native-ipad-home.jpg` ; les autres pages iPad restent à parcourir.

Contrôles fonctionnels web ciblés : une mesure corporelle `-12` empêche Enregistrer ; une saisie nutritionnelle de `1444` kcal reste présente après rechargement direct ; une charge `-5` empêche la validation d’une série, puis `22,5` kg et `8` répétitions rendent le bouton actif sans enregistrer la série. Ces cas ne constituent pas un audit exhaustif de tous les champs.

Passe source supplémentaire sur les boutons d’action : les lignes de choix d’un exercice à ajouter portent désormais une icône Plus et un nom accessible « Ajouter [exercice] ». Les jours et choix de valeur restent textuels ; les onglets de navigation visuelle ont été repris dans la passe décrite plus bas. Les autres actions inspectées possèdent déjà une icône ou un chevron de destination. Le bouton Voir le programme du volet d’étape utilise aussi la fermeture animée commune avant de naviguer.

## Reprise de couverture du 8 octobre — observations du responsable

Sur simulateur natif33, `native33-session-preview-fr-dark.png` montre le volet d’un jour avec Pull prévu ; `native33-exercise-fr-dark.png` et `native33-exercise-technique-fr-dark.png` couvrent la fiche, la démonstration 3D et Technique. `native33-session-page-fr-dark.png` montre la salle alignée avec le titre, mais a révélé le retour à la ligne de `kg/main`. Le correctif d’unité a depuis été intégré à34 puis livré dans35 ; cette capture33 reste une preuve de l’ancien défaut. Le défilement par glissement de la fiche exercice reste bloqué dans ce simulateur ; le corps de Séance défile. La cause reste à déterminer.

Dans l’IAB, profil fictif isolé en 393 px EN sombre : les cinq étapes d’onboarding ont été parcourues (`iab-onboarding-*.png`). Âge 32 ans, taille 178 cm, poids 80,1 kg et tour de taille 88 cm acceptés ; le mode sans date masque la date et conserve les options physiques. Terminer ouvre Séance sans entraînement actif. Ce contrôle web ne valide pas la demande d’autorisation native. La fiche exercice défile dans l’IAB, une vidéo invalide affiche et conserve son erreur, et les alternatives montrent l’icône Remplacer (`iab-video-invalid-en.png`, `iab-alternatives-en.png`).

Journal détaillé : `.local-release/build33/qa/evidence-log.json`. Les 445 tests cités plus haut concernent le code figé33, pas une certification automatique des nouveaux correctifs locaux. Aucune validation physique 33, Android ou couverture exhaustive n’est ajoutée par cette reprise.


### Complément ciblé — mesures, photos et sauvegarde

Les captures supplémentaires ont été relues indépendamment : `native33-cm-inline-input-confirmed.png` montre `90 cm` dans le brouillon Ajouter des mesures ; le responsable a ouvert la roue à `85`, saisi `90`, validé la roue puis fermé le volet sans Enregistrer. Cela ne constitue pas une nouvelle mesure sauvegardée ni une validation du défilement du volet.

Sur le profil IAB fictif 393 px EN sombre, `iab-body-measurement-empty-en.png` montre les champs vides avec unités fixes et Enregistrer désactivé. `iab-nutrition-en.png` montre les unités g/kcal et les actions compactes. Deux icônes PWA locales servent de photos fictives : comparaison visible dans `iab-photos-compare-slider-en.png` ; le responsable a déplacé le séparateur de 50 à 51, puis ouvert et annulé la suppression (`iab-photo-delete-confirm-en.png`). La capture prouve l’état visuel ; le déplacement et l’annulation sont les observations du responsable. La restauration finale est désormais confirmée : 0 séance, 1 mesure et 0 photo, dans l’interface et l’export final ; les deux photos QA ont été retirées par réimport de la baseline.

L’import de `{}` est rejeté avec une erreur explicite (`iab-import-invalid-en.png`). La comparaison indépendante des exports avant/après confirme exactement les deux seules différences du reçu `iab-import-preservation.json` : `exportedAt` et `state.meta.lastBackupAt`, produits par l’export lui-même. Aucune donnée métier ne diffère. L’aperçu de la sauvegarde valide a été capturé (`iab-import-preview-en.png`) ; le responsable confirme ensuite « Import complete » après réimport de la baseline. Ceci ne valide pas les permissions natives ou tous les formats de sauvegarde.

Observation historique sur une installation propre33 : la fiche exercice et le volet de mesures avec roue développée ne défilent pas au glissement, alors qu’une modification programmatique de `scrollTop` fonctionne. Les relevés d’événements du responsable ne montrent pas de `preventDefault` sur le geste ascendant ; lecture régulière des styles ou interaction Pause3D peut masquer le symptôme. La revue source confirme que le geste ascendant n’est pas pris par la fermeture, que la navigation de page est bloquée pendant le volet et que celui-ci est rendu hors du conteneur de route. La cause native reste ouverte ; aucun correctif de défilement ni succès tactile général n’est déclaré.


### Restauration finale IAB et dernières captures

Comparaison indépendante de `post-final-restoration.json` avec `QA-baseline33-iab.json` : seuls `exportedAt` et `state.meta.importedAt` diffèrent, comme attendu après export et réimport. Tout le reste de l’export est identique, y compris données métier, préférences, programme et photos. L’interface Sauvegarde (`iab-restoration-confirmed-en.png`) concorde : **0 séance, 1 mesure, 0 photo**. Reçu détaillé : `.local-release/build33/qa/iab-final-restoration-receipt.json`. Le profil fictif a retrouvé son état de référence ; cela ne concerne aucune donnée d’iPhone physique.

Captures récentes relues indépendamment en IAB393 EN sombre : éditeur Upper (`iab-program-editor-en.png`), repos `14 s` avec erreur et Enregistrer désactivé (`iab-edit-rest-invalid-en.png`), équipement avec salle par défaut et formulaire vide (`iab-gyms-empty-en.png`), bilan de séance fictive (`iab-session-summary-en.png`) et confirmation de correction (`iab-history-editor-en.png`). Ces images attestent leur présentation et leurs états visibles ; elles ne démontrent pas à elles seules le réordonnancement, le renommage d’une salle ou la sauvegarde d’une correction.

`iab-rest-chevron-en.png` confirme le chevron d’agrandissement ajouté au dock ; `iab-rest-full-en.png` montre le minuteur développé et ses actions compactes. Cette preuve web ne vaut pas validation Live Activity/Dynamic Island. Le contrôle source final des boutons d’action n’a révélé aucune autre omission concrète d’icône après ce chevron ; les jours, contrôles de valeur et vignettes de sélection restent exclus de cet ajout systématique. Les onglets visuels ont ensuite été traités séparément, ci-dessous.


### Revue du code local destiné au build 34 — onglets et focus

La revue finale porte sur les quatre groupes de navigation visuelle : Mouvement/Face/Dos, Force/Corps/Volume/Séances, Calendrier/Programme et les cinq aperçus de séance. `Segmented` accepte une icône facultative 16 px masquée aux technologies d’assistance ; noms, état sélectionné, largeur complète et hauteur minimale 44 px restent présents. Les groupes de quatre ou cinq options placent l’icône au-dessus du libellé sous 400 px de largeur du groupe, puis à côté. Les durées, langues et choix de valeur ne changent pas. Les modifications de charge gardent `kg/main` ou `kg/hand` avec la valeur ; le dock de repos indique son agrandissement par un chevron.

Les sept captures `iab-icons-*`, rangées dans `build33/qa` pour continuité du journal, proviennent **du code local destiné au build 34, pas du binaire 33**. Relecture indépendante : quatre groupes visibles sans débordement à 320 px EN sombre ; Progrès et modèle à 320 px FR clair ; Progrès à 1024 px FR clair avec icône et libellé sur la même ligne. Ces observations ciblent ces groupes et combinaisons, pas tous les écrans.

Pour le défilement natif, le retrait d’`overscroll-contain` n’a pas suffi au volet Mesures et n’est pas retenu. L’adaptation de focus garde le confinement du défilement, le verrouillage du fond et les gestes, mais place le focus initial sur le bouton Fermer (ou le contrôle `data-autofocus` explicite) plutôt que sur le conteneur. Le responsable confirme le défilement Mesures dans la variante isolée correspondante ; le mécanisme interne WebKit n’est pas démontré. Revue source et **31 tests ciblés réussis** (Sheet, fermeture tactile et Field), dont priorité autofocus, piège clavier du volet supérieur et restauration du focus ; typecheck réussi. Les binaires intégrés34–35 ont ensuite conservé un défaut de défilement de la fiche exercice ; le résultat Mesures de cette variante ne le résout pas et ne s’étend pas aux appareils physiques ou à VoiceOver.

La restauration IAB documentée reste une preuve au moment de l’export final ; après cette restauration, langue et thème ont été volontairement changés pour les captures d’onglets. Les données métier de référence restent celles de la baseline. Ces changements de préférences de QA ne doivent pas être présentés comme une dérive d’import.


Vérification intégrée finale du code local34 rapportée par le responsable : **447 tests au total, 446 réussis et 1 ignoré** (20,7 s ; journal `build34/tests-final.log`). Contrôle clavier réel dans l’IAB : focus initial sur Fermer → Maj+Tab vers le dernier lien → Tab vers Fermer → Escape → focus rendu au déclencheur, aucun volet restant. Ce parcours complète le test de composant ; il ne remplace pas la validation native physique. Ce contrôle clavier reste distinct de la livraison désormais confirmée de 35 et de sa validation physique encore ouverte ; voir l’état courant en tête du document.


### Observation native 34–35 et limites du diagnostic

Un deuxième glissement a réussi sur un cas 34 ; **ce résultat n’est pas reproductible comme contournement sur 35**. Dans le binaire original 35, ouvert directement par Séance → info → Tirage vertical, le premier geste défile ; après fermeture/réouverture, les deux gestes suivants restent sans effet. Il n’est donc pas nécessaire de remplacer `CalendarDaySheet` pour retrouver le symptôme. Reçu et captures : `.local-release/build35/qa/scroll-observations.json`. Les variantes diagnostiques34 n’ont pas été intégrées à35.

Le diagnostic passif post35 change l’interprétation : un glissement CUA produit **un seul `touchmove`, dy −286,7 px, `defaultPrevented=false`, scrollTop0**, puis le même échec se retrouve sur la page Séance ordinaire. Les trois succès sans WebGL n’identifient donc pas une cause ; ni Lift, ni WebKit, ni l’outil d’injection ne peuvent être désignés sur cette preuve. Les essais sans animation d’entrée ne changent pas le résultat. La suite doit utiliser un geste humain physique ou une injection continue multipoint vérifiée sur la page témoin et le volet, avant tout nouveau changement produit. Aucun correctif de défilement ni validation physique n’est établi.

Le responsable a restauré et lancé le **binaire simulateur original35** après ces essais. Capture : `.local-release/build35/qa/post35/original35-restored.jpg` ; déclaration de restauration et hash de capture ajoutés à `diagnostics-summary.json`. L’auteur de ce document n’a pas piloté le simulateur ni revérifié indépendamment le binaire installé. Aucun patch diagnostique n’est intégré.

34 est resté une archive locale non envoyée ; **35 est le build TestFlight distribué**, tandis que le web sert désormais `30a21e9`, selon les reçus cités en tête. Le pictogramme `ZoomIn` des photos est inclus dans35. Les dates, langues et choix de valeur restent textuels. Aucune validation physique 35, nouvelle preuve Live Activity/Dynamic Island ou nouvelle soumission App Review n’est revendiquée.

Les changements après 35 — seuil initial du geste pour ignorer les petits mouvements involontaires, accès à la saisie manuelle visible au focus, indicateur de focus de la comparaison photo, unité attachée à la cible et explication/erreur accessible en nutrition/IA — ont été publiés sur le web dans `30a21e9`. Les captures de leur QA ne doivent pas être présentées comme une modification du 35 TestFlight. Les changements ultérieurs pause, dock de repos et graphiques sont encore locaux.


## Complément de validation du code postérieur au build 35

Le profil fictif IAB a été contrôlé en anglais, clair/bleu à 1024 px puis 320 px : Apparence, Repos et alertes, cibles nutritionnelles, sources et assistance IA. Après correction, l’erreur IA est annoncée et associée au champ ; elle disparaît à la modification. Le comparateur photo conserve un contour visible au focus et répond à la flèche droite (50 → 51). Les deux photos de test sont des icônes publiques du dépôt. Le profil a ensuite été restauré par l’interface depuis `QA-baseline33-iab.json` : 0 séance, 1 mesure, 0 photo, préférences EN/sombre/orange. Cible de poids avec unité, À propos, Confidentialité et explication nutritionnelle inspectés à 320 px. Provenance, états avant/après et hashes dans `.local-release/build35/qa/continued/manifest.json` ; ces captures ne proviennent pas du binaire TestFlight35.

Suite complète de cette passe : **447 tests réussis, 1 ignoré**, typecheck et diff-check réussis, avant les changements locaux pause/repos/graphiques. Le seuil de 4 px évite qu’un tremblement initial capture un geste ascendant ; il n’établit pas la résolution de l’observation native. Le candidat simulateur post35 compile mais sa fiche exercice ignore encore deux gestes CUA dans le cas contrôlé (`qa/post35/base-open1-drag*.png`). Le diagnostic décrit ci-dessus ne permet pas de distinguer défaut produit et limite d’injection. Aucun succès physique ni nouvelle soumission Apple n’est déduit de cette passe.

### Complément IAB : reprise de pause, exercice actif et dock de repos

Ces contrôles sont rapportés directement par le responsable sur le code `30a21e9` avec changements locaux supplémentaires ; ils ne concernent ni le web public actuel ni le TestFlight35. Les captures sont dans `.local-release/build35/qa/coverage/`.

- **Pause, EN sombre320** : le volet de reprise affiche la conséquence ; Annuler conserve la pause et sa fin prévue, puis Confirmer démarre la séance (`pause-confirm-fixed-en-dark-320.jpg`). La preuve ferme ces deux branches de ce parcours, sans certifier toutes les entrées ni une restauration ultérieure de la pause.
- **Exercice actif hors ordre** : exercice3 choisi, terminé puis passage à4 ; l’annulation revient de manière stable (`session-out-of-order-first-set.jpg`, `session-out-of-order-next.jpg`, `session-out-of-order-undo.jpg`). Cette transition ne prouve pas à elle seule la fin anticipée ; le contrôle ultérieur de correction de séance est décrit ci-dessous.
- **Dock de repos FR/EN320/393** : titres et préfixe de série sont complets après le correctif local (`rest-dock-fixed-set-fr-320.jpg`, `rest-dock-fixed-set-fr-393.jpg`, `rest-dock-fixed-set-en-320.jpg`, `rest-dock-fixed-next-en-320.jpg`). Expiration naturelle avec état orange dans `rest-dock-fixed-expired-fr-320.jpg` et `rest-dock-fixed-expired-en-393.jpg`. Le minuteur développé FR393 est dans `rest-overlay-fr-393.jpg`. Ces preuves web ne valident pas Live Activity/Dynamic Island.

Seuls ces faits rapportés ferment les points correspondants de la liste bornée. La présence d’autres captures dans le répertoire n’est pas utilisée pour conclure à une action réussie sans récit d’observation. Le contrôle ultérieur de la graduation est décrit ci-dessous ; aucune livraison des corrections locales n’est déduite de ces observations.


### Derniers parcours IAB confirmés et restauration

Observations directes du responsable, EN393 sur le code web local `30a21e9` avec corrections pause/repos/graphiques ; fichiers dans `build35/qa/coverage/`. Le manifeste associe les captures réellement présentes, leurs hashes et les limites de chaque observation. Il ne prétend pas à un snapshot source individuel de chaque capture.

- **Correction de séance** : séance 1 garde son numéro,3 séries et 2 exercices. La deuxième série passe de 22,5kg×10 à×11 ; le 1RM est recalculé (`session-correction-en-393.jpg`). La graduation corrigée présente des valeurs distinctes (`progress-exercise-fixed-en-393.jpg`) ; l’ancienne capture `progress-exercise-populated-en-393.jpg` reste antérieure au correctif.
- **Calendrier** : vendredi déplacé en repos et dimanche en entraînement, enregistrés, puis Rétablir les jours habituels. Résultat : vendredi Lower, samedi Push, dimanche repos ; jeudi Upper terminé inchangé ; cible 5 (`calendar-usual-days-restored-en-393.jpg`). Après visite de la semaine suivante, Home → Cette semaine retourne au 5–11 octobre (`home-this-week-current-en-393.jpg`).
- **Éditeur** : déplacement clavier de Chest 1→2 puis reset→1 (`editor-order-reset-en-393.jpg`). Ajout Pecdeck, sauvegarde 32,5kg et note, remplacement Cablefly efface charge/note précédentes, retrait revient à 8 exercices. Ces actions sont rapportées par le responsable ; la capture du reset ne prouve pas seule toutes ces étapes.
- **Rappels/fréquence** : export 8 événements puis sélection vide désactivant l’action (`reminders-en-dark-320.jpg`,`reminders-empty-en-dark-320.jpg`) ; jours habituels5 → 4 → 5 (`usual-days-en-dark-320.jpg`,`usual-days-four-en-dark-320.jpg`). Aucun import système ou accord de permission n’est déduit.
- **Salles/volume** : ajout QA salle 2, renommage QA salle renommée, sélection réussie ; Volume 2 séries pectoraux/1 dos, aller au28 septembre puis retour au 5 octobre. Le graphique poulie avec une seule salle historique est inspecté sans filtre ; ce cas ne couvre pas plusieurs salles. Les noms exacts des captures présentes figurent au manifeste.
- **Restauration** : réimport de `QA-baseline33-iab.json` par l’interface Sauvegarde ; Import complete puis Continue,0 séance,1 mesure,0 photo confirmés par le responsable. Aucune comparaison d’export final supplémentaire n’est revendiquée pour cette passe.

Suite complète locale : **455 tests, 454 réussites, 1 ignoré,0 échec**, résultat vérifié dans `tests-post35.log`. Aucun build natif, TestFlight, appareil physique ou App Review supplémentaire n’est validé par ces résultats.
