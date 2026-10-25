# Fill the demo troop (its own data store) with made-up sample data for showing off the app.
#   python3 scripts/seed-demo.py http://localhost:5288 leader
#   python3 scripts/seed-demo.py https://troop23-basecamp.netlify.app <LEADER_PASSCODE>
# Every name, photo and message here is invented. Sign in with XXXX-XXXX (leader) or XXXX-XXXS (scout),
# or type "demo" as the troop code for a guest look.
import base64, datetime as dt, io, json, random, sys, urllib.request, urllib.error
from PIL import Image, ImageDraw, ImageFilter

BASE = sys.argv[1].rstrip('/') + '/api/'; PASS = sys.argv[2]
random.seed(23)
TODAY = dt.date.today()
D = lambda n: (TODAY + dt.timedelta(days=n)).isoformat()

def call(path, body=None, method=None, s=None, leader=False):
    h = {'content-type': 'application/json', 'x-troop-code': 'demo'}
    if leader: h['x-leader-passcode'] = PASS
    if s: h['x-session'] = s
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ('POST' if body is not None else 'GET'))
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read() or b'{}')
    except urllib.error.HTTPError as e: raise SystemExit(f'{path}: {e.code} {e.read()[:300]}')

assert call('demo').get('demo') is True, 'server did not route to the demo store'
if call('leader/members', leader=True).get('members'):
    print('Demo troop already has people; adding anything missing (re-run safe).')

# ---------------------------------------------------------------- settings & people
PATROLS = ['Eagles', 'Foxes', 'Wolverines', 'Adults']
call('leader/settings', {'patrols': PATROLS, 'aiHelper': True}, leader=True)
scouts = [  # first, last, patrol, rank, positions, badges earned
  ('Demo', 'Scout', 'Eagles', 'First Class', ['Patrol Leader'], 9), ('Mason', 'Reyes', 'Eagles', 'Star', ['Senior Patrol Leader'], 14),
  ('Liam', 'Carter', 'Eagles', 'Second Class', [], 4), ('Ethan', 'Brooks', 'Foxes', 'Life', ['Patrol Leader', 'Quartermaster'], 22),
  ('Noah', 'Patel', 'Foxes', 'Tenderfoot', [], 2), ('Caleb', 'Nguyen', 'Foxes', 'Scout', [], 0),
  ('Owen', 'Harris', 'Wolverines', 'Star', ['Patrol Leader', 'Scribe'], 15), ('Jack', 'Lopez', 'Wolverines', 'First Class', ['Den Chief'], 8),
  ('Ava', 'Kim', 'Wolverines', 'Second Class', [], 3),
]
adults = [  # first, last, leader, positions
  ('Demo', 'Leader', True, ['Scoutmaster']), ('Pat', 'Morgan', True, ['Committee Chair']), ('Chris', 'Reyes', True, ['Assistant Scoutmaster']),
  ('Jordan', 'Carter', False, ['Parent']), ('Sam', 'Brooks', True, ['Advancement Chair', 'Merit Badge Counselor']), ('Riley', 'Patel', False, ['Parent']),
]
RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle']
BADGES = [('First Aid', True), ('Camping', True), ('Cooking', True), ('Swimming', True), ('Citizenship in the Community', True), ('Environmental Science', True),
          ('Personal Fitness', True), ('Communication', True), ('Fishing', False), ('Kayaking', False), ('Wilderness Survival', False), ('Pioneering', False),
          ('Geocaching', False), ('Astronomy', False), ('Fingerprinting', False), ('Leatherwork', False), ('Archery', False), ('Rifle Shooting', False),
          ('Space Exploration', False), ('Chess', False), ('Robotics', False), ('Woodwork', False)]
