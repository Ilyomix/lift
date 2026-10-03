# App Store submission

Draft metadata for Lift 1.0. Verify availability and the current App Store Connect fields before submitting. These notes are not a record of an upload or approval.

## App identity

- App: `app.lift.training`
- Live Activity extension: `app.lift.training.activity`
- Category: Health & Fitness
- Supported devices: iPhone and iPad (both targets use device families `1,2`)
- Languages: French and English
- No account, login, subscription or in-app purchases are implemented.
- App icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`, 1024 × 1024, opaque.

## Suggested metadata

| Field | French | English |
| --- | --- | --- |
| Name | Lift — Musculation | Lift — Strength Training |
| Subtitle | Séances, repos et progression | Workouts, rest and progress |
| Keywords | hypertrophie,fitness,charges,répétitions,salle,domicile,programme,calendrier | hypertrophy,fitness,weights,reps,gym,home,program,timer,calendar |

### French description

Lift prépare ton programme de musculation et t’accompagne pendant chaque séance, à la salle ou à la maison.

- Un programme adapté à tes jours d’entraînement et au matériel disponible.
- Des séances guidées avec séries, répétitions, charges et temps de repos.
- Des Activités en direct pour suivre ta séance et ton repos depuis l’écran verrouillé.
- Un ajustement des charges à partir de tes performances.
- Un calendrier de blocs, de décharges et de pauses.
- Le suivi de ta force, de tes mesures corporelles et de tes photos.
- Des repères de nutrition et les sources scientifiques du programme.
- Des sauvegardes exportables et un bilan à partager avec l’assistant IA de ton choix.

Sans compte. Les données d’entraînement sont conservées sur ton appareil. Les vidéos YouTube s’ouvrent à ta demande dans YouTube ou ton navigateur. Les liens externes et les partages volontaires sont décrits dans la politique de confidentialité.

Disponible en français et en anglais. Lift propose des informations d’entraînement et de nutrition ; il ne remplace pas un professionnel de santé.

### English description

Lift prepares your strength training program and guides each workout, at the gym or at home.

- A program adapted to your training days and available equipment.
- Guided workouts with sets, reps, loads and rest times.
- Live Activities to follow your session and rest timer from the lock screen.
- Load adjustments based on your performance.
- A calendar of training blocks, deloads and breaks.
- Strength, body measurement and progress photo tracking.
- Nutrition guidance and the program’s scientific sources.
- Exportable backups and summaries you can share with your chosen AI assistant.

No account required. Training data is stored on your device. YouTube videos open in YouTube or your browser at your request. External links and voluntary sharing are described in the privacy policy.

Available in English and French. Lift provides training and nutrition information; it does not replace a health professional.

## URLs

- Support: https://github.com/Ilyomix/lift/issues
- Marketing: https://ilyomix.github.io/lift/
- Privacy policy, once deployed: https://ilyomix.github.io/lift/privacy.html
- The bundled privacy policy is accessible from More → Privacy policy and includes both languages.

## App Review notes

No login is required. Complete onboarding by choosing a language, location, training days, body information and a goal or maintenance mode. A gym is not required; home equipment can be selected.

To inspect the native functionality, start a workout, log a set and start the rest timer. Live Activities and local notification settings are available in More → Settings. Enable the corresponding system permissions, then lock the device to inspect the activity and rest alert. Native iOS notifications do not use the PWA’s push server.

The optional AI coach does not call an AI API. It copies or shares a summary at the user’s request; the user chooses an external assistant and pastes its reply back into Lift. Changes are previewed before applying them.

The app does not request HealthKit access. Body information and photos are manually entered or selected. Scientific references are listed under More → Program and evidence. Native web assets are bundled with the app; the PWA update prompt is disabled in native builds.

The native app does not load YouTube thumbnails or embedded players. Pinned video links open externally after the user selects them. The web/PWA edition retains YouTube thumbnails and embedded playback; those behaviors do not apply to the native build.

## App privacy answer for the native app

The audited native implementation supports **Data Not Collected**: training information remains on device, notifications are local, Live Activities use iOS, no ads or analytics SDKs are present, and no third-party media is embedded in the native interface. User-selected external links open outside Lift; exports and AI briefs are shared to destinations chosen by the user, without a Lift server or integrated AI service receiving them. No ATT prompt is needed for these implemented behaviors.

This answer applies to the final native build containing the external-video change, not the web/PWA edition. Recheck any future dependency or network changes before retaining the answer. Apple excludes data processed only on device from collection and distinguishes ordinary external web navigation from collection within embedded web content in its [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

## Remaining submission checks

- Verify both identifiers and signing profiles in the intended Apple Developer team. App Store export requires distribution signing, separately from Apple Development signing for local builds.
- Complete App Store Connect review contact information, age rating, content rights, pricing, availability and any applicable account agreements or trader information using the account holder’s actual information.
- Capture actual app UI with fictional data: at least one accepted 6.9-inch or 6.5-inch iPhone screenshot and one 13-inch iPad screenshot. Suggested portrait sizes: 1320 × 2868 and 2064 × 2752. No alpha channel.
- Verify the deployed privacy policy URL is public before submission.
- Verify the final native binary uses external YouTube links, with no remote thumbnails or embedded players, before applying the privacy answer above. The current code has no ads or analytics; no ATT prompt is implemented.
- Test photo selection and taking a photo on an actual iPhone. The image file inputs can offer the camera; camera usage descriptions must be present in the host app before invoking it.
- Verify backup export/import, calendar export, external links and video playback in the native app, not only in Safari.
- Confirm the archive contains the Capacitor/Cordova privacy manifests. No required-reason API use was found in the application’s own Swift code during the initial audit; declarations must match the final dependencies and binary.
- Run a native smoke test on both iPhone and iPad; upload and await processing before selecting the build for App Review.

Apple references: [review guidelines](https://developer.apple.com/app-store/review/guidelines/), [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).
