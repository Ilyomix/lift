# Audit complet Lift — 7 octobre 2026

## Résultat

Audit du code courant, des calculs, de la persistance, des parcours web et du code natif. Les défauts confirmés ont été corrigés dans le répertoire de travail. **398 tests réussis, 1 ignoré, aucun échec ; compilation web réussie.** Trois défauts P1 concernaient la conservation des données ou un résultat de stockage trompeur. Les détails reproductibles, corrections et limites sont consignés dans les trois rapports spécialisés :

- [Logique métier, calendrier, entraînement et nutrition](audit-complet-2026-10-07-logique.md)
- [Données, sauvegardes, migrations, partage et push](audit-complet-2026-10-07-donnees.md)
- [iOS, Android, notifications et Live Activity](audit-complet-2026-10-07-natif.md)

Référence : HEAD `9fd789b264e3a83a1f06907e70d5d3d332b22ca1`, avec les modifications déjà présentes puis les corrections de cette passe. Les changements marketing antérieurs sont conservés. Aucun commit, déploiement push, envoi TestFlight ou changement App Store effectué pour cet audit. Les données des tests et captures sont fictives et isolées de celles de l’utilisateur.

L’audit est terminé sur le périmètre accessible. Cela ne signifie ni absence absolue de bugs, ni validation physique complète : les points ouverts ci-dessous sont des travaux de validation distincts.

## Corrections confirmées

| Priorité | Défaut | Résultat après correction | Référence |
|---|---|---|---|
| P1 | Import annoncé réussi malgré une écriture de l’état refusée | Succès seulement après persistance ; restauration des photos précédentes en cas d’échec ; erreur explicite si cette compensation échoue | D1 |
| P1 | Effacement fictif, ou données recréées par une écriture déjà en cours | Attente de l’écriture, contrôle du résultat, navigation seulement après succès | D2 |
| P1 | Stockage illisible traité comme un profil vide | Écran d’erreur et Réessayer ; aucune invitation à créer un profil par-dessus | D8 |
| P2 | Petite charge augmentée lors d’un allègement | Une réduction ne peut plus dépasser la charge de départ | L01 |
| P2 | Synthèse de force mélangeant machines ou unités | Comparaisons regroupées par contexte compatible | L02 |
| P2 | Protéines fixes modifiées automatiquement en sèche | Respect de la fourchette fixe enregistrée | L03 |
| P2 | Réserve moyenne incompatible avec une série à l’échec | Même lecture de l’effort que le moteur d’entraînement | L04 |
| P2 | Date objectif impossible acceptée | Validation du jour calendaire réel, y compris dans l’import | L05 |
| P2 | Palier emprunté à une autre machine ou à une séance future | Filtrage par unité, contexte et chronologie | L06 |
| P2 | Charge absente interprétée comme une chute de force | Comparaison indisponible, sans fausse baisse ni record ; diagnostics recalculés en révision 5 | L07 |
| P2 | Photo masquée malgré suppression refusée ; IDs importés en collision | Retrait après confirmation ; IDs distincts pour contenus distincts | D3–D4 |
| P2 | Import acceptant des types invalides pour vidéos, horaires, préférences et minuteur | Normalisation à la frontière ; contenu valide conservé | D5 |
| P2 | Copie refusée annoncée réussie | Résultat réel du fallback contrôlé | D6 |
| P2 | Validation push insuffisante | Corps objet, origine étrangère refusée, destinations HTTPS contrôlées, hôte de relais issu de la configuration | D7 |
| P2 | Notification Android touchée au lancement à froid sans ouvrir la séance | Intention initiale prise en compte avant le chargement de la vue web | N3 |
| P2 | Fin naturelle du repos Android affichée comme « Prêt » | Distinction entre repos terminé et absence de repos | N4 |
| P2 | Synchronisation Android ouvrant les réglages d’alarmes sans action dédiée | Alarme exacte seulement si déjà autorisée ; sinon inexacte | N5 |
| P2 | Son désactivé remplacé par le son système sous Android 7/7.1 | Ressource silencieuse explicite pour cette branche | N6 |

Les corrections natives N1/N2 présentes au début de cette passe ont aussi été contrôlées : secours sonore après retrait d’autorisation et lest PDC effacé correctement représenté. Les corrections précédentes des diagnostics « Conditions différentes », de l’historique chronologique, des semaines flexibles et des animations de navigation restent couvertes par la suite intégrée.

### Corrections d’interface complémentaires

