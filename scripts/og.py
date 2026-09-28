"""Render the share image (Open Graph / Twitter) from scripts/og.html to public/og.png, 1200 × 630.

Needs Playwright with Chromium: pip install playwright && python -m playwright install chromium
Run from the repository root: python scripts/og.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'scripts' / 'og.html'
OUT = ROOT / 'public' / 'og.png'

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    page.goto(SRC.as_uri())
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT), clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
    browser.close()

# Smaller file, same pixels: it is fetched by every link preview.
try:
    from PIL import Image
    Image.open(OUT).convert('RGB').save(OUT, optimize=True)
except ImportError:
    pass
print(f'og ok → {OUT.relative_to(ROOT)}')
