# Audit des pages Lift — hors Plus et Réglages

Date : 4 octobre 2026. Base : `79d002d`, avec les changements de navigation/réglages présents dans l’arbre de travail. Audit du code React, des routes, des actions et des composants partagés ; aucune donnée utilisateur modifiée.

`More.tsx`, le nouveau `Settings.tsx` et `SettingsMenu.tsx` sont audités séparément. Leurs routes sont recensées pour compléter l’arborescence, sans conclusions sur leur contenu. La politique de confidentialité, les rappels, la pause, les sources et l’objectif visuel restent dans le présent périmètre même si leurs routes commencent par `plus`.

Les constats ci-dessous décrivent l’état observé **avant les corrections issues de cet audit**. Les numéros de ligne peuvent donc se déplacer. Aucun contraste, débordement réel à 320 px ou comportement VoiceOver n’est déclaré vérifié par ce seul audit source.

## 1. Arborescence actuelle

Les cinq destinations principales sont Aujourd’hui, Séance, Calendrier, Progrès et Plus (`TabBar.tsx`). Les écrans détaillés conservent cette barre ; les feuilles passent au-dessus.

| Route | Vue / contenu | Navigation et actions principales |
| --- | --- | --- |
| `#/` | Aujourd’hui | Compteur séances réalisées/total, frise, prochaine séance, repères corporels/assiduité/force, nutrition du jour, rappels contextuels. |
| `#/seance` | Avant séance ou séance active | Choisir une séance, voir/remplacer les exercices, démarrer ; puis journaliser, gérer le repos et terminer. |
| `#/seance/bilan` | Bilan de la dernière séance terminée | Records, effort, charges proposées/appliquées, récupération, exercices, retour accueil. |
| `#/seance/:id` | Séance enregistrée | Lecture, fiche mouvement, appliquer/annuler un ajustement encore pertinent, corriger la dernière séance, supprimer avec confirmation. |
| `#/calendrier` | Calendrier — onglet Calendrier | Mois, jours, séances prévues/réalisées, prochaines échéances, pause, export de rappels. |
| `#/calendrier/programme` | Calendrier — onglet Programme | Frise des phases, bloc courant, blocs futurs/passés repliés, semaine type, cinq séances, volumes, règles d’ajustement. |
| `#/calendrier/programme/:type` | Fiche Upper / Lower / Push / Pull / Legs | Réordonner, ajouter, modifier, remplacer ou retirer les exercices du programme. |
| `#/progres`, `#/progres/force` | Progrès — Force | Exercices actuels/anciens avec historique et évolution ; ouvrir un exercice. |
| `#/progres/exercice/:id` | Progression d’un exercice | Salle si nécessaire, courbes, séries propres, séances liées, démo et sources, fiche complète. |
| `#/progres/corps` | Progrès — Corps | Poids, tendance, cible, courbes poids/taille, mesures, photos, comparaison. |
| `#/progres/corps/mesure` | Corps + feuille Nouvelle mesure ouverte | Saisie corporelle ; fermeture vers `progres/corps` avec remplacement de route. |
| `#/progres/volume` | Progrès — Volume | Semaine précédente/suivante, séries par muscle, séances par semaine, effort récent. |
| `#/progres/seances` | Progrès — Séances | Historique groupé par mois ; ouvrir une séance. |
| `#/plus/preuves` | Sources scientifiques | Fréquence, principes, limites, bibliographie et liens originaux. Le segment historique `preuves` n’est pas un intitulé visible à renommer impérativement. |
| `#/plus/pause` | Pause du programme | Motif, fin prévue, note, aperçu de reprise ; démarrer ou terminer une pause. |
| `#/plus/rappels` | Rappels calendrier | Sélection des événements, horaires, fichier ICS, aide d’import. |
| `#/plus/objectif` | Objectif visuel | Look, zones prioritaires, données nécessaires à l’estimation, plan, photo de référence, explications. |
| `#/plus/confidentialite` | Politique de confidentialité | Document local intégré, langue et thème de l’app. |
| `#/plus` | Menu Plus — audit séparé | Entrées secondaires. |
| `#/plus/nutrition`, `#/plus/coach`, `#/plus/donnees`, `#/plus/a-propos` | Pages de More — audit séparé | Nutrition, assistant, sauvegardes, présentation. |
| `#/plus/reglages[/section]` | Réglages — audit séparé | Nouvelle page de réglages par section. `nutrition` utilise NutritionTargetsScreen. |
| `#/plus/programme[/type]` | Ancienne adresse | Redirection `replace` vers `calendrier/programme[/type]`, type validé contre WORKOUT_TYPES. |