- **Première page d’onboarding** : suppression du compteur « 37 publications citées » et de sa version anglaise. Le pied de page indique seulement « Tes données restent sur cet appareil. ». Vérifié dans les deux langues, avec capture après chargement des icônes.
- **Date objectif** : le sélecteur s’arrêtait au 31 décembre 2030, alors que le programme accepte une plage plus longue. Il utilise maintenant la même borne que le programme. Une date du 2 février 2031 a été sélectionnée dans le navigateur.
- **Graphe nutrition** : le graphe des 14 derniers jours utilisait la cible du jour choisi dans le formulaire. Sa cible est désormais celle de sa propre période, indépendamment du jour consulté. Titre clarifié : « Protéines, 14 derniers jours ».
- **Progrès avec charge absente** : les points sans mesure ne produisent plus une fausse chute à zéro. Les lignes réelles restent visibles dans l’historique ; la liste ne prétend plus qu’aucune séance n’existe. Un message explique pourquoi la courbe manque.
- **Réinitialisation** : l’écran ne quitte plus les réglages après une suppression refusée. Un reset réellement réussi après une erreur de stockage restaure aussi le mode de stockage normal.
- **Chargement en erreur** : titre avec icône et action Réessayer, sans écriture ni onboarding. Vérification à 320 px avec un refus IndexedDB injecté.

## Arborescence des pages

```text
Onboarding
  Lieu et matériel → jours → profil/mesures → objectif → notifications

Aujourd’hui
  Progression/frise, objectif/date, prochaine séance ou séance active
  Semaine et détail d’un jour, objectifs, nutrition du jour

Séance
  Aperçu → séance active → bilan
  Historique d’une séance → correction ou suppression

Calendrier
  Calendrier : semaine/mois, détail d’un jour, organisation des repos, étapes
  Programme : frise, blocs actuels/à venir, règles
    Upper / Lower / Push / Pull / Legs → édition des exercices

Progrès
  Force → historique et détail d’exercice
  Corps → mesures et photos
  Volume
  Séances → historique d’une séance

Plus
  Nutrition
  Réglages
  Sources scientifiques
  Outils avancés → Aide IA facultative
  À propos → confidentialité, auteur, version/build, GitHub
```

L’ancienne route `/plus/programme[/type]` redirige vers Calendrier/Programme. L’aide à l’installation est réservée au web/PWA.

## Inventaire des réglages

| Groupe | Options et actions |
|---|---|
| Objectifs | Objectif visuel ; date objectif ou entretien ; poids minimum/maximum ; tour de taille cible ; enregistrer ; explication des cibles |
| Jours et fréquence | Jours lundi–dimanche ; séances allongées si moins de cinq jours |
| Séances du programme | Fiches des cinq séances ; ordre des exercices par glisser-déposer ; rétablissement de l’ordre initial ; ajouter/retirer un exercice |
| Prescription d’exercice | Charge/lest ; séries ; répétitions minimum/maximum ; réserve ; repos ; réglage machine/note |
| Matériel et salles | Salle/maison ; haltères, banc, traction, élastiques ; aperçu des exercices ; choisir/ajouter/renommer/supprimer une salle ; protection de la salle principale |
| Pause du programme | Motif ; dernier jour facultatif ; raccourcis de durée ; note ; pause/reprise et conditions de reprise |
| Rappels calendrier | Séances, pesée, tour de taille, photos, semaines allégées, phases/objectif ; heures séance/pesée ; export ICS ; aide à l’ajout |
| Charges automatiques | Activation et explication des règles |
| Repos et alertes | Son ; écran allumé ; Live Activity iOS/suivi Android ; notification native ; précision Android ; push et test web/PWA ; secours lorsque l’app est ouverte |
| Cibles nutritionnelles | Calories ; créatine ; protéines adaptées au poids ou fixes ; minimum/maximum ; enregistrer ; conseil calorique conditionnel et application explicite |
| Apparence | Langue automatique/FR/EN ; thème automatique/sombre/clair ; accent orange/bleu |
| Données et confidentialité | Export ; import et aperçu ; migration compatible ; effacement confirmé ; politique de confidentialité |

### Volets et fonctions secondaires

| Entrée | Contenu inventorié |
|---|---|
| Objectif du programme | Date/entretien, raccourcis de dates, aperçu des phases et volume, enregistrer |
| Objectif visuel | Physique visé, trois priorités maximum, photo référence, taille/sexe/gras facultatif, estimations, appliquer/actualiser/retirer |
| Détail du jour | Séance faite/active/prévue, exercices et prescriptions, repos/pause, démarrer/reprendre, déplacer séance/repos |
| Organiser la semaine | Jours futurs, conserver la cible ou les séances prévues, enregistrer, rétablir les jours habituels |
| Entraînement un jour de repos | Confirmation avant démarrage ; proposition d’organisation après clôture |
| Fiche exercice | Schéma 3D, séries/répétitions/réserve/repos, technique, Techniques sur YouTube, vidéo personnelle, alternatives, sources, performances |
| Séance active | Choix d’exercice/salle, actions séance/exercice, détail de série/effort/répétitions propres/note, terminer/abandonner |
| Minuteur | Agrandir/réduire, ajuster, passer/fermer |
| Mesures et photos | Dates et mesures corporelles ; ajout/suppression confirmée ; comparaison de photos et photo objectif |
| Nutrition | Date, valeurs éditables, incréments, créatine, graphe des 14 derniers jours |
| Aide IA facultative | Partager séance/bilan ; coller, prévisualiser, appliquer une réponse |

Cet inventaire décrit les entrées et leurs ramifications. Il ne prétend pas que chaque combinaison d’options et chaque permission système a été manipulée sur appareil physique.

