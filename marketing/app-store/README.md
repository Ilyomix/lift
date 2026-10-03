# Lift — App Store campaign

French and English campaign in the official Lift blue, ink and Geologica typeface. Source UI is captured from the application. No interface, graph, counter or workout result is reconstructed in Remotion.

## Current status

- All 40 native source screenshots and 12 preview scenarios have been captured in French and English on iPhone and iPad. Real recordings are edited into action-led previews; short benefit captions sit above genuine device footage. iPad footage is captured independently of iPhone footage.
- The exact accepted outputs, source hashes and confirmed App Store Connect upload positions live in the ignored `.local-release/marketing/upload-ready.json`. Uploaded versions needing a new crop are preserved with their hashes and moved to `pending`; the gallery contains accepted versions only.
- All four Live Activity source images use the reviewed MM:SS timer, ghost segments and Geologica labels. Previous widget images and recordings are blocked by hash in `source-requirements.json`; they must not be restored as fallbacks.
- Home/workout sources include the requested native 3D design. Other screens were reviewed against the final app views; original capture build references remain in the source manifest. Never infer readiness merely from a source filename.
- Browser captures in `public/proofs/` are internal design proofs only, never native App Store screenshots or preview footage. Final campaign assets have no demo, proof or source-status stamp.

## Deliverables

| Format | Dimensions | Count |
| --- | --- | --- |
| iPhone screenshot | 1320 × 2868 PNG | 10 per language |
| iPad screenshot | 2064 × 2752 PNG | 10 per language |
| iPhone App Store preview | 886 × 1920, 20 s, 30 fps | 3 per language |
| iPad App Store preview | 1200 × 1600, 20 s, 30 fps | 3 per language, native iPad sources required |
| Vertical promo | 1080 × 1920, 20 s, 30 fps | 3 per language |

Preview videos use chronological cuts of real native screen recordings at normal speed, with three brief localized benefit captions in a separate header. For iPad lock-screen actions, an optional `focus: "live"` segment enlarges the actual footage twofold around the Live Activity; the return to the app uses the full frame. Promos use the same cuts with a brief animated headline and closing panel. No music is used. Final FFmpeg exports target H.264 High, 10 Mbps (12 Mbps maximum), progressive YUV 4:2:0, silent stereo AAC at 256 kbps/48 kHz. App Store previews use level 4.0; vertical promos use level 4.1. The script verifies codec, dimensions, frame rate, profile, audio, duration and size via FFprobe. Silent AAC may report a low measured average bitrate despite the 256 kbps encoder target.

## Reproduce

Use Node.js and npm. FFmpeg/FFprobe must be on PATH, or set `FFMPEG` and `FFPROBE` to their executable paths. Root app dependencies must also be installed to generate the fixture.

```sh
cd marketing/app-store
npm ci
npm run lint
npm run demo
```

The fictional adult gym profile is generated with the shipping app's `stateFromOnboarding`, `prescribeSession`, `finishedState`, `makeBackup` and `parseBackup` helpers. It contains eight completed sessions, conservative load changes and stable measurements. Dates are intentionally pinned to 3 October 2026. No photos, identity or personal user data is included. Files are written to `.local-release/demo/lift-demo-fr.json` and `lift-demo-en.json`. `npm run demo:serve` serves only these two files on `127.0.0.1:43125` as downloads. Open the URL in simulator Safari, save to Downloads, then import through the real app's Backup screen and capture actual use. This generator is outside the shipping app and is never bundled into it.

Capture names in `.local-release/screenshots/`:

```text
iphone-01-home.png        iphone-02-workout.png
iphone-03-live-activity.png   iphone-04-timer.png
iphone-05-plan.png        iphone-06-calendar.png
iphone-07-progress.png    iphone-08-exercise.png
iphone-09-gyms.png        iphone-10-backup.png
```

Use the `ipad-` prefix for tablet sources. Append `-en` before `.png` for English; French has no suffix. Capture the expanded timer; record effort guidance, populated history and the latest Live Activity actions. Preserve the whole screenshot file. The compositions can enlarge faithful regions of those source pixels without rewriting them. Crops retain the actual native gutters, plus enough source space above and below text. Never trim to the card content edge or paint new UI padding.

Native recordings in `.local-release/recordings/` must be at least 20 seconds:

```text
iphone-preview-workout-fr.mp4  iphone-preview-workout-en.mp4
iphone-preview-live-fr.mp4     iphone-preview-live-en.mp4
iphone-preview-plan-fr.mp4     iphone-preview-plan-en.mp4
```

For iPad, use the same six names with an `ipad-` prefix. A phone recording is never used in an iPad preview. iPad previews are saved in `<lang>/preview-ipad/`; vertical promos use iPhone sources.

Storyboard: `workout` starts a session and records a set/effort; `live` uses the real timer and lock-screen actions; `plan` explores calendar/history/progress. Capture smoothly, avoid permission dialogs and personal notifications, and preserve genuine UI movement. Aim for shots of 3–5 seconds in the finished edit. Long takes are fine: preserve the rushes and cut waiting time using the sidecar below.

A recording can have a matching `.segments.json` file beside it, such as `iphone-preview-workout-fr.segments.json`. The importer first decodes the complete native take into H.264 at 30 fps, retaining original dimensions and real-time playback. This avoids inconsistent seeking in HEVC variable-frame-rate simulator captures. The source manifest retains both original and normalized hashes. Inspect the normalized file in `public/recordings/` and use seconds on that timeline for the cuts; no UI content is reconstructed. Example structure (replace these example timecodes after watching the actual rush):