Comportements transversaux vérifiés dans `App.tsx`, `router.ts` et `swipeNavigation.ts` :

- Sans profil, toutes les routes présentent l’onboarding. Le chargement initial montre le logo et `aria-busy`.
- Changer de route remet le document en haut. Calendrier et Programme partagent la même clé de composant, donc le mois choisi survit au passage d’un onglet à l’autre.
- Les sous-onglets Calendrier et Progrès utilisent `replace`, afin de ne pas empiler leur sélection dans l’historique.
- Le retour d’un Header suit d’abord l’historique Lift ; `backTo` est une destination de secours. Une arrivée directe dans une feuille routée doit donc avoir un secours cohérent.
- Les gestes horizontaux des cinq destinations principales ne s’appliquent pas aux fiches profondes ; celles-ci utilisent le retour de bord. Les zones interactives excluent le geste global.
- La langue remonte toute l’interface. RestDock, effets de séance, toast et résultat d’import sont globaux ; invitation à mettre à jour seulement dans la PWA.

## 2. Inventaire des sections et options

### Aujourd’hui — `Home.tsx`

- Logo/date ; nombre terminé/total sur une ligne avec libellé, pourcentage et frise SessionTrack.
- Objectif daté ou entretien : ouvre GoalSheet ; lien Programme canonique.
- Pause active : durée/contexte et gérer la pause. Conseil de reprise conditionnel.
- Prochaine séance : type, muscles, séries, durée estimée, date ; salle/maison avant départ ; démarrer, reprendre ou consulter les détails.
- Semaine : état des jours. Repères : poids, tour de taille, régularité et force, chacun vers le bon onglet Progrès.
- Nutrition du jour : protéines, calories, créatine, objectifs et barres ; saisir la journée. Fond désormais aligné sur les cartes neutres.
- Rappels conditionnels : annuler une décharge avancée, charge à trouver, calories à ajuster, objectif à actualiser, mesure/photo manquante ou ancienne, sauvegarde, installation PWA.

### Séance avant départ — `Session.tsx:42`

- Contexte de la prochaine séance, durée/séries/exercices et salle choisie.
- Sélecteur des cinq types de séance ; avertissement explicite si l’on choisit une autre étape de rotation.
- Bloc, effort attendu, reprise et adaptation du volume si moins de cinq jours.
- Liste numérotée d’exercices avec séries × reps, réserve, charge et superset ; chaque ligne ouvre la fiche complète avec son occurrence précise.
- Remplacement possible pour cette séance ou durablement au programme. Les brouillons restent distincts des fiches.
- Bouton démarrer fixé près du bas ; GymSheet pour lieu/salle.

### Séance en cours — `Session.tsx:154`

- Header, salle, options ; bandeau collant de la série/exercice courant, durée, progression réalisée/total ; toucher revient à l’exercice courant.
- Explication unique des répétitions en réserve ; consignes spécifiques à chaque exercice.
- Exercices : prescription, performance précédente dans les bonnes conditions, charge/comparaison, séries compactes, démo/technique, menu.
- Série : charge ou lest, répétitions, réserve `— / 0 / 1 / 2 / 3 / 4+`, valider/annuler. Charge/reps restent visuellement des champs après validation ; réserve encore modifiable.
- Détails de série : échec, technique, douleur, répétitions propres −/+, note.
- Ajouter une série (confirmation si hors prescription), retirer la dernière non validée ; conseil de charge avec annulation ; charge validée ; indication de superset.
- Menu exercice : alternatives et portée, conditions de comparaison, note, passer l’exercice ; restaurer un exercice passé.
- Notes de séance ; terminer ; confirmation quand des séries restent non validées.
- Options de séance : date et abandon/correction annulée. La date est plafonnée à aujourd’hui.

### Repos — `RestTimer.tsx`

