# Inventaire UI Lift — 8 octobre 2026

## Portée et niveau de preuve

Inventaire du code de travail pendant la préparation du build 33, complément de [ui-harmonization-plan.md](ui-harmonization-plan.md). Les routes viennent de `src/App.tsx`, les options des composants effectivement rendus. L’arborescence ci-dessous décrit l’interface disponible ; elle ne vaut pas validation visuelle. Les libellés peuvent encore évoluer pendant cette passe.

Lecture effectuée : App, écrans Home/Session/Calendar/ProgramScreen/Progress/More/Settings/Goal/Onboarding/Privacy, composants de réglage et volets, infrastructure Sheet/navigation et présentations natives. Aucun contrôle CUA ou appareil réalisé par l’auteur de cet inventaire. Les observations visuelles ci-dessous sont celles du responsable de la QA ; les fichiers sont dans `.local-release/build33/qa`. La première passe web finale porte sur le code `5f5e31e26a7c03f5a922867f244877fc060a2162`. La QA native a d’abord utilisé Debug32, puis le simulateur Debug33 avec les assets de l’archive33. La reprise IAB utilise un profil isolé sur le code local, avec des corrections supplémentaires non livrées. Aucune de ces passes ne constitue une validation physique du build Release33 distribué.

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
| P2 | Une fermeture pilotée par `open=false` peut démonter un `Sheet` avant sa sortie vers le bas, contrairement aux fermetures déclenchées par le volet. | Corrigé : présence et contenu retenus pendant la sortie ; actions fermantes des parents conditionnels différées explicitement. `sheet-presence.test.ts` : 9 cas, dont StrictMode, réouverture, échec asynchrone, validation unique, absence de seconde sortie, Escape/focus/scroll du volet supérieur. QA native Debug ciblée : petit glissement de 30 px revient en place, grand glissement de 383 px ferme ; mesure enregistrée conservée. |
| P3 | Les actions de confirmation doivent avoir les mêmes icônes Annuler/Confirmer que les autres actions. | Les confirmations sont des `Sheet` spécifiques (aucun composant `ConfirmDialog`). Icônes raccordées par le responsable, icône de l’action du toast ajoutée ; contrôle visuel restant. |
| P2 | `Field` enveloppait un sélecteur composite dans `<label>` : toucher une valeur non labelable de la roue activait implicitement le premier bouton et refermait le sélecteur. | Reproduit en QA native par le responsable. Corrigé : label implicite réservé aux contrôles natifs directs ; composite avec son nom accessible hors label. `field-accessibility.test.ts` couvre les deux structures. QA native Debug après correction : toucher le centre permet la saisie manuelle de 81, unité kg fixe ; Valider transmet au brouillon. |
| P2 | L’unité `kg/main` revient à la ligne dans la page Séance native33. | Constat visuel du responsable (`native33-session-page-fr-dark.png`) ; correctif local par un autre agent. Nouvelle compilation/build requis ; rendu corrigé et livraison non confirmés ici. |
| P2 | Le glissement ne fait pas défiler `ExerciseSheet` dans le simulateur natif33, alors que le corps de la page Séance défile. | Défaut33 confirmé : `native33-exercise-scroll-stuck.png`. Les essais isolés conduisent au focus initial sur Fermer plutôt que sur le conteneur, en conservant `overscroll-contain` ; le volet Mesures défile avec cette variante, selon le responsable. Correctif local34 et test focus/trap intégrés ; compilation finale et gestes natifs à revalider. Mécanisme WebKit exact non établi. |

Ne pas interpréter les différences propres aux filtres de salles, notifications système ou vues natives comme des défauts de style sans vérifier leur fonction. Aucun autre bug métier n’a été déclaré sur la seule apparence du code.

## Matrice de validation visuelle à compléter

La couverture est **partielle**. Une mention de langue, largeur ou thème ne valide que cette combinaison et les écrans cités dans les preuves ci-dessous ; elle ne vaut pas validation de toute la famille. Les tests de composants sont une preuve de comportement, pas d’alignement, contraste ou geste physique. Les cellules « À faire » restent ouvertes.

