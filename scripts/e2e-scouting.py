# Knot trainer, patrol points, scavenger hunts, duty roster, night sky and Court of Honor on the demo troop.
#   python3 scripts/e2e-scouting.py <shots dir> <photo.jpg>
import os, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; PHOTO = sys.argv[2]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844, mobile=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    L = page(b, 'XXXX-XXXX'); s = page(b, 'XXXX-XXXS')
    # knots
    s.goto(BASE + '/#/more'); s.click('a[href="#/knots"]'); s.wait_for_selector('.knot-hero'); shot(s, 's01-knots', True)
    s.click('a[href="#/knots/bowline"]'); s.wait_for_selector('.knot-steps'); shot(s, 's02-bowline', True)
    s.click('a:has-text("Practice step by step")'); s.wait_for_selector('.knot-practice'); s.click('.em-foot button:has-text("Next")'); shot(s, 's03-practice')
    s.click('.em-top button'); s.wait_for_selector('.knot-steps'); s.click('a:has-text("Tie it!")'); s.wait_for_selector('.timer-face')
    s.click('button:has-text("Start")'); s.wait_for_timeout(2300); s.click('button:has-text("Stop")'); s.click('.check-row input'); s.click('button:has-text("Save my time")'); s.wait_for_selector('.timer-face ~ .card .kim-score'); shot(s, 's04-timer')
    s.goto(BASE + '/#/knots/bowline'); s.wait_for_selector('.knot-board'); print('board rows:', s.locator('.knot-board li').count())
    s.goto(BASE + '/#/knots/quiz'); s.wait_for_selector('.knot-opts')
    for i in range(8): s.locator('.knot-opts button').first.click(); s.click('.fire-how button')
    s.wait_for_selector('.kim-score'); print('quiz done:', s.inner_text('.kim-score').replace('\n', '')); shot(s, 's05-quiz')
    # points
    L.goto(BASE + '/#/points'); L.wait_for_selector('.pts-bars'); L.click('.head-btn'); L.locator('.sheet .el-chips .chip').first.click(); L.click('.sheet .give-pts .chip:has-text("+10")'); L.click('.sheet .chip:has-text("Best campsite")'); L.click('.sheet .btn.big')
    L.wait_for_timeout(800); shot(L, 's06-points', True)
    L.click('a:has-text("Show on a TV")'); L.wait_for_selector('.pts-tv .pts-bars'); shot(L, 's07-points-tv')
    L.click('.em-top button')
    # scavenger hunt
    L.goto(BASE + '/#/hunts'); L.click('a:has-text("New hunt")'); L.wait_for_selector('input[aria-label="Add something to find"]')
    for t in ['Animal tracks', 'Lichen or moss', 'A spider web']: L.click(f'.chip:has-text("+ {t}")')
    L.fill('input[aria-label="Add something to find"]', 'A pinecone'); L.click('.row-input button:has-text("Add")'); shot(L, 's08-hunt-editor', True)
    L.click('button:has-text("Save hunt")'); L.wait_for_selector('button:has-text("Start the hunt")'); L.click('button:has-text("Start the hunt")'); L.wait_for_selector('button:has-text("Finish the hunt")')
    s.goto(BASE + '/#/'); s.wait_for_selector('.alert-card:has-text("Scavenger hunt")'); print('home hunt banner: yes')
    s.click('.alert-card:has-text("Scavenger hunt")'); s.wait_for_selector('.hunt-items')
    with s.expect_file_chooser() as fc: s.locator('.hunt-items li:has-text("A pinecone") button:has-text("Snap it")').click()
    fc.value.set_files(PHOTO); s.wait_for_selector('.hunt-items li.pending'); shot(s, 's09-hunt-scout', True)
    L.reload(); L.wait_for_selector('.hunt-judge'); shot(L, 's10-hunt-judge', True); L.click('.hj-btns button:has-text("Yes")'); L.wait_for_timeout(800)
    L.goto(BASE + '/#/points'); L.wait_for_selector('.pts-bars'); print('hunt points on board:', '📸' in L.inner_text('.pts-bars'))
    # duty roster
    L.goto(BASE + '/#/outings'); L.wait_for_selector('.outing-list'); L.locator('.outing-list a').first.click(); L.wait_for_selector('.tabs')
    L.click('.tabs button:has-text("Duties")'); L.wait_for_selector('.duty-roster'); shot(L, 's11-duty', True)
    L.locator('.duty-roster .section-row button').first.click(); L.click('button:has-text("Shuffle")'); L.click('button:has-text("Save roster")'); L.wait_for_timeout(800); print('duty saved:', L.locator('button:has-text("Change")').count())
    # night sky
    s.goto(BASE + '/#/sky'); s.wait_for_selector('.sky-chart'); s.wait_for_timeout(800); print('stars drawn:', s.locator('.sky-star').count(), 'finds:', s.locator('.sky-list li').count()); shot(s, 's12-sky', True)
    s.click('button:has-text("Night vision")'); shot(s, 's13-sky-color')
    D = page(b, 'XXXX-XXXS', 1280, 800, False)
    D.goto(BASE + '/#/sky/point'); D.wait_for_selector('.sp-ask'); D.click('button:has-text("Drag to look around")'); D.wait_for_timeout(800)
    D.mouse.move(640, 400); D.mouse.down(); D.mouse.move(500, 300, steps=8); D.mouse.up(); D.wait_for_timeout(600); print('aim:', D.inner_text('.em-plan')); shot(D, 's14-sky-point')
    # Court of Honor
    L.goto(BASE + '/#/more'); L.click('a[href="#/coh"]'); L.wait_for_selector('.coh'); L.locator('button:has-text("New"), button:has-text("Plan one")').first.click(); L.wait_for_selector('.lineup')
    L.fill('input[aria-label="Name"], .card input >> nth=0', 'Fall Court of Honor')
    L.click('button:has-text("Bring in what\'s earned")'); L.wait_for_selector('.sheet'); L.wait_for_timeout(1200)
    L.fill('.sheet input[type=date]', ''); L.wait_for_timeout(1200)
    if L.locator('.sheet .btn.big').count(): L.click('.sheet .btn.big')
    else: L.keyboard.press('Escape')
    L.wait_for_timeout(500); print('awards added:', L.locator('.coh-awards li').count()); shot(L, 's15-coh', True)
    L.click('button:has-text("Save changes")'); L.wait_for_selector('button:has-text("Saved")')
    L.click('a:has-text("Program")'); L.wait_for_selector('.program'); shot(L, 's16-program', True)
    # small phone
    t = page(b, 'XXXX-XXXS', 320, 640)
    for path, sel, n in [('knots', '.knot-hero', 's17-knots-320'), ('points', '.pts-bars', 's18-points-320'), ('sky', '.sky-chart', 's19-sky-320'), ('hunts', '.fire-list', 's20-hunts-320')]:
        t.goto(f'{BASE}/#/{path}'); t.wait_for_selector(sel); shot(t, n); print(n, 'overflow:', overflow(t))
    # clean up demo test data
    L.goto(BASE + '/#/hunts'); L.wait_for_selector('.fire-list'); L.locator('.fire-list a').first.click(); L.click('a:has-text("Edit")'); L.click('button:has-text("Delete hunt")'); L.wait_for_selector('.hunts')
    L.goto(BASE + '/#/coh'); L.wait_for_selector('.fire-list'); L.locator('.fire-list a').first.click(); L.wait_for_selector('.save-bar'); L.click('button:has-text("Delete")'); L.wait_for_timeout(500)
    b.close()
print('ERRORS', errors)