- Dock global : temps, prochaine série/exercice, progression, agrandir, +15 s pendant le compte à rebours, passer/fermer.
- Plein écran : cadran et dixièmes, exercice/série à suivre, réduction, une ligne de réglage `− / [15 s | 1 min | 5 min] / +`, passer le repos ou Go.
- Choisir le pas ne change pas le temps. Retirer est désactivé à zéro ; ajouter relance le repos. Les chiffres expirés pulsent doucement, sans animation sous mouvement réduit.
- Les effets son/notification/écran actif suivent les préférences et évitent le doublon sonore natif.

### Bilan et historique d’une séance — `Session.tsx:631,834`

- Bilan : durée/séries/tonnage, effort, records, ajustements proposés ou appliqués (un par un / tout appliquer / annuler), effort hors cible, récupération/décharge anticipée ou annulation, points à surveiller, exercices, accueil.
- Séance enregistrée : notes, exercices/performances, ajustements encore applicables, correction uniquement pour la dernière terminée et sans autre séance active, suppression confirmée avec effets expliqués.
- Correction réouvre les séries et recalcule à la fin ; aucune fusion avec une autre séance active.

### Calendrier — `Calendar.tsx:20`

- Deux onglets Calendrier/Programme dans le même écran.
- Repère du plan, mois courant ; précédent/suivant/aujourd’hui, jours actionnables et légende (réalisé, prévu, pause, aujourd’hui).
- Prochaines étapes limitées aux échéances utiles, chacune ouvre le jour ; lien vers la progression du programme.
- Actions rappels calendrier et pause.
- DaySheet : date, bloc/phase/effort ; séances réalisées vers le détail, sinon séance prévue et sa prescription. Démarrer uniquement aujourd’hui et sans séance active. Jour vide : état de récupération ou absence d’historique, retour au calendrier.

### Programme et fiches — `ProgramScreen.tsx:22,207`

- Résumé de la cadence et du volume ; PhaseTrack et frise de blocs, bloc courant/semaine/effort, quatre étapes futures, autres étapes en disclosure, blocs passés repliés ; fin du plan et entretien traités explicitement.
- Semaine type : sept sélecteurs repos/type, enregistrement immédiat, explication de la rotation.
- Cinq fiches de séance : exercices, séries réellement prescrites, durée, ouverture de l’éditeur.
- Volume prévu par muscle et semaine, comptage fractionnaire et zone cible.
- Huit règles opérationnelles : double progression, effort, volume, charges automatiques, alerte, exercice partagé, décharge, corrections ; lien discret vers Sources scientifiques.
- Éditeur : glisser-déposer par poignée (tactile/souris/clavier), ajout d’exercice, liste vide explicite.
- Ajout : bibliothèque filtrée par matériel et exercices déjà présents ; sélection ajoute puis ferme.
- Modification : alternatives, charge ou lest, séries, réserve visée, reps min/max, secondes de repos, réglage machine/note ; informations priorité et programme ; enregistrer ou retirer.

### Sources scientifiques — `ProgramScreen.tsx:142`

- Réponse à « 5 séances par semaine, est-ce optimal ? », justification et références.
- Chaque principe : titre, règle, niveau scientifique ; détail et références repliables.
- Limites générales ; bibliographie intégrale triée par auteur, nombre d’articles/recommandations, revue/année/type, lien original.
- Aucun réglage d’entraînement ; les niveaux « preuve forte » restent des évaluations scientifiques légitimes.

### Progrès — `Progress.tsx`

- Force : exercices actuels puis anciens, dernière performance, sparkline, variation ; aucun historique → CTA séance.
- Détail exercice : sélection de salle pour les machines, meilleur résultat estimé/poids du corps, progression et reps propres, historique vers les séances, démo/sources puis fiche complète.
- Corps : dernière pesée ou moyenne sept jours, tendance, cible ; trajectoire du plan et courbe de taille ; mesure ; liste des trente dernières mesures ; photos.
- Nouvelle mesure : date, poids, taille, bras, poitrine, épaules. Au moins une valeur numérique pour activer Enregistrer. Une saisie à la même date fusionne avec l’entrée existante.
- Photos : importer plusieurs images, ouvrir/supprimer, comparer deux photos ou photo et objectif. Comparaison : choix avant/après, curseur de séparation.
- Volume : semaine précédente/suivante (sans futur), séries réelles vs plan, retour à la dernière semaine active, douze semaines d’assiduité, réserve moyenne des huit dernières séances.
- Séances : groupes mensuels, type/date/séries/durée/records/comparaison ; détail complet.

