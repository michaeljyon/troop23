# Sync center walkthrough: the Webmaster brings in TroopWebHost files, compares a Scoutbook advancement
# file, saves Black Pug camp results and checks a Scoutbook roster.  python3 scripts/e2e-sync.py <files dir> <shots dir>
import os, sys, glob
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5288'; FD = sys.argv[1]; SP = sys.argv[2]; os.makedirs(SP, exist_ok=True); errors = []
MIKE = os.environ.get('MIKE_CODE', 'MU6B-66G4')
def shot(p, n, full=False): p.wait_for_timeout(500); p.screenshot(path=f'{SP}/{n}.png', full_page=full)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); p.on('dialog', lambda d: d.accept())
    p.on('console', lambda m: m.type == 'error' and 'status of 40' not in m.text and errors.append(m.text))
    p.goto(f'{BASE}/?x=1#/join/{MIKE}'); p.wait_for_selector('.app-main'); p.wait_for_timeout(2500)
    if p.locator('button:has-text("Later")').count(): p.click('button:has-text("Later")')
    p.goto(BASE + '/#/leaders?tab=sync'); p.wait_for_selector('.sync-status'); shot(p, 'y01-sync', True)
    twh = [f for f in glob.glob(FD + '/*') if not f.lower().endswith('.csv') or not any(x in os.path.basename(f) for x in ('advancement', 'BlackPug', 'RosterReport'))]
    p.locator('.sync-drop input').set_input_files(twh); p.wait_for_selector('.sync-files'); shot(p, 'y02-files', True)
    print('recognized:', p.locator('.sync-files li:not(.k-unknown):not(.k-blocked)').count(), 'skipped:', p.locator('.sync-files li.k-blocked, .sync-files li.k-unknown').count())
    print('blocked file shown:', p.locator('.sync-files li.k-blocked').count())
    p.click('button:has-text("Update Basecamp from TroopWebHost")'); p.wait_for_selector('.sync-result', timeout=120000); shot(p, 'y03-twh-done', True)
    print('twh:', p.locator('.sync-result .good-text').inner_text())
    p.locator('.sync-drop input').set_input_files(FD + '/advancement.csv'); p.wait_for_selector('.sync-act')
    p.click('button:has-text("Compare with TroopWebHost")'); p.wait_for_selector('.sync-sum', timeout=30000); shot(p, 'y04-compare', True)
    print('compare:', p.locator('.sync-sum').inner_text().replace('\n', ' '))
    p.locator('.sync-drop input').set_input_files(FD + '/BlackPug_Scoutbook_Export.csv'); p.wait_for_selector('.sync-act')
    print('camp guessed:', p.locator('.sync-act .seg button.on').inner_text())
    p.fill('.sync-act input', 'Wallwood, week 2'); p.click('button:has-text("Save camp results")'); p.wait_for_selector('text=Summer camp results', timeout=30000)
    p.locator('.sync-drop input').set_input_files(FD + '/RosterReport.csv'); p.wait_for_selector('.sync-act')
    p.click('button:has-text("Check the roster")'); p.wait_for_selector('text=Scoutbook roster vs Basecamp', timeout=30000); shot(p, 'y05-after-all', True)
    print('status:', p.locator('.sync-status').inner_text().replace('\n', ' | '))
    for role in ['Committee Chair', 'Advancement Chair', 'Scoutmaster']:
        p.click(f'.chip-scroll button:has-text("{role}")'); p.wait_for_timeout(200)
    shot(p, 'y06-roles')
    b.close()
print('ERRORS', errors)