members, adv = [], []
for i, (f, l, pt, rank, pos, nb) in enumerate(scouts):
    totals = {'nights': random.randint(4, 40), 'hiking': random.randint(5, 60), 'service': random.randint(3, 50)}
    ri = RANKS.index(rank); start = TODAY - dt.timedelta(days=200 * (ri + 1))
    ranks = [{'rank': r, 'earned': (start + dt.timedelta(days=170 * k)).isoformat(), 'awarded': ''} for k, r in enumerate(RANKS[:ri + 1])]
    earned = [{'name': n, 'eagle': e, 'earned': (TODAY - dt.timedelta(days=20 + 37 * k)).isoformat(), 'awarded': ''} for k, (n, e) in enumerate(BADGES[:nb])]
    inprog = [{'name': n, 'eagle': e, 'started': D(-60), 'done': random.randint(2, 9), 'left': random.randint(1, 6), 'counselor': 'Sam Brooks' if e else ''} for n, e in BADGES[nb:nb + 2]]
    acts = [{'event': 'Fall Campout at Wakulla Springs', 'date': D(-35), 'nights': 2, 'service': 0, 'hiking': 3, 'paddling': 0},
            {'event': 'Food Drive Service Project', 'date': D(-21), 'nights': 0, 'service': 3, 'hiking': 0, 'paddling': 0},
            {'event': 'Leon Sinks Day Hike', 'date': D(-9), 'nights': 0, 'service': 0, 'hiking': 6, 'paddling': 0}]
    nxt = RANKS[min(ri + 1, 6)]
    members.append({'first': f, 'last': l, 'role': 'scout', 'patrol': pt, 'positions': pos, 'rank': rank, 'rankDate': ranks[-1]['earned'], 'totals': totals,
                    **({'code': 'XXXX-XXXS'} if (f, l) == ('Demo', 'Scout') else {})})
    adv.append({'key': f'{l.lower()}|{f.lower()}', 'eagleReq': sum(1 for b in earned if b['eagle']), 'next': {'rank': nxt, 'done': random.randint(2, 8), 'total': 12},
                'record': {'rank': rank, 'rankDate': ranks[-1]['earned'], 'ranks': ranks, 'badges': earned, 'inProgress': inprog, 'activity': acts}})
for f, l, lead, pos in adults:
    members.append({'first': f, 'last': l, 'role': 'adult', 'patrol': 'Adults', 'positions': pos, 'leader': lead, **({'code': 'XXXX-XXXX'} if (f, l) == ('Demo', 'Leader') else {})})
groups = [{'name': 'Request a Board of Review', 'kind': 'contact', 'emoji': '🎖️', 'description': 'Ready for a rank? Ask the advancement team.', 'keys': ['brooks|sam', 'leader|demo']},
          {'name': "Request a Scoutmaster's Conference", 'kind': 'contact', 'emoji': '🤝', 'description': 'Set up your conference for your next rank.', 'keys': ['leader|demo', 'reyes|chris']},
          {'name': 'High Adventure Crew 2027', 'kind': 'board', 'emoji': '🏔️', 'description': 'Planning for next summer.', 'keys': ['reyes|mason', 'brooks|ethan', 'harris|owen', 'reyes|chris', 'leader|demo']}]
call('leader/import', {'members': members, 'adv': adv, 'groups': groups, 'guardians': {'scoutmaster': 'leader|demo', 'chair': 'morgan|pat'}}, leader=True)
P = {m['name']: m for m in call('leader/members', leader=True)['members']}
for parent, kids in [('Jordan Carter', ['Liam Carter']), ('Sam Brooks', ['Ethan Brooks']), ('Riley Patel', ['Noah Patel']), ('Chris Reyes', ['Mason Reyes'])]:
    call(f"leader/members/{P[parent]['id']}", {'scouts': [P[k]['id'] for k in kids]}, leader=True)
sess = {n: call('auth/redeem', {'code': P[n]['code']})['token'] for n in ['Demo Leader', 'Demo Scout', 'Mason Reyes', 'Ethan Brooks', 'Owen Harris', 'Pat Morgan', 'Jordan Carter']}

# ---------------------------------------------------------------- outings
def outing(oid, **o): call(f'c/outings/{oid}', o, method='PUT', leader=True); return oid
O = {}
O['camp'] = outing('o-demo-campout', title='Fall Campout at Torreya State Park', type='campout', start=D(6), end=D(8), location='Torreya State Park', address='2576 NW Torreya Park Rd, Bristol, FL 32321',
    mapQ='Torreya State Park', meetTime='Fri 5:30 PM', meetPlace='Church parking lot', returnTime='Sun 12:00 PM', cost='$25', details='Two nights of tent camping on the bluffs above the Apalachicola River. Saturday: 7-mile Torreya Challenge loop, knots and lashing for rank advancement, campfire program Saturday night.\n\nPatrols plan and cook their own meals. Bring your Scout handbook.', extras=['Rain fly', 'Headlamp with fresh batteries', 'Mess kit'])
