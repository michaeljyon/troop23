# Build a Basecamp import from TroopWebHost exports and send it to the site.
# Only troop-safe fields are kept: names, adult/scout, patrol, positions, rank,
# activity totals and advancement. Contact info, birthdays, ages, BSA IDs,
# medical, allergies, finances and addresses are never read into the payload.
#
# Usage: python3 scripts/import-troopwebhost-all.py <exports-folder> <site-url> <leader-passcode> [--dry]
import csv, sys, json, re, glob, os, hashlib, datetime as dt, urllib.request

FOLDER, SITE, PASS = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3]
DRY = '--dry' in sys.argv
def find(part):
    m = [f for f in glob.glob(os.path.join(FOLDER, '*')) if part.lower() in os.path.basename(f).lower() and f.lower().endswith('.csv')]
    return m[0] if m else None
def rows(path): return list(csv.DictReader(open(path, encoding='utf-8-sig', errors='replace'))) if path else []
def split_name(n):  # "Last, First M" -> (first, last)
    last, _, rest = n.partition(',')
    first = rest.strip().split(' ')[0] if rest.strip() else ''
    first = re.sub(r'^"|"$', '', first)
    return first.strip(), re.sub(r'\s+(Jr\.?|Sr\.?|II|III|IV)$', '', last.strip())
def key(first, last): return f"{last.strip().lower()}|{first.strip().lower()}"
def iso(d):
    for f in ('%m/%d/%Y', '%m/%d/%y'):
        try: return dt.datetime.strptime(d.strip(), f).date().isoformat()
        except ValueError: pass
    return ''
def patrol(p): return re.sub(r'\s*\([A-Z]\)\s*$', '', p or '').strip()
def num(x):
    try: return float(str(x).replace(',', '')) if str(x).strip() else 0
    except ValueError: return 0

DEMO = re.compile(r'demo|^test|scout2|dem0', re.I)
LEADER_POS = re.compile(r'scoutmaster|committee|chartered organization|treasurer|training coordinator|outdoor activities coordinator', re.I)
# positions TWH marks "Committee Member = Y" (Leadership_Positions export), plus the chair
COMMITTEE = {r['Title'].strip() for r in rows(find('Leadership_Positions')) if r.get('Adult') == 'Y' and r.get('Committee Member') == 'Y'} | {'Committee Chair', 'Committee Member'}

# ---- roster (safe columns only)
roster = rows(find('Active_Roster'))
perm = rows(find('User_Permissions'))
adult_leaders = {key(*split_name(r['User Name'])) for r in perm if r['Role'] in ('Adult Leader', 'Site Administrator')}
members, guardians, oa = [], {}, set()
for r in roster:
    first, last = split_name(r['Name'])
    pref = (r.get('Preferred Name') or '').strip()
    if pref and len(pref) < 20: first = pref
    if not first or DEMO.search(r['Name']): continue
    k = key(first, last)
    pos = [s.strip() for s in (r.get('Leadership') or '').split(',') if s.strip() and not s.strip().startswith('Z -')]
    adult = r['Adult'].strip().upper() == 'Y'
    m = {'first': first, 'last': last, 'role': 'adult' if adult else 'scout', 'patrol': '' if adult else patrol(r.get('Patrol')),
         'positions': pos, 'rank': '' if adult else (r.get('Rank') or '').strip(), 'rankDate': iso(r.get('Rank Date') or ''),
         'leader': adult and (bool(LEADER_POS.search(', '.join(pos))) or k in adult_leaders or any(x in COMMITTEE for x in pos))}
    if (r.get('OA Member') or '').strip().upper() == 'Y': oa.add(k)
    if not adult:
        m['totals'] = {'nights': num(r.get('Camping Nights')), 'hiking': num(r.get('Total Hiking Miles')), 'service': num(r.get('Total Service Hours'))}
    members.append(m)
    if re.search(r'(^|,\s*)Scoutmaster', r.get('Leadership') or ''): guardians['scoutmaster'] = k
    if 'Committee Chair' in (r.get('Leadership') or ''): guardians['chair'] = k
mkeys = {key(m['first'], m['last']): m for m in members}
# match "Last, First M" names from other reports to roster keys (first token only)
def mkey(name):
    f, l = split_name(name)
    k = key(f, l)
    if k in mkeys: return k
    cands = [kk for kk in mkeys if kk.startswith(l.lower() + '|')]
    return cands[0] if len(cands) == 1 else k

# ---- advancement
EAGLE_GROUPS = [['Camping'], ['Citizenship in the Community'], ['Citizenship in the Nation'], ['Citizenship in the World'], ['Communication'], ['Cooking'],
                ['Emergency Preparedness', 'Lifesaving'], ['Environmental Science', 'Sustainability'], ['Family Life'], ['First Aid'], ['Personal Fitness'],
                ['Personal Management'], ['Swimming', 'Hiking', 'Cycling']]
