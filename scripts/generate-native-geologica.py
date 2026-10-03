#!/usr/bin/env python3
"""Instance the official Geologica 1.010 face; requires fonttools==4.62.1."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

source = (
    "https://raw.githubusercontent.com/googlefonts/geologica/"
    "685f38d7c9e86b0c8530204c97ddcaf6558dd17b/fonts/variable/"
    "Geologica%5BCRSV,SHRP,slnt,wght%5D.ttf"
)
data = urlopen(source, timeout=30).read()
assert sha256(data).hexdigest() == "9124d9e88ac6c11d761f35241713a51d68e2c4ebedce0edaca834717a00959ec"
directory = Path(__file__).resolve().parents[1] / "ios/App/LiftActivity/Fonts"
for weight in [500, 600, 700]:
    font = TTFont(BytesIO(data), recalcTimestamp=False)
    instantiateVariableFont(
        font, {"wght": weight, "CRSV": 0, "SHRP": 0, "slnt": 0},
        inplace=True, updateFontNames=True,
    )
    font.save(directory / (font["name"].getDebugName(6) + ".ttf"))
