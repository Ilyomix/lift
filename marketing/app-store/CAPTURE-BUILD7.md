# Native capture handoff — build 7

Frozen release: build 7, source commit `2b2804b807f74e5dcb79725317da4a59fc82e231`, with the requested smooth faces without facial features. Both final native installations were confirmed by `.local-release/build7-final-smoke/install-handoff.json`; capture cutoff is `2026-10-03T10:52:27.674418Z`. Import only files explicitly delivered after that cutoff. This build replaces CSS picture motion with real GLB objects, introduces the real skinned human demonstrations and precise qualitative muscle regions, and uses the sculpted L icon. Title art uses 32 CSS px slots; standalone artwork uses 64 CSS px. Page title typography is reduced. Use the installed native build after its smoke test. Every UI movement in footage must come from the app, not from a Remotion imitation.

## Sources and delivery

Save full, uncropped PNG files in `.local-release/screenshots/`. French has no suffix; English adds `-en` before `.png`. Prefix with `iphone-` or `ipad-`. Dimensions: iPhone 1320 × 2868, iPad 2064 × 2752. Send an explicit list of finished files and build number after each batch. A filename existing on disk is not a handoff.

| Native filename stem | View to capture | Campaign slot |
| --- | --- | --- |
| `01-home` | Populated home, new app icon, dumbbell and section illustrations; active training and 8 completed sessions | 01 |
| `02-workout` | Fresh active workout, whole exercise name, 32 px title illustration, effort guidance and recorded first set | 02 |
| `03-live-activity` | Lock screen with new official icon, MM:SS below one minute, ghost segments, all actions visible | 05 |
| `04-timer` | Expanded DSEG timer with controls and next exercise visible | 04 |
| `05-plan` | Research/effort guidance expanded; preserve the whole card and its references | 07 |
| `06-calendar` | September with the eight completed sessions visible and the new 32 px calendar title illustration | 06 |
| `07-progress` | Chest press detail: graph plus history, the actual new page header | 03 |
| `08-exercise` | Native exercise sheet with real human 3D technique, stable representative pose, primary/secondary legend and useful cues; whole title visible | 08 |
| `09-gyms` | Open session gym selector at the bottom, selected gym and explanatory text visible | 09 |
| `10-backup` | Backup screen with 8 sessions / 8 measurements, export/import controls and new illustration | 10 |

Import the language-specific fixture through the real app UI so custom exercise notes also match the language. Use `.local-release/demo/lift-demo-fr.json` or `lift-demo-en.json`. Do not modify the rendered screenshot or create a runtime demo route.

Avoid Safari breadcrumbs, keyboards left open, permission alerts and unrelated system notifications. Wait for page transitions to finish. Capture a normal animation phase: objects must fit within their reserved boxes and remain sharp. Screenshots remain untouched source pixels.

## Recordings

Save native recordings in `.local-release/recordings/` using exactly:

```text
iphone-preview-workout-fr.mp4   iphone-preview-workout-en.mp4
iphone-preview-plan-fr.mp4      iphone-preview-plan-en.mp4
iphone-preview-live-fr.mp4      iphone-preview-live-en.mp4
ipad-preview-workout-fr.mp4     ipad-preview-workout-en.mp4
ipad-preview-plan-fr.mp4        ipad-preview-plan-en.mp4
ipad-preview-live-fr.mp4        ipad-preview-live-en.mp4
```

Record 25–60 seconds of real interaction where practical. Long takes are acceptable when tool latency is unavoidable; report approximate action times and preserve their chronology. Never speed up or edit the original recording. Marketing extracts twenty seconds with normal-speed cuts.

- **Workout:** open a verified exercise demonstration from the real session; let one complete human repetition play, then use the anatomy front/back control once if available. Close the sheet, record repetitions/effort, confirm, show the running rest timer. Film 45–90 seconds if needed. Final edit: technique at 0–8 s (stable real human at poster 5 s), set/effort at 8–12 s, recovery at 12–20 s. Preserve actual taps/transitions. Use only movements that passed their visual review; chest press or chest-supported row are preferred pilots. A separate same-device/language technique take can supplement the main take if tool latency requires it.
- **Plan:** populated September calendar; tap a completed day; open the saved workout history; open progress and the chest press curve. Give the calendar, history and graph 3–4 seconds each. Include actual navigation between them.
- **Live:** clean countdown below one minute; `+30`; `Skip/Passer`; `Resume/Reprendre`; wait at least three seconds after returning to the workout. Clear unrelated system notifications before filming. Capture the new logo and the real changing DSEG timer. A stable return to the app is more useful than a long lock-screen wait.

Phone and tablet have independent native sources. The same phone cut powers its App Store preview and vertical promo. Do not reuse a phone recording for iPad.

The final exercise stills use the lat pulldown in **Back/Dos** anatomy view, making the primary lat regions visible. The workout previews show its real animated technique before effort entry and the rest timer.

## Crop review required

Build 7 changes header type size, swaps the icon family for true 3D geometry, and adds the full human technique/anatomy panel. These changes affect home, workout, calendar, progress, guidance, backup and exercise sheets. Old pixel coordinates are not approvals. Recheck every final composition after import, especially phone calendar, progress/history, effort and backup; iPad gym sheets must stay fully visible. Preserve actual native gutters and complete text/buttons. The live card must be measured on the new source before using its crop.

## Freshness and state

