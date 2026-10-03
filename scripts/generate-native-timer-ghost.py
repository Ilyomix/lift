#!/usr/bin/env python3
"""Build Lift timer faces from DSEG 0.46; requires fonttools==4.62.1.

Both fonts preserve the official segment outlines and add contextual minute
padding. The ghost replaces decimal outlines with eight. System countdown Text
views therefore keep time, leading zeroes and unlit segments in sync themselves.
Derived from DSEG by keshikan under SIL OFL 1.1; primary font names are renamed.
"""

from copy import deepcopy
from pathlib import Path

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
directory = root / "ios/App/LiftActivity/Fonts"


def build(ghost: bool) -> None:
    font = TTFont(directory / "DSEG7ClassicMini-BoldItalic.ttf", recalcTimestamp=False)
    cmap = font.getBestCmap()
    digits = [cmap[ord(c)] for c in "0123456789"]
    eight = cmap[ord("8")]
    if ghost:
        for name in digits:
            assert font["hmtx"][name][0] == font["hmtx"][eight][0]
            font["glyf"][name] = deepcopy(font["glyf"][eight])
            font["hmtx"][name] = font["hmtx"][eight]

    advance, bearing = font["hmtx"][digits[0]]
    for name in digits:
        pen = TTGlyphPen(font.getGlyphSet())
        pen.addComponent(digits[0], (1, 0, 0, 1, 0, 0))
        pen.addComponent(name, (1, 0, 0, 1, advance, 0))
        padded = name + ".padMinute"
        font["glyf"][padded] = pen.glyph()
        font["hmtx"][padded] = (advance * 2, bearing)

    # Only a single digit immediately before ':' receives a leading zero.
    # The ignore rule leaves 10:00, 100:00, etc. unchanged as they count down.
    rules = ["@digits = [" + " ".join(digits) + "];", "feature calt {"]
    rules.append("ignore sub @digits @digits' colon;")
    rules.extend(f"sub {name}' colon by {name}.padMinute;" for name in digits)
    rules.append("} calt;")
    addOpenTypeFeaturesFromString(font, "\n".join(rules))

    family = "Lift Segment Ghost" if ghost else "Lift Timer"
    postscript = "LiftSegmentGhost-BoldItalic" if ghost else "LiftTimer-BoldItalic"
    names = {
        1: family,
        2: "Bold Italic",
        3: family + " Bold Italic 1.100",
        4: family + " Bold Italic",
        5: "Version 1.100",
        6: postscript,
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font["name"].setName(
        "Modified for Lift, 2026: contextual leading-zero minute glyphs; "
        + ("decimal outlines replaced by eight; " if ghost else "")
        + "renamed " + family + ". Based on DSEG7 Classic Mini Bold Italic 0.46 "
        "by keshikan. Original copyright and SIL OFL 1.1 retained. "
        "See DSEG-LICENSE.txt and scripts/generate-native-timer-ghost.py.",
        10, 3, 1, 0x409,
    )
    font.save(directory / (postscript + ".ttf"))


build(ghost=False)
build(ghost=True)