### Objectif — `GoalSheet.tsx`, `Goal.tsx`

- GoalSheet : mode daté ou entretien, date objectif, décalages −1 mois/−2 semaines/+2 semaines/+1 mois/+3 mois, aperçu des phases/nombre de séances/poids estimé, enregistrer. En entretien : fonctionnement et prochaine décharge/calories.
- Objectif visuel : état appliqué ou entretien ; look et plage indicative ; maximum trois zones prioritaires, exercices affectés/date de début ; taille/sexe/taux de gras mesuré ; estimation et besoin de mesure récente ; poids/coupe/date/rythmes ; appliquer, date suggérée ou garder la date, retirer objectif ; photo de référence ajouter/changer/retirer ; bases scientifiques.
- Les images sont locales. Le bouton de mesure ouvre la feuille routée Corps. Les estimations et leurs limites restent visibles à proximité des choix.

### Lieu et matériel — `GymSheet.tsx`, `Setup.tsx`

- GymSheet : salle courante, sélectionner une salle, créer un nom ; historique machine distinct selon salle ; avant séance, basculer salle/maison.
- SetupSheet : salle ou maison ; à la maison haltères/banc/barre de traction/élastiques, poids du corps implicite ; aperçu Upper replié ; enregistrer reconstruit les fiches en conservant les charges connues et l’archive salle.
- Pendant une séance, GymSheet change la salle de cette séance sans reconstruire le programme.

### Pause, rappels, confidentialité

- Pause (`Calendar.tsx:221`) : vacances/maladie/blessure/fatigue/autre ; dernier jour optionnel et raccourcis 3/7/14/21 jours ; note ; démarrer. Active : début/fin/note et aperçu de reprise ; reprendre. Règles de reprise et nuance scientifique.
- Rappels (`Calendar.tsx:310`) : séances, pesée, tour de taille, photos, décharges, phases/objectif ; heures séances/pesée persistées ; export ICS avec nombre d’événements ; instructions spécifiques iOS et information distincte pour notifications de repos ; dates de décharge.
- Confidentialité (`Privacy.tsx`) : iframe locale intitulée, langue FR/EN dans l’ancre, tokens et font de l’app injectés ; lecture sans fermer le contexte app.

### Onboarding — `Onboarding.tsx`

- Accueil : Français/English, identité, deux bénéfices, démarrer ou importer une sauvegarde, erreur d’import.
- 1 Lieu : SetupPicker ; salle/maison et matériel.
- 2 Jours : jours de semaine, minimum deux pour continuer, cadence/durée et explication repliée des adaptations.
- 3 Point de départ : sexe, âge 14–90, taille 120–230, poids 35–250, tour de taille optionnel 50–200 ; erreurs contextualisées et Continuer désactivé si invalide.
- 4 Objectif : date ou entretien ; date et raccourcis 3/6/9/12 mois ; look ; zones facultatives et estimations repliées ; avertissement/date suggérée si délai trop court.
- 5 Première séance : date/lieu, trois exercices puis les autres repliés, jours/objectif, consigne de charge initiale ; nutrition/objectif en disclosure ; terminer crée le profil et ouvre la séance avant démarrage.
- Retour à chaque étape, progression textuelle/visuelle, titre focalisé et retour en haut au changement. Import propose une prévisualisation/confirmation avant remplacement.

### Fiche exercice et composants transversaux

