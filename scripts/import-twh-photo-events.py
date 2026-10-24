# Make past outings (photo albums) for TroopWebHost events that have photos.
# Input: events.json gathered from TroopWebHost → Photo Gallery → Download Photos
#   [{date: "MM/DD/YYYY", event, type, loc, photos: [{u, cap}]}]
# Uses the same outing ids as import-troopwebhost.py, and never overwrites an existing outing.
# Usage: python3 scripts/import-twh-photo-events.py <events.json> <site-url> <leader-passcode> [--dry]
import json, sys, hashlib, re, urllib.request, urllib.error
SRC, SITE, PASS = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
DRY = '--dry' in sys.argv
TYPE = {
    'Campout': 'campout', 'Hike': 'hike', 'Bike Ride': 'hike', 'Paddle Sports': 'paddle',
    'Summer Camp': 'camp', 'Winter Camp': 'camp', 'National High Adventure Camp': 'camp',
    'Community Service': 'service', 'Service Hours': 'service', 'Living Christmas': 'service', 'Wallwood Workday': 'service',
    'Christmas Tree Sales': 'fundraiser', 'Fundraiser': 'fundraiser',
    'Troop Meeting': 'meeting', 'Council/Committee Meetings': 'meeting', 'Patrol Leadership Council Meeting': 'meeting',
    'Merit Badge Opportunity': 'merit', 'Training': 'training', 'Order of the Arrow Fellowship': 'oa', 'OA Event': 'oa',
    'Pack Outreach Event': 'service', 'Webelos Event': 'service', 'Scoutmaster Conference': 'meeting',
}
def call(path, body=None, method='GET'):
    req = urllib.request.Request(f'{SITE}/api/{path}', data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={'content-type': 'application/json', 'x-leader-passcode': PASS})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'{}')
existing = {o['id'] for o in call('c/outings')['items']}
made = 0
for e in json.load(open(SRC)):
    m, d, y = e['date'].split('/'); start = f'{y}-{m}-{d}'
    oid = 'o-twh-' + hashlib.sha1(f"{start}|{e['event'].strip()}".encode()).hexdigest()[:10]
    e['outing'] = oid
    if oid in existing: continue
    title = re.sub(r'\s+', ' ', e['event']).strip()
    doc = {'title': title[:80], 'type': TYPE.get(e['type'], 'other'), 'start': start, 'end': start, 'location': e['loc'][:160],
           'details': f"Photos from the TroopWebHost photo gallery.\nTroopWebHost category: {e['type']}", 'extras': [], 'cancelled': False}
    print(start, doc['type'], title[:60])
    if not DRY: call(f'c/outings/{oid}', {**doc, '_by': 'TroopWebHost photo import'}, 'PUT'); made += 1
json.dump(json.load(open(SRC)), open(SRC, 'w'))
print(f'{made} outings created')
