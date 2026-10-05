"""Export Lift launcher icons from the orange and blue opaque 1024px masters.

Run from any directory with Python 3 and Pillow: python3 scripts/icons.py.
The master and its generation provenance are intentionally kept in the repo.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "public/icons"
MASTER = ICONS / "app-icon-1024.png"
BLUE_MASTER = ICONS / "app-icon-blue-1024.png"
RES = ROOT / "android/app/src/main/res"
LANCZOS = Image.Resampling.LANCZOS


def save(image, path, size=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if size is not None:
        image = image.resize((size, size), LANCZOS)
    image.save(path, format="PNG", optimize=True)


def padded(image, scale):
    """Inset the artwork and extend its edge colors, without an inset tile.

    The original accent background reaches every edge. Repeating only those
    outermost colors preserves a seamless opaque background around the inset.
    """
    size = image.width
    inner = round(size * scale)
    inset = (size - inner) // 2
    tile = image.resize((inner, inner), LANCZOS)
    out = tile.resize((size, size), Image.Resampling.NEAREST)
    out.paste(tile, (inset, inset))
    out.paste(tile.crop((0, 0, inner, 1)).resize((inner, inset)), (inset, 0))
    out.paste(tile.crop((0, inner - 1, inner, inner)).resize((inner, size - inner - inset)), (inset, inset + inner))
    out.paste(out.crop((inset, 0, inset + 1, size)).resize((inset, size)), (0, 0))
    out.paste(out.crop((inset + inner - 1, 0, inset + inner, size)).resize((size - inner - inset, size)), (inset + inner, 0))
    # Soften only the backdrop join; the subject is well inside this 4% edge band.
    # This prevents straight seams from the source background's light variation.
    backdrop = out.filter(ImageFilter.GaussianBlur(size * 0.015))
    band = max(1, round(inner * 0.04))
    edge_mask = Image.new("L", tile.size)
    edge_mask.putdata([
        min(255, round(255 * min(x, y, inner - 1 - x, inner - 1 - y) / band))
        for y in range(inner) for x in range(inner)
    ])
    backdrop.paste(tile, (inset, inset), edge_mask)
    return backdrop


def circular(image):
    mask = Image.new("L", image.size)
    ImageDraw.Draw(mask).ellipse((0, 0, image.width - 1, image.height - 1), fill=255)
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def notification_badge(image):
    """White silhouette required by Android/Web Push, from the same master.

    The saturated blue backdrop is excluded by blue-channel dominance. This
    mask affects only the monochrome notification badge, never launcher art.
    """
    red, green, blue = image.split()
    blue_dominance = ImageChops.subtract(blue, ImageChops.lighter(red, green))
    alpha = blue_dominance.point(lambda value: max(0, min(255, (48 - value) * 10)))
    out = Image.new("RGBA", image.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


def main():
    with Image.open(MASTER) as source:
        if source.size != (1024, 1024):
            raise ValueError("app-icon-1024.png must be a 1024 × 1024 square")
        if "A" in source.getbands() and source.getchannel("A").getextrema() != (255, 255):
            raise ValueError("The launcher master must be fully opaque")
        master = source.convert("RGB")

    with Image.open(BLUE_MASTER) as source:
        if source.size != (1024, 1024):
            raise ValueError("app-icon-blue-1024.png must be a 1024 × 1024 square")
        blue = source.convert("RGB")

    for artwork, suffix in ((master, ""), (blue, "-blue")):
        for name, size in (("pwa-512", 512), ("pwa-192", 192),
                           ("apple-touch-icon", 180), ("favicon-64", 64)):
            save(artwork, ICONS / f"{name}{suffix}.png", size)
        save(padded(artwork, 0.76), ICONS / f"maskable-512{suffix}.png", 512)

    # Keep the complete monogram inside the circular 80% PWA safe zone.
    maskable = padded(master, 0.76)
    # The original blue master supplies the unchanged monochrome silhouette.
    save(notification_badge(blue), ICONS / "badge-96.png", 96)
    save(master, ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
    save(blue, ROOT / "ios/App/App/Assets.xcassets/AppIconBlue.appiconset/AppIconBlue.png")
    save(master, ROOT / "marketing/app-store/public/brand/icon.png")

    # Adaptive icons use a 108dp canvas, with the essential mark in the central
    # 66dp safe circle. Edge extension prevents a colored border under masking.
    adaptive = padded(master, 0.58)
    for density, legacy_size, adaptive_size in (
        ("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432),
    ):
        target = RES / f"mipmap-{density}"
        save(master, target / "ic_launcher.png", legacy_size)
        save(circular(maskable), target / "ic_launcher_round.png", legacy_size)
        save(adaptive, target / "ic_launcher_foreground.png", adaptive_size)

    print("Lift icons exported: orange primary, blue alternate")


if __name__ == "__main__":
    main()
