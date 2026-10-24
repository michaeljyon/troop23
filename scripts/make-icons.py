# Renders the "Troop 23" app icons with headless Chromium.
import pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent
out = root.parent / 'public' / 'brand'; out.mkdir(parents=True, exist_ok=True)
jobs = [('icon-512.png', 512, '0', 1), ('icon-192.png', 192, '0', 1), ('icon-maskable-512.png', 512, '0', .78), ('apple-touch-icon.png', 180, '0', .92), ('mark-256.png', 256, '22%', 1)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, px, radius, scale in jobs:
        pg = b.new_page(viewport={'width': 512, 'height': 512}, device_scale_factor=px / 512)
        pg.goto((root / 'icon.html').as_uri()); pg.wait_for_timeout(250)
        pg.evaluate(f"const t=document.getElementById('t');t.style.setProperty('--r','{radius}');t.style.setProperty('--s','{scale}')")
        pg.locator('#t').screenshot(path=str(out / name), omit_background=True); pg.close()
    b.close()
print('ok')
