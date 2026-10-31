# Outing safety, rides and slips, sign-offs, service, Eagle, camp, meetings, polls, check-in, tree sale,
# year, Eagle wall, lost and found and geocaching on the demo troop.   python3 scripts/e2e-troop.py <shots dir> <photo.jpg>
import os, sys, re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; PHOTO = sys.argv[2]; os.makedirs(SP, exist_ok=True); errors = []
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
def page(b, code, w=390, h=844, mobile=True, geo=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, geolocation=geo, permissions=['geolocation'] if geo else [])
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and 'status of 50' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{code}'); p.wait_for_selector('.app-main', timeout=20000); p.wait_for_timeout(2000)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    return p
def overflow(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    L = page(b, 'XXXX-XXXX'); s = page(b, 'XXXX-XXXS')
    # outing safety
    L.goto(BASE + '/#/outing/o-demo-campout'); L.wait_for_selector('.safety-links'); shot(L, 't01-outing-safety', True)
    L.click('a:has-text("Emergency card")'); L.wait_for_selector('.emerg-911'); L.click('.head-btn')
    L.fill('input[placeholder="Calhoun Liberty Hospital"]', 'Calhoun Liberty Hospital'); L.fill('input[placeholder="The flagpole by the dining hall"]', 'Flagpole by the pavilion'); L.click('button:has-text("Save card")')
    L.wait_for_selector('.er-row'); shot(L, 't02-emergency', True)
    L.goto(BASE + '/#/buddy?outing=o-demo-campout'); L.wait_for_selector('.buddy'); L.click('button:has-text("Make buddy pairs")'); L.wait_for_selector('.buddy-pairs li')
    for i in range(L.locator('.buddy-pairs li button:has-text("In")').count()): L.locator('.buddy-pairs li button:has-text("In")').first.click()
    L.click('button:has-text("Buddy check")'); shot(L, 't03-buddy-check', True)
    while L.locator('.buddy-pairs button:has-text("Together")').count(): L.locator('.buddy-pairs button:has-text("Together")').first.click()
    print('buddy check done:', 'ago' in L.inner_text('.buddy-timer'))
    L.click('.seg button:has-text("Headcount")'); L.locator('.count-list button').first.click(); shot(L, 't04-headcount', True)
    # rides and slips
    L.goto(BASE + '/#/outing/o-demo-campout?tab=rides'); L.wait_for_selector('text=Carpools')
    L.wait_for_timeout(800)
    if L.locator('button:has-text("I can drive")').count(): L.click('button:has-text("I can drive")'); L.fill('.sheet input[type=number]', '3'); L.click('.sheet button:has-text("Save")')
    L.wait_for_selector('.car')
    if L.locator('.slip-roster').count() == 0: L.locator('button:has-text("Set up"), button:has-text("Change")').last.click(); L.click('.sheet button:has-text("Save")')
    L.wait_for_selector('.slip-roster'); shot(L, 't05-rides', True)
    s.goto(BASE + '/#/field'); s.wait_for_selector('.fire-list'); s.click('a[href="#/field/snakes"]'); s.wait_for_selector('.fire-how'); shot(s, 't06-field-snakes', True)
    # requirement sign-offs and service
    L.goto(BASE + '/#/reqs'); L.wait_for_selector('.fire-list'); L.click('.fire-list a:has-text("Demo Scout")'); L.wait_for_selector('.req-list')
    L.locator('.req-list button:has-text("Sign")').first.click(); L.click('.sheet button:has-text("Sign off")'); L.wait_for_timeout(700); shot(L, 't07-reqs', True)
    s.goto(BASE + '/#/service'); s.wait_for_selector('.svc-total'); s.click('.head-btn'); s.fill('.sheet input[placeholder^="Scouting for Food"]', 'Park cleanup'); s.click('.sheet .check-row input'); s.click('.sheet button:has-text("Send to a leader")'); s.wait_for_timeout(800); shot(s, 't08-service-scout', True)
    L.goto(BASE + '/#/service'); L.wait_for_selector('text=To approve'); L.locator('.svc-list button:has-text("✓")').first.click(); L.wait_for_timeout(600); shot(L, 't09-service-leader', True)
    # Eagle
    L.goto(BASE + '/#/eagle'); L.wait_for_selector('.fire-list'); L.locator('.fire-list a').first.click(); L.wait_for_selector('.eagle-steps')
    L.fill('input[placeholder="Benches for the nature trail"]', 'Benches for the nature trail'); L.locator('.es-dot').nth(0).click(); L.locator('.es-dot').nth(1).click(); L.click('button:has-text("Save")'); L.wait_for_selector('button:has-text("Saved")'); shot(L, 't10-eagle', True)
    # summer camp
    L.goto(BASE + '/#/camp/new'); L.wait_for_selector('.campplan')
    L.fill('.card input >> nth=0', 'Camp Daniel Boone'); L.click('button:has-text("Add a merit badge")'); L.fill('input[aria-label="Merit badge"]', 'Swimming')
    L.click('button:has-text("Add a merit badge")'); L.locator('input[aria-label="Merit badge"]').nth(1).fill('First Aid'); L.locator('input[aria-label="Prerequisites"]').nth(1).fill('Bring your Tenderfoot first aid kit')
    L.click('.switch-row input'); L.click('button:has-text("Save camp")'); L.wait_for_selector('.camp-roster'); shot(L, 't11-camp-leader', True)
    s.goto(BASE + '/#/camp'); s.wait_for_selector('.fire-list'); s.locator('.fire-list a').first.click(); s.wait_for_selector('.camp-block select'); s.locator('.camp-block select').first.select_option('Swimming'); s.wait_for_timeout(700); shot(s, 't12-camp-scout', True)
    # meeting planner (demo scout is a patrol leader)
    s.goto(BASE + '/#/meetings'); s.click('a:has-text("Plan one")'); s.wait_for_selector('.meet-part')
    s.locator('.meet-part').nth(0).locator('.chip').first.click(); s.locator('.meet-part').nth(2).locator('.chip:has-text("Bowline")').click(); s.locator('.meet-part').nth(5).locator('.chip').first.click()
    s.click('button:has-text("Save plan")'); s.wait_for_selector('.meet-plan'); shot(s, 't13-meeting', True)
    # polls
    L.goto(BASE + '/#/polls'); L.click('.head-btn'); L.fill('.sheet input[maxlength="160"]', 'Where should the spring campout be?'); L.locator('.sheet input[placeholder="Choice 1"]').fill('Torreya State Park'); L.locator('.sheet input[placeholder="Choice 2"]').fill('Camp Wallwood'); L.click('.sheet button:has-text("Post poll")'); L.wait_for_selector('.poll')
    s.goto(BASE + '/#/'); s.wait_for_selector('.alert-card:has-text("Vote:")'); s.click('.alert-card:has-text("Vote:")'); s.wait_for_selector('.po-btn'); s.locator('.po-btn').first.click(); s.click('.poll button:has-text("Vote")'); s.wait_for_selector('.po-bar'); shot(s, 't14-poll', True)
    # check-in
    L.goto(BASE + '/#/checkin'); L.wait_for_selector('.checkin h1'); L.wait_for_timeout(1000)
    if L.locator('button:has-text("Start check-in")').count(): L.click('button:has-text("Start check-in")')
    L.wait_for_selector('.code-big'); code = L.inner_text('.code-big').strip()
    L.click('a:has-text("Show the code on a TV")'); L.wait_for_selector('.ctv-qr'); shot(L, 't15-checkin-tv')
    L.click('.em-top button')
    s.goto(f'{BASE}/#/checkin/{code}'); s.wait_for_selector('.ci-ok'); shot(s, 't16-checked-in')
    L.goto(BASE + '/#/checkin'); L.wait_for_selector('.count-list'); print('checked in:', L.locator('.count-list button.on').count())
    # Christmas tree sale
    L.goto(BASE + '/#/fundraiser'); L.wait_for_selector('.tree-hero'); L.click('button:has-text("Set up")'); L.fill('.sheet input[type=number] >> nth=0', '8000')
    for i, pr in enumerate(['45', '55', '65', '85', '110', '25', '30', '25', '15']): L.locator(f'.sheet input[aria-label$=" price"]').nth(i).fill(pr)
    L.locator('.sheet input[aria-label$=" received"]').nth(1).fill('120'); L.locator('.sheet input[aria-label$=" received"]').nth(2).fill('80')
    L.fill('.sheet input[maxlength="200"]', '1500 Main St, Tallahassee'); L.click('.sheet button:has-text("Save")'); L.wait_for_timeout(700)
    L.click('button:has-text("Add lot shifts")'); L.click('.sheet button:has-text("Add")'); L.wait_for_timeout(800)
    L.click('button:has-text("Record today")'); L.locator('.sheet .sales-in button[aria-label^="One more"]').nth(1).click(); L.locator('.sheet .sales-in button[aria-label^="One more"]').nth(1).click(); L.locator('.sheet .sales-in button[aria-label^="One more"]').nth(2).click(); L.click('.sheet button:has-text("Save")'); L.wait_for_timeout(800)
    shot(L, 't17-trees-leader', True)
    s.goto(BASE + '/#/fundraiser'); s.wait_for_selector('.shift-day'); s.locator('.shift-btns .chip').first.click(); s.wait_for_timeout(700); shot(s, 't18-trees-scout', True)
    s.goto(BASE + '/#/'); s.wait_for_selector('.tree-home'); print('home tree banner: yes')
    # year, Eagle wall, lost and found
    L.goto(BASE + '/#/year'); L.wait_for_selector('.yr-grid'); shot(L, 't19-year', True)
    L.goto(BASE + '/#/eagles'); L.click('.head-btn'); L.fill('.sheet input >> nth=0', 'Robert Alumni'); L.fill('.sheet input >> nth=1', '1998'); L.click('.sheet button:has-text("Add")'); L.wait_for_selector('.eagle-list'); shot(L, 't20-eagles', True)
    s.goto(BASE + '/#/lost'); s.click('.head-btn'); s.fill('.sheet input >> nth=0', 'Blue water bottle'); s.fill('.sheet input >> nth=1', 'Fall campout, dining fly'); s.set_input_files('.sheet input[type=file]', PHOTO); s.wait_for_selector('.lost-preview'); s.click('.sheet button:has-text("Post")'); s.wait_for_selector('.lost-grid img'); shot(s, 't21-lost', True)
    # geocaching
    L.goto(BASE + '/#/geocache/new'); L.wait_for_selector('.geo')
    L.click('button:has-text("Add a cache")'); L.fill('input[aria-label="Cache name"]', 'Old oak'); L.fill('input[aria-label="Latitude"]', '30.4400'); L.fill('input[aria-label="Longitude"]', '-84.2800'); L.fill('input[aria-label="Code word"]', 'acorn'); L.fill('input[aria-label="Hint"]', 'Under the big root')
    L.click('button:has-text("Add a cache")'); L.locator('input[aria-label="Cache name"]').nth(1).fill('Bridge'); L.locator('input[aria-label="Latitude"]').nth(1).fill('30.4410'); L.locator('input[aria-label="Longitude"]').nth(1).fill('-84.2790')
    L.click('button:has-text("Save course")'); L.wait_for_selector('.geo-caches'); L.click('button:has-text("Open the course")'); L.wait_for_timeout(600); shot(L, 't22-geo-course', True)
    L.click('a:has-text("Print cache cards")'); L.wait_for_selector('.geo-card'); shot(L, 't23-geo-cards')
    G = page(b, 'XXXX-XXXS', geo={'latitude': 30.4395, 'longitude': -84.2806})
    G.goto(BASE + '/#/geocache'); G.wait_for_selector('.fire-list'); G.locator('.fire-list a').first.click(); G.wait_for_selector('.geo-caches'); G.wait_for_timeout(1500); shot(G, 't24-geo-scout', True)
    G.locator('.geo-caches a:has-text("Go")').first.click(); G.wait_for_selector('.gn-dial'); G.wait_for_timeout(1500); print('nav distance:', G.inner_text('.gn-dist')); G.click('button:has-text("Show the hint")'); shot(G, 't25-geo-nav')
    G.click('button:has-text("I found it")'); G.fill('.sheet input', 'ACORN'); G.click('.sheet button:has-text("Log it")'); G.wait_for_selector('text=Found it'); shot(G, 't26-geo-found')
    # small phone
    t = page(b, 'XXXX-XXXS', 320, 640)
    for path, sel, n in [('outing/o-demo-campout', '.safety-links', 't27-outing-320'), ('fundraiser', '.tree-hero', 't28-trees-320'), ('reqs/' + 'x', '.content', 't29'), ('meetings', '.content', 't30-meet-320'), ('polls', '.poll', 't31-polls-320'), ('field', '.fire-list', 't32-field-320'), ('year', '.yr-grid', 't33-year-320')]:
        if n == 't29': continue
        t.goto(f'{BASE}/#/{path}'); t.wait_for_selector(sel); shot(t, n); print(n, 'overflow:', overflow(t))
    b.close()
print('ERRORS', errors)