- ExerciseSheet : titre, muscle/type, labels séries × reps/réserve/repos en haut, démo, technique en priorité, vidéo YouTube principale, groupe homogène Ajouter/modifier vidéo + Alternatives, raison scientifique et références, trois dernières performances.
- Vidéo : lien YouTube validé, enregistrer/retirer ; lecture intégrée web, ouverture YouTube native.
- Alternatives : sélectionner l’occurrence si plusieurs, portée séance/programme, matériel personnel/tout, démo par ligne, remplacement. Doublons grisés et séries déjà enregistrées protégées ; aucune occurrence implicite lorsqu’un exercice n’est plus au programme.
- ExerciseDemo : technique/face/dos, pause/lecture, rotation deux doigts sur tactile ou glisser souris, flèches clavier, recentrer, muscles directs/secondaires ; fallback si modèle indisponible. Chargement à visibilité, cleanup, mouvement réduit pris en compte.
- Sheet : titre/fermeture, focus initial/restauré, boucle clavier, Escape, verrouillage du document, défilement intérieur, footer optionnel.
- Disclosure : summary natif, hauteur minimale 52 px, icône18, contenu masqué absent du parcours Tab ; bordure portée par le groupe quand nécessaire.
- Boutons et champs DS : tokens thème, IconButton44 et petits boutons44, labels/aria au niveau des composants. Toaster avec action optionnelle ; Empty illustré64 et CTA adapté.

## 3. Constats vérifiés et corrections minimales

### P1 — données ou interaction principale

| ID | Preuve source | Effet concret | Correction minimale |
| --- | --- | --- | --- |
| A1 | `RestTimer.tsx:203` RestOverlay ne gère que Escape ; `ui.tsx:419` Sheet gère focus et document. | `aria-modal=true` ne rend pas le reste inerte. Le focus peut rester/partir dans la page cachée, le document n’est pas verrouillé, la fermeture ne rend pas le focus au déclencheur. | Reprendre le contrat de Sheet pour cette vue plein écran : focus initial, boucle Tab, restauration, verrouillage du fond. Garder cadran, timer et boutons actuels. |
| A2 | `Progress.tsx:305–330` valide seulement `parseNumber !== null` ; `format.ts:78` accepte tout nombre fini ; `store.ts:764` persiste sans normalisation. | −5 kg ou 0 cm active Enregistrer, est sauvegardé et annoncé comme réussi. Les graphiques/estimations consomment ensuite ces données. | Champs positifs, erreur visible associée et blocage tant qu’une valeur saisie est invalide. Laisser les champs vides facultatifs ; ne pas réécrire l’historique. |
| A3 | `ProgramScreen.tsx:277–289`, `store.ts:968` : `sets=Math.max(1,n)` sans entier, min/max indépendants. | 2,5 séries ou 15–8 reps sont enregistrés comme prescription ; la fiche affiche une cible incohérente. | Validation avant save : séries entières positives, reps entières positives et min≤max, erreurs ciblées ; garder valeurs existantes et handlers. |

### P2 — cohérence, navigation et actions

| ID | Preuve source | Effet concret | Correction minimale |
| --- | --- | --- | --- |
| A4 | `Progress.tsx:187–194` « Technique et preuves », inline DemoFrames + sources + bouton « Démo » qui rouvre ExerciseSheet. | Ancien wording maintenu ; deux présentations du même modèle et des mêmes sources, alors que les consignes Technique sont dans la seconde. | Un seul accès explicite « Technique et alternatives » vers la fiche complète ; garder les courbes/historique sur Progrès. Ne pas renommer les niveaux scientifiques des études. |
| A5 | `ProgramScreen.tsx:47–118` sept champs de semaine, volume et huit longs paragraphes toujours ouverts. `SourcesScreen:160–201` règles longues dans les summaries et bibliographie entièrement ouverte. | Le réglage courant et les fiches de séance se retrouvent au milieu de contenu de référence volumineux. | Frises + séances immédiatement visibles ; disclosures nommés pour semaine, volume, règles. Sources : règles/détails repliés et bibliographie regroupée avec décompte. Aucun contenu retiré. |
| A6 | `GymSheet.tsx:34–49` : à la maison, une première feuille ne contient que « Retourner à la salle », qui ouvre SetupSheet. | Deux ouvertures pour atteindre les vrais choix ; le matériel maison n’est pas accessible directement depuis ce raccourci. | Ouvrir SetupSheet directement pour le contexte maison avant séance. Préserver la sélection de salle distincte en séance. |
| A7 | `Setup.tsx:36`, `PlanMode.tsx:29`, `Goal.tsx:130,192`, `Onboarding.tsx:168,307,373` utilisent `role=radio` sur boutons sans flèches/roving tabindex. | Chaque option prend une étape Tab ; les flèches ne changent pas la sélection comme attendu d’un radiogroup. | Entrées radio natives stylées ou gestion clavier commune minimale. Le Segmented DS utilise honnêtement des boutons `aria-pressed` dans un group ; ne pas lui ajouter une fausse sémantique radio. |
| A8 | Cibles CSS : Home salle `h-9`36 ; Pause motifs `h-10`40 et raccourcis `h-9`36 ; GoalSheet raccourcis40 ; ZonePicker40 ; Onboarding langue32 et dates40 ; Goal sexe48−padding8−bordure2≈38 ; Session ajouter/retirer40. | Tailles différentes du standard44 des actions voisines, particulièrement en usage tactile. | Utiliser min-h-11/contrôles DS, sans agrandir les illustrations ni recomposer les cartes. C’est un écart DS44, pas une affirmation d’échec WCAG24. |
| A9 | `Progress.tsx:300,372` suppression mesure/photo directe ; `Session.tsx:894` suppression séance avec confirmation. | Une activation retire une donnée corporelle ou image sans possibilité locale d’annulation, contrairement à l’historique de séance. | Confirmation courte pour photo ; confirmation ou toast Annuler pour mesure. Pas de changement des sauvegardes existantes. |
| A10 | `Progress.tsx:210,228` date fixe `2026-09-28`, fallback « Dès le 28 sept. » et sèche systématique ; `PROGRAM_START` est dynamique. | Hors phase courante (avant début personnalisé ou après fin), le texte promet une ancienne date/sèche au lieu de décrire ce plan. | Utiliser PROGRAM_START/contexte réel et libellés avant/après/entretien explicites. |

