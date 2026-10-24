# Import a TroopWebHost "Export Events" CSV into Troop 23 Basecamp outings.
# Usage: python3 scripts/import-troopwebhost.py <export.csv> <site-url> <leader-passcode> [--from YYYY-MM-DD] [--dry]
# Each event gets a stable id (date + name), so re-running updates instead of duplicating.
import csv, sys, json, re, hashlib, datetime as dt, urllib.request

args = [a for a in sys.argv[1:] if not a.startswith('--')]
CSV, SITE, PASS = args[0], args[1].rstrip('/'), args[2]
FROM = dt.date.fromisoformat(sys.argv[sys.argv.index('--from') + 1]) if '--from' in sys.argv else dt.date(2026, 8, 1)
DRY = '--dry' in sys.argv

TYPE = {
    'Campout': 'campout', 'Hike': 'hike', 'Bike Ride': 'hike', 'Paddle Sports': 'paddle',
    'Summer Camp': 'camp', 'Winter Camp': 'camp', 'National High Adventure Camp': 'camp',
    'Community Service': 'service', 'Service Hours': 'service', 'Living Christmas': 'service', 'Wallwood Workday': 'service',
    'Christmas Tree Sales': 'fundraiser', 'Fundraiser': 'fundraiser',
    'Troop Meeting': 'meeting', 'Council/Committee Meetings': 'meeting', 'Patrol Leadership Council Meeting': 'meeting',
    'Assistant Scoutmaster Meeting': 'meeting', 'Outdoor Activities Committee': 'meeting', 'Scout Rank Scoutmaster Conference': 'meeting', 'Scoutmaster Conference': 'meeting',
    'Merit Badge Opportunity': 'merit', 'Training': 'training', 'Order of the Arrow Fellowship': 'oa', 'OA Event': 'oa',
    'Pack Outreach Event': 'service', 'Webelos Event': 'service',
}
SKIP_NAMES = {'thanksgiving', 'christmas', 'new years', "new year's", 'easter', 'memorial day', 'spring break', 'labor day', 'independence day', 'fourth of july'}
TBD = {'location pending (tbd)', 'to be determined', 'tbd', ''}

def parse(s):
    s = s.strip()
    for f, timed in (('%m/%d/%y %I:%M %p', True), ('%m/%d/%y', False), ('%m/%d/%Y %I:%M %p', True), ('%m/%d/%Y', False)):
        try: return dt.datetime.strptime(s, f), timed
        except ValueError: pass
    return None, False

def when(d, timed):
    return f"{d.strftime('%a')} {d.strftime('%I:%M %p').lstrip('0')}" if timed else ''

def leaders(s):
    s = re.sub(r'(?<!Mc)(?<!Mac)([a-z])([A-Z])', r'\1, \2', s.strip())
    return s

def kind(t, name):
    n = name.lower()
    if t == 'Other' or t not in TYPE:
        if re.search(r'tubing|canoe|kayak|paddl', n): return 'paddle'
        if re.search(r'meeting|planning', n): return 'meeting'
        if re.search(r'campout|camping', n): return 'campout'
        if re.search(r'hike|hiking', n): return 'hike'
    return TYPE.get(t, 'other')

rows = list(csv.DictReader(open(CSV, encoding='utf-8-sig', errors='replace')))
out = []
for r in rows:
    start, st_timed = parse(r['Start'])
    end, en_timed = parse(r['End'] or r['Start'])
    if not start or start.date() < FROM: continue
    name = r['Event'].strip()
    if name.lower() in SKIP_NAMES or 'admin event only' in name.lower(): continue
    cancelled = bool(re.match(r'^\s*cancel+ed\b', name, re.I))
    title = re.sub(r'^\s*cancel+ed\s*[-–:]\s*', '', name, flags=re.I)
    loc = r['Location'].strip()
    details = []
    if r['Highlights'].strip(): details.append(r['Highlights'].strip())
    if r['Subgroup'].strip(): details.append(f"For: {r['Subgroup'].strip()}")
    if r['Leaders'].strip(): details.append(f"Leaders: {leaders(r['Leaders'])}")
    if r['Campout Nights'].strip() and r['Campout Nights'].strip() not in ('0', ''): details.append(f"Nights: {r['Campout Nights'].strip()}")
    if r['Distance'].strip(): details.append(f"About {r['Distance'].strip()} miles away")
    if r['Sign-Up Deadline'].strip(): details.append(f"Sign up by {r['Sign-Up Deadline'].strip()} on TroopWebHost")
    details.append(f"TroopWebHost category: {r['Type'].strip()}")
    cost = r['Est Cost'].strip()
    if cost in ('0', '0.00', 'N/A', 'n/a'): cost = ''
    doc = {
        'title': title[:80], 'type': kind(r['Type'].strip(), name),
        'start': start.date().isoformat(), 'end': (end or start).date().isoformat(),
        'location': '' if loc.lower() in TBD else loc,
        'meetTime': when(start, st_timed), 'meetPlace': r['Departing From'].strip(),
        'returnTime': when(end, en_timed) if end and en_timed and (end != start) else '',
        'cost': cost[:60], 'details': '\n'.join(details), 'extras': [], 'cancelled': cancelled,
    }
    oid = 'o-twh-' + hashlib.sha1(f"{doc['start']}|{name}".encode()).hexdigest()[:10]
    out.append((oid, doc))

print(f'{len(out)} events to import from {FROM}')
ok = 0
for oid, doc in out:
    if DRY: print(oid, doc['start'], doc['type'], doc['title']); continue
    req = urllib.request.Request(f'{SITE}/api/c/outings/{oid}', data=json.dumps({**doc, '_by': 'TroopWebHost import'}).encode(), method='PUT',
                                 headers={'content-type': 'application/json', 'x-leader-passcode': PASS})
    try: urllib.request.urlopen(req, timeout=30); ok += 1
    except Exception as e: print('FAILED', doc['title'], e)
if not DRY: print(f'imported {ok}/{len(out)}')