## Vérifications exécutées

| Vérification | Résultat et portée |
|---|---|
| `npm test` | 399 tests : **398 réussis, 1 ignoré**, 0 échec. Le test facultatif `legacy backup: import, upgrade, finish a session` attend un fichier de sauvegarde non fourni ; les imports synthétiques sont couverts séparément. |
| `npm run build` | TypeScript, Vite et génération PWA réussis. |
| Swift | 29 tests réussis : échéances, snapshots, actions, polices et tirets. |
| iOS Release Simulator | App + extension compilées. Le bundle web natif préexistant n’a pas été synchronisé : ceci valide Swift/packaging, pas une installation du dernier web. |
| Android | Compilation non réalisée : JDK/SDK manquants. Revue Java/Kotlin et tests du bridge TS ; aucun résultat physique revendiqué. |
| 112 contrôles de pages | 28 routes réelles × 4 variantes : FR sombre/orange 320 px, EN clair/orange 390 px, FR clair/bleu 768 px, EN sombre/bleu 1280 px. Aucun débordement horizontal de document, bouton sans nom, champ sans label ou erreur JS détecté par ces contrôles. |
| 10 contrôles d’interaction navigateur | Confirmation de repos et annulation ; saisie nutrition ; cible du graphe stable ; mesure négative refusée ; saisie de série et repos ; swipe gauche entre pages ; retour swipe ; date 2031 ; fermeture de volet ; erreur de stockage et retry sans onboarding. |
| Inspection visuelle | Captures navigateur de l’accueil, calendrier, programme, réglages, nutrition, progrès, séance, corps, confirmation de repos et erreur de stockage. Icônes 3D attendues avant captures finales. |
| Contrôles de sources | TypeScript intégré au build, `git diff --check`, détecteur UI ciblé sans anomalie rapportée. Aucun de ces contrôles n’est une certification d’accessibilité. |

Les swipes du navigateur sont des événements tactiles synthétiques, pas une preuve de geste au doigt sur iPhone. L’onboarding web a aussi été parcouru jusqu’à l’aperçu initial à 320 px ; la demande d’autorisation native n’a pas été déclenchée.

## Points ouverts, sans fausse validation

1. **Live Activity / Dynamic Island sur iPhone** : revalider zéro → « Repos terminé », VoiceOver à l’échéance, alignements/crop, compact/étendu, paysage, Always-On, texte agrandi et deux thèmes. Le clignotement natif continu n’est pas implémenté ; les limites documentées d’Apple figurent dans le rapport natif. La compilation et une ancienne vidéo ne ferment pas ces points.
2. **Android réel** : compiler après mise à disposition de JDK/SDK, puis vérifier démarrage à froid, Doze, précision des alarmes et silence. L’icône launcher ne suit pas encore l’accent comme sur iOS.
3. **Stockage** : la compensation protège les erreurs retournées, mais les deux bases IndexedDB ne forment pas une transaction commune en cas d’arrêt brutal entre commits. Quota Safari et interruption du processus à vérifier séparément.
4. **Accessibilité et gestes physiques** : noms accessibles contrôlés, mais pas de parcours VoiceOver/TalkBack complet ni de mesure systématique du contraste ; pas de validation physique du swipe, du clavier natif et de la rotation 3D à deux doigts dans cette passe.
5. **Performance** : Vite signale des chunks > 500 kB ; précache PWA de 93 entrées, environ 12 205 KiB. Aucun ralentissement mesuré attribué à ces chiffres, aucune optimisation spéculative. Mesurer premier chargement/cache froid et mémoire sur appareil modeste avant de modifier le chargement.
6. **Backend et distribution** : corrections push uniquement locales ; pas de validation du serveur déployé, des secrets ou des notifications réelles. Pas de nouvelle publication Apple ni de vérification du statut App Review dans cet audit.

Les références physiologiques existantes n’ont pas fait l’objet d’une nouvelle évaluation médicale. Les corrections portent sur la cohérence des calculs et le respect des choix enregistrés.

## Captures et traces

Captures finales, navigateur 390 × 844, données fictives, thème sombre orange :

- [Calendrier](../output/playwright/audit-final-calendar.png)
- [Réglages](../output/playwright/audit-final-settings.png)
- [Progrès vide](../output/playwright/audit-final-progress.png)
- [Erreur de stockage, 320 px](../output/playwright/audit-storage-error.png)
- [Confirmation avant séance un jour de repos](../output/playwright/audit-rest-confirmation.png)
- [Onboarding corrigé FR](../output/playwright/audit-onboarding-fr.png) · [EN](../output/playwright/audit-onboarding-en.png)

Traces locales conservées dans `.local-release/audit-complet-2026-10-07/` : `all-tests.log`, `build.log`, `browser-sweep.json`, `interactions.json`, `error-and-gestures.json`, scripts de vérification navigateur et sous-dossier `native/`. Les preuves données/persistance sont dans `.local-release/audit-complet-donnees/`. Ces éléments sont des preuves locales, pas des reçus de livraison.
