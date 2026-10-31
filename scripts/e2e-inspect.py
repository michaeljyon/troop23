# Uniform inspection walkthrough on the demo troop (Demo Scout is the Eagles' patrol leader).
#   python3 scripts/e2e-inspect.py <shots dir>
import json, os, sys, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(450); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 900, has_touch=w < 900)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = page(b, 'XXXX-XXXS')
    p.wait_for_selector('.ins-home'); shot(p, 'i01-home')
    p.click('.ins-home'); p.wait_for_selector('.roll'); shot(p, 'i02-roll', True)
    p.locator('.roll button').nth(1).click()   # one scout absent
    p.click('.play-next button'); p.wait_for_selector('.uf-pin'); shot(p, 'i03-scout1')
    p.click('.uf-pin[aria-label^="Patrol patch"]'); p.click('.uf-pin[aria-label^="Shirt"]'); p.click('.uf-pin[aria-label^="Socks"]'); p.click('.uf-pin[aria-label^="Socks"]')
    shot(p, 'i04-marked'); shot(p, 'i04b-marked-full', True)
    print('score after marks:', p.locator('.run-head .score-ring text').text_content())
    while p.locator('.run-next button').count():
        p.click('.run-next button'); p.wait_for_timeout(300)
        if p.locator('.ins-sum').count(): break
    shot(p, 'i05-summary', True)
    p.click('button:has-text("Save inspection")'); p.wait_for_selector('.ins-one, .ins-sum'); p.wait_for_timeout(800); shot(p, 'i06-detail', True)
    iid = p.url.split('/inspect/')[1].split('?')[0]
    p.goto(BASE + '/#/inspect'); p.wait_for_selector('.cup'); shot(p, 'i07-hub', True)
    # a scout in the same patrol sees only their own marks
    q = page(b, 'XXXX-XXXX', 1280, 860)
    q.goto(BASE + '/#/inspect'); q.wait_for_selector('.ins-start'); shot(q, 'i08-hub-leader-desktop', True)
    q.goto(BASE + '/#/inspect/new?patrol=Foxes'); q.wait_for_selector('.roll'); q.click('.play-next button'); q.wait_for_selector('.uf-pin')
    q.click('.uf-pin[aria-label^="Rank patch"]'); q.click('.uf-pin[aria-label^="Rank patch"]'); shot(q, 'i09-run-desktop')
    print('inspection', iid)
    b.close()
print('ERRORS', errors)
