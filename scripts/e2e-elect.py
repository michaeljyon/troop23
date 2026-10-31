# Troop elections walkthrough on the demo troop: leader sets up the ballot, a scout votes on their
# phone, the leader takes a vote on their own phone for a scout without one, and the TV shows it.
#   python3 scripts/e2e-elect.py <shots dir>
import os, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if w < 900 else 1, is_mobile=w < 900, has_touch=w < 900)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
with sync_playwright() as pw:
    b = pw.chromium.launch()
    L = page(b, 'XXXX-XXXX')
    L.goto(BASE + '/#/vote'); L.wait_for_selector('.page-head'); L.click('.head-btn')
    L.wait_for_selector('.el-edit'); L.fill('.sheet input >> nth=0', 'QA Fall troop elections')
    L.click('.el-edit button.chip:has-text("Add candidates")'); L.wait_for_selector('.el-pick')
    for i in range(3): L.locator('.el-pick .pick-list input').nth(i).check()
    L.click('.el-pick .sheet-foot button')
    L.click('.el-presets button:has-text("Chaplain Aide")'); L.click('.el-presets button:has-text("each patrol votes")')
    for k in range(L.locator('.el-edit li').count()):
        if k == 0: continue
        L.locator('.el-edit li').nth(k).locator('button.chip').last.click(); L.wait_for_selector('.el-pick')
        n = L.locator('.el-pick .pick-list input').count()
        for i in range(min(2, n)): L.locator('.el-pick .pick-list input').nth(i).check()
        L.click('.el-pick .sheet-foot button')
    shot(L, 'e01-editor', True)
    L.click('.sheet-foot button:has-text("Save & open voting")'); L.wait_for_selector('.el-admin'); shot(L, 'e02-leader-view', True)
    eid = L.url.split('/vote/')[1].split('?')[0]
    T = page(b, 'XXXX-XXXX', 1920, 1080); T.goto(f'{BASE}/#/vote/{eid}/screen'); T.wait_for_selector('.el-tv-turn'); T.wait_for_timeout(1500); shot(T, 'e03-tv-start')
    S = page(b, 'XXXX-XXXS'); S.wait_for_selector('.el-home'); shot(S, 'e04-home-banner')
    S.click('.el-home'); S.wait_for_selector('.bal-cand'); shot(S, 'e05-ballot', True)
    for sec in range(S.locator('.bal-pos').count()): S.locator('.bal-pos').nth(sec).locator('.bal-cand').first.click()
    S.click('.play-next button'); S.wait_for_selector('.bal-review'); shot(S, 'e06-review')
    S.click('.sheet-foot button'); S.wait_for_selector('.voted-big'); shot(S, 'e07-voted')
    # leader takes votes on their phone
    L.reload(); L.wait_for_selector('.el-admin'); L.click('button:has-text("Vote on this phone")'); L.wait_for_selector('.kiosk-list'); shot(L, 'e08-kiosk', True)
    print('already-voted disabled:', L.locator('.kiosk-list button[disabled]').count())
    L.locator('.kiosk-list button:not([disabled])').first.click(); L.wait_for_selector('.kiosk-head'); shot(L, 'e09-kiosk-ballot')
    L.locator('.bal-pos').first.locator('.bal-cand').nth(1).click()
    L.click('.play-next button'); L.click('.sheet-foot button'); L.wait_for_selector('.voted-big'); shot(L, 'e10-kiosk-thanks')
    L.click('.voted-big button'); L.wait_for_selector('.kiosk-list'); print('voted now:', L.locator('.kiosk-list button[disabled]').count())
    T.wait_for_timeout(2600); shot(T, 'e11-tv-live')
    L.click('button:has-text("Done taking votes")'); L.wait_for_selector('.el-admin')
    L.click('button:has-text("Close voting")'); L.wait_for_timeout(800)
    T.wait_for_selector('.el-winners', timeout=8000); T.wait_for_timeout(1200); shot(T, 'e12-tv-winners')
    shot(L, 'e13-results', True)
    T2 = page(b, 'XXXX-XXXX', 1024, 768); T2.goto(f'{BASE}/#/vote/{eid}/screen'); T2.wait_for_selector('.el-winners'); shot(T2, 'e14-tv-1024')
    print('election', eid)
    b.close()
print('ERRORS', errors)
