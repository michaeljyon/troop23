# Add addresses, phone numbers, websites and map pins from TroopWebHost's
# Maintain_Event_Locations export to outings already in Basecamp (matched by location name).
# Disabled locations are skipped.
# Usage: python3 scripts/import-locations.py <locations.csv> <site-url> <leader-passcode> [--dry]
import csv, sys, json, re, urllib.request
CSV, SITE, PASS = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
DRY = '--dry' in sys.argv
norm = lambda s: re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
places = {}
for r in csv.DictReader(open(CSV, encoding='utf-8-sig', errors='replace')):
    if (r.get('Disabled') or '').strip().upper() == 'Y': continue
    addr = re.sub(r'\s{2,}', ', ', (r.get('Address') or '').strip()).replace(' USA', '').strip(' ,')
    addr = re.sub(r',\s*,', ',', addr).strip(' ,')
    if not re.search(r'[A-Za-z]{2}', addr): addr = ''
    mp = (r.get('Map') or '').strip()
    coords = re.match(r'^(-?\d+\.\d+),\s*(-?\d+\.\d+)', mp)
    web = (r.get('Web Site') or '').strip()
    if web and not web.startswith('http'): web = 'https://' + web
    if 'google.com/?' in web: web = ''
    places[norm(r['Location'])] = {'address': addr[:200], 'placePhone': (r.get('Telephone') or '').strip()[:40], 'placeWeb': web[:300],
                                   'mapQ': f"{float(coords[1]):.6f},{float(coords[2]):.6f}" if coords else ''}
def call(path, body=None, method='GET'):
    req = urllib.request.Request(f'{SITE}/api/{path}', data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={'content-type': 'application/json', 'x-leader-passcode': PASS})
    return json.loads(urllib.request.urlopen(req, timeout=30).read() or b'{}')
outs = call('c/outings')['items']
done = 0
for o in outs:
    p = places.get(norm(o.get('location')))
    if not p or not any(p.values()): continue
    patch = {k: v for k, v in p.items() if v and not o.get(k)}
    if not patch: continue
    print(f"{o['start']}  {o['title'][:40]:40}  {o['location'][:34]:34}  {', '.join(patch)}")
    if not DRY:
        doc = {k: v for k, v in o.items() if not k.startswith('_') and k not in ('id', 'updated', 'created', 'by')}
        call(f"c/outings/{o['id']}", {**doc, **patch, '_by': 'TroopWebHost locations'}, 'PUT')
    done += 1
print(f'{len(places)} locations · {done} outings updated' + (' (dry run)' if DRY else ''))
