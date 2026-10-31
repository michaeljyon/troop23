# Hike tracker + advancement suggestions walkthrough, with simulated GPS.
# Run against `npm run dev` (port 5288) with imported troop data:  python3 scripts/e2e-hikes.py <shots dir>
import json, math, os, sys, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True); errors = []
r = urllib.request.Request(BASE + '/api/leader/members', headers={'x-leader-passcode': 'leader'})
P = json.loads(urllib.request.urlopen(r).read())['members']
brandon = next(m for m in P if m['name'] == 'Brandon Yon'); mike = next(m for m in P if m['name'] == 'Michael Yon')
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def later(p):
    if p.locator('.sheet button:has-text("Later")').count(): p.click('.sheet button:has-text("Later")')
LAT, LNG = 30.3150, -84.3440
def pos(i, off=0.0): a = i / 60 * math.pi; return {'latitude': LAT + 0.0009 * i / 10 + off, 'longitude': LNG + 0.0004 * math.sin(a) + off, 'accuracy': 6}

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, geolocation=pos(0), permissions=['geolocation'])
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and 'tile' not in m.text.lower() and 'ERR_' not in m.text and errors.append(m.text))
    p.goto(f"{BASE}/#/join/{brandon['code']}"); p.wait_for_selector('.hello', timeout=20000); p.wait_for_timeout(2000); later(p)
    p.wait_for_selector('.steps', timeout=15000); shot(p, 'h01-home-next-step', True)
    p.goto(BASE + '/#/hikes'); p.wait_for_selector('.seg'); shot(p, 'h02-hikes-empty')
    p.goto(BASE + '/#/track'); p.wait_for_selector('.gps-pill.good', timeout=15000)
    p.fill('.track-body input[placeholder^="e.g."]', 'QA Leon Sinks loop')
    p.click('button:has-text("Add people")'); p.fill('.sheet .search-row input', 'Michael Yon'); p.click('.sheet .pick-list .check >> nth=0'); p.click('.sheet-foot button')
    shot(p, 'h03-setup', True)
    p.click('button:has-text("Start")'); p.wait_for_selector('.live-panel')
    for i in range(1, 46):
        ctx.set_geolocation(pos(i)); p.wait_for_timeout(1050)
    shot(p, 'h04-recording')
    p.click('.live-panel button:has-text("Pause")'); ctx.set_geolocation(pos(45, 0.004)); p.wait_for_timeout(1200)   # drive somewhere while paused
    shot(p, 'h05-paused')
    p.click('button:has-text("Resume")')
    for i in range(46, 56):
        ctx.set_geolocation(pos(i, 0.004)); p.wait_for_timeout(1050)
    live = p.locator('.lp-big b').inner_text(); print('live miles', live)
    p.reload(); p.wait_for_selector('.live-panel'); print('resumed after reload:', p.locator('.lp-big b').inner_text())
    p.click('button:has-text("Finish")'); p.wait_for_selector('button:has-text("Save hike")'); shot(p, 'h06-review', True)
    p.click('button:has-text("Save hike")'); p.wait_for_selector('.ho-top', timeout=20000); p.wait_for_timeout(1500)
    stats = p.locator('.ho-main b').all_inner_texts(); print('saved stats', stats)
    p.click('button:has-text("High five")'); p.wait_for_selector('button:has-text("High-fived")'); shot(p, 'h07-detail', True)
    hike_url = p.url
    # log one by hand
    p.goto(BASE + '/#/hikes'); p.click('button:has-text("Log a hike by hand")'); p.fill('.sheet input[placeholder="e.g. Leon Sinks loop"]', 'QA Tram Road ride-along')
    p.fill('.sheet input[placeholder="5.2"]', '10.4'); p.fill('.sheet input[placeholder="300"]', '220'); p.fill('.sheet input[aria-label="Hours"]', '3'); p.fill('.sheet input[aria-label="Minutes"]', '40')
    p.click('.sheet-foot button:has-text("Save hike")'); p.wait_for_selector('.ho-top'); print('manual', p.locator('.ho-main b').all_inner_texts()[:2])
    p.goto(BASE + '/#/hikes'); p.wait_for_selector('.hike-card'); shot(p, 'h08-feed', True)
    p.click('.seg button:has-text("Leaderboard")'); p.wait_for_selector('.board'); shot(p, 'h09-board', True)
    p.goto(BASE + f"/#/advancement/{brandon['id']}"); p.wait_for_selector('.rank-check'); shot(p, 'h10-adv-next-steps', True)
    print('steps:', p.locator('.step .grow > b').all_inner_texts())
    # leader planning
    q = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page(); q.on('pageerror', lambda e: errors.append(str(e)))
    q.goto(f"{BASE}/#/join/{mike['code']}"); q.wait_for_selector('.hello', timeout=20000); q.wait_for_timeout(2000); later(q)
    q.goto(BASE + '/#/advancement'); q.click('.seg button:has-text("Troop planning")'); q.wait_for_selector('.plan-list'); q.click('.plan-row >> nth=0'); shot(q, 'h11-troop-planning', True)
    q.goto(hike_url); q.wait_for_selector('.ho-top'); print('mike sees hike, kudos:', q.locator('button:has-text("High five")').inner_text())
    d = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); d.goto(f"{BASE}/#/join/{brandon['code']}"); d.wait_for_selector('.hello', timeout=20000); d.wait_for_timeout(1500); later(d)
    d.goto(hike_url); d.wait_for_selector('.elev-chart, .hike-map', timeout=10000); shot(d, 'h12-detail-desktop', True)
    d.goto(BASE + '/#/track'); d.wait_for_timeout(1500); shot(d, 'h13-track-desktop')
    b.close()
# clean up the QA hikes
H = {'x-leader-passcode': 'leader', 'content-type': 'application/json', 'x-session': ''}
tok = json.loads(urllib.request.urlopen(urllib.request.Request(BASE + '/api/auth/redeem', data=json.dumps({'code': brandon['code']}).encode(), headers={'content-type': 'application/json'})).read())['token']
for h in json.loads(urllib.request.urlopen(urllib.request.Request(BASE + '/api/hikes', headers={'x-session': tok})).read())['hikes']:
    if h['title'].startswith('QA'): urllib.request.urlopen(urllib.request.Request(BASE + f"/api/hikes/{h['id']}", headers={'x-session': tok}, method='DELETE'))
print('ERRORS', errors)
