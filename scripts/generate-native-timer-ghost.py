#!/usr/bin/env python3
"""Build Lift's unlit segment face; requires fonttools==4.62.1.

Derived from DSEG7 Classic Mini Bold Italic by keshikan under SIL OFL 1.1.
The renamed face deliberately renders every decimal digit as an eight.
Two system countdown Text views can then share exact layout and timing,
including changes in minute width, without an app-driven update loop.
"""

from copy import deepcopy
from pathlib import Path

from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
directory = root / "ios/App/LiftActivity/Fonts"
font = TTFont(directory / "DSEG7ClassicMini-BoldItalic.ttf", recalcTimestamp=False)
cmap = font.getBestCmap()
eight = cmap[ord("8")]
for digit in "0123456789":
    name = cmap[ord(digit)]
    assert font["hmtx"][name][0] == font["hmtx"][eight][0]
    font["glyf"][name] = deepcopy(font["glyf"][eight])
    # Advance widths stay identical; the side bearing follows the new outline.
    font["hmtx"][name] = font["hmtx"][eight]

names = {
    1: "Lift Segment Ghost",
    2: "Bold Italic",
    3: "Lift Segment Ghost Bold Italic 1.000",
    4: "Lift Segment Ghost Bold Italic",
    5: "Version 1.000",
    6: "LiftSegmentGhost-BoldItalic",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font["name"].setName(
    "Modified for Lift, 2026: decimal digit outlines replaced by the eight "
    "outline; renamed Lift Segment Ghost. Based on DSEG7 Classic Mini Bold "
    "Italic 0.46 by keshikan. Original copyright and SIL OFL 1.1 retained. "
    "See DSEG-LICENSE.txt and scripts/generate-native-timer-ghost.py.",
    10, 3, 1, 0x409,
)
font.save(directory / "LiftSegmentGhost-BoldItalic.ttf")
