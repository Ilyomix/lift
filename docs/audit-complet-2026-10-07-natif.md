# Audit natif Lift — 7 octobre 2026

État du code audité : HEAD `9fd789b264e3a83a1f06907e70d5d3d332b22ca1`, avec les correctifs de l’audit dans le répertoire de travail. Cette passe ne produit ni commit, ni archive distribuable, ni nouvelle livraison Apple/Google.

## Résultat et portée

- 31 tests TypeScript ciblés réussis : snapshots, progression/focus, actions natives périmées et répétées, sérialisation, permissions, alertes de repos.
- 29 tests Swift réussis : échéances, snapshots fresh/stale, expiration de séance, prolongation après zéro, journal d’actions, polices réelles et tirets de cadence réduite.
- Compilation **Release iOS Simulator réussie** : app + extension, Xcode 27.0 (27A266a), SDK simulateur fourni par Xcode. Aucun appareil n’a reçu ce binaire.
- Build Android bloqué avant compilation : `./gradlew :app:assembleDebug --offline` ne trouve pas de JDK. Aucun SDK Android trouvé dans les emplacements installés usuels. Un JRE 21 est embarqué dans DBeaver, mais ne fournit ni compilateur JDK ni SDK Android.
- `npm run typecheck` et `git diff --check` réussis après consolidation des modifications concurrentes. La suite globale finale appartient à la consolidation de l’audit.

La compilation iOS utilise le contenu `ios/App/App/public` déjà présent. **Aucun `native:sync` n’a été exécuté** : le binaire compilé vérifie les sources Swift et le packaging natif, mais ne constitue pas une application intégrant les derniers correctifs TS/UI. Ceux-ci sont couverts ici par les tests TS.

## Couverture du code

| Domaine | Fichiers/parcours examinés | Preuve de cette passe |
| --- | --- | --- |
| Contrat JS natif | `snapshot.ts`, `restActions.ts`, `sync.ts`, `bridge.ts` | Tests TS exécutés |
| Cycle app | `NativeSessionEffects`, `RestTimer`, premier plan, notifications, deep links, réconciliation avant synchronisation | Lecture du code + effets réels exercés avec hôtes React/audio/Capacitor simulés |
| iOS | Plugin Capacitor, SceneDelegate, UserDefaults du journal, ActivityKit request/update/end, actions `+30` et skip | Lecture complète + compilation app/extension |
| Modèle temporel Swift | `WorkoutAttributes`, snapshot stale, expiration, anciennes actions, prolongations successives | Tests Swift de production via shim ActivityKit |
| Lock Screen / Island | Couleurs, marges, polices, icônes, présentations compact/minimal/expanded, masque d’expiration, API paysage | Lecture complète + compilation ; **pas de nouvelle mesure visuelle** |
| Android | Manifest, MainActivity, WorkoutActivityPlugin, WorkoutService, calendrier de notifications Capacitor 8.3.1 | Lecture du code natif et dépendance ; tests TS du bridge, compilation/runtime Android indisponibles |
| Packaging | Versions app/extension, cibles, minimum iOS, icônes alternatives, fontes, manifestes de confidentialité | Inspection du bundle iOS compilé |

## Bugs corrigés

### N1 — Autorisation retirée : plus aucun son de fin de repos dans l’app

Avant : `prefs.notifications=true` restait la préférence souhaitée après un refus dans les réglages système. Le bridge ne programmait plus de notification, et `SessionEffects` supprimait aussi le son/haptique local parce qu’il ne consultait que la préférence.

Correction : le bridge publie séparément l’autorisation réellement lue. Un refus permet le secours sonore au premier plan pour une expiration récente. Une autorisation accordée conserve la notification native comme propriétaire du son. La préférence souhaitée n’est pas écrasée. Le retour `appStateChange` actif invalide le cache comme `visibilitychange`, et l’autorisation est relue même après expiration.

Preuve : vrai bridge avec transport Capacitor simulé + vrais effets `SessionEffects`. Refus après échéance : une seule séquence de trois tons et une vibration. Autorisé : aucun son local ajouté. Échéance ancienne ou app masquée : aucun replay.

### N2 — Lest effacé réintroduit dans le snapshot natif

Avant : une série PDC avec `weight=null` affichait encore le lest de la prescription via `??`. La saisie et `completeSet` considèrent correctement `null` comme poids du corps.

