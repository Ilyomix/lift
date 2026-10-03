# Native timer fonts

`DSEG7ClassicMini-BoldItalic.ttf` is the unmodified official DSEG 0.46 face by
keshikan, from https://github.com/keshikan/DSEG/releases/download/v0.46/fonts-DSEG_v046.zip.
It matches the face used by the app's web timer.
Its copyright and SIL Open Font License 1.1 are in
`src/assets/fonts/DSEG-LICENSE.txt`, also bundled with the extension.

`LiftSegmentGhost-BoldItalic.ttf` is a modified font under the same license,
renamed to avoid the original reserved font name. The Lift modification (2026)
replaces each decimal digit's outline with the original eight, retaining advance
widths, vertical metrics, character mapping and punctuation. Its embedded font
metadata preserves the original copyright/license and describes the modification.

Rebuild from the repository root with Python and `fonttools==4.62.1`:

```sh
python3 scripts/generate-native-timer-ghost.py
```

The ghost and visible digits use identical system countdown intervals. This
keeps the unlit segments aligned when the number of minutes changes, while iOS
continues to update the Live Activity with the app suspended.
