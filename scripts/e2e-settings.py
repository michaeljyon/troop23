# Leader settings walkthrough on the demo troop: feature switches and options, exports download,
# More/Home show what's switched on, and meeting notes are easy to reach.  python3 scripts/e2e-settings.py <shots>
import os, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 900, has_touch=w < 900, accept_downloads=True)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
def has_link(p, href): return p.locator(f'a[href="#/{href}"]').count() > 0
with sync_playwright() as pw:
    b = pw.chromium.launch()
    L = page(b, 'XXXX-XXXX'); S = page(b, 'XXXX-XXXS')
    L.goto(BASE + '/#/more'); L.wait_for_selector('.more-group'); shot(L, 's01-more-leader', True)
    print('leader More has notes + committee:', has_link(L, 'notes'), has_link(L, 'notes?book=committee'))
    S.goto(BASE + '/#/more'); S.wait_for_selector('.more-group'); shot(S, 's02-more-scout', True); print('scout More has notes:', has_link(S, 'notes'), 'committee:', has_link(S, 'notes?book=committee'))
    S.goto(BASE + '/#/'); S.wait_for_selector('.tiles'); print('scout Home tile notes:', has_link(S, 'notes')); shot(S, 's03-home-tiles', True)
    L.goto(BASE + '/#/leaders'); L.wait_for_selector('.lead-quick'); shot(L, 's04-leader-tools')
    L.click('.lead-quick a:has-text("Committee minutes")'); L.wait_for_selector('.notes'); print('committee from leader tools:', 'committee' in L.url)
    # settings
    L.goto(BASE + '/#/leaders?tab=settings'); L.wait_for_selector('.set-group'); shot(L, 's05-settings', True)
    L.click('.feat:has-text("Games") input[role=switch]'); L.wait_for_timeout(1200)
    L.click('.feat:has-text("Meeting notes") input[role=switch] >> nth=1'); L.wait_for_timeout(800)   # parents can read PLC notes
    shot(L, 's06-settings-games-off', True)
    S.goto(BASE + '/#/more'); S.reload(); S.wait_for_selector('.more-group'); print('scout More has games after off:', has_link(S, 'games'))
    S.goto(BASE + '/#/games'); S.wait_for_selector('.empty'); shot(S, 's07-games-off-scout'); print('scout sees turned-off:', S.locator('text=turned off').count() > 0)
    L.goto(BASE + '/#/games'); L.wait_for_selector('.off-note'); shot(L, 's08-games-off-leader')
    L.goto(BASE + '/#/leaders?tab=settings'); L.wait_for_selector('.set-group')
    L.click('.feat:has-text("Games") input[role=switch]'); L.wait_for_timeout(1000)
    L.click('.feat:has-text("Meeting notes") input[role=switch] >> nth=1'); L.wait_for_timeout(800)
    print('games back on:', L.locator('.feat:has-text("Games") input[role=switch]').first.is_checked())
    # inspection checklist chip
    L.locator('.feat:has-text("Uniform inspection") .chip:has-text("Hat")').click(); L.wait_for_timeout(800)
    print('hat now on:', '✓' in L.locator('.feat:has-text("Uniform inspection") .chip:has-text("Hat")').inner_text())
    L.locator('.feat:has-text("Uniform inspection") .chip:has-text("Hat")').click(); L.wait_for_timeout(600)
    # exports (downloads are checked in a desktop browser; phone emulation can't save files)
    L.goto(BASE + '/#/leaders?tab=data'); L.wait_for_selector('.more-list a[download]'); shot(L, 's09-records', True)
    L = page(b, 'XXXX-XXXX', 1280, 860); L.goto(BASE + '/#/leaders?tab=data'); L.wait_for_selector('.more-list a[download]')
    ok = 0
    n = L.locator('.more-list a[download]').count()
    for i in range(n):
        if i % 5 == 4: L.reload(); L.wait_for_selector('.more-list a[download]')   # browsers limit rapid-fire downloads
        a = L.locator('.more-list a[download]').nth(i)
        with L.expect_download(timeout=15000) as dl: a.click()
        d = dl.value; path = d.path(); txt = open(path).read()
        if txt and ',' in txt.split('\n')[0] or txt.startswith('note'): ok += 1
        else: errors.append(f'bad export {d.suggested_filename}: {txt[:80]}')
    print('exports downloaded:', ok, 'of', n)
    D = page(b, 'XXXX-XXXX', 1280, 860); D.goto(BASE + '/#/leaders?tab=settings'); D.wait_for_selector('.set-group'); shot(D, 's10-settings-desktop', True)
    b.close()
print('ERRORS', errors)