Correction : pour PDC, le snapshot lit directement le lest saisi. Le fallback de charge reste disponible pour les exercices en kg.

Preuve : tests FR/EN pour PDC sans lest, lest explicite et fallback kg.

### N3 — Android : toucher le suivi au lancement à froid n’ouvrait pas la séance

Avant : `WorkoutService` plaçait `liftRoute=seance` dans l’intention, mais `MainActivity` ne la consommait que dans `onNewIntent`. Une activité nouvellement créée recevait l’intention initiale sans positionner `openSession`.

Correction : lecture de l’intention initiale dans `onCreate`, avant le chargement du WebView. Le mécanisme existant attend toujours `onPageLoaded` avant de naviguer. Le traitement à chaud reste identique.

Preuve : chemin de contrôle et contrat Android examinés. **Non exécuté sur Android**, compilation bloquée par l’environnement. [Cycle des tâches Android](https://developer.android.com/guide/components/activities/tasks-and-back-stack).

### N4 — Android : fin naturelle du repos confondue avec l’état prêt

Avant : quand `resting` devenait faux à l’échéance, le service affichait `readyLabel`, comme après un repos supprimé.

Correction : une échéance toujours présente mais passée affiche « Repos terminé » / « Rest over ». `restEndAt=null` garde « Prêt » / « Ready ».

Preuve : branche déterministe de `WorkoutService.notification()` vérifiée avec états échéance future/passée/null. **Pas de preuve runtime Android** ; son rafraîchissement par le service ne constitue pas une garantie temporelle sous Doze.

### N5 — Android : la synchronisation ouvrait implicitement les réglages d’alarmes

La dépendance installée `@capacitor/local-notifications` 8.3.1 active `isExactNotification` par défaut. Dans `LocalNotificationsPlugin.kt`, `doSchedule` ouvre `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` quand l’accès manque. Le lancement automatique d’un repos pouvait donc ouvrir des réglages sans passer par le bouton dédié.

Correction : lecture de `checkExactNotificationSetting()`, puis `isExactNotification=true` seulement pour une autorisation déjà accordée. Sinon, programmation inexacte ; le bouton explicite « Réglages » reste l’entrée pour autoriser les alarmes exactes. iOS ne reçoit pas cette option Android.

Preuve : vrai bridge testé avec refus puis accord ; aucun appel de demande/changement d’autorisation. Le comportement par défaut est confirmé dans le code Kotlin et les types documentés de la dépendance installée.

### N6 — Android 7/7.1 : son désactivé remplacé par le son système

Avant Android 8, le canal silencieux ne s’applique pas. Dans la dépendance installée, un son absent finit sur le son par défaut ou `DEFAULT_ALL`.

Correction : la branche Android sans son utilise `res/raw/lift_silence.wav` (PCM mono 8 kHz, 100 ms de zéros). Le canal silencieux reste utilisé sur les versions récentes. iOS conserve l’absence de son et la branche sonore conserve `default`.

Preuve : options transmises au plugin et fichier WAV vérifiés par test, échantillons PCM tous nuls. **L’emballage et la restitution audio Android restent à vérifier après installation d’un SDK/JDK**.

## Éléments vérifiés sans modification

- Actions natives absolues et idempotentes ; une ancienne échéance ou un autre workout ne peut pas remplacer le repos actuel. Le journal reste présent jusqu’à confirmation de stockage durable côté JS.
- Les corrections de séances (`reopened`) ne démarrent pas une Live Activity. La fin, l’abandon et la remise à zéro de séance transmettent un snapshot nul.
- Échéance future, repos terminé et expiration de séance ont des états distincts ; `+30` après zéro repart de l’heure courante, sans réutiliser une échéance passée.
- Pas de tâche JS/Swift récurrente utilisée pour maintenir artificiellement une Live Activity en arrière-plan ; pas d’APNs ActivityKit configuré. Le serveur Web Push existant n’est pas un serveur ActivityKit.
- Minimum iOS 16.2 ; boutons intents protégés par iOS 17 ; restriction de largeur Island protégée par iOS 27. Les chemins inférieurs conservent leur fallback.
- App et extension compilées en 1.0 (30), identifiants `app.lift.training` et `app.lift.training.activity`, minimum iOS 16.2, `NSSupportsLiveActivities=true` dans l’app.
- Icône principale et alternative `AppIconBlue` présentes pour iPhone/iPad. Les deux images utilisées par l’extension sont présentes. Les six fontes déclarées sont embarquées. Manifestes de confidentialité présents pour app, extension, Capacitor et Cordova.
- Seuls warnings iOS observés : variable inutilisée `responseType` dans la dépendance Capacitor Filesystem, pour les deux architectures simulateur. Aucun warning ajouté dans le code natif Lift.

## Appareils et limites qui restent ouvertes

Découverte en lecture seule le 7 octobre à 06:06 CEST : iPhone 17 connecté par câble, iOS 27.0.1 (24A446), mode développeur activé. Aucun accès à ses données, aucune installation ou action de test. Cette découverte ne prouve aucun comportement de l’app.

Les runtimes simulateurs disponibles sont iOS 26.5. Les simulateurs Release iPhone/iPad étaient démarrés ; aucun n’a été utilisé pour une nouvelle session de test visuel dans cette passe.

1. **Clignotement natif continu absent.** Apple limite les animations de widgets/Live Activities à deux secondes et les désactive en Always-On. Aucun clignotement périodique fiable n’est revendiqué ni ajouté. Le clignotement CSS dans l’app ne prouve pas un clignotement natif. [Documentation Apple des animations](https://developer.apple.com/documentation/widgetkit/animating-data-updates-in-widgets-and-live-activities).
2. **Bascule visuelle à zéro à revalider.** Le masque natif `ProgressView(timerInterval:)` est toujours utilisé ; sa composition n’est pas une garantie Apple de mise à jour exacte. Les enregistrements antérieurs décrits dans `tests/native-timing/README.md` restent des preuves historiques, pas la validation de ce code complet. [Définition de staleDate](https://developer.apple.com/documentation/activitykit/activitycontent/staledate).
3. **VoiceOver** : le masque visuel ne change pas l’arbre d’accessibilité. Avant une vraie actualisation stale/content, la lecture peut rester « temps restant, zéro » plutôt que « repos terminé » ; non corrigé par compilation.
4. **Crop et alignements** : marges communes expanded, marque 20 pt dans une boîte 26 pt et fontes incluses vérifiées dans le code ; aucune nouvelle preuve pixel sur Island compacte/étendue, petit écran, grandes tailles de texte, Always-On ou thème clair. Aucun « crop résolu » annoncé par cette passe.
5. **Paysage** : le code masque le timer compact quand `isDynamicIslandLimitedInWidth` est vrai. Apple documente ce flag pour les présentations compact/minimal à partir d’iOS 27 ; il ne signifie pas toute orientation paysage sur toutes versions. Pas de runtime iOS 27 simulateur pour le rejouer ici. [API Apple](https://developer.apple.com/documentation/swiftui/environmentvalues/isdynamicislandlimitedinwidth).
6. **Android** : compilation app complète, tests instrumentés, cold start réel, Doze, canaux utilisateur et alarmes exactes/inexactes restent non validés. L’icône alternative suivant le thème est implémentée uniquement côté iOS ; l’icône launcher Android ne change pas avec l’accent.

## Preuves et commandes

Répertoire local ignoré : `.local-release/audit-complet-2026-10-07/native/`.

| Fichier | Contenu |
| --- | --- |
| `ts-tests.log` | 31 tests ciblés réussis |
| `swift-tests.log` | 29 tests Swift réussis |
| `ios-build.log` | Compilation Release simulateur, `BUILD SUCCEEDED` |
| `packaging-inspection.json` | Versions, minimum OS, icônes, fontes, privacy manifests du bundle compilé |
| `android-build.log` | Échec d’environnement avant compilation Java |
| `device-details.json` | Découverte native en lecture seule ; reste locale |

```sh
node --import tsx --test tests/native.test.ts tests/native-rest-alerts.test.ts tests/native-permission.test.ts tests/active-exercise.test.ts
swift test --package-path tests/native-timing
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/lift-audit-native-20261007 -jobs 2 CODE_SIGNING_ALLOWED=NO build
cd android
./gradlew :app:assembleDebug --offline
```

Les outils XcodeBuildMCP n’étaient pas exposés dans cette session. Les outils Apple locaux ont servi au repli de compilation/découverte. Le build simulé n’est ni signé pour distribution, ni envoyé sur TestFlight/App Store.