def base(b): return re.sub(r'\s*\((?:[^)]*rqmts|old rqmts)\)\s*$', '', b.lstrip('*')).strip()
adv = {}
def rec(k): return adv.setdefault(k, {'ranks': [], 'badges': [], 'inProgress': [], 'activity': []})
for r in rows(find('Rank_Advancement_History')):
    if DEMO.search(r['Scout']): continue
    rec(mkey(r['Scout']))['ranks'].append({'rank': r['Rank'], 'earned': iso(r['Date Earned']), 'awarded': iso(r['Date Awarded'])})
for r in rows(find('Merit_Badge_History')):
    if DEMO.search(r['Scout']): continue
    rec(mkey(r['Scout']))['badges'].append({'name': base(r['Merit Badge']), 'eagle': r['Merit Badge'].startswith('*'), 'earned': iso(r['Earned']), 'awarded': iso(r['Awarded'])})
for r in rows(find('Merit_Badges_In_Progress')):
    if DEMO.search(r['Scout']): continue
    done, left = int(num(r['Completed Requirements'])), int(num(r['Uncompleted Requirements']))
    rec(mkey(r['Scout']))['inProgress'].append({'name': base(r['Merit Badge']), 'eagle': r['Merit Badge'].startswith('*'), 'started': iso(r['Started']), 'done': done, 'left': left, 'counselor': r['Merit Badge Counselor'].strip()})
RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle']
PREFIX = {'Scout': 'BS', 'Tenderfoot': 'T', 'Second Class': 'SC', 'First Class': 'FC', 'Star': 'S', 'Life': 'L', 'Eagle': 'E'}
nexts = {}
req_rows = rows(find('Rank_Requirements_Earned'))
if req_rows:
    cols = list(req_rows[0].keys())
    for r in req_rows:
        if DEMO.search(r['Name']): continue
        cur = (r.get('Rank') or '').strip()
        nxt = RANKS[RANKS.index(cur) + 1] if cur in RANKS and cur != 'Eagle' else ('Scout' if not cur else None)
        if not nxt: continue
        pc = [c for c in cols if re.fullmatch(PREFIX[nxt] + r'\d+[a-z]?', c)]
        nexts[mkey(r['Name'])] = {'rank': nxt, 'done': sum(1 for c in pc if (r.get(c) or '').strip()), 'total': len(pc)}
# this scouting year's activity from participation
part = rows(find('Event_Participation'))
events = rows(find('Export_Events'))  # optional, for outing ids
def outing_id(start_iso, name): return 'o-twh-' + hashlib.sha1(f"{start_iso}|{name}".encode()).hexdigest()[:10]
attendance = []
for r in part:
    d = iso(r['Date'].split(' ')[0])
    if not d: continue
    k = mkey(r['Participant'])
    if k not in mkeys: continue
    if d >= '2026-08-01':
        attendance.append({'key': k, 'outingId': outing_id(d, r['Event'].strip())})
    if mkeys[k]['role'] == 'scout' and d >= '2025-08-01':
        rec(k)['activity'].append({'event': r['Event'].strip()[:80], 'date': d, 'nights': num(r['Camping Nights']), 'service': num(r['Service Hours']), 'hiking': num(r['Hiking Miles']), 'paddling': num(r['Paddling Miles'])})
adv_out = []
for k in [kk for kk, m in mkeys.items() if m['role'] == 'scout']:
    a = rec(k)
    m = mkeys[k]
    earned = {b['name'] for b in a['badges']}
    eagle_req = sum(1 for g in EAGLE_GROUPS if any(x in earned for x in g))
    a['ranks'].sort(key=lambda x: RANKS.index(x['rank']) if x['rank'] in RANKS else 99)
    a['badges'].sort(key=lambda x: x['earned'], reverse=True)
    a['inProgress'].sort(key=lambda x: (-x['done'] / max(1, x['done'] + x['left'])))
    a['activity'].sort(key=lambda x: x['date'], reverse=True)
    a.update({'rank': m['rank'], 'rankDate': m['rankDate'], 'eagleGroups': EAGLE_GROUPS, 'source': 'TroopWebHost export, Oct 24, 2026', 'totals': m.get('totals')})
    adv_out.append({'key': k, 'record': a, 'eagleReq': eagle_req, 'next': nexts.get(k)})