```json
{
  "fps": 30,
  "segments": [
    { "start": 2, "duration": 4, "label": "Open the workout" },
    { "start": 12, "duration": 4, "label": "Choose the load" },
    { "start": 24, "duration": 4, "label": "Log repetitions" },
    { "start": 36, "duration": 4, "label": "Set effort" },
    { "start": 48, "duration": 4, "label": "Confirm and recover" }
  ]
}
```

Cuts must remain chronological within each source take, fit inside the source, align to 30 fps frames and total 20 seconds. A segment can specify `source: "ipad-preview-plan-detail-en.mp4"` to use a complementary native take in the same recording directory. The importer verifies matching device, language and dimensions, normalizes the extra take, and records its original and normalized hashes. Paths outside the recording directory are rejected. The pipeline validates this, imports the sidecar with the recording, and applies identical cuts to preview and promo. Missing sidecars explicitly default to the first 20 seconds; review before publication. Each App Store preview also exports a `*.poster.png` from the actual encoded frame at 5 seconds, including the short benefit caption: choose the cuts so this frame shows readable UI, clear of transitions or the keyboard. The generated `*.props.json` in the output directory also lets you inspect the exact edit in Studio (`npx remotion studio --props=/absolute/path/to/workout.props.json`). Neither labels nor timecodes are printed onto the video.

For a long take whose cuts have already been reviewed, set `LIFT_IMPORT_EDIT_ONLY=1` during `sync:recordings`. FFmpeg decodes only those actual time ranges at normal speed into a 20-second source, preserving native dimensions and CRF 16 quality. The public sidecar then uses cumulative timecodes on that edited source; `originalSegments` and all raw-source hashes remain in `public/source-manifest.json`. The local sidecar always retains the original timecodes, so importing again is reproducible. This mode requires an explicit valid sidecar. `LIFT_NORMALIZATION_PRESET` defaults to `veryfast` with four encoder threads; `medium` is available when smaller local source files matter more than import time.

```sh
# Full native source import; fails if a requested screenshot is missing.
npm run sync:assets

# Example while only native iPad home/workout are available:
LIFT_DEVICES=ipad LIFT_FEATURES=home,workout npm run sync:stills
LIFT_DEVICES=ipad LIFT_FEATURES=home,workout npm run render:stills

# Render final iPhone screenshots / twelve device previews and six promos.
LIFT_DEVICES=iphone npm run render:stills
npm run render:videos

# Import and render a newly delivered recording without waiting for screenshots.
LIFT_LANG=fr LIFT_DEVICES=iphone LIFT_THEMES=live npm run sync:recordings
LIFT_LANG=fr LIFT_DEVICES=iphone LIFT_THEMES=live npm run render:videos

# Prioritize App Store processing; render social promos afterwards.
LIFT_VIDEO_KINDS=Preview npm run render:videos
LIFT_DEVICES=iphone LIFT_VIDEO_KINDS=Promo npm run render:videos

# Internal design board, using isolated browser proof assets.
npm run render:proof

# Nine clean individual browser proofs per language and internal contact sheets.
npm run render:proofs
```

`sync:stills` imports only screenshots; use it during partial capture delivery so a recording still being filmed is not imported accidentally. `sync:assets` imports both source types. `LIFT_LANG=fr` or `en` limits a run. `REMOTION_BROWSER_EXECUTABLE=/absolute/browser/path` uses an installed Chromium browser; otherwise Remotion uses its normal browser resolution. `LIFT_FEATURES` accepts the comma-separated feature keys in `src/campaign.ts`. `LIFT_DEVICES=iphone` or `ipad` also limits video imports/renders. `LIFT_THEMES=plan`, `workout` or `live` limits video imports/renders to available footage; comma-separated values are supported.

All outputs go to the ignored `.local-release/marketing/` directory. Syncing records source paths, file timestamps and SHA-256 hashes in `public/source-manifest.json`. Set `LIFT_SOURCE_BUILD` to the capture agent's verified build reference to include that provenance. Never upload a file solely because it rendered: inspect the final native source, screenshot crops, localized text and complete video playback first.

## Assets and ownership

- `public/brand/icon.png`: official app icon copied from the iOS asset catalog.
- `public/brand/geologica.woff2`: bundled app font; license alongside it.
- `public/screenshots/`: real native screenshots; only fictional marketing data.
- `public/proofs/`: real browser captures via the app UI; only fictional marketing data.
- `public/recordings/`: real native app recordings supplied by the simulator capture workflow. Large MP4 takes are ignored by Git; retain the local rushes separately. Edit sidecars and original/normalized SHA-256 values remain versioned.
- Output videos and renders are not committed. No credentials, signing material or personal datasets belong here.

## Final local gallery

After actual visual and format review, list the accepted outputs in `.local-release/marketing/upload-ready.json` (`version: 1`, `assets: []`). Each entry has `reviewed: true`, `lang` (`fr`/`en`), `kind` (`screenshot`/`preview`/`promo`), a readable `title`, `path` relative to that output directory and its exact `sha256`. Screenshots also specify `device` (`iphone`/`ipad`); videos can specify `poster: { path, sha256 }`.

After a confirmed App Store Connect upload, record `upload: { destination: "app-store-connect", status: "uploaded", position: 1, confirmedAt: "ISO timestamp" }` on that exact hashed asset. The gallery marks it as already sent so subsequent batches do not duplicate it. Do not infer an upload from a render or a file-chooser action.

`npm run gallery` verifies those file hashes before producing the static `index.html`; missing approval, modified files, empty manifests and browser-proof paths are rejected. It never discovers or includes unfinished files automatically. `npm run gallery:serve` then serves the gallery on `http://127.0.0.1:43127`, with language/format filters, actual download links and video players. The server allows only the gallery and listed files, and supports video seeking. No gallery is generated until the first final asset passes review.

Apple requirements reference: <https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications>.
