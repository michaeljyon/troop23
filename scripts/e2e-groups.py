# Groups walkthrough against `npm run dev` with TroopWebHost data imported.
import json, sys, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; errors = []
def call(path):
    r = urllib.request.Request(BASE + '/api/' + path, headers={'x-leader-passcode': 'leader'})
    return json.loads(urllib.request.urlopen(r).read())
by = {m['name']: m for m in call('leader/members')['members']}
mike, brandon = by['Michael Yon'], by['Brandon Yon']
def phone(b):
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text)); p.on('dialog', lambda d: d.accept())
    return p
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    q = phone(b)   # scout
    q.goto(f"{BASE}/#/join/{brandon['code']}"); q.wait_for_selector('.hello', timeout=20000); q.wait_for_timeout(2500); q.locator('.sheet button:has-text("Later")').count() and q.click('.sheet button:has-text("Later")')
    q.goto(BASE + '/#/messages'); q.wait_for_selector('.ask-list'); shot(q, 'g1-scout-chat', True)
    q.click(".ask-list button:has-text('Board of Review')"); q.wait_for_selector('.composer2')
    q.fill('.composer2 textarea', 'I finished my Second Class requirements. Could I have a board of review at the next meeting?'); q.click('.send-btn'); q.wait_for_selector('.msg.mine')
    shot(q, 'g2-scout-request')
    print('people in request:', q.locator('.chat-top-title').inner_text())
    p = phone(b)   # Mike: leader + Advancement group
    p.goto(f"{BASE}/#/join/{mike['code']}"); p.wait_for_selector('.hello', timeout=20000); p.wait_for_timeout(2500); p.locator('.sheet button:has-text("Later")').count() and p.click('.sheet button:has-text("Later")')
    p.goto(BASE + '/#/messages'); p.wait_for_selector('.thread-row'); shot(p, 'g3-leader-chat', True)
    print('Mike groups:', p.locator('.threads >> nth=1').locator('.thread-title').all_inner_texts())
    p.goto(BASE + '/#/leaders'); p.click('.tabs button:has-text("Groups")'); p.wait_for_selector('.group-row'); shot(p, 'g4-groups', True)
    p.click(".group-row:has-text('Philmont')"); p.wait_for_selector('.group-pick'); p.click('.chip:has-text("Scouts")')
    for n in ['Brandon Yon', 'William Yon']: p.click(f".group-pick label:has-text('{n}')")
    p.click('.chip:has-text("In group")'); shot(p, 'g5-edit-group'); p.click('button:has-text("Save group")'); p.wait_for_timeout(800)
    q.goto(BASE + '/#/messages'); q.wait_for_selector('.ask-list'); print('Brandon groups:', [t for t in q.locator('.thread-title').all_inner_texts()][:12])
    b.close()
print('ERRORS', errors)