### P3 — points contenus et groupements secondaires

- `Progress.tsx:122` passe `name: tpl?.name ?? all[0]?.sets[0] ? undefined : id` à `infoFor`. L’expression conditionnelle fournit toujours `undefined` ou l’ID, jamais le nom historique. Un exercice personnalisé archivé affiche son ID dans le détail alors que ForceTab a son nom. Réutiliser le nom enregistré, sans toucher aux IDs.
- `RestTimer.tsx:265` tronque systématiquement le titre du prochain exercice en plein écran, comme dans le dock. Le plein écran peut accepter deux lignes sans modifier la taille du cadran. À valider sur titre long FR/EN avant de qualifier le crop visuel.
- GoalSheet/date et Objectif visuel servent deux opérations réelles ; ne pas tout fusionner en un formulaire massif. Les présenter dans une même rubrique Objectif avec noms explicites « Date et mode du plan » et « Physique et priorités » suffit à réduire la dispersion. Coordination nécessaire avec l’audit Réglages.
- Pause : son action justifie une vue dédiée, mais les règles de reprise statiques peuvent être un disclosure sous l’aperçu. Rappels : même principe pour les instructions ICS et la liste de décharges, en laissant choix/horaires/export immédiatement accessibles.
- Pas de doublon de séparateur confirmé dans ExerciseSheet : le groupe vidéo/alternatives porte `border-y divide-y`, ses Disclosure sont `bordered=false`. Ne pas ajouter de nouvelles bordures individuelles.

## 4. Répartition recommandée sans refonte

| Vue | Visible immédiatement | Complément replié / vue liée |
| --- | --- | --- |
| Aujourd’hui | 0/total, frise, prochaine séance, repères, nutrition | Réglages restent des liens contextuels ; ne pas y ajouter un deuxième programme. |
| Calendrier | Mois, échéances utiles, pause/rappels | Programme reste le second onglet, même état de mois. |
| Programme | Frise, bloc courant et futur proche, cinq fiches | Semaine type ; volume ; règles d’ajustement. Passé reste replié. |
| Sources | Question centrale et catégories lisibles | Principe/règle/détail ; limites ; bibliographie dénombrée. Références accessibles depuis les mouvements conservées. |
| Progrès exercice | Courbes, salle, historique | Un accès à la fiche Technique/alternatives, sans second modèle/science inline. |
| Lieu | Vrais choix salle/maison/matériel | Supprimer uniquement la feuille maison de transition. |
| Objectif | Rubrique commune, deux opérations identifiées | Date/mode en feuille courte ; look/zones/estimation dans la page détaillée. |
| Pause / rappels | Action et réglages | Explications/règles/liste longue en disclosure. |

