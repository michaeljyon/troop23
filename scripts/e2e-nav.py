# Back-button and history checks (section-level navigation). Run with npm run dev on 5288:  python3 scripts/e2e-nav.py <shots dir>
import sys
from playwright.sync_api import sync_playwright
B='http://localhost:5288'; OUT=sys.argv[1]; res=[]
def chk(name, ok, got=''): res.append(ok); print(('PASS ' if ok else 'FAIL ')+name+('' if ok else f'  got {got}'))
def h(pg): return pg.evaluate('location.hash')
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'{B}/#/join/XXXX-XXXS'); pg.wait_for_selector('.hello',timeout=20000); pg.wait_for_timeout(1200)
    if pg.locator('.sheet button:has-text("Later")').count(): pg.click('.sheet button:has-text("Later")')
    # 1 outing tabs then back
    pg.click('.tabbar a:has-text("Outings")'); pg.wait_for_selector('.outing-list a'); pg.click('.outing-list a >> nth=0'); pg.wait_for_selector('.tabs')
    for t in ['Meals','Gear','Packing','Photos','Overview','Meals']: pg.click(f'.tabs button:has-text("{t}")'); pg.wait_for_timeout(250)
    lbl=pg.locator('.back-btn').inner_text(); chk('outing back button names Outings', 'Outings' in lbl, lbl); pg.screenshot(path=f'{OUT}/1-outing.png')
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('back from outing (after 6 tab taps) goes to Outings', h(pg).startswith('#/outings'), h(pg))
    # 2 phone back gesture
    pg.click('.outing-list a >> nth=0'); pg.wait_for_selector('.tabs')
    for t in ['Gear','Packing']: pg.click(f'.tabs button:has-text("{t}")'); pg.wait_for_timeout(250)
    pg.go_back(); pg.wait_for_timeout(600); chk('phone back gesture skips tabs', h(pg).startswith('#/outings'), h(pg))
    # 3 outings view switches, then Home tile flow
    pg.click('.seg button:has-text("Calendar")'); pg.wait_for_timeout(300); pg.click('.seg button:has-text("Past")'); pg.wait_for_timeout(300)
    pg.go_back(); pg.wait_for_timeout(600); chk('back from Outings views returns to Home', h(pg) in ('#/', '', '#/home'), h(pg))
    pg.click('a.tile:has-text("Kitchen")'); pg.wait_for_selector('.seg, .tabs'); 
    for t in ['Scan','Budget','Pantry']: pg.click(f'button[role=tab]:has-text("{t}")'); pg.wait_for_timeout(250)
    lbl=pg.locator('.back-btn').inner_text(); chk('kitchen back names Home', 'Home' in lbl, lbl)
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('kitchen back goes Home', h(pg) in ('#/', ''), h(pg))
    # 4 hikes chain
    pg.goto(B+'/#/more'); pg.wait_for_timeout(500); pg.click('a:has-text("Hikes")'); pg.wait_for_selector('.hike-card2'); pg.click('.seg button:has-text("Stats")'); pg.click('.seg button:has-text("Troop")'); pg.click('.hike-card2 >> nth=0'); pg.wait_for_selector('.ho-top')
    lbl=pg.locator('.back-btn').inner_text(); chk('hike back names Hikes', 'Hikes' in lbl, lbl); pg.screenshot(path=f'{OUT}/2-hike.png')
    pg.click('.back-btn'); pg.wait_for_timeout(600); lbl=pg.locator('.back-btn').inner_text(); chk('hikes back names More', 'More' in lbl, lbl)
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('hikes back goes More', h(pg).startswith('#/more'), h(pg))
    # 5 gallery filters
    pg.goto(B+'/#/'); pg.wait_for_timeout(400); pg.click('a.tile:has-text("Photos")'); pg.wait_for_selector('.seg')
    pg.click('.gal-seg button >> nth=1'); pg.wait_for_timeout(300); pg.click('.gal-seg button >> nth=0'); pg.wait_for_timeout(300)
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('gallery back after filters goes Home', h(pg) in ('#/', ''), h(pg))
    pg.click('a.tile:has-text("Photos")'); pg.wait_for_selector('.ev-card'); pg.click('.ev-card >> nth=0'); pg.wait_for_timeout(600)
    lbl=pg.locator('.back-btn').inner_text(); chk('album back names Photos', 'Photos' in lbl, lbl)
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('album back goes to gallery', h(pg).startswith('#/gallery') and 'album' not in h(pg), h(pg))
    # 6 scout advancement redirect
    pg.goto(B+'/#/more'); pg.wait_for_timeout(400); pg.click('.more-list a:has-text("Advancement"), a:has-text("Advancement") >> nth=0'); pg.wait_for_selector('.adv-hero')
    lbl=pg.locator('.back-btn').inner_text(); chk('scout record back names More (no loop)', 'More' in lbl, lbl)
    pg.click('.back-btn'); pg.wait_for_timeout(700); chk('scout record back goes More', h(pg).startswith('#/more'), h(pg))
    ctx.close()
    # 7 deep link
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.goto(f'{B}/#/join/XXXX-XXXS'); pg.wait_for_selector('.hello',timeout=20000); pg.wait_for_timeout(800)
    pg.evaluate("sessionStorage.clear()"); pg.goto(B+'/#/outing/o-demo-campout?tab=meals'); pg.reload(); pg.wait_for_selector('.tabs')
    if pg.locator('.sheet button:has-text("Later")').count(): pg.click('.sheet button:has-text("Later")')
    lbl=pg.locator('.back-btn').inner_text(); chk('opened from a link: back names Outings', 'Outings' in lbl, lbl)
    pg.click('.back-btn'); pg.wait_for_timeout(600); chk('opened from a link: back goes Outings', h(pg).startswith('#/outings'), h(pg))
    ctx.close()
    print('errors', errs, f'{sum(res)}/{len(res)}'); b.close()
