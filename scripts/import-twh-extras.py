# Merit badge counselors and event places from TroopWebHost exports.
#  - Counselors: names in "Merit Badges In Progress" (with the badges they're counseling)
#    plus everyone with the "Merit Badge Counselor" role in the User Permissions report.
#  - Places: "Maintain Event Locations" (disabled ones skipped).
# Existing entries are never overwritten, so leaders' edits stay.
# Usage: python3 scripts/import-twh-extras.py <exports-folder> <site-url> <leader-passcode> [--dry]
import csv, sys, json, re, glob, os, hashlib, urllib.request
FOLDER, SITE, PASS = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
DRY = '--dry' in sys.argv
def find(part):
    m = [f for f in glob.glob(os.path.join(FOLDER, '*')) if part.lower() in os.path.basename(f).lower() and f.lower().endswith('.csv')]
    return m[0] if m else None
def rows(path): return list(csv.DictReader(open(path, encoding='utf-8-sig', errors='replace'))) if path else []
def call(path, body=None, method='GET'):
    req = urllib.request.Request(f'{SITE}/api/{path}', data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={'content-type': 'application/json', 'x-leader-passcode': PASS})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'{}')
def base(b): return re.sub(r'\s*\((?:[^)]*rqmts|old rqmts)\)\s*$', '', b.lstrip('*')).strip()
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

members = [m for m in call('leader/members')['members'] if m.get('active') is not False]
def parse(name):
    nick = re.findall(r'"([^"]+)"', name)
    name = re.sub(r'"[^"]*"', '', name).strip()
    if ',' in name: last, first = [x.strip() for x in name.split(',', 1)]; first = first.split(' ')[0]
    else: parts = name.split(); first, last = parts[0], parts[-1]
    return [first] + nick, last
def match(name):
    firsts, last = parse(name)
    for m in members:
        if m['last'].lower() == last.lower() and any(m['first'].lower() == f.lower() or m['name'].lower().startswith(f.lower()) for f in firsts): return m
    return None

counselors = {}
def add(name, badge=None):
    m = match(name)
    if m: disp = m['name']
    else: firsts, last = parse(name); disp = f"{firsts[-1]} {last}" if ',' in name else re.sub(r'\s+', ' ', name).strip()
    c = counselors.setdefault(disp, {'name': disp, 'memberId': m['id'] if m else '', 'badges': set(), 'notes': '', 'active': True})
    if badge: c['badges'].add(badge)
for r in rows(find('Merit_Badges_In_Progress')):
    if (r.get('Merit Badge Counselor') or '').strip(): add(r['Merit Badge Counselor'].strip(), base(r['Merit Badge']))
for r in rows(find('User_Permissions')):
    if r['Role'] == 'Merit Badge Counselor': add(r['User Name'])

existing = {c['id'] for c in call('c/counselors')['items']}
for c in counselors.values():
    cid = 'mbc-' + slug(c['name'])
    print(f"counselor {c['name']:28} {'troop' if c['memberId'] else 'outside':8} {len(c['badges'])} badges {'(exists, kept)' if cid in existing else ''}")
    if not DRY and cid not in existing: call(f'c/counselors/{cid}', {**c, 'badges': sorted(c['badges']), '_by': 'TroopWebHost import'}, 'PUT')

existing = {p['id'] for p in call('c/places')['items']}
made = 0
for r in rows(find('Event_Locations')):
    if (r.get('Disabled') or '').strip().upper() == 'Y' or not r['Location'].strip(): continue
    addr = re.sub(r'\s{2,}', ', ', (r.get('Address') or '').strip()).replace(' USA', '').strip(' ,')
    addr = re.sub(r',\s*,', ',', addr).strip(' ,')
    if not re.search(r'[A-Za-z]{2}', addr): addr = ''
    mp = re.match(r'^(-?\d+\.\d+),\s*(-?\d+\.\d+)', (r.get('Map') or '').strip())
    web = (r.get('Web Site') or '').strip()
    if web and not web.startswith('http'): web = 'https://' + web
    if 'google.com/?' in web: web = ''
    doc = {'name': r['Location'].strip()[:160], 'address': addr[:200], 'phone': (r.get('Telephone') or '').strip()[:40], 'web': web[:300], 'mapQ': f"{float(mp[1]):.6f},{float(mp[2]):.6f}" if mp else '', 'notes': ''}
    pid = 'pl-' + hashlib.sha1(doc['name'].lower().encode()).hexdigest()[:10]
    if pid in existing: continue
    if not DRY: call(f'c/places/{pid}', {**doc, '_by': 'TroopWebHost import'}, 'PUT')
    made += 1
print(f'{len(counselors)} counselors · {made} places added' + (' (dry run)' if DRY else ''))