Ne pas fusionner nutrition quotidienne avec ses objectifs, édition du programme avec une séance active, ni sources scientifiques avec réglages : leurs actions, portée et fréquence diffèrent.

## 5. Éléments à préserver et vérification

- Identité conservée : typographie Geologica, timer DSEG, frises, 0/total, headers3D et petits pictogrammes18 pour sous-sections. Ne pas remettre de grandes illustrations dans les cartes de journalisation.
- Les composants partagés donnent déjà de bons repères : marges Screen, Header, SectionHeading, boutons44, Sheet, Disclosure, tokens clair/sombre et Empty contextuels.
- La rotation 3D laisse le défilement tactile à un doigt ; raccourcis clavier et mouvement réduit existent. Le chargement des modèles attend la visibilité.
- Les changements de programme ont une portée explicite ; séries terminées/historique sont protégés, occurrences et doublons contrôlés. Conserver ces règles lors des regroupements.
- Aucun nouveau moteur de navigation n’est nécessaire. Garder les URL historiques redirigées et les routes canoniques Calendrier/Programme.

Passe statique Impeccable bornée exécutée sur les pages/composants listés, hors More/Settings : code de sortie0, aucun diagnostic imprimé. Cette passe regex ne prouve ni absence de défauts fonctionnels ni conformité visuelle/accessibilité ; les constats manuels ci-dessus restent à traiter.

Pas de nouveau test produit exécuté pour l’inventaire. Vérifications à effectuer sur les corrections : saisies invalides/valides FR+EN, maintien des handlers d’édition/remplacement, clavier Tab/Escape du repos, retour de focus, disclosures refermés absents du parcours Tab, aucun overflow320/402, contrastes clair/sombre et textes longs. Profil QA isolé uniquement.

Ordre de travail conseillé : P1 `$impeccable harden` sur formulaires et modal ; P2 `$impeccable distill` sur Programme/Sources et parcours court ; P2 `$impeccable clarify` sur libellés/contexte ; `$impeccable polish` en passe finale ciblée. Ne pas relancer de refonte globale.

## 6. Corrections autorisées après remise de l’audit

Lot limité à `ProgramScreen.tsx`, `Progress.tsx` et `RestTimer.tsx` :

- **A1** : focus initial, boucle Tab/Shift+Tab, Escape stable pendant les mises à jour du compteur, verrouillage/restauration du débordement du document. Le dock reste monté sous le plein écran pour retrouver son bouton à la réduction.
- **A2/A3** : mesures strictement positives ; séries et répétitions entières positives ; maximum de répétitions au moins égal au minimum. Erreurs via le `Field.error` partagé, save désactivé et handler protégé. Aucun assainissement rétroactif des données.
- **A4** : un seul bouton « Technique et alternatives » mène à la fiche existante depuis le détail Progrès ; modèle, technique, sources et vidéos restent dans cette fiche.
- **A5** : frises et cinq séances restent visibles, avant semaine type/volume/règles repliables. Sources : les règles longues passent dans leurs accordions, limites et bibliographie sont repliées ; toutes les références sont conservées.
- **A9** : confirmation Sheet avant suppression d’une mesure ou photo. Annuler une suppression photo rouvre son aperçu ; aperçu et confirmation ne sont pas ouverts simultanément.
- **A10** : début et texte de rythme utilisent le vrai PROGRAM_START ; état après fin de plan explicite, courbe réelle visible jusqu’à aujourd’hui et aucune projection prolongée fictivement après fin.
- **P3** : nom/muscle/unité issus de l’exercice historique quand la fiche actuelle n’existe plus ; titre du prochain exercice sur deux lignes dans le repos plein écran.

Vérifications du lot : TypeScript PASS ; 27 tests existants remplacement/SSR/timeline PASS ; rendu SSR réel FR/EN avant début personnalisé et après fin PASS ; présence de toutes les URL de la bibliographie et nom d’exercice archivé PASS ; detector ciblé `[]` ; `git diff --check` PASS. Les interactions clavier, suppressions et validations par vraie UI restent à vérifier par la passe navigateur du parent. Aucun commit, build natif, import utilisateur ou publication effectué par ce lot.