O['service'] = outing('o-demo-service', title='Park Cleanup Service Project', type='service', start=D(13), location='Tom Brown Park', address='501 Easterwood Dr, Tallahassee, FL 32311', mapQ='Tom Brown Park', meetTime='8:30 AM', meetPlace='Pavilion 3', details='Litter pickup and trail trimming with the city parks crew. Counts toward service hours. Gloves provided; bring water.')
O['coh'] = outing('o-demo-coh', title='Court of Honor', type='meeting', start=D(17), location='Troop meeting hall', meetTime='7:00 PM', details='Celebrate rank advancements and merit badges. Families welcome — bring a dessert to share.')
O['hike'] = outing('o-demo-hike', title='Leon Sinks Geological Area Hike', type='hike', start=D(27), location='Leon Sinks Geological Area', address='Crawfordville Hwy, Tallahassee, FL 32305', mapQ='Leon Sinks Geological Area', meetTime='9:00 AM', details='5 miles past sinkholes and karst. Good for Second Class hiking requirements.')
O['paddle'] = outing('o-demo-paddle', title='Wakulla River Paddle', type='paddle', start=D(41), location='Wakulla River', mapQ='Wakulla River canoe launch', meetTime='8:00 AM', cost='$15 canoe rental', details='6 miles downstream. Swim check required.')
O['camp2'] = outing('o-demo-winter', title='Winter Camp at Camp Wallwood', type='camp', start=D(58), end=D(61), location='Camp Wallwood', meetTime='Sat 9:00 AM', details='Merit badge classes all week: Cooking, First Aid, Wilderness Survival, Pioneering.')
O['past1'] = outing('o-demo-past1', title='Fall Campout at Wakulla Springs', type='campout', start=D(-35), end=D(-33), location='Wakulla Springs State Park')
O['past2'] = outing('o-demo-past2', title='Food Drive Service Project', type='service', start=D(-21), location='Second Harvest Food Bank')
O['past3'] = outing('o-demo-past3', title='Leon Sinks Day Hike', type='hike', start=D(-9), location='Leon Sinks Geological Area')
O['past4'] = outing('o-demo-past4', title='Summer Camp', type='camp', start=D(-110), end=D(-104), location='Camp Daniel Boone')
for n, st in [('Demo Scout', 'yes'), ('Mason Reyes', 'yes'), ('Ethan Brooks', 'yes'), ('Owen Harris', 'maybe'), ('Demo Leader', 'yes'), ('Pat Morgan', 'yes')]:
    m = P[n]; call(f"c/rsvps/{O['camp']}__{m['id']}", {'outingId': O['camp'], 'memberId': m['id'], 'name': n, 'patrol': m['patrol'], 'role': 'scout' if m['role'] == 'scout' else 'adult', 'status': st}, method='PUT', s=sess[n])
for n in ['Liam Carter', 'Noah Patel', 'Jack Lopez', 'Ava Kim', 'Caleb Nguyen']:
    m = P[n]; call(f"c/rsvps/{O['camp']}__{m['id']}", {'outingId': O['camp'], 'memberId': m['id'], 'name': n, 'patrol': m['patrol'], 'role': 'scout', 'status': 'yes'}, method='PUT', leader=True)

# ---------------------------------------------------------------- meal plan for the Eagles
recipes = {r['title']: r for r in call('c/recipes')['items']}
def meal(mid, slot, title):
    r = recipes.get(title) or next(iter(recipes.values()))
    return {'id': mid, 'slot': slot, 'recipeId': r['id'], 'title': r['title'], 'serves': 4, 'ingredients': r.get('ingredients', []), 'notes': ''}
names = list(recipes)
pick = lambda *keys: next((t for t in names if any(k.lower() in t.lower() for k in keys)), names[0])
plan_id = f"{O['camp']}__eagles"
call(f'c/plans/{plan_id}', {'outingId': O['camp'], 'patrol': 'Eagles', 'grubmaster': 'Demo Scout', 'headcount': 4, 'budget': 60, 'meals': [
    meal('m1', 'Fri dinner', pick('foil', 'chili')), meal('m2', 'Sat breakfast', pick('pancake', 'burrito', 'breakfast')), meal('m3', 'Sat lunch', pick('quesadilla', 'grilled cheese', 'wrap')),
    meal('m4', 'Sat dinner', pick('dutch oven chicken', 'jambalaya', 'chili mac')), meal('m5', 'Sat dessert', pick('cobbler', 'banana')), meal('m6', 'Sun breakfast', pick('biscuits', 'french toast'))]}, method='PUT', s=sess['Demo Scout'])
