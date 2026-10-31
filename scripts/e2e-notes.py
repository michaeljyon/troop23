# Meeting notes walkthrough on the demo troop: the patrol leader writes PLC notes with a photo,
# a leader writes committee minutes with a file and approves them.  python3 scripts/e2e-notes.py <shots dir>
import os, sys, base64
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
img = Image.new('RGB', (1200, 900), '#F4F1E8'); d = ImageDraw.Draw(img)
for i, t in enumerate(['PLC PLAN', '- Campout menu', '- Service hours', '- Elections']): d.text((80, 80 + i * 120), t, fill='#1E4A36')
img.save(f'{SP}/whiteboard.jpg'); open(f'{SP}/agenda.txt', 'w').write('Committee agenda\n1. Budget\n2. Campout\n')
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 900, has_touch=w < 900)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
with sync_playwright() as pw:
    b = pw.chromium.launch()
    s = page(b, 'XXXX-XXXS')
    s.goto(BASE + '/#/more'); s.click('a[href="#/notes"]'); s.wait_for_selector('.notes'); shot(s, 'n01-plc-empty')
    s.click('.head-btn'); s.wait_for_selector('.note-ta'); s.click('button:has-text("template")')
    s.locator('input[type=file][accept="image/*"]').set_input_files(f'{SP}/whiteboard.jpg'); s.wait_for_selector('.note-tray .att-item')
    shot(s, 'n02-plc-editor', True)
    s.click('.play-next button'); s.wait_for_selector('.note-body'); s.wait_for_timeout(800); shot(s, 'n03-plc-note', True)
    s.click('.note-pics button'); s.wait_for_timeout(600); shot(s, 'n04-photo'); s.keyboard.press('Escape')
    s.goto(BASE + '/#/notes'); s.wait_for_selector('.note-list'); shot(s, 'n05-plc-list')
    print('scout sees committee tab:', s.locator('.seg button:has-text("Committee")').count())
    L = page(b, 'XXXX-XXXX')
    L.goto(BASE + '/#/notes'); L.wait_for_selector('.seg'); L.click('.seg button:has-text("Committee")'); L.wait_for_timeout(600)
    L.click('.head-btn'); L.wait_for_selector('.note-ta'); L.fill('.note-ta', '**Treasurer\'s report**\n- Balance is fine\n\n**Action items**\n- Order new tents')
    L.locator('input[type=file]').nth(1).set_input_files(f'{SP}/agenda.txt'); L.wait_for_selector('.note-tray .att-item')
    L.click('.play-next button'); L.wait_for_selector('.note-status.draft'); shot(L, 'n06-committee-draft', True)
    L.click('button:has-text("Mark approved")'); L.wait_for_selector('.note-status.approved'); shot(L, 'n07-committee-approved', True)
    print('edit hidden after approval:', L.locator('.head-btn:has-text("Edit")').count() == 0)
    L.goto(BASE + '/#/notes?book=committee'); L.wait_for_selector('.note-list'); shot(L, 'n08-committee-list')
    D = page(b, 'XXXX-XXXX', 1280, 860); D.goto(BASE + '/#/notes'); D.wait_for_selector('.note-list'); D.click('.note-list a'); D.wait_for_selector('.note-body'); shot(D, 'n09-desktop', True)
    b.close()
print('ERRORS', errors)
