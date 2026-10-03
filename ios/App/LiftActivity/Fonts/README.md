# Native timer fonts

`DSEG7ClassicMini-BoldItalic.ttf` is the unmodified official DSEG 0.46 face by
keshikan, from https://github.com/keshikan/DSEG/releases/download/v0.46/fonts-DSEG_v046.zip.
It matches the face used by the app's web timer.
Its copyright and SIL Open Font License 1.1 are in
`src/assets/fonts/DSEG-LICENSE.txt`, also bundled with the extension.

`LiftTimer-BoldItalic.ttf` and `LiftSegmentGhost-BoldItalic.ttf` are modified
fonts under the same license, renamed to avoid the original reserved font name.
Both add contextual glyph substitution: a single minute digit before a colon is
drawn as a zero plus that digit. Minutes with two or more digits stay unchanged.
The ghost also replaces each decimal digit's outline with the original eight.
The original outlines, vertical metrics, character mapping and punctuation stay
intact; added glyphs use exactly two digit advances. Embedded metadata retains
the original copyright/license and describes the Lift modifications (2026).

Rebuild from the repository root with Python and `fonttools==4.62.1`:

```sh
python3 scripts/generate-native-timer-ghost.py
```

The ghost and visible digits use identical system countdown intervals. This
keeps the unlit segments aligned when the number of minutes changes, while iOS
continues to update the Live Activity with the app suspended.

`Geologica-Medium.ttf`, `Geologica-SemiBold.ttf` and `Geologica-Bold.ttf` use
the app's Geologica family for labels. They are instances at weights 500, 600
and 700, with the other axes at their upright defaults, from the official
[Geologica 1.010 source](https://github.com/googlefonts/geologica/tree/685f38d7c9e86b0c8530204c97ddcaf6558dd17b).
The full character set includes French accents and user exercise names.
The existing `src/assets/fonts/Geologica-LICENSE.txt` is bundled as well.
To reproduce the instances from the pinned source and verified checksum:

```sh
python3 scripts/generate-native-geologica.py
```