call(f'plans/{plan_id}/spend', {'amount': 42.17, 'note': 'Publix run', 'by': 'Demo Scout'}, s=sess['Demo Scout'])
call(f'plans/{plan_id}/duties', {'roles': ['Cook', 'Assistant cook', 'Fire & water', 'Cleanup'], 'grid': {f'm{i}': {'Cook': n[0], 'Assistant cook': n[1], 'Fire & water': n[2], 'Cleanup': n[3]} for i, n in
    zip(range(1, 7), [('Demo', 'Mason', 'Liam', 'Mr. Reyes'), ('Mason', 'Liam', 'Demo', 'Mr. Reyes'), ('Liam', 'Demo', 'Mason', 'Mr. Reyes')] * 2)}}, s=sess['Demo Scout'])

# ---------------------------------------------------------------- gear, pantry, bulletin, counselors, places
gear = [('Eureka 4-person tent', 'Shelter', 'T-01'), ('Eureka 4-person tent', 'Shelter', 'T-02'), ('Eureka 4-person tent', 'Shelter', 'T-03'), ('Dining fly 12x12', 'Shelter', 'F-01'),
        ('Two-burner propane stove', 'Cooking', 'S-01'), ('12" Dutch oven', 'Cooking', 'DO-1'), ('Eagles patrol box', 'Cooking', 'PB-E'), ('Foxes patrol box', 'Cooking', 'PB-F'),
        ('5-gal water jug', 'Water', 'W-01'), ('Lantern (LED)', 'Lighting', 'L-01'), ('First aid kit (troop)', 'Safety', 'FA-1'), ('Hatchet', 'Tools', 'H-01')]
for i, (n, c, t) in enumerate(gear):
    call(f'c/gear/g-demo-{i}', {'name': n, 'category': c, 'tag': t, 'qty': 1, 'condition': 'repair' if t == 'H-01' else 'good', 'location': 'Trailer'}, method='PUT', leader=True)
for gid in ['g-demo-0', 'g-demo-4', 'g-demo-6']:
    try: call(f'gear/{gid}/checkout', {'who': 'Demo Scout', 'memberId': P['Demo Scout']['id'], 'patrol': 'Eagles', 'outingId': O['camp'], 'outingTitle': 'Fall Campout at Torreya State Park', 'due': D(9)}, s=sess['Demo Scout'])
    except SystemExit: pass
for i, (n, q, u, loc, low) in enumerate([('Cooking oil', 1, 'bottle', 'Eagles patrol box', False), ('Salt & pepper', 1, 'set', 'Eagles patrol box', False), ('Heavy-duty foil', 2, 'roll', 'Trailer', False),
                                          ('Dish soap', 1, 'bottle', 'Trailer', True), ('Trash bags', 1, 'box', 'Trailer', True), ('Matches', 4, 'box', 'Trailer', False)]):
    call(f'c/pantry/p-demo-{i}', {'name': n, 'qty': q, 'unit': u, 'location': loc, 'low': low}, method='PUT', leader=True)
call('c/posts/post-demo-1', {'title': 'Campout permission slips due Wednesday', 'body': 'Turn in the form and $25 at the meeting. Patrols: finish your meal plans in Basecamp by Wednesday night.', 'pinned': True, '_by': 'Demo Leader'}, method='PUT', leader=True)
call('c/posts/post-demo-2', {'title': 'Welcome to the Basecamp demo', 'body': 'This is a sample troop with made-up scouts, outings and photos. Look around — nothing here is real.', '_by': 'Demo Leader'}, method='PUT', leader=True)
for i, (n, b) in enumerate([('Sam Brooks', ['First Aid', 'Emergency Preparedness', 'Personal Fitness']), ('Chris Reyes', ['Camping', 'Cooking', 'Wilderness Survival', 'Pioneering']),
                            ('Pat Morgan', ['Citizenship in the Community', 'Citizenship in the Nation', 'Communication']), ('Dana Whitfield', ['Kayaking', 'Canoeing', 'Swimming'])]):
    call(f'c/counselors/mbc-demo-{i}', {'memberId': P.get(n, {}).get('id', ''), 'name': n, 'badges': b, 'active': True, 'notes': 'Outside counselor (district list)' if n not in P else ''}, method='PUT', leader=True)
