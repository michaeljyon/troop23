# Walkthrough of accounts, family sign-ups, chat (two-deep), advancement,
# recipe scanning and budgets against `npm run dev` with TroopWebHost data imported.
import json, sys, urllib.request, os
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; SP = sys.argv[1]; os.makedirs(SP, exist_ok=True)
errors = []
def call(path, body=None, method=None):
    h = {'content-type': 'application/json', 'x-leader-passcode': 'leader'}
    r = urllib.request.Request(BASE + '/api/' + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ('POST' if body is not None else 'GET'))
    return json.loads(urllib.request.urlopen(r).read())
mem = call('leader/members')['members']; by = {m['name']: m for m in mem}
mike, brandon, william, brian = by['Michael Yon'], by['Brandon Yon'], by['William Yon'], by['Brian Evanson']
call(f"leader/members/{mike['id']}", {'scouts': [brandon['id'], william['id']]})
outs = call('c/outings')['items']; blue = [o for o in outs if o['title'] == 'Blue Angels'][0]

def phone(b):
    c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.on('dialog', lambda d: d.accept())
    return c, p
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- recipe card image for the scanner
    rc = b.new_page(viewport={'width': 900, 'height': 1100})
    rc.set_content("""<div style="font:26px Georgia;padding:50px;background:#fffdf5;width:800px;line-height:1.45">
      <h1 style="font-size:44px;margin:0 0 6px">Campfire Chili Mac</h1><p style="margin:0 0 18px">Serves 6</p><h2 style="font-size:30px;margin:0">Ingredients</h2>
      <p style="margin:6px 0 18px">2 lbs ground beef<br>1 1/2 cups elbow macaroni<br>1 can (15 oz) kidney beans<br>2 cans diced tomatoes<br>1 packet chili seasoning<br>2 cups shredded cheese</p>
      <h2 style="font-size:30px;margin:0">Directions</h2><p style="margin:6px 0">1. Brown the beef in a dutch oven and drain.<br>2. Add tomatoes, beans, seasoning and 3 cups water.<br>3. Stir in macaroni and simmer 12 minutes.<br>4. Top with cheese and serve.</p></div>""")
    rc.screenshot(path=f'{SP}/recipe-card.png'); rc.close()

    # ---- Mike (leader + parent) signs in by invite link
    c1, p = phone(b)
    p.goto(f"{BASE}/#/join/{mike['code']}"); p.wait_for_selector('.hello', timeout=20000); shot(p, 'a01-home-signed-in')
    p.goto(BASE + '/#/more'); p.wait_for_selector('.me-card'); shot(p, 'a02-more-account')
    p.goto(BASE + f"/#/outing/{blue['id']}"); p.wait_for_selector('.rsvp-person')
    p.click('.rsvp-person >> nth=0 >> .rsvp-yes'); p.click('.rsvp-person >> nth=1 >> .rsvp-yes'); p.click('.rsvp-person >> nth=2 >> .rsvp-maybe'); p.wait_for_timeout(700)
    p.reload(); p.wait_for_selector('.patrol-group'); shot(p, 'a03-family-rsvp', True)
    # advancement
    p.goto(BASE + '/#/advancement'); p.wait_for_selector('.adv-row'); shot(p, 'a04-adv-list')
    p.click(f".adv-row:has-text('William Yon')"); p.wait_for_selector('.ladder'); shot(p, 'a05-adv-record', True)
    # leader tools: members + invite
    p.goto(BASE + '/#/leaders'); p.wait_for_selector('.gear-list'); shot(p, 'a06-members')
    p.fill('.search-row input', 'Brandon'); p.click(".gear-row:has-text('Brandon Yon')"); p.wait_for_selector('.big-code'); shot(p, 'a07-invite')
    p.keyboard.press('Escape')
    # chat
    p.goto(BASE + '/#/messages'); p.wait_for_selector('.thread-row'); shot(p, 'a08-chat-list', True)
    p.click('button:has-text("New")'); p.wait_for_selector('.pick-list label'); p.fill('.sheet .tag-search', 'Brandon'); p.click(".pick-list label:has-text('Brandon Yon')")
    shot(p, 'a09-new-message'); p.click('.sheet-foot button'); p.wait_for_selector('.composer')
    p.fill('.composer textarea', 'Brandon, can you bring the patrol box lantern to Blue Angels?'); p.click('.composer button'); p.wait_for_selector('.msg.mine')
    p.goto(BASE + '/#/thread/board-troop'); p.wait_for_selector('.composer')
    p.fill('.composer textarea', 'Reminder: Blue Angels sign-ups close Friday. Patrols, please finish your meal plans.'); p.click('.composer button'); p.wait_for_selector('.msg.mine')
    # ---- Brandon (scout) on another phone
    c2, q = phone(b)
    q.goto(f"{BASE}/#/join/{brandon['code']}"); q.wait_for_selector('.hello', timeout=20000)
    q.goto(BASE + '/#/messages'); q.wait_for_selector('.thread-row.unread'); shot(q, 'a10-scout-chat-list')
    q.click('.thread-row.unread >> nth=0'); q.wait_for_selector('.msg'); q.fill('.composer textarea', 'Yes sir, I will bring it!'); q.click('.composer button'); q.wait_for_selector('.msg.mine')
    shot(q, 'a11-scout-thread')
    q.click('.msg-more >> nth=0'); q.click('.chip:has-text("Something else")'); q.click('button:has-text("Send report")'); q.wait_for_selector('text=Thanks')
    q.keyboard.press('Escape')
    q.goto(BASE + '/#/advancement'); q.wait_for_selector('.ladder', timeout=10000); print('scout sees own record:', q.locator('.adv-hero h1').inner_text())
    q.goto(BASE + f"/#/advancement/{william['id']}"); q.wait_for_selector('.empty'); print('scout blocked from sibling:', q.locator('.empty-title').inner_text())
    # leader reviews report
    p.goto(BASE + '/#/leaders'); p.click('.tabs button:has-text("Chat reports")'); p.wait_for_selector('.quote'); shot(p, 'a12-reports'); p.click('button:has-text("Keep it")')
    # kitchen: scan + budget + shopping prices
    p.goto(BASE + '/#/kitchen?tab=scan'); p.wait_for_selector('.scan-box')
    p.set_input_files('.scan-box input[type=file]:not([capture])', f'{SP}/recipe-card.png')
    p.wait_for_selector('.scale-card', timeout=120000); shot(p, 'a13-scan-result', True)
    print('scanned:', p.locator('.ing-list li').all_inner_texts())
    p.click('button:has-text("Save recipe")'); p.wait_for_selector('.recipe-card')
    p.goto(BASE + '/#/kitchen?tab=budget'); p.wait_for_selector('.calc'); p.select_option('.card select >> nth=0', blue['id']); p.wait_for_timeout(1200); shot(p, 'a14-budget', True)
    # meals with prices
    p.goto(BASE + f"/#/outing/{blue['id']}?tab=meals"); p.click('.chip:has-text("Flaming Flamingos")'); p.wait_for_selector('.menu, button:has-text("Start the meal plan")'); p.wait_for_timeout(1500)
    if not p.locator('.menu').count(): p.click('text=Start the meal plan'); p.wait_for_selector('.menu')
    p.click('.meal >> nth=0'); p.click('.chip:has-text("All")'); p.click('.recipe-pick button:has-text("Campfire Chili Mac")'); p.click('button:has-text("Save meal")'); p.wait_for_timeout(500)
    p.click('.meal >> nth=1'); p.click('.chip:has-text("All")'); p.click('.recipe-pick button:has-text("Pancakes")'); p.click('button:has-text("Save meal")'); p.wait_for_timeout(500)
    p.fill('.ps-num input[step="0.5"]', '15'); p.wait_for_timeout(1200)
    for i, v in enumerate(['8.99', '1.49', '3.98', '6.50']):
        p.fill(f'.price-in input >> nth={i}', v); p.keyboard.press('Tab'); p.wait_for_timeout(300)
    p.wait_for_timeout(800); shot(p, 'a15-shopping-prices', True)
    b.close()
print('pricebook', list(call('pricebook')['book'].items())[:3])
print('ERRORS', errors)
