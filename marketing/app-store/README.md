# Lift — App Store campaign

French and English campaign in the official Lift blue, ink and Geologica typeface. Source UI is captured from the application. No interface, graph, counter or workout result is reconstructed in Remotion.

## Current status

- The revised art direction opens with three distinct compositions: electric blue program, ice white workout and a close-up of progress history. A full-screen rest dial follows. Nine browser capture angles per language are complete. Native capture of the final release build is now in progress.
- Browser captures in `public/proofs/` are **design proofs only**. They must not be uploaded as validated native App Store screenshots or used as native app previews.
- Native source folders are being populated from the final release build, including the new interactive Live Activity. The original empty-profile and obsolete-widget screenshots were removed; `source-requirements.json` blocks re-importing their exact bytes. The first home capture is available for crop review; a cleaner capture without the Safari return breadcrumb is pending.
- Video compositions and export pipeline are ready. Final renders require the six actual native screen recordings listed below. A missing recording fails the render; nothing substitutes a slideshow or browser recording.
- Final screenshots, promos and previews contain only consumer-facing copy. Demo/proof/source status stays in this README, internal boards and manifests, never stamped on an individual campaign asset.

## Deliverables

| Format | Dimensions | Count |
| --- | --- | --- |
| iPhone screenshot | 1320 × 2868 PNG | 10 per language |
| iPad screenshot | 2064 × 2752 PNG | Up to 10 per language, only where the matching native source exists |
| App Store preview | 886 × 1920, 20 s, 30 fps | 3 per language |
| Vertical promo | 1080 × 1920, 20 s, 30 fps | 3 per language |

Preview videos use chronological cuts of real native screen recordings at normal speed. Promos use the same cuts with a brief animated headline and closing panel. No music is used. Final FFmpeg exports target H.264 High, 10 Mbps (12 Mbps maximum), progressive YUV 4:2:0, silent stereo AAC at 256 kbps/48 kHz. App Store previews use level 4.0; vertical promos use level 4.1. The script verifies codec, dimensions, frame rate, profile, audio, duration and size via FFprobe. Silent AAC may report a low measured average bitrate despite the 256 kbps encoder target.

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

Use the `ipad-` prefix for tablet sources. Append `-en` before `.png` for English; French has no suffix. Capture the expanded timer; record effort guidance, populated history and the latest Live Activity actions. Preserve the whole screenshot file. The compositions can enlarge faithful regions of those source pixels without rewriting them.

Native recordings in `.local-release/recordings/` must be at least 20 seconds:

```text
iphone-preview-workout-fr.mp4  iphone-preview-workout-en.mp4
iphone-preview-live-fr.mp4     iphone-preview-live-en.mp4
iphone-preview-plan-fr.mp4     iphone-preview-plan-en.mp4
```

Storyboard: `workout` starts a session and records a set/effort; `live` uses the real timer and lock-screen actions; `plan` explores calendar/history/progress. Capture smoothly, avoid permission dialogs and personal notifications, and preserve genuine UI movement. Aim for shots of 3–5 seconds in the finished edit. Long takes are fine: preserve the rushes and cut waiting time using the sidecar below.

A recording can have a matching `.segments.json` file beside it, such as `iphone-preview-workout-fr.segments.json`. Times are seconds into the untouched source. Example structure (replace these example timecodes after watching the actual rush):

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

Cuts must remain chronological, fit inside the source, align to 30 fps frames and total 20 seconds. The pipeline validates this, imports the sidecar with the recording, and applies identical cuts to preview and promo. Missing sidecars explicitly default to the first 20 seconds; review before publication. Each App Store preview also exports a `*.poster.png` from the actual encoded frame at 5 seconds: choose the cuts so this frame shows readable UI, clear of transitions or the keyboard. The generated `*.props.json` in the output directory also lets you inspect the exact edit in Studio (`npx remotion studio --props=/absolute/path/to/workout.props.json`). Neither labels nor timecodes are printed onto the video.

```sh
# Full native source import; fails if a requested screenshot is missing.
npm run sync:assets

# Example while only native iPad home/workout are available:
LIFT_DEVICES=ipad LIFT_FEATURES=home,workout npm run sync:assets
LIFT_DEVICES=ipad LIFT_FEATURES=home,workout npm run render:stills

# Render final iPhone screenshots / all six native previews and six promos.
LIFT_DEVICES=iphone npm run render:stills
npm run render:videos

# Import and render a newly delivered recording without waiting for screenshots.
LIFT_LANG=fr LIFT_THEMES=live npm run sync:recordings
LIFT_LANG=fr LIFT_THEMES=live npm run render:videos

# Internal design board, using isolated browser proof assets.
npm run render:proof

# Nine clean individual browser proofs per language and internal contact sheets.
npm run render:proofs
```

`LIFT_LANG=fr` or `en` limits a run. `REMOTION_BROWSER_EXECUTABLE=/absolute/browser/path` uses an installed Chromium browser; otherwise Remotion uses its normal browser resolution. `LIFT_FEATURES` accepts the comma-separated feature keys in `src/campaign.ts`. `LIFT_THEMES=plan`, `workout` or `live` limits video imports/renders to available footage; comma-separated values are supported.

All outputs go to the ignored `.local-release/marketing/` directory. Syncing records source paths, file timestamps and SHA-256 hashes in `public/source-manifest.json`. Set `LIFT_SOURCE_BUILD` to the capture agent's verified build reference to include that provenance. Never upload a file solely because it rendered: inspect the final native source, screenshot crops, localized text and complete video playback first.

## Assets and ownership

- `public/brand/icon.png`: official app icon copied from the iOS asset catalog.
- `public/brand/geologica.woff2`: bundled app font; license alongside it.
- `public/screenshots/`: real native screenshots; only fictional marketing data.
- `public/proofs/`: real browser captures via the app UI; only fictional marketing data.
- `public/recordings/`: real native app recordings supplied by the simulator capture workflow.
- Output videos and renders are not committed. No credentials, signing material or personal datasets belong here.

Apple requirements reference: <https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications>.