for i, (n, a, q) in enumerate([('Torreya State Park', '2576 NW Torreya Park Rd, Bristol, FL 32321', 'Torreya State Park'), ('Tom Brown Park', '501 Easterwood Dr, Tallahassee, FL 32311', 'Tom Brown Park'),
                               ('Leon Sinks Geological Area', 'Crawfordville Hwy, Tallahassee, FL 32305', 'Leon Sinks Geological Area'), ('Wakulla Springs State Park', '465 Wakulla Park Dr, Wakulla Springs, FL 32327', 'Wakulla Springs State Park')]):
    call(f'c/places/pl-demo-{i}', {'name': n, 'address': a, 'mapQ': q}, method='PUT', leader=True)

# ---------------------------------------------------------------- photos (drawn here; no real people)
def scene(kind, w=1200, h=900):
    sky = {'sunset': [(255, 170, 90), (120, 70, 140)], 'day': [(150, 205, 240), (225, 240, 250)], 'night': [(18, 24, 60), (60, 50, 110)], 'dawn': [(250, 210, 160), (160, 200, 230)]}[kind[0]]
    im = Image.new('RGB', (w, h)); d = ImageDraw.Draw(im)
    for y in range(h): t = y / h; d.line([(0, y), (w, y)], fill=tuple(int(sky[0][k] * (1 - t) + sky[1][k] * t) for k in range(3)))
    if kind[0] == 'night':
        for _ in range(140): x, y = random.randrange(w), random.randrange(h // 2); d.ellipse([x, y, x + 3, y + 3], fill=(255, 255, 230))
    else: d.ellipse([w * .7, h * .12, w * .7 + 120, h * .12 + 120], fill=(255, 236, 160))
    for k, col in enumerate([(70, 110, 90), (40, 80, 60), (25, 55, 40)]):
        base = h * (.55 + .1 * k); pts = [(0, h)] + [(x, base - random.randint(0, 160 - 40 * k)) for x in range(0, w + 100, 100)] + [(w, h)]
        d.polygon(pts, fill=col)
    if kind[1] == 'tents':
        for x, c in [(260, (240, 170, 40)), (620, (40, 150, 140)), (900, (220, 90, 60))]: d.polygon([(x, h * .86), (x + 110, h * .62), (x + 220, h * .86)], fill=c)
    if kind[1] == 'fire':
        d.rectangle([w / 2 - 90, h * .86, w / 2 + 90, h * .88], fill=(90, 50, 30))
        for r, c in [(80, (255, 120, 30)), (50, (255, 190, 60)), (25, (255, 240, 170))]: d.polygon([(w / 2 - r, h * .86), (w / 2, h * .86 - 3 * r), (w / 2 + r, h * .86)], fill=c)
    if kind[1] == 'lake':
        d.rectangle([0, h * .72, w, h], fill=(50, 110, 160)); d.polygon([(w * .35, h * .8), (w * .55, h * .8), (w * .52, h * .83), (w * .38, h * .83)], fill=(200, 80, 40))
    if kind[1] == 'trail':
        d.polygon([(w * .45, h), (w * .55, h), (w * .52, h * .7), (w * .5, h * .7)], fill=(190, 160, 110))
    return im.filter(ImageFilter.SMOOTH)
def b64(im, size):
    im = im.copy(); im.thumbnail((size, size)); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80); return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
call('leader/settings', {'autoApprove': True, 'by': 'Demo setup'}, leader=True)
shots = [(O['past1'], ('sunset', 'tents'), 'Tents up before dark', 'Eagles', D(-35)), (O['past1'], ('night', 'fire'), 'Campfire skits', '', D(-34)), (O['past1'], ('dawn', 'lake'), 'Morning on the spring', 'Foxes', D(-33)),
         (O['past2'], ('day', 'trail'), 'Loading the truck', '', D(-21)), (O['past3'], ('day', 'trail'), 'Trail past the sinks', 'Wolverines', D(-9)), (O['past3'], ('dawn', 'trail'), 'Lunch stop', 'Eagles', D(-9)),
         (O['past4'], ('day', 'lake'), 'Canoe merit badge', 'Foxes', D(-107)), (O['past4'], ('night', 'tents'), 'Last night at camp', '', D(-105)), (O['past4'], ('sunset', 'lake'), 'Sunset at the waterfront', 'Wolverines', D(-106))]
