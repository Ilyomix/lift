# Inventaire UI Lift — 8 octobre 2026

## Portée et niveau de preuve

Inventaire du code de travail pendant la préparation du build 33, complément de [ui-harmonization-plan.md](ui-harmonization-plan.md). Les routes viennent de `src/App.tsx`, les options des composants effectivement rendus. L’arborescence ci-dessous décrit l’interface disponible ; elle ne vaut pas validation visuelle. Les libellés peuvent encore évoluer pendant cette passe.

Lecture effectuée : App, écrans Home/Session/Calendar/ProgramScreen/Progress/More/Settings/Goal/Onboarding/Privacy, composants de réglage et volets, infrastructure Sheet/navigation et présentations natives. Aucun contrôle CUA ou appareil réalisé par l’auteur de cet inventaire. Les captures de travail du responsable sont dans `.local-release/build33/qa` ; les premières captures précèdent les dernières modifications et doivent être renouvelées.

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
| `useSessionStart` | Confirmation de démarrage un jour de repos | Annuler ne démarre rien ; accepter démarre la séance choisie |
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
| P2 | Une fermeture pilotée par `open=false` peut démonter un `Sheet` avant sa sortie vers le bas, contrairement aux fermetures déclenchées par le volet. | Corrigé : présence et contenu retenus pendant la sortie ; actions fermantes des parents conditionnels différées explicitement. `sheet-presence.test.ts` : 9 cas, dont StrictMode, réouverture, échec asynchrone, validation unique, absence de seconde sortie, Escape/focus/scroll du volet supérieur. Geste et rendu final sur appareil restent à vérifier. |
| P3 | Les actions de confirmation doivent avoir les mêmes icônes Annuler/Confirmer que les autres actions. | Les confirmations sont des `Sheet` spécifiques (aucun composant `ConfirmDialog`). Icônes raccordées par le responsable, icône de l’action du toast ajoutée ; contrôle visuel restant. |
| P2 | `Field` enveloppait un sélecteur composite dans `<label>` : toucher une valeur non labelable de la roue activait implicitement le premier bouton et refermait le sélecteur. | Reproduit en QA native par le responsable. Corrigé : label implicite réservé aux contrôles natifs directs ; composite avec son nom accessible hors label. `field-accessibility.test.ts` couvre les deux structures. La saisie tactile après correction reste à revalider. |

Ne pas interpréter les différences propres aux filtres de salles, notifications système ou vues natives comme des défauts de style sans vérifier leur fonction. Aucun autre bug métier n’a été déclaré sur la seule apparence du code.

## Matrice de validation visuelle à compléter

Toutes les cases ci-dessous restent **à valider sur la source finale**. Les tests de composants sont une preuve de comportement, pas d’alignement, contraste ou geste physique.

| Famille | FR/EN | Clair/sombre + orange/bleu | 320/393 px | Tablette/desktop | Vide/erreur/rempli | Clavier/focus/reduced motion | Natif/gestes |
|---|---|---|---|---|---|---|---|
| Onboarding, import, permissions | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Home, repos, semaine, tâches | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Séance aperçu/active/bilan/historique | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Exercice, 3D, technique, alternatives | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Calendrier semaine/mois/jour/programme | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Éditeur programme et salles | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Progrès : quatre onglets, mesures/photos | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Plus, réglages, objectifs et critères | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Nutrition/cibles, sauvegarde, IA, sources | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Tous sélecteurs de valeurs et volets | À faire | À faire | À faire | À faire | À faire | À faire | À faire |
| Repos web, Live Activity, Dynamic Island | À faire | À faire | Selon surface | Selon surface | À faire | À faire | Appareil requis |
| Notification Android et permissions | À faire | Système + accent | Appareil | Sans objet | À faire | À faire | Android requis |

Critères de chaque case : titres/sous-titres alignés, icônes adaptées, actions identifiables et accessibles, unité visible, absence de débordement/troncature dommageable, hauteur tactile cohérente, densité/espacement, information non répétée, état sélectionné et erreurs lisibles. Pour les volets : contenu suit le doigt, seuil d’abandon cohérent, animation jusqu’en bas puis démontage, retour du focus. Pour les pages : retour avec aperçu de la bonne entrée, pas de flash à l’arrivée, onglets sans animation de navigation inadaptée.

## Limites et prochaine preuve

Validation automatisée de cette passe : suite ciblée de 72 tests réussie avant le dernier correctif Field/StrictMode ; dernière passe 26 tests réussis (5 accessibilité, 12 sélecteur, 9 présence Sheet) et typecheck réussi. Cela ne remplace pas le contrôle natif tactile.

Cet inventaire couvre les routes et familles de contrôles présentes dans le code. Il ne certifie ni toutes les combinaisons de données historiques, ni les rendus des notifications/permissions du système, ni les moteurs 3D de chaque appareil. Les comptes rendus Apple/builds précédents ne valident pas le build 33. La preuve finale doit indiquer source/build, appareil ou navigateur, langue/thème, chemin, état et capture ; les défauts résolus doivent être revérifiés après les dernières modifications communes.

## Complément de QA native transmis par le responsable

Le 8 octobre, après correction du `Field`, le responsable a constaté dans l’interface native : toucher la valeur centrale laisse le sélecteur ouvert et permet la saisie manuelle ; l’unité kg reste fixe ; Valider transmet `81` au brouillon ; après défilement, Annuler conserve `81`. Cette observation valide ce parcours précis, pas toutes les unités ni tous les appareils. Un geste rapide automatisé a fait passer la roue de `81` à son plafond `250` : l’inertie système est active, mais la finesse du geste et la vitesse sur appareil physique ne sont pas certifiées.

Les captures Chrome supposées en thème clair sont invalidées pour juger la palette : Dark Reader injectait un fond sombre. Cette contamination extérieure ne constitue pas un défaut CSS de Lift. La palette claire doit être contrôlée dans la version native ou un navigateur sans cette injection. Les cases « clair » de la matrice ne sont donc pas marquées comme réussies.

Passe source supplémentaire sur les boutons d’action : les lignes de choix d’un exercice à ajouter portent désormais une icône Plus et un nom accessible « Ajouter [exercice] ». Les jours, onglets et choix purement textuels ne reçoivent pas d’icône artificielle. Les autres actions inspectées possèdent déjà une icône ou un chevron de destination. Le bouton Voir le programme du volet d’étape utilise aussi la fermeture animée commune avant de naviguer.