| Famille | FR/EN | Clair/sombre + orange/bleu | 320/393 px | Tablette/desktop | Vide/erreur/rempli | Clavier/focus/reduced motion | Natif/gestes |
|---|---|---|---|---|---|---|---|
| Onboarding, import, permissions | Onboarding EN ciblé | IAB sombre ciblé | 393 EN sombre | À faire | Cinq étapes, maintien, import valide/invalide IAB ; permissions à faire | À faire | Permissions natives et physique à faire |
| Home, repos, semaine, tâches | EN ciblé | Clair web ; sombre natif ciblés | 320 EN clair | Home iPad natif EN sombre | États supplémentaires à faire | À faire | Home Debug inspecté ; autres gestes à faire |
| Séance aperçu/active/bilan/historique | FR/EN ciblés | Clair web/sombre natif ciblés | 320 EN clair ; aperçu natif FR | À faire | Charge -5 refusée ; bilan fictif et confirmation de correction IAB visibles ; autres états à faire | À faire | Page native33 : salle alignée ; unité kg/main à revalider |
| Exercice, 3D, technique, alternatives | FR natif / EN IAB ciblés | Sombre ciblé | IAB393 ; fiche native33 | À faire | Vidéo invalide et alternatives IAB ; autres états à faire | À faire | 3D/Technique visibles ; défilement natif bloqué ; rotation physique à faire |
| Calendrier semaine/mois/jour/programme | FR/EN ciblés | Clair/sombre ciblés ; bleu à faire | 320 EN clair ; 393 FR sombre | 1024 px sans débordement ; iPad33 clair ciblé | Jour Pull prévu inspecté ; autres états à faire | À faire | Volet jour natif33 ciblé ; autres gestes à faire |
| Éditeur programme et salles | EN ciblé | IAB sombre ciblé | 393 EN sombre | À faire | Éditeur, repos14s invalide, salle par défaut visibles | À faire | Natif à faire |
| Progrès : quatre onglets, mesures/photos | EN ciblé | Clair ciblé | Quatre onglets 320 EN clair | 1024 px : onglets sans débordement | Mesure -12 refusée ; IAB champs vides, deux photos fictives/comparaison/annulation ; autres états à faire | À faire | Sélecteur de poids Debug ciblé |
| Plus, réglages, objectifs et critères | FR/EN ciblés | Clair/sombre ciblés ; bleu à faire | 320 EN clair ; Plus/cibles 393 FR sombre | À faire | Estimation/personnalisé ciblés ; autres états à faire | À faire | À faire |
| Nutrition/cibles, sauvegarde, IA, sources | Nutrition/sauvegarde EN ciblés ; IA/sources à faire | Nutrition claire ciblée | Nutrition/cibles 320 EN clair | À faire | 1444 kcal conservées après rechargement ; import {} rejeté sans changement métier | À faire | À faire |
| Tous sélecteurs de valeurs et volets | Poids et cm natifs ciblés | Combinaisons restantes à faire | Sélecteur natif ciblé | À faire | Poids ciblé ; cm saisi/validé dans le brouillon puis abandonné | Saisie manuelle ciblée ; reste à faire | Debug : petit/grand swipe ; autres volets à faire |
| Repos web, Live Activity, Dynamic Island | Repos web EN ciblé | IAB sombre/orange ciblé | 393 EN sombre | Selon surface | Dock et minuteur développés visibles ; expiration native à faire | À faire | Appareil requis pour Live Activity/Island |
| Notification Android et permissions | À faire | Système + accent | Appareil | Sans objet | À faire | À faire | Android requis |

Critères de chaque case : titres/sous-titres alignés, icônes adaptées, actions identifiables et accessibles, unité visible, absence de débordement/troncature dommageable, hauteur tactile cohérente, densité/espacement, information non répétée, état sélectionné et erreurs lisibles. Pour les volets : contenu suit le doigt, seuil d’abandon cohérent, animation jusqu’en bas puis démontage, retour du focus. Pour les pages : retour avec aperçu de la bonne entrée, pas de flash à l’arrivée, onglets sans animation de navigation inadaptée.

## Limites et prochaine preuve

Validation automatisée de cette passe : suite ciblée de 72 tests réussie avant le dernier correctif Field/StrictMode ; puis 26 tests réussis (5 accessibilité, 12 sélecteur, 9 présence Sheet) et typecheck réussi. La dernière suite intégrée, exécutée par le responsable sur la source finale, compte **445 tests réussis et 1 ignoré**. Cela ne remplace pas le contrôle natif tactile.

