# Native workout tracking / Suivi natif de séance

Lift keeps its React PWA and additionally ships Capacitor iOS and Android projects.
Installing the website on the Home Screen does **not** enable ActivityKit. Build and install the native app.

## Build

Node 22+; `npm ci`, then `npm run native:sync`.

- iOS: macOS with Xcode 26+, `npm run native:ios`. Choose your development team for **App** and **LiftActivity**. The WidgetKit extension is already a dependency and embedded in App. Deployment target is iOS 16.2. Build/install on an iPhone; the Dynamic Island requires a compatible iPhone. No APNs server or App Group is needed for this local ActivityKit integration.
- Android: Android Studio with SDK 36 and Java 21, `npm run native:android`. Or `cd android && ./gradlew assembleDebug`. Install the APK; starting the first workout requests notification permission for lock-screen tracking. For precise end-of-rest alerts enable alarms/reminders from Lift's timer settings. Otherwise Android may delay local alerts. The ongoing notification works from Android 7 (API 24). It uses a `specialUse` foreground service; declare that use case during Play Console review. This implementation uses a standard ongoing notification, not Android's promoted Live Updates format.

The checked-in projects are complete: do not run `cap add` again. Run `native:sync` after web changes; generated web bundles and native configuration are intentionally ignored by git. Web builds keep `/lift/` for GitHub Pages; native builds use `/` and disable PWA/service-worker installation so packaged updates cannot be shadowed by a stale service worker.

## Behaviour

- Subscribe to the existing Zustand store after hydration. Show the next incomplete set, current load/prescription and completed/total non-skipped sets.
- A rest's absolute epoch deadline renders with an iOS system timer or Android system chronometer when the WebView sleeps. The next set is already visible; on iOS a rest counts down to zero (the activity does not run arbitrary code at expiry). Android switches the notification to the ready label at expiry.
- Local notification ID 7401 is replaced when a rest changes, and cancelled when skipped, finished, discarded or imported/reset. Sound follows the sound preference. Notifications must be enabled in Lift and allowed by the OS. Tracking has its own opt-out preference and can remain enabled without end-of-rest alerts.
- On iOS 17+, the Live Activity offers **+30 s**, **Skip rest** and **Resume workout**. Rest actions update the system countdown and the same local notification while the WebView is suspended. A persistent FIFO journal reconciles absolute timer results before the app sends a new snapshot; acknowledgements happen after the app saves them. An obsolete action cannot change a different workout or a newly started rest. iOS 16.2 retains the live countdown and resume link.
- End-of-rest notifications offer **+30 s** and **Resume workout** in French and English. Notification actions open the session. Native notification sound/haptics are not duplicated by the WebView, and an expired alert is not replayed when the app resumes. Tracking uses the official Lift icon and the same DSEG7 typeface as the in-app clock.
- Native builds skip web push scheduling and browser notifications. PWA behaviour remains unchanged. Updates are serialized/coalesced, so a slow update cannot recreate a session after its finish event.
- iOS finds existing activities after relaunch and ends activities from a different session. Android uses a non-sticky service, stops on task removal and expires tracking after eight hours without a new snapshot. iOS marks the snapshot stale at that deadline; iOS also imposes its own Live Activity lifetime.
- The native app uses a separate browser storage origin: export a backup from the PWA and import it into the native app to carry your history over.

## Languages

All user-facing generated workout strings follow Lift's resolved French/English preference. Exercise names follow the app's existing localization of the store. Changing language refreshes the active native snapshot, including notification text. Bodyweight and per-hand units follow that language too. Android's OS notification channel names/descriptions have English and French resources (the OS manages their display). No native screen introduces a separate language preference.

## Device acceptance

Check on an iPhone and Android phone before releasing:

1. Import a backup, allow local notifications, start a session, complete a set and lock the phone. Check exercise, set, load, reps, RIR, progress and countdown.
2. Adjust rest in both directions, skip rest, finish and discard. No outdated rest alert or activity should remain.
3. Change French ↔ English during rest. Check all labels and `kg/main`/`kg/hand`, `PDC`/`BW`.
4. Background the app through rest expiry. Check the single local alert and countdown reaches zero. Disable sound and repeat.
5. Disable alerts but keep tracking; then disable tracking but keep alerts. Check independence.
6. Relaunch with an active session; reopen a historical completed session. Check no duplicate activity and no tracking for historical corrections.
7. Deny notifications/live activities, revoke exact alarms, remove the Android task. Check settings explain permissions and normal workout logging still works.
8. On iOS 17+, tap +30 s twice from the Live Activity, then skip. Relaunch and verify the app retains the exact resulting timer. Repeat with the app suspended: extend rest in the Live Activity, wait for the new notification and use its +30 s action.
9. Lock/unlock, edit a set **after** unlocking and relaunch. Verify the new edit persisted. A temporary IndexedDB failure must not disable all future saves.

## Verification status

Run `npm test` and `npm run build:native`, then `npx cap sync ios`. The tests cover snapshot localization, coalesced updates, stale notification actions, timer-result replay and IndexedDB recovery. The Native build checks workflow compiles the iOS and Android projects. Interactive Live Activity behavior and distribution signing additionally require the device checks above and a signed archive/export.
