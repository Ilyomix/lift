"""Generate Golgoth app icons: a mechanical dial (weight plate) with an orange progress arc."""
from PIL import Image, ImageDraw
import os
S = 4096  # supersampled canvas
INK = (11, 11, 14, 255)
PAPER = (237, 237, 234, 255)
SIGNAL = (255, 123, 0, 255)
def icon():
    im = Image.new('RGBA', (S, S), INK)
    d = ImageDraw.Draw(im)
    c = S / 2
    R, r = S * 0.322, S * 0.225          # ring outer / inner radius
    w = int(R - r)
    box = [c - R + w / 2, c - R + w / 2, c + R - w / 2, c + R - w / 2]
    d.arc(box, 0, 360, fill=PAPER, width=w)
    d.arc(box, -90, 30, fill=SIGNAL, width=w)           # progress: one third of the dial
    # hairline gap separating the signal arc from the paper ring
    import math
    for ang in (-90, 30):
        a = math.radians(ang)
        x0, y0 = c + (r - 8) * math.cos(a), c + (r - 8) * math.sin(a)
        x1, y1 = c + (R + 8) * math.cos(a), c + (R + 8) * math.sin(a)
        d.line([x0, y0, x1, y1], fill=INK, width=int(S * 0.012))
    hub = S * 0.052
    d.ellipse([c - hub, c - hub, c + hub, c + hub], fill=PAPER)
    return im
big = icon()
os.makedirs('public/icons', exist_ok=True)
for name, size in [('pwa-512.png', 512), ('pwa-192.png', 192), ('maskable-512.png', 512), ('apple-touch-icon.png', 180), ('favicon-64.png', 64)]:
    big.resize((size, size), Image.LANCZOS).convert('RGB').save(f'public/icons/{name}', optimize=True)
print('icons ok')