Cet inventaire couvre les routes et familles de contrôles présentes dans le code. Il ne certifie ni toutes les combinaisons de données historiques, ni les rendus des notifications/permissions du système, ni les moteurs 3D de chaque appareil. Les comptes rendus Apple/builds précédents ne valident pas le build 33. La preuve finale doit indiquer source/build, appareil ou navigateur, langue/thème, chemin, état et capture ; les défauts résolus doivent être revérifiés après les dernières modifications communes.

## Preuves finales transmises par le responsable

Le 8 octobre, après correction du `Field`, le responsable a constaté dans l’interface native Debug : toucher la valeur centrale laisse le sélecteur ouvert et permet la saisie manuelle ; l’unité kg reste fixe ; Valider transmet `81` au brouillon ; après défilement, Annuler conserve ce brouillon `81`. Un petit glissement du volet de 30 px revient en place ; un glissement de 383 px le ferme. Après abandon du brouillon, la mesure enregistrée reste `80,1` et `81` n’est pas sauvegardé. Ces observations valident ces parcours précis, pas toutes les unités ni tous les appareils. Un geste rapide automatisé a fait passer la roue de `81` à son plafond `250` : l’inertie système est active, mais la finesse du geste et la vitesse sur appareil physique ne sont pas certifiées.

Les premières captures Chrome, y compris la première passe 393 px FR sombre sur douze familles, sont conservées pour le cadrage seulement : Dark Reader injectait ses styles. Elles sont invalidées pour juger la palette ; cette contamination ne constitue pas un défaut CSS de Lift. Dark Reader a ensuite été désactivé **uniquement pour `127.0.0.1:5185`**. L’absence de styles Dark Reader a été contrôlée (`0`) avant les nouvelles captures préfixées `clean-` ; les surfaces CSS Lift étaient correctes.

La planche `clean-light-contact.jpg`, inspectée par le responsable, présente la passe 320 px EN clair : accueil, séance, calendrier/programme, quatre onglets Progrès, Plus, réglages, objectifs/critères et nutrition. Les captures `clean-plus-393-fr-dark.jpg`, `clean-calendrier-393-fr-dark.jpg`, `clean-targets-393-fr-dark.jpg` et `clean-targets-custom-393-fr-dark.jpg` documentent les contrôles propres en 393 px FR sombre. Elles ne valident pas toutes les permutations FR/EN, clair/sombre et orange/bleu.

À 1024 px, Calendrier et Progrès ont été contrôlés sans débordement : barre d’onglets de 608 px dans une zone de contenu de 640 px (`clean-calendar-desktop-fr-dark.jpg`, `clean-progress-desktop-fr-dark.jpg`). L’accueil iPad natif EN sombre a été inspecté et enregistré dans `native-ipad-home.jpg` ; les autres pages iPad restent à parcourir.

Contrôles fonctionnels web ciblés : une mesure corporelle `-12` empêche Enregistrer ; une saisie nutritionnelle de `1444` kcal reste présente après rechargement direct ; une charge `-5` empêche la validation d’une série, puis `22,5` kg et `8` répétitions rendent le bouton actif sans enregistrer la série. Ces cas ne constituent pas un audit exhaustif de tous les champs.

Passe source supplémentaire sur les boutons d’action : les lignes de choix d’un exercice à ajouter portent désormais une icône Plus et un nom accessible « Ajouter [exercice] ». Les jours et choix de valeur restent textuels ; les onglets de navigation visuelle ont été repris dans la passe décrite plus bas. Les autres actions inspectées possèdent déjà une icône ou un chevron de destination. Le bouton Voir le programme du volet d’étape utilise aussi la fermeture animée commune avant de naviguer.

## Reprise de couverture du 8 octobre — observations du responsable

Sur simulateur natif33, `native33-session-preview-fr-dark.png` montre le volet d’un jour avec Pull prévu ; `native33-exercise-fr-dark.png` et `native33-exercise-technique-fr-dark.png` couvrent la fiche, la démonstration 3D et Technique. `native33-session-page-fr-dark.png` montre la salle alignée avec le titre, mais a révélé le retour à la ligne de `kg/main`. Le correctif est local : il impose un nouveau build (34 prévu, pas encore numéroté ni livré). Le défilement par glissement de la fiche exercice reste bloqué dans ce simulateur ; le corps de Séance défile. La cause reste à déterminer.

