# Campsite explorer on the demo troop: list, filters, map, a place page, picks, plan an outing, guest view.
#   python3 scripts/e2e-explore.py <shots dir>
import os, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(600); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844, mobile=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and 'tile' not in m.text and 'ERR_' not in m.text and errors.append(m.text))
    if code:
        p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(1500)
        if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    s = page(b, 'XXXX-XXXS')
    # clear any earlier picks so the run is repeatable
    s.goto(BASE + '/#/explore'); s.wait_for_selector('.ex-card'); s.evaluate("localStorage.removeItem('t23-ex-view')")
    mine = s.evaluate("""async () => { const r = await fetch('/api/explore', { headers: { 'x-troop-code': 'demo', 'x-session': JSON.parse(localStorage.getItem('t23-session') || 'null') || '' } }); return r.ok ? (await r.json()).mine : null }""")
    n = s.locator('.ex-card').count(); print('cards:', n)
    shot(s, 'x01-hub'); shot(s, 'x02-hub-full', True)
    s.click('.ex-chips .chip:has-text("Under 1 hr")'); s.wait_for_timeout(300); print('under 1 hr:', s.locator('.ex-card').count())
    s.click('.ex-chips .chip:has-text("Group camp")'); s.wait_for_timeout(300); print('+ group camp:', s.locator('.ex-card').count())
    s.click('button:has-text("Clear filters")'); s.click('.ex-chips .chip:has-text("Springs")'); s.click('.ex-chips .chip:has-text("Swim")'); s.wait_for_timeout(300); print('springs+swim:', s.locator('.ex-card').count()); shot(s, 'x03-filtered')
    s.click('button:has-text("Clear filters")'); s.fill('.ex-search input', 'okefenokee'); s.wait_for_timeout(300); print('search okefenokee:', s.locator('.ex-card').count()); s.fill('.ex-search input', '')
    print('overflow 390:', overflow(s))
    # map
    s.click('.seg button:has-text("Map")'); s.wait_for_selector('.ex-pin', timeout=20000); print('pins:', s.locator('.ex-pin').count()); shot(s, 'x04-map')
    s.locator('.ex-pin[title="St. Andrews State Park"]').click(); s.wait_for_selector('.ex-pop'); shot(s, 'x05-map-pop')
    s.click('.ex-pop-in'); s.wait_for_selector('.ex-place'); shot(s, 'x06-place'); shot(s, 'x07-place-full', True)
    # picks: undo earlier, pick 5, sixth refused
    s.goto(BASE + '/#/explore'); s.click('.seg button:has-text("List")'); s.wait_for_selector('.ex-card')
    ids = [h.split('/')[-1] for h in s.locator('.ex-card').evaluate_all('els => els.map(e => e.getAttribute("href"))')]
    picked = 0
    for i in ids[:6]:
        s.goto(f'{BASE}/#/explore/{i}'); s.wait_for_selector('.ex-pick'); s.wait_for_timeout(700)
        if s.locator('.ex-pick button:has-text("Picked")').count(): s.click('.ex-pick button'); s.wait_for_timeout(600)
    for i in ids[:6]:
        s.goto(f'{BASE}/#/explore/{i}'); s.wait_for_selector('.ex-pick'); s.wait_for_timeout(600)
        s.click('.ex-pick button'); s.wait_for_timeout(800)
        if s.locator('.form-msg').count(): print('6th pick refused:', s.locator('.form-msg').inner_text()[:60])
        else: picked += 1
    print('picked:', picked); shot(s, 'x08-pick')
    s.goto(BASE + '/#/explore'); s.wait_for_selector('.ex-favs'); shot(s, 'x09-favs')
    # small phone
    t = page(b, 'XXXX-XXXS', 320, 640)
    for path, sel, nm in [('explore', '.ex-card', 'x10-320-hub'), (f'explore/{ids[0]}', '.ex-place', 'x11-320-place')]:
        t.goto(f'{BASE}/#/{path}'); t.wait_for_selector(sel); shot(t, nm); print(nm, 'overflow:', overflow(t))
    # leader: plan an outing from a place, make a poll
    L = page(b, 'XXXX-XXXX')
    L.goto(f'{BASE}/#/explore/torreya-sp'); L.wait_for_selector('.ex-plan'); L.click('.ex-plan button'); L.wait_for_selector('.sheet'); L.wait_for_timeout(500)
    print('outing form name:', L.locator('.sheet input').first.input_value()); shot(L, 'x12-plan')
    L.keyboard.press('Escape')
    L.goto(BASE + '/#/explore'); L.wait_for_selector('.ex-favs'); print('leader sees make poll:', L.locator('button:has-text("Make a poll")').count())
    # desktop
    D = page(b, 'XXXX-XXXS', 1366, 900, False)
    D.goto(BASE + '/#/explore'); D.wait_for_selector('.ex-card'); shot(D, 'x13-desktop'); print('desktop overflow:', overflow(D))
    # guest on the troop code
    G = page(b, None)
    G.goto(BASE); G.wait_for_selector('.gate-form'); G.click('text=I only have the troop code'); G.fill('.gate-form input', 'demo'); G.click('button:has-text("Continue")')
    G.wait_for_selector("text=Who's using this phone?"); G.fill('.gate-form input[autocomplete=name]', 'Guest Test'); G.click("text=Let's go"); G.wait_for_selector('.app-main')
    G.goto(f'{BASE}/#/explore/{ids[0]}'); G.wait_for_selector('.ex-pick'); print('guest sees sign in:', G.locator('.ex-pick a:has-text("Sign in")').count())
    b.close()
print('ERRORS', errors)
