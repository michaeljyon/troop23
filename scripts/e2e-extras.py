# Notifications card, calendar subscribe, add-to-calendar and Link families (against `npm run dev`).
import json, sys, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; errors = []
r = urllib.request.Request(BASE + '/api/leader/members', headers={'x-leader-passcode': 'leader'})
by = {m['name']: m for m in json.loads(urllib.request.urlopen(r).read())['members']}
mike = by['Michael Yon']
with sync_playwright() as pw:
    b = pw.chromium.launch()
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text)); p.on('dialog', lambda d: d.accept())
    shot = lambda n, full=False: (p.wait_for_timeout(600), p.screenshot(path=f'{SP}/{n}.png', full_page=full))
    p.goto(f"{BASE}/#/join/{mike['code']}"); p.wait_for_selector('.hello', timeout=20000)
    p.goto(BASE + '/#/more'); p.wait_for_selector('.notify-card'); shot('x1-more-notify')
    print('notify card:', p.locator('.notify-card').inner_text().replace('\n', ' | '))
    p.goto(BASE + '/#/messages'); p.wait_for_selector('.thread-row'); shot('x2-chat-nudge')
    print('nudge:', p.locator('.notify-nudge').count())
    p.goto(BASE + '/#/outings'); p.click('.cal-sub-btn'); p.wait_for_selector('.btn-col a'); shot('x3-cal-sheet')
    print('webcal:', p.locator('.btn-col a >> nth=0').get_attribute('href')[:60])
    p.keyboard.press('Escape'); p.click('.outing-list a >> nth=0'); p.wait_for_selector('.outing-links a'); shot('x4-outing-cal')
    href = p.locator('.outing-links a >> nth=0').get_attribute('href'); print('add to cal:', href)
    print('ics status:', urllib.request.urlopen(href.replace('http://localhost/', BASE + '/')).status)
    p.goto(BASE + '/#/leaders'); p.wait_for_selector('.gear-list'); p.click('button:has-text("Link families")'); p.wait_for_selector('.fam-list'); shot('x5-link-families')
    n = p.locator('.fam-list .chip.on').count(); print('suggested pairs:', n)
    p.click('.fam-list li >> nth=0 >> .chip >> nth=0')   # untick one
    p.click('.sheet-foot button'); p.wait_for_selector('.fam-list', state='detached', timeout=30000); p.wait_for_timeout(800)
    linked = [m for m in json.loads(urllib.request.urlopen(r).read())['members'] if m.get('scouts')]
    print('adults linked now:', len(linked))
    b.close()
print('ERRORS', errors)
