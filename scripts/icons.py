"""Generate Lift app icons: a mechanical dial (weight plate) with a blue progress arc on navy."""
import math
import os
from PIL import Image, ImageDraw

S = 4096  # supersampled canvas
TOP = (13, 22, 42)       # navy, lit from the top
BOTTOM = (5, 8, 16)      # near-black navy
PAPER = (232, 238, 251, 255)
SIGNAL = (61, 123, 255, 255)


def background(size):
    grad = Image.new('RGB', (1, 256))
    for y in range(256):
        t = y / 255
        grad.putpixel((0, y), tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    return grad.resize((size, size), Image.BICUBIC).convert('RGBA')


def dial(im, ring=PAPER, arc=SIGNAL, gap=True, scale=1.0):
    d = ImageDraw.Draw(im)
    c = S / 2
    R, r = S * 0.322 * scale, S * 0.225 * scale  # ring outer / inner radius
    w = int(R - r)
    box = [c - R + w / 2, c - R + w / 2, c + R - w / 2, c + R - w / 2]
    # Hairline cuts at both ends of the arc, showing the background through.
    half = math.degrees((S * 0.006) / ((R + r) / 2)) if gap else 0
    d.arc(box, 30 + half, 270 - half, fill=ring, width=w)
    d.arc(box, -90 + half, 30 - half, fill=arc, width=w)  # progress: one third of the dial
    hub = S * 0.052 * scale
    d.ellipse([c - hub, c - hub, c + hub, c + hub], fill=ring)
    return im


def icon():
    im = background(S)
    return dial(im)


os.makedirs('public/icons', exist_ok=True)
big = icon()
for name, size in [('pwa-512.png', 512), ('pwa-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-64.png', 64)]:
    big.resize((size, size), Image.LANCZOS).convert('RGB').save(f'public/icons/{name}', optimize=True)

# Maskable: the dial inside the 80 % safe zone.
mask = dial(background(S), scale=0.8)
mask.resize((512, 512), Image.LANCZOS).convert('RGB').save('public/icons/maskable-512.png', optimize=True)

# Notification badge: white silhouette on transparent (Android shows it in the status bar).
badge = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dial(badge, ring=(255, 255, 255, 255), arc=(255, 255, 255, 255), gap=False, scale=1.25)
badge.resize((96, 96), Image.LANCZOS).save('public/icons/badge-96.png', optimize=True)
print('icons ok')