# ---- gear: equipment + merit badge library
gear = []
checked = {r['ID'].strip(): r for r in rows(find('Checked_Out_Items'))}
for r in rows(find('Inventory_Items')):
    gid = r['ID'].strip()
    if not gid: continue
    lib = r['Type'].strip() == 'Library'
    gname = re.sub(r'\s*-\s*EAGLE REQUIRED', '', gid).strip()
    item = {'id': 'g-twh-' + hashlib.sha1(f"{r['Type']}|{gid}".encode()).hexdigest()[:10], 'qty': 1, 'location': (r.get('Location') or '').strip()}
    if lib:
        item.update({'name': f"{gname} merit badge pamphlet", 'category': 'Merit badge library', 'tag': ('Eagle req.' if 'EAGLE REQUIRED' in gid else ''),
                     'notes': (r.get('Condition') or '').strip()})
    else:
        desc = (r.get('Description') or '').strip()
        name = 'Troop tent' if gid.lower().startswith('tent') else desc or gid
        item.update({'name': name, 'category': 'Shelter' if 'tent' in gid.lower() else 'Cooking' if 'stove' in (desc + gid).lower() else 'Other', 'tag': gid,
                     'notes': '; '.join(x for x in [(r.get('Condition') or '').strip(), f"Replacement cost ${r['Replacement Cost']}" if (r.get('Replacement Cost') or '').strip() else ''] if x)})
    c = checked.get(gid) or ({'Checked Out To': r.get('Checked Out To'), 'Date Checked Out': r.get('Date Checked Out')} if (r.get('Checked Out To') or '').strip() else None)
    if c and (c.get('Checked Out To') or '').strip():
        k = mkey(c['Checked Out To'])
        f, l = split_name(c['Checked Out To'])
        item.update({'checkoutKey': k, 'checkoutName': f"{f} {l}", 'checkoutAt': int(dt.datetime.fromisoformat(iso(c['Date Checked Out']) or '2024-01-01').timestamp() * 1000)})
    gear.append(item)

patrols = sorted({m['patrol'] for m in members if m['patrol']}) + ['Adults']
# ---- e-mail groups (Maintain_E-Mail_Groups has names only; members come from positions, roles and the roster)
def holders(rx): return [key(m['first'], m['last']) for m in members if any(re.search(rx, x, re.I) for x in m['positions'])]
adv_role = {key(*split_name(r['User Name'])) for r in perm if r['Role'] == 'Rank Advancement'}
sm = [guardians['scoutmaster']] if 'scoutmaster' in guardians else []
committee = [key(m['first'], m['last']) for m in members if m['role'] == 'adult' and any(x in COMMITTEE for x in m['positions'])]
asm = holders(r'^assistant scoutmaster$')
RULES = {
  'board of review': ('contact', '📋', 'Ready for a board of review? Ask here — the committee will set it up.', committee),
  'star, life': ('contact', '⭐', "Ready for a Scoutmaster conference for Star, Life or Eagle? Ask the Scoutmaster here.", sm),
  'tenderfoot': ('contact', '🧭', 'Ready for a Scoutmaster conference for Tenderfoot, Second or First Class? Ask here.', sm + asm),
  'adult patrol': ('board', '🛡️', 'Registered adult leaders.', [key(m['first'], m['last']) for m in members if m['leader']]),
  'advancement': ('board', '🎖️', 'Advancement team.', [k for k in adv_role if k in mkeys]),
  'all adults': ('board', '👪', 'All parents and adults in the troop.', [key(m['first'], m['last']) for m in members if m['role'] == 'adult']),
  'assistant scoutmasters': ('board', '🧢', '', asm),
  'committee members': ('board', '🏛️', 'Troop committee.', committee),
  'den chiefs': ('board', '🐾', 'Scouts serving as den chiefs.', holders(r'den chief')),
  'jr assistant': ('board', '🎒', 'Junior Assistant Scoutmasters.', holders(r'junior assistant scoutmaster')),
  'order of the arrow': ('board', '🏹', 'Order of the Arrow members.', sorted(k for k in oa if k in mkeys)),
  'outdoor activities': ('board', '🏕️', 'Plans outings and campouts.', holders(r'outdoor activities|summer.*camp|equipment')),
  'philmont': ('board', '⛰️', 'Philmont 2027 crew — leaders add crew members.', []),
}
groups = []
for r in rows(find('E-Mail_Groups')):
    name = (r.get('Group Name') or '').strip()
    if not name or name.lower().startswith('patrol -'): continue   # patrols already have their own boards
    rule = next((v for kk, v in RULES.items() if kk in name.lower()), None)
    if not rule: groups.append({'name': name, 'kind': 'board', 'keys': []}); continue
    kind, emoji, desc, keys = rule
    groups.append({'name': name.replace('Active Scouts to Request ', 'Request a ').replace(' - For Scouts to Request Leaders', '').replace(' - For Ranks ', ' — '),
                   'kind': kind, 'emoji': emoji, 'description': desc, 'keys': list(dict.fromkeys(keys))})
for g in groups: print(f"  group {g['kind']:7} {len(g['keys']):3}  {g['name']}")
payload = {'members': members, 'adv': adv_out, 'attendance': attendance, 'gear': gear, 'patrols': patrols, 'guardians': guardians, 'groups': groups}
print(f"members {len(members)} ({sum(m['role']=='scout' for m in members)} scouts, {sum(m['leader'] for m in members)} leaders) · adv {len(adv_out)} · attendance {len(attendance)} · gear {len(gear)} · patrols {patrols} · guardians {list(guardians)}")
if DRY: sys.exit(0)
req = urllib.request.Request(f'{SITE}/api/leader/import', data=json.dumps(payload).encode(), method='POST', headers={'content-type': 'application/json', 'x-leader-passcode': PASS})
print(urllib.request.urlopen(req, timeout=120).read().decode()[:600])