Dans l’IAB, profil fictif isolé en 393 px EN sombre : les cinq étapes d’onboarding ont été parcourues (`iab-onboarding-*.png`). Âge 32 ans, taille 178 cm, poids 80,1 kg et tour de taille 88 cm acceptés ; le mode sans date masque la date et conserve les options physiques. Terminer ouvre Séance sans entraînement actif. Ce contrôle web ne valide pas la demande d’autorisation native. La fiche exercice défile dans l’IAB, une vidéo invalide affiche et conserve son erreur, et les alternatives montrent l’icône Remplacer (`iab-video-invalid-en.png`, `iab-alternatives-en.png`).

Journal détaillé : `.local-release/build33/qa/evidence-log.json`. Les 445 tests cités plus haut concernent le code figé33, pas une certification automatique des nouveaux correctifs locaux. Aucune validation physique33, Android ou couverture exhaustive n’est ajoutée par cette reprise.


### Complément ciblé — mesures, photos et sauvegarde

Les captures supplémentaires ont été relues indépendamment : `native33-cm-inline-input-confirmed.png` montre `90 cm` dans le brouillon Ajouter des mesures ; le responsable a ouvert la roue à `85`, saisi `90`, validé la roue puis fermé le volet sans Enregistrer. Cela ne constitue pas une nouvelle mesure sauvegardée ni une validation du défilement du volet.

Sur le profil IAB fictif 393 px EN sombre, `iab-body-measurement-empty-en.png` montre les champs vides avec unités fixes et Enregistrer désactivé. `iab-nutrition-en.png` montre les unités g/kcal et les actions compactes. Deux icônes PWA locales servent de photos fictives : comparaison visible dans `iab-photos-compare-slider-en.png` ; le responsable a déplacé le séparateur de 50 à 51, puis ouvert et annulé la suppression (`iab-photo-delete-confirm-en.png`). La capture prouve l’état visuel ; le déplacement et l’annulation sont les observations du responsable. La restauration finale est désormais confirmée : 0 séance, 1 mesure et 0 photo, dans l’interface et l’export final ; les deux photos QA ont été retirées par réimport de la baseline.

L’import de `{}` est rejeté avec une erreur explicite (`iab-import-invalid-en.png`). La comparaison indépendante des exports avant/après confirme exactement les deux seules différences du reçu `iab-import-preservation.json` : `exportedAt` et `state.meta.lastBackupAt`, produits par l’export lui-même. Aucune donnée métier ne diffère. L’aperçu de la sauvegarde valide a été capturé (`iab-import-preview-en.png`) ; le responsable confirme ensuite « Import complete » après réimport de la baseline. Ceci ne valide pas les permissions natives ou tous les formats de sauvegarde.

Investigation native en cours : sur une installation propre33, la fiche exercice et le volet de mesures avec roue développée ne défilent pas au glissement, alors qu’une modification programmatique de `scrollTop` fonctionne. Les relevés d’événements du responsable ne montrent pas de `preventDefault` sur le geste ascendant ; lecture régulière des styles ou interaction Pause3D peut masquer le symptôme. La revue source confirme que le geste ascendant n’est pas pris par la fermeture, que la navigation de page est bloquée pendant le volet et que celui-ci est rendu hors du conteneur de route. La cause native reste ouverte ; aucun correctif de défilement ni succès tactile général n’est déclaré.


### Restauration finale IAB et dernières captures

Comparaison indépendante de `post-final-restoration.json` avec `QA-baseline33-iab.json` : seuls `exportedAt` et `state.meta.importedAt` diffèrent, comme attendu après export et réimport. Tout le reste de l’export est identique, y compris données métier, préférences, programme et photos. L’interface Sauvegarde (`iab-restoration-confirmed-en.png`) concorde : **0 séance, 1 mesure, 0 photo**. Reçu détaillé : `.local-release/build33/qa/iab-final-restoration-receipt.json`. Le profil fictif a retrouvé son état de référence ; cela ne concerne aucune donnée d’iPhone physique.

Captures récentes relues indépendamment en IAB393 EN sombre : éditeur Upper (`iab-program-editor-en.png`), repos `14 s` avec erreur et Enregistrer désactivé (`iab-edit-rest-invalid-en.png`), équipement avec salle par défaut et formulaire vide (`iab-gyms-empty-en.png`), bilan de séance fictive (`iab-session-summary-en.png`) et confirmation de correction (`iab-history-editor-en.png`). Ces images attestent leur présentation et leurs états visibles ; elles ne démontrent pas à elles seules le réordonnancement, le renommage d’une salle ou la sauvegarde d’une correction.