Build 5 confirmed uploads remain archived under `.local-release/obsolete/build5-campaign/`; its sources/cuts are under `build5-sources/`. The interrupted build 6 manifest and matching rendered outputs are archived under `.local-release/obsolete/build6-campaign/`. Neither counts toward build 7. Old public files may remain on disk, but build/hash gates reject them rather than using them as fallbacks.

The current `.local-release/marketing/upload-ready.json` tracks the 58 current-release outputs. State advances per file: `pending` → `rendered` → `qa-approved` → `uploaded`. A render alone does not enter the approved gallery. `assets` contains only QA-approved or uploaded new versions; `pending` retains unfinished entries and their previous uploaded versions for traceability. Apple processing remains a separate field from confirmed receipt.

Before import, set source-requirements.json to status=ready with requiredBuild=7, exact sourceCommit, captureNotBefore from the finalized build/install and the current brand SHA. Set the local output manifest release to the same commit. Only the parent’s final native build handoff supplies these facts; do not invent them from the current dirty checkout. Then import only explicitly delivered files with LIFT_SOURCE_BUILD=7. The pipeline rejects pending releases, old timestamps, known old bytes, missing build/commit provenance and hashes changed after import. Create fresh video sidecars from each new take; never inherit old timecodes. Each sidecar includes sourceBuild, sourceCommit and sourceHashes for its primary and supplementary raw takes. The importer verifies these values and its timestamp, and rendering checks the imported cut hash again.

```sh
LIFT_SOURCE_BUILD=7 LIFT_LANG=fr LIFT_DEVICES=iphone LIFT_FEATURES=home,workout npm run sync:stills
LIFT_LANG=fr LIFT_DEVICES=iphone LIFT_FEATURES=home,workout npm run render:stills
```

Use the existing commercial layouts and copy. No demo/proof/build labels appear in final visuals. The first preview is workout, followed by plan and live, in both languages and device sets.

## Batch order and division

1. Native agent owns all four device/language sets: phone FR → phone EN → iPad FR → iPad EN, totaling 40 main PNGs, two phone History detail PNGs and 12 native recordings. The supplemental names are `iphone-07-progress-history.png` and `iphone-07-progress-history-en.png`; scroll until both History entries and the card's bottom border are fully visible. They supply the second crop in the same progress composition, with independent hash provenance. Native has exclusive UI control and delivers finished filenames explicitly in small batches, beginning after final installation/smoke and the confirmed cutoff.
2. Each set includes nine app views, the Live Activity view, and three real video themes. Import the matching fixture through Backup so custom notes also have the right language. No parallel capture or competing UI actor.
3. Marketing imports and composes explicitly delivered PNGs as they arrive, validates dimensions/opaque RGB, then inspects every crop. No CUA during native capture. Heavy video import/encoding waits until the native agent finishes recording or gives an explicit compute window.
4. Render the twelve App Store previews before the six social promos so Apple processing can start early. The Live agent checks the final IPA independently; it does not own a separate capture lot in this pass.
5. Parent uploads only QA-approved hashes; order screenshots 01–10 and videos workout / plan / live in all four device/locale sets. Multi-file upload completion order is not reliable; verify/reorder in ASC.

## Reproduction and completion record

The pipeline includes four localized screenshot layout sets, branded preview/promo compositions, native edit and codec validation, exact source/cut/brand hashes, the 58-entry output manifest, old-byte blacklist, gallery allowlist and exact-hash QA/upload state machine. The original install handoff supplies the commit and capture cutoff above. Each later capture batch is certified in `.local-release/native-media-status.json`.

Every final crop is recalculated from the new native images. Each preview uses a fresh chronological cut list, matched benefit-caption timing and an actual decoded poster at five seconds. Review and Apple receipt are independent: only explicitly reviewed current hashes enter the gallery; only confirmed App Store receipts enter the upload records. Do not turn stills into an ersatz preview or reuse old timecodes.

The final `npm run package:media` gate requires all 58 assets reviewed, with no pending entries. It verifies bytes, posters and provenance, then packages the current gallery and media with a concise hash manifest. Private capture evidence and superseded media are excluded.

## Apple handoff

Version 1.0 (7), binary source `2b2804b807f74e5dcb79725317da4a59fc82e231`, was submitted on 3 October 2026 at 14:47 Europe/Paris. App Store Connect confirmed « En attente de vérification », submission `e016c93c-5b8d-4f39-9718-977749bb3f0d`. The submission includes all 40 screenshots and 12 previews, in the checked order 01–10 and workout / plan / live for each locale/device. Evidence: `.local-release/app-store-build7-submitted.png` and the four device/locale receipt pairs. Automatic release follows Apple approval; submission is not publication. Individual preview-processing indicators were not all rechecked after Apple accepted the submission.

## Completed media package

All captures and reviews are complete: 40 canonical native screenshots plus two phone History supplements, 12 independent native recordings, and 58 final commercial assets. All 58 final hashes passed visual and format QA; all 52 App Store assets have confirmed upload receipts. The six social promos remain separate campaign deliverables. `.local-release/marketing/upload-ready.json` has no pending entries. The final gallery and `.local-release/Lift-App-Store-build7-FR-EN.zip` include only those verified hashes; 12 decoded poster frames and the concise delivery manifest accompany the 58 media files.

Final source checks passed: ESLint, TypeScript, six freshness/chronology/provenance tests, packaging-script syntax and `git diff --check`. PNGs are opaque RGB at the specified device dimensions; video formats, frame counts, audio and encoding profiles are checked by the renderer. The package script re-verifies all hashes and the exact ZIP entry list.
