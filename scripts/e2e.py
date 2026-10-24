# End-to-end walkthrough of Troop 23 Basecamp against `npm run dev` (port 5288).
import json, sys, base64, urllib.request
from playwright.sync_api import sync_playwright, expect
BASE = 'http://localhost:5288'; SP = sys.argv[1]; DEMO = 'scripts/demo'
errors = []
def api(path, body=None, method=None, leader=False):
    h = {'content-type': 'application/json', 'x-troop-code': 'troop23'}
    if leader: h['x-leader-passcode'] = 'leader'
    r = urllib.request.Request(BASE + '/api/' + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ('POST' if body is not None else 'GET'))
    return json.loads(urllib.request.urlopen(r).read())
def shot(pg, name, full=False): pg.wait_for_timeout(350); pg.screenshot(path=f'{SP}/{name}.png', full_page=full)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    pg.on('dialog', lambda d: d.accept())
    # --- gate
    pg.goto(BASE); pg.wait_for_selector('.gate-form'); shot(pg, '01-gate')
    pg.fill('.gate-form input', 'nope'); pg.click('text=Head to basecamp'); expect(pg.locator('.form-msg')).to_be_visible()
    pg.fill('.gate-form input', 'TROOP23'); pg.click('text=Head to basecamp'); pg.wait_for_selector('text=Who\'s using this phone?')
    pg.fill('.gate-form input[autocomplete=name]', 'Eli Morgan'); pg.select_option('.gate-form select', 'Hawks'); shot(pg, '02-who')
    pg.click("text=Let's go"); pg.wait_for_selector('.hello'); shot(pg, '03-home-empty')
    # --- leader sign in + setup
    pg.goto(BASE + '/#/leaders'); pg.fill('input[type=password]', 'leader'); pg.click('button:has-text("Sign in")'); pg.wait_for_selector('.tabs')
    pg.click('.tabs button:has-text("Bulletin")'); pg.fill('input[placeholder^="Permission slips"]', 'Campout permission slips due Thursday')
    pg.fill('textarea', 'Turn in forms and $25 to Mr. Diaz at the meeting.'); pg.check('.check input'); pg.click('button:has-text("Post")'); pg.wait_for_selector('.post')
    # outings via UI
    pg.goto(BASE + '/#/outings'); pg.click('button:has-text("New")'); pg.wait_for_selector('text=New outing')
    pg.fill('input[placeholder^="e.g. Fall"]', 'Fall Campout at Wakulla'); pg.fill('.sheet input[type=date] >> nth=0', '2026-11-06'); pg.fill('.sheet input[type=date] >> nth=1', '2026-11-08')
    pg.fill('input[placeholder^="Campground"]', 'Wakulla Springs State Park'); pg.fill('input[placeholder="Fri 5:30 PM"]', 'Fri 5:30 PM'); pg.fill('input[placeholder="Church parking lot"]', 'Church parking lot')
    pg.fill('input[placeholder="Sun 12:00 PM"]', 'Sun 11:30 AM'); pg.fill('input[placeholder="$25 per scout"]', '$25 per scout')
    pg.fill('textarea[placeholder^="Plan"]', 'Patrol cooking all weekend. Saturday: canoe the river and work on Cooking merit badge requirements.\nCampfire program Saturday night.')
    pg.fill('textarea[placeholder^="Swimsuit"]', 'Swimsuit & towel\nWater shoes'); shot(pg, '04-new-outing', True)
    pg.click('button:has-text("Save outing")'); pg.wait_for_selector('.outing-hero'); oid = pg.url.split('/outing/')[1].split('?')[0]; print('outing', oid)
    api(f'c/outings/o-hike1', {'title': 'Leon Sinks Day Hike', 'type': 'hike', 'start': '2026-11-14', 'location': 'Leon Sinks Geological Area', 'meetTime': 'Sat 8:00 AM'}, method='PUT', leader=True)
    api(f'c/outings/o-svc1', {'title': 'Food Drive Service Project', 'type': 'service', 'start': '2026-11-21', 'location': 'Second Harvest'}, method='PUT', leader=True)
    # RSVPs
    pg.click('.rsvp-btn:has-text("Going")'); pg.wait_for_timeout(400)
    for n, pt, role in [('Sam Ortiz', 'Hawks', 'scout'), ('Leo Park', 'Hawks', 'scout'), ('Ava Chen', 'Hawks', 'scout'), ('Noah Diaz', 'Flaming Arrows', 'scout'), ('Mia Brooks', 'Flaming Arrows', 'scout'), ('Dan Diaz', 'Adults', 'adult')]:
        api(f"c/rsvps/{oid}__{n.lower().replace(' ', '-')}", {'outingId': oid, 'name': n, 'patrol': pt, 'role': role, 'status': 'yes'}, method='PUT')
    api(f"c/rsvps/{oid}__jo-kim", {'outingId': oid, 'name': 'Jo Kim', 'patrol': 'Sharks', 'role': 'scout', 'status': 'maybe'}, method='PUT')
    pg.reload(); pg.wait_for_selector('.patrol-group'); shot(pg, '05-outing-overview', True)
    # gear via API + UI
    for gid, name, cat, tag, qty in [('g1', 'Eureka 4-person tent', 'Shelter', 'T-01', 1), ('g2', 'Eureka 4-person tent', 'Shelter', 'T-02', 1), ('g3', 'Eureka 4-person tent', 'Shelter', 'T-03', 1),
                                      ('g4', 'Two-burner propane stove', 'Cooking', 'S-01', 1), ('g5', '12" Dutch oven', 'Cooking', 'DO-1', 1), ('g6', 'Hawks patrol box', 'Cooking', 'PB-H', 1),
                                      ('g7', 'LED lantern', 'Lighting', 'L-01', 2), ('g8', '5-gal water jug', 'Water', 'W-01', 2), ('g9', 'Troop first-aid kit', 'Safety & first aid', 'FA-1', 1), ('g10', 'Dining fly 12x12', 'Shelter', 'F-01', 1)]:
        api(f'c/gear/{gid}', {'name': name, 'category': cat, 'tag': tag, 'qty': qty, 'condition': 'good', 'location': 'Trailer'}, method='PUT')
    api('c/gear/g11', {'name': 'Hatchet', 'category': 'Tools', 'tag': 'H-02', 'qty': 1, 'condition': 'repair', 'location': 'Trailer', 'notes': 'Handle cracked'}, method='PUT')
    pg.click('.tabs button:has-text("Gear")'); pg.click('button:has-text("Check out gear for this trip")'); pg.wait_for_selector('.pick-list')
    for t in ['T-01', 'T-02', 'S-01', 'PB-H', 'L-01']: pg.click(f'.pick-list label:has-text("{t}")')
    shot(pg, '06-gear-picker'); pg.click('.sheet-foot button'); pg.wait_for_selector('.gear-row.static'); shot(pg, '07-outing-gear')
    # meals
    pg.click('.tabs button:has-text("Meals")'); pg.wait_for_selector('text=Start the meal plan'); shot(pg, '08-meals-start')
    pg.click('text=Start the meal plan'); pg.wait_for_selector('.menu')
    picks = {'Fri dinner': 'One-pot chili mac', 'Sat breakfast': 'Breakfast burritos', 'Sat lunch': 'Walking tacos', 'Sat dinner': 'Foil packet dinners', 'Sun breakfast': 'Pancakes & bacon'}
    for slot, rec in picks.items():
        pg.click(f'.meal:has-text("{slot}")'); pg.wait_for_selector('.recipe-pick'); pg.click('.chip:has-text("All")')
        pg.click(f'.recipe-pick button:has-text("{rec}")')
        if slot == 'Sat dinner': shot(pg, '09-meal-sheet')
        pg.click('button:has-text("Save meal")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Add a meal")'); pg.fill('.sheet input[placeholder="e.g. Sat dinner"]', 'Sat dessert'); pg.click('.chip:has-text("Dessert")'); pg.click('.recipe-pick button:has-text("cobbler")'); pg.click('button:has-text("Save meal")'); pg.wait_for_timeout(300)
    pg.fill('.ps-item input[placeholder="Who\'s shopping?"]', 'Eli Morgan'); pg.fill('.ps-num input[step="0.5"]', '12'); pg.wait_for_timeout(1200)
    pg.click('.shop label >> nth=0'); pg.click('.shop label >> nth=1'); pg.click('.shop label >> nth=2'); pg.wait_for_timeout(300)
    pg.fill('.spend-form input[type=number]', '38.42'); pg.fill('.spend-form input[placeholder="Store / note"]', 'Publix'); pg.click('button:has-text("Add receipt")'); pg.wait_for_selector('.spend li')
    pg.click('button:has-text("Build roster")'); pg.wait_for_selector('.duty select'); pg.wait_for_timeout(400)
    shot(pg, '10-meals-plan', True)
    # pantry, recipe
    pg.goto(BASE + '/#/kitchen?tab=pantry'); pg.wait_for_selector('.pantry-add')
    for name, q, u, loc in [('Cooking oil', '1', 'bottle', 'Hawks patrol box'), ('Salt & pepper', '1', 'set', 'Hawks patrol box'), ('Heavy-duty foil', '2', 'roll', 'Trailer'), ('Dish soap', '1', 'bottle', 'Trailer'), ('Trash bags', '1', 'box', 'Trailer')]:
        pg.fill('.pantry-add input >> nth=0', name); pg.fill('.pantry-add input >> nth=1', q); pg.fill('.pantry-add input >> nth=2', u); pg.fill('.pantry-add input >> nth=3', loc); pg.click('.pantry-add button'); pg.wait_for_timeout(350)
    pg.click('.pantry li:has-text("Dish soap") button:has-text("Mark low")'); pg.wait_for_timeout(400); shot(pg, '11-pantry', True)
    pg.goto(BASE + '/#/kitchen'); pg.wait_for_selector('.recipe-card'); shot(pg, '12-recipes')
    pg.click('.recipe-card:has-text("cobbler")'); pg.wait_for_selector('.stepper'); pg.click('[aria-label="More servings"]'); pg.click('[aria-label="More servings"]'); shot(pg, '13-recipe-view')
    pg.keyboard.press('Escape')
    pg.click('button:has-text("Add a recipe")'); pg.fill('.sheet .field input >> nth=0', 'Campfire banana boats'); pg.select_option('.sheet select', 'dessert'); pg.fill('.sheet input[list=methods]', 'Coals')
    pg.fill('.ing-row >> nth=0 >> input >> nth=0', 'Bananas'); pg.fill('.ing-row >> nth=0 >> input >> nth=1', '8'); pg.fill('.ing-row >> nth=0 >> input >> nth=2', 'each')
    pg.click('text=Add ingredient'); pg.fill('.ing-row >> nth=1 >> input >> nth=0', 'Mini marshmallows'); pg.fill('.ing-row >> nth=1 >> input >> nth=1', '1'); pg.fill('.ing-row >> nth=1 >> input >> nth=2', 'bag')
    pg.fill('.sheet textarea', 'Slit banana peel lengthwise.\nStuff with marshmallows and chocolate chips.\nWrap in foil, 5 minutes on coals.'); pg.click('button:has-text("Save recipe")'); pg.wait_for_selector('.recipe-card:has-text("banana")')
    # gear locker
    pg.goto(BASE + '/#/gear'); pg.wait_for_selector('.gear-row'); shot(pg, '14-gear', True)
    pg.click('.gear-row:has-text("Dutch oven")'); pg.wait_for_selector('.sheet'); pg.click('.sheet button:has-text("Check out")'); pg.wait_for_timeout(300); shot(pg, '15-gear-checkout')
    pg.click('.sheet .btn-row button:has-text("Check out")'); pg.wait_for_timeout(500); shot(pg, '16-gear-detail-out')
    pg.keyboard.press('Escape')
    # check in all from outing
    pg.goto(BASE + f'/#/outing/{oid}?tab=gear'); pg.wait_for_selector('button:has-text("Check gear back in")'); pg.click('button:has-text("Check gear back in")')
    pg.click('.checkin-row:has-text("S-01") .chip'); shot(pg, '17-checkin'); pg.click('.sheet-foot button'); pg.wait_for_timeout(800)
    # packing
    pg.goto(BASE + f'/#/outing/{oid}?tab=pack'); pg.wait_for_selector('.checklist')
    for i in range(7): pg.click(f'.checklist label >> nth={i}')
    shot(pg, '18-packing')
    # photos
    roster = []
    api('consent', {'parent': {'name': 'Kara Morgan'}, 'scouts': [{'first': 'Eli', 'lastInitial': 'M', 'patrol': 'Hawks', 'level': 'public'}], 'signature': 'Kara Morgan', 'agreed': True})
    api('consent', {'parent': {'name': 'Tom Ortiz'}, 'scouts': [{'first': 'Sam', 'lastInitial': 'O', 'patrol': 'Hawks', 'level': 'none'}], 'signature': 'Tom Ortiz', 'agreed': True})
    pg.goto(BASE + f'/#/snap?album={oid}'); pg.wait_for_selector('.setup'); pg.check('.setup .check input'); pg.wait_for_selector('.tag-chips', timeout=5000)
    pg.click('.mission:has-text("Camp kitchen")'); pg.click('.tag-chips .chip:has-text("Eli M.")'); shot(pg, '19-snap', True)
    pg.set_input_files('input[type=file][multiple]', [f'{DEMO}/campfire.jpg', f'{DEMO}/tents.jpg', f'{DEMO}/lake.jpg']); pg.wait_for_selector('.form-msg.good', timeout=20000)
    rs = {s['name']: s['id'] for s in api('roster')['scouts']}
    img = 'data:image/jpeg;base64,' + base64.b64encode(open(f'{DEMO}/trail.jpg', 'rb').read()).decode()
    api('photos', {'image': img, 'thumb': img, 'name': 'Dan Diaz', 'role': 'leader', 'album': oid, 'patrol': 'Hawks', 'scouts': [rs['Sam O.']], 'caption': 'Trail break', 'release': True})
    pg.goto(BASE + '/#/leaders'); pg.wait_for_selector('.review-list'); shot(pg, '20-leader-review', True)
    for _ in range(6):
        btns = pg.locator('.review:not(:has(.flag.bad)) button:has-text("Approve")')
        if btns.count() == 0: break
        btns.first.click(); pg.wait_for_timeout(400)
    pg.click('.tabs button:has-text("Settings")'); pg.wait_for_selector('.row-input'); shot(pg, '21-leader-settings')
    pg.click('.tabs button:has-text("Records")'); shot(pg, '22-leader-records')
    # home full + more + gallery
    pg.goto(BASE + '/#/'); pg.wait_for_selector('.next-card .next-title'); pg.wait_for_timeout(900); shot(pg, '23-home'); shot(pg, '24-home-full', True)
    pg.goto(BASE + '/#/more'); pg.wait_for_selector('.more-list'); shot(pg, '25-more')
    pg.goto(BASE + f'/#/outing/{oid}?tab=photos'); pg.wait_for_selector('.gallery img'); shot(pg, '26-outing-photos')
    pg.goto(BASE + '/#/outings'); pg.wait_for_selector('.outing-row'); shot(pg, '27-outings')
    # desktop slideshow
    d = b.new_context(viewport={'width': 1280, 'height': 720}, storage_state=ctx.storage_state()); sp = d.new_page(); sp.on('pageerror', lambda e: errors.append(str(e)))
    sp.goto(BASE + '/#/slideshow'); sp.wait_for_selector('.show-img'); sp.wait_for_timeout(1500); sp.screenshot(path=f'{SP}/28-slideshow.png')
    b.close()

for k in ['signups', 'gear', 'gear-log', 'spending', 'permissions']:
    r = urllib.request.urlopen(urllib.request.Request(BASE + f'/api/leader/export/{k}', headers={'x-leader-passcode': 'leader'})).read().decode()
    print(f'--- {k}\n' + '\n'.join(r.splitlines()[:5]))
plan = api(f'c/plans/{oid}__hawks')['item']
print('plan', plan['grubmaster'], plan['budget'], len(plan['meals']), 'checks', len(plan['checks']), 'spend', plan['spend'][0]['amount'], 'duties roles', plan['duties']['roles'])
print('ERRORS', errors)