have = {p.get('caption') for p in call('photos')['photos']}
for album, kind, cap, patrol, taken in shots:
    if cap in have: continue
    im = scene(kind)
    call('photos', {'release': True, 'name': 'Demo Leader', 'role': 'leader', 'album': album, 'patrol': patrol, 'caption': cap, 'image': b64(im, 1600), 'thumb': b64(im, 480), 'takenAt': taken, 'source': 'Demo'})
call('leader/settings', {'autoApprove': False, 'by': 'Demo setup'}, leader=True)
call('consent', {'parent': {'name': 'Jordan Carter'}, 'scouts': [{'first': 'Liam', 'lastInitial': 'C', 'patrol': 'Eagles', 'level': 'public'}], 'signature': 'Jordan Carter', 'agreed': True})
call('consent', {'parent': {'name': 'Riley Patel'}, 'scouts': [{'first': 'Noah', 'lastInitial': 'P', 'patrol': 'Foxes', 'level': 'troop'}], 'signature': 'Riley Patel', 'agreed': True})

# ---------------------------------------------------------------- chat
threads = {t['id']: t for t in call('threads', s=sess['Demo Leader'])['threads']}
if not threads.get('board-troop', {}).get('last'):
    def say(tid, who, text, **kw): call(f'threads/{tid}/msgs', {'text': text, **kw}, s=sess[who])
    say('board-troop', 'Demo Leader', "Campout this weekend at Torreya! **Permission slips and $25 due Wednesday.** Patrols, finish your meal plans in Basecamp.")
    say('board-troop', 'Mason Reyes', 'SPL here — we\'ll do knots and lashing Saturday morning. Bring your handbooks.')
    say('board-troop', 'Ethan Brooks', 'Foxes have our menu done. Can we borrow the second Dutch oven?')
    say('board-troop', 'Demo Leader', '@Ethan yes, DO-1 is in the trailer. Check it out in the Gear locker so we know where it is.')
    pt = next(t for t in threads if t.startswith('patrol') and 'eagles' in t.lower()) if any(t.startswith('patrol') and 'eagles' in t.lower() for t in threads) else None
    if pt:
        say(pt, 'Demo Scout', 'Eagles: I put our menu in the meal plan. Foil dinners Friday, pancakes Saturday. Who can bring a griddle?')
        say(pt, 'Mason Reyes', 'I can bring ours. Also I have the patrol box checked out.')
    dm = call('threads', {'to': [P['Demo Scout']['id']]}, s=sess['Demo Leader'])['thread']['id']
    call(f'threads/{dm}/msgs', {'text': 'Great job planning the menu. When you get a minute, can you send me the shopping total so we can collect from families?', 'subject': 'Campout menu'}, s=sess['Demo Leader'])
    call(f'threads/{dm}/msgs', {'text': 'Yes sir! Shopping list says about $42. I\'ll bring the receipt Wednesday.'}, s=sess['Demo Scout'])
    call(f'threads/{dm}/msgs', {'text': 'Perfect. Also — are you ready to schedule your Star Scoutmaster conference?'}, s=sess['Demo Leader'])
    grp = next(g for g in call('threads', s=sess['Owen Harris'])['ask'] if g['name'].startswith('Request a Board'))
    req = call('threads', {'group': grp['id']}, s=sess['Owen Harris'])['thread']['id']
    call(f'threads/{req}/msgs', {'text': 'Hi, I finished my Life requirements and would like to schedule my board of review. I\'m free any Monday after the meeting.'}, s=sess['Owen Harris'])
    call(f'threads/{dm}/msgs', {'text': 'Not quite yet — I still need to finish Environmental Science. Can I ask about it at the Court of Honor?'}, s=sess['Demo Scout'])
print('Demo ready. Leader code XXXX-XXXX, scout code XXXX-XXXS, guest troop code "demo".')