`iab-rest-chevron-en.png` confirme le chevron d’agrandissement ajouté au dock ; `iab-rest-full-en.png` montre le minuteur développé et ses actions compactes. Cette preuve web ne vaut pas validation Live Activity/Dynamic Island. Le contrôle source final des boutons d’action n’a révélé aucune autre omission concrète d’icône après ce chevron ; les jours, contrôles de valeur et vignettes de sélection restent exclus de cet ajout systématique. Les onglets visuels ont ensuite été traités séparément, ci-dessous.


### Revue du code local destiné au build 34 — onglets et focus

La revue finale porte sur les quatre groupes de navigation visuelle : Mouvement/Face/Dos, Force/Corps/Volume/Séances, Calendrier/Programme et les cinq aperçus de séance. `Segmented` accepte une icône facultative 16 px masquée aux technologies d’assistance ; noms, état sélectionné, largeur complète et hauteur minimale 44 px restent présents. Les groupes de quatre ou cinq options placent l’icône au-dessus du libellé sous 400 px de largeur du groupe, puis à côté. Les durées, langues et choix de valeur ne changent pas. Les modifications de charge gardent `kg/main` ou `kg/hand` avec la valeur ; le dock de repos indique son agrandissement par un chevron.

Les sept captures `iab-icons-*`, rangées dans `build33/qa` pour continuité du journal, proviennent **du code local destiné au build34, pas du binaire33**. Relecture indépendante : quatre groupes visibles sans débordement à 320 px EN sombre ; Progrès et modèle à 320 px FR clair ; Progrès à 1024 px FR clair avec icône et libellé sur la même ligne. Ces observations ciblent ces groupes et combinaisons, pas tous les écrans.

Pour le défilement natif, le retrait d’`overscroll-contain` n’a pas suffi au volet Mesures et n’est pas retenu. L’adaptation de focus garde le confinement du défilement, le verrouillage du fond et les gestes, mais place le focus initial sur le bouton Fermer (ou le contrôle `data-autofocus` explicite) plutôt que sur le conteneur. Le responsable confirme le défilement Mesures dans la variante isolée correspondante ; le mécanisme interne WebKit n’est pas démontré. Revue source et **31 tests ciblés réussis** (Sheet, fermeture tactile et Field), dont priorité autofocus, piège clavier du volet supérieur et restauration du focus ; typecheck réussi. La compilation native intégrée doit encore confirmer ces gestes, sans extrapoler aux appareils physiques ou à VoiceOver.

La restauration IAB documentée reste une preuve au moment de l’export final ; après cette restauration, langue et thème ont été volontairement changés pour les captures d’onglets. Les données métier de référence restent celles de la baseline. Ces changements de préférences de QA ne doivent pas être présentés comme une dérive d’import.


Vérification intégrée finale du code local34 rapportée par le responsable : **447 tests au total, 446 réussis et 1 ignoré** (20,7 s ; journal `build34/tests-final.log`). Contrôle clavier réel dans l’IAB : focus initial sur Fermer → Maj+Tab vers le dernier lien → Tab vers Fermer → Escape → focus rendu au déclencheur, aucun volet restant. Ce parcours complète le test de composant ; il ne remplace pas la validation native physique. À 21 h 06 Paris, App Store Connect demandait toujours une connexion et l’iPhone était verrouillé ; aucun traitement/distribution/soumission supplémentaire n’est affirmé.


### Résultat natif intégré 34 et dernier contrôle des actions

Le binaire intégré 34 reproduit le blocage intermittent du premier glissement de la fiche exercice ; le deuxième glissement défile. Les variantes isolées ne démontrent pas de correction stable, y compris à la troisième ouverture. Le focus Fermer reste utile au clavier, mais ne doit pas être présenté comme la cause résolue. Aucun essai de diagnostic n’est conservé dans le code ni dans le simulateur restauré. Voir `.local-release/build34/DELIVERY-STATUS.md` et `scroll-diagnostic/observations.json`. Build 34 non envoyé à Apple ; web `4245a32` publié et contrôlé.

La revue stricte des actions a relevé une dernière vignette interactive : l’aperçu photo dans Progrès reçoit `ZoomIn`, sans changer le nom accessible, la cible tactile ou le comportement. Les sélections de date, langue et valeur restent textuelles. Aucune couverture physique exhaustive ou nouvelle soumission Apple n’est revendiquée.
