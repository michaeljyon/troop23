# Games walkthrough: hub, Quiz Trail, puzzles, Daily Challenge, and a live
# Campfire Clash with a host and two players.  Run against `npm run dev`:
#   python3 scripts/e2e-games.py <shots dir>
import json, os, sys, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
r = urllib.request.Request(BASE + '/api/leader/members', headers={'x-leader-passcode': 'leader'})
P = json.loads(urllib.request.urlopen(r).read())['members']
scouts = [m for m in P if not m.get('leader') and m.get('code')]
mike = next(m for m in P if m['name'] == 'Michael Yon')
a, b2 = scouts[0], scouts[1]
def shot(p, n, full=False): p.wait_for_timeout(450); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def later(p):
    if p.locator('.sheet button:has-text("Later")').count(): p.click('.sheet button:has-text("Later")')
def page(br, who, w=390, h=844):
    ctx = br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=w < 900, has_touch=w < 900)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(f"{who}: {e}")); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(f"{who}: {m.text}"))
    p.goto(f"{BASE}/#/join/{who['code']}"); p.wait_for_selector('.hello', timeout=20000); p.wait_for_timeout(1500); later(p)
    return p
def answer_any(p):
    """answer whatever question is showing (right or wrong doesn't matter)"""
    if p.locator('.q-choice').count(): p.locator('.q-choice').first.click(); return
    for _ in range(14):
        if p.locator('.q-tile').count(): p.locator('.q-tile').first.click(); continue
        if p.locator('.qs-tile:not([disabled])').count(): p.locator('.qs-tile:not([disabled])').first.click(); continue
        if p.locator('.qm-item.left:not(.paired)').count():
            p.locator('.qm-item.left:not(.paired)').first.click(); p.locator('.qm-item.right:not(.paired)').first.click(); continue
        break

with sync_playwright() as pw:
    br = pw.chromium.launch()
    p = page(br, a)
    p.goto(BASE + '/#/games'); p.wait_for_selector('.g-topics'); shot(p, 'g01-hub', True)
    p.click('.g-topic:has-text("Knots")'); p.wait_for_selector('.g-topic.on'); p.click('.chip:has-text("Tenderfoot")')
    p.wait_for_timeout(300); print('url', p.url)
    p.click('.g-mode.trail'); p.wait_for_selector('.qcard'); shot(p, 'g02-question')
    n = 0
    while True:
        answer_any(p); p.wait_for_timeout(250)
        if n == 0: shot(p, 'g03-feedback')
        n += 1
        btn = p.locator('.play-next button')
        if btn.inner_text().startswith('See'): btn.click(); break
        btn.click(); p.wait_for_selector('.qcard')
    p.wait_for_selector('.res-card'); p.wait_for_timeout(1200); shot(p, 'g04-results', True)
    print('trail result:', p.locator('.res-card h1').inner_text(), p.locator('.res-xp').inner_text().replace('\n', ' | '))
    # puzzles
    p.goto(BASE + '/#/play?mode=puzzle'); p.wait_for_selector('.qcard'); shot(p, 'g05-puzzle')
    for i in range(5):
        answer_any(p); p.wait_for_selector('.q-why'); 
        if i == 0: shot(p, 'g06-puzzle-answered')
        p.locator('.play-next button').click()
    p.wait_for_selector('.res-card'); print('puzzle result:', p.locator('.res-card h1').inner_text())
    # daily
    p.goto(BASE + '/#/games'); p.goto(BASE + '/#/play?mode=daily'); p.wait_for_selector('.qcard, .empty')
    if p.locator('.qcard').count():
        for i in range(5):
            answer_any(p); p.wait_for_selector('.q-why'); p.locator('.play-next button').click()
        p.wait_for_selector('.res-card'); print('daily:', p.locator('.res-xp').inner_text().replace('\n', ' | '))
    p.goto(BASE + '/#/games'); p.goto(BASE + '/#/play?mode=daily'); p.wait_for_selector('.empty, .qcard'); print('daily again blocked:', p.locator('.empty').count() == 1)
    # speed (let the timer run a bit then leave via results after timeout is too long; just answer a few)
    p.goto(BASE + '/#/play?mode=speed'); p.wait_for_selector('.qcard')
    for i in range(4): answer_any(p); p.wait_for_timeout(1000)
    shot(p, 'g07-speed')
    p.goto(BASE + '/#/games'); p.wait_for_selector('.g-me'); p.wait_for_timeout(1200); shot(p, 'g08-hub-after', True)

    # live: Mike hosts on a laptop, two scouts join on phones
    h = page(br, mike, 1280, 800)
    h.goto(BASE + '/#/games'); h.wait_for_selector('.g-live'); h.click('button:has-text("Host a game")')
    h.click('.sheet .seg button:has-text("5")'); h.check('.sheet input[type=checkbox]'); h.click('.sheet-foot button')
    h.wait_for_selector('.big-code'); code = ''.join(h.locator('.big-code span').all_inner_texts()); print('room', code)
    q = page(br, b2)
    for pl in (p, q):
        pl.goto(BASE + '/#/games'); pl.fill('.g-join input', code.lower()); pl.click('.g-join button'); pl.wait_for_selector('.lobby-wait', timeout=10000)
    h.wait_for_function('document.querySelectorAll(".lp").length >= 2', timeout=10000); shot(h, 'g09-lobby-host'); shot(p, 'g10-lobby-player')
    h.click('button:has-text("Start the game")')
    for qi in range(5):
        for pl in (p, q): pl.wait_for_selector('.lq-choice:not([disabled])', timeout=10000)
        if qi == 0: shot(h, 'g11-question-host'); shot(p, 'g12-question-player')
        p.locator('.lq-choice').nth(0).click(); q.locator('.lq-choice').nth(1).click()
        # everyone (except the host) answered — the host has to answer too, or press Show answer
        h.click('button:has-text("Show answer now")')
        for pl in (p, q, h): pl.wait_for_selector('.lq-result, .lq-why', timeout=10000)
        if qi == 0: shot(p, 'g13-reveal-player'); shot(h, 'g14-reveal-host')
        h.click('.host-bar .btn.accent')
    for pl in (p, q, h): pl.wait_for_selector('.final', timeout=10000)
    h.wait_for_timeout(1200); shot(h, 'g15-final-host'); shot(p, 'g16-final-player', True)
    print('final:', h.locator('.final .board').inner_text().replace('\n', ' '))
    print('teams:', h.locator('.team-win').inner_text().replace('\n', ' ') if h.locator('.team-win').count() else 'none')
    p.goto(BASE + '/#/games'); p.wait_for_selector('.g-board .board, .g-board .empty'); p.wait_for_timeout(800)
    p.locator('.g-board').scroll_into_view_if_needed(); shot(p, 'g17-board')
    d = page(br, a, 1440, 900); d.goto(BASE + '/#/games'); d.wait_for_selector('.g-me'); d.wait_for_timeout(1000); shot(d, 'g18-hub-desktop', True)
    d.goto(BASE + '/#/play?mode=trail&topic=spirit'); d.wait_for_selector('.qcard'); shot(d, 'g19-play-desktop')
    br.close()
print('ERRORS', errors)
