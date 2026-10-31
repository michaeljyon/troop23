# Access-control and safety checks against `npm run dev` (port 5288) with imported data.
# Run: python3 scripts/check-security.py   (uses local codes: troop23 / leader)
import json, base64, os, sys, urllib.request, urllib.error
BASE = 'http://localhost:5288/api/'; STORE = '.data/basecamp-troop23-tlh'
results = []

def call(path, body=None, method=None, troop=False, leader=False, s=None, raw=False):
    h = {'content-type': 'application/json'}
    if troop: h['x-troop-code'] = 'troop23'
    if leader: h['x-leader-passcode'] = 'leader'
    if s: h['x-session'] = s
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=h,
                               method=method or ('POST' if body is not None else 'GET'))
    try:
        res = urllib.request.urlopen(r); data = res.read()
        return res.status, (data if raw else (json.loads(data) if data[:1] in b'{[' else data.decode()))
    except urllib.error.HTTPError as e:
        data = e.read()
        try: return e.code, json.loads(data)
        except Exception: return e.code, data[:200]

def check(name, ok, detail=''):
    results.append((ok, name, detail)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

people = json.load(open(f'{STORE}/people'))
M = {m['id']: m for m in people['members']}
active = [m for m in people['members'] if m.get('active') is not False]
sm, chair = people['guardians']['scoutmaster'], people['guardians']['chair']
scout = next(m for m in active if m['role'] == 'scout' and m.get('patrol'))
other_scout = next(m for m in active if m['role'] == 'scout' and m['id'] != scout['id'] and m.get('patrol') != scout.get('patrol'))
parent = next(m for m in active if m['role'] != 'scout' and not m.get('leader') and m.get('scouts'))
adult = next(m for m in active if m['role'] != 'scout' and not m.get('leader') and m['id'] not in (sm, chair))
leader = next(m for m in active if m.get('leader') and m['id'] not in (sm, chair))
def sess(m):
    st, r = call('auth/redeem', {'code': m['code']}); assert st == 200, r; return r['token']
S = {k: sess(v) for k, v in dict(scout=scout, other=other_scout, parent=parent, adult=adult, leader=leader).items()}

# --- no credentials / troop code only
for path in ['c/outings', 'photos', 'albums', 'roster', 'settings', 'mbcatalog', 'threads', 'members', 'adv']:
    st, _ = call(path); check(f'no code: GET /{path} refused', st == 401, st)
for path in ['leader/members', 'leader/photos', 'leader/permissions', 'leader/export/signups', 'leader/reports', 'leader/ai-status']:
    st, _ = call(path); check(f'no code: GET /{path} refused', st == 401, st)
    st, _ = call(path, troop=True); check(f'troop code: GET /{path} refused', st == 401, st)
    st, _ = call(path, s=S['scout']); check(f'scout: GET /{path} refused', st == 401, st)
    st, _ = call(path, s=S['parent']); check(f'parent: GET /{path} refused', st == 401, st)
st, _ = call('leader/members', leader=True); check('leader passcode: GET /leader/members ok', st == 200, st)
st, _ = call('leader/members', s=S['leader']); check('leader account: GET /leader/members ok', st == 200, st)
st, _ = call('leader/settings', {'patrols': ['X'], 'autoApprove': True}, s=S['scout']); check('scout cannot change settings', st == 401, st)
for path in ['members', 'threads', 'adv']:
    st, _ = call(path, troop=True); check(f'troop code only: GET /{path} needs personal code', st == 401, st)
for col in ['outings', 'posts', 'counselors', 'places']:
    st, _ = call(f'c/{col}/x-test-1', {'title': 'Hack', 'name': 'Hack', 'start': '2030-01-01'}, method='PUT', troop=True)
    check(f'troop code cannot write {col}', st == 403, st)
    st, _ = call(f'c/{col}/x-test-1', {'title': 'Hack', 'name': 'Hack', 'start': '2030-01-01'}, method='PUT', s=S['scout'])
    check(f'scout cannot write {col}', st == 403, st)
for col in ['outings', 'gear', 'recipes', 'posts', 'counselors', 'places']:
    st, items = call(f'c/{col}', troop=True); first = (items.get('items') or [{}])[0].get('id') if st == 200 else None
    if first:
        st, _ = call(f'c/{col}/{first}', method='DELETE', troop=True); check(f'troop code cannot delete {col}', st == 403, st)
st, _ = call('c/outings/../../people', troop=True); check('path tricks rejected', st in (400, 404), st)

# --- calendar feed
st, _ = call('calendar.ics'); check('calendar feed without key refused', st == 401, st)
st, _ = call('calendar.ics?c=wrong'); check('calendar feed with wrong key refused', st == 401, st)
st, link = call('calendar/link', troop=True); key = (link.get('url') or link.get('webcal') or '') if isinstance(link, dict) else ''
import re; k = re.search(r'c=([0-9a-f]+)', json.dumps(link)); k = k and k.group(1)
st, ics = call(f'calendar.ics?c={k}', raw=True); ics = ics.decode() if isinstance(ics, bytes) else str(ics)
check('calendar feed with key works', st == 200 and 'BEGIN:VEVENT' in ics, st)
check('calendar feed has no private notes', not any(w in ics.lower() for w in ['medical', 'allerg', 'birthday']))

# --- photos: pending ones stay hidden
st, ph = call('leader/photos', leader=True)
allp = ph.get('photos', []); pend = [p for p in allp if p.get('status') == 'pending']
pub_ids = {p['id'] for p in call('photos', troop=True)[1]['photos']}
check('public photo list has only approved', all(p['status'] == 'approved' for p in allp if p['id'] in pub_ids), len(pub_ids))
if pend:
    st, _ = call(f"photos/{pend[0]['id']}", troop=True, raw=True); check('pending photo file not served to members', st == 404, st)
else:
    st, up = call('photos', {'data': 'data:image/png;base64,' + base64.b64encode(open('scripts/demo/' + sorted(os.listdir('scripts/demo'))[0], 'rb').read()).decode() if os.path.isdir('scripts/demo') else '', 'by': 'Sec Check', 'caption': 'sec-check'}, troop=True)
    print('  (no pending photos to test with)', st)

# --- advancement scoping
st, r = call('adv', s=S['scout']); check('scout sees only own advancement', st == 200 and [x['id'] for x in r['scouts']] == [scout['id']], r if st != 200 else len(r['scouts']))
st, _ = call(f"adv/{other_scout['id']}", s=S['scout']); check("scout cannot open another scout's record", st == 403, st)
st, r = call('adv', s=S['parent']); ids = [x['id'] for x in r.get('scouts', [])]
check('parent sees only own scouts', set(ids) <= set(parent['scouts']) and ids, ids)
st, _ = call(f"adv/{parent['scouts'][0]}", s=S['parent']); check("parent can open own scout's record", st == 200, st)
st, _ = call(f"adv/{other_scout['id']}", s=S['parent']) if other_scout['id'] not in parent['scouts'] else (403, 0)
check("parent cannot open another scout's record", st == 403, st)
st, r = call('adv', s=S['leader']); check('leader sees all scouts', st == 200 and len(r['scouts']) > 20, len(r.get('scouts', [])))

# --- directory privacy
st, r = call('members', s=S['scout']); blob = json.dumps(r)
check('directory has no personal codes', 'code' not in json.dumps([list(m.keys()) for m in r['members']]), list(r['members'][0].keys()))
check('directory has no contact/birthday fields', not re.search(r'"(email|phone|birth|dob|address|bsaId|medical)"', blob))
st, r = call('me', s=S['scout']); check('me returns own code only', st == 200 and r['member'].get('code') in (None, scout['code']), st)

# --- chat access
st, tl = call('threads', s=S['scout']); tids = {t['id']: t for t in tl['threads']}
check('scout cannot see adult-leaders board', not any('adult' in t['id'] for t in tl['threads']), [t['id'] for t in tl['threads']])
adult_board = next((t['id'] for t in call('threads', s=S['leader'])[1]['threads'] if 'adult' in t['id']), None)
if adult_board:
    st, _ = call(f'threads/{adult_board}', s=S['scout']); check('scout cannot open adult board directly', st == 404, st)
    st, _ = call(f'threads/{adult_board}/msgs', {'text': 'hi'}, s=S['scout']); check('scout cannot post to adult board', st == 404, st)
    st, _ = call('ai/coach', {'threadId': adult_board, 'draft': 'hi'}, s=S['scout']); check('writing helper cannot read adult board for scout', st == 404, st)
other_patrol = next((t['id'] for t in call('threads', s=S['other'])[1]['threads'] if t['kind'] == 'patrol' and t['id'] not in tids), None)
if other_patrol:
    st, _ = call(f'threads/{other_patrol}/msgs', {'text': 'hi'}, s=S['scout']); check("scout cannot post to another patrol's board", st == 404, st)
# a DM between the other scout and the leaders
st, dm = call('threads', {'to': [adult['id']]}, s=S['other']); dmid = dm['thread']['id']
st, t = call(f'threads/{dmid}', s=S['other']); mem = [p['id'] for p in t['people']]
check('new chat always includes Scoutmaster and Committee Chair', sm in mem and chair in mem, mem)
st, _ = call(f'threads/{dmid}', s=S['scout']); check("scout cannot open someone else's private chat", st == 404, st)
st, _ = call(f'threads/{dmid}/msgs', {'text': 'sneak'}, s=S['scout']); check("scout cannot post into someone else's chat", st == 404, st)

# --- attachments
png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
st, a = call(f'threads/{dmid}/att', {'name': 'dot.png', 'type': 'image/png', 'data': png, 'w': 1, 'h': 1}, s=S['other']); check('photo upload ok', st == 200, a)
aid = a['attachment']['id']
for nm, ty in [('x.html', 'text/html'), ('x.svg', 'image/svg+xml'), ('evil.exe', 'application/pdf'), ('x.js', 'text/plain')]:
    st, _ = call(f'threads/{dmid}/att', {'name': nm, 'type': ty, 'data': png}, s=S['other']); check(f'blocked upload {nm} ({ty})', st == 400, st)
big = 'data:application/pdf;base64,' + base64.b64encode(b'0' * (4 * 1024 * 1024 + 10)).decode()
st, _ = call(f'threads/{dmid}/att', {'name': 'big.pdf', 'type': 'application/pdf', 'data': big}, s=S['other']); check('oversize file refused', st in (400, 413), st)
st, _ = call(f'threads/{dmid}/att', {'name': 'dot.png', 'type': 'image/png', 'data': png}, s=S['scout']); check('non-member cannot upload into chat', st == 404, st)
st, _ = call(f'threads/{dmid}/att/{aid}', s=S['scout'], raw=True); check('non-member cannot download attachment', st == 404, st)
# post an email-style message with script and attach
evil = '<p>Hi <b>there</b></p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">x</a>'
st, m2 = call(f'threads/{dmid}/msgs', {'text': 'steal', 'attachments': [aid]}, s=S['adult'])
check("can't send someone else's attachment", not m2['message'].get('attachments'), m2)
st, m = call(f'threads/{dmid}/msgs', {'text': 'Hi there', 'subject': 'Test subject', 'html': evil, 'attachments': [aid]}, s=S['other'])
check('rich message sent', st == 200 and m['message'].get('attachments'), m)
check('script blocks stripped from stored HTML', '<script' not in m['message'].get('html', ''))
st, r = call(f'threads/{dmid}/att/{aid}', s=S['adult'], raw=True); check('member can download attachment', st == 200, st)
# report + hide
mid = m['message']['id']
st, _ = call(f'threads/{dmid}/msgs/{mid}/report', {'reason': 'sec check'}, s=S['adult']); check('member can report a message', st == 200, st)
st, reps = call('leader/reports', leader=True); rep = next(r for r in reps['reports'] if r['msgId'] == mid)
st, _ = call(f"leader/reports/{dmid}__{mid}", {'action': 'hide'}, leader=True); check('leader hides message', st == 200, st)
st, t = call(f'threads/{dmid}', s=S['adult']); hm = next(x for x in t['messages'] if x['id'] == mid)
check('hidden message text/html/attachments removed for members', not hm.get('text') and not hm.get('html') and not hm.get('attachments') and not hm.get('subject'), hm)
st, _ = call(f'threads/{dmid}/att/{aid}', s=S['adult'], raw=True); check('hidden attachment no longer downloads', st == 404, st)
st, _ = call(f'leader/att/{dmid}/{aid}', leader=True, raw=True); check('reviewing leader can still see hidden attachment', st == 200, st)
st, _ = call(f'leader/att/{dmid}/{aid}', s=S['scout'], raw=True); check('scout cannot use leader attachment route', st == 401, st)
st, tl2 = call('threads', s=S['adult']); last = next(x for x in tl2['threads'] if x['id'] == dmid)['last']
check('chat list preview does not leak hidden message', 'Test subject' not in (last or {}).get('text', ''), last)

# --- writing helper
st, r = call('ai/coach', {'draft': 'can i go', 'threadId': dmid}, s=S['other']); check('writing helper answers', st == 200 and (r.get('message') or r.get('tips')), (st, r))
st, _ = call('ai/coach', {'draft': 'x'}, troop=True); check('writing helper needs personal code', st == 401, st)
import datetime
uk = f"{STORE}/ai%2Fusage%2F{other_scout['id']}"; os.makedirs(STORE, exist_ok=True)
open(uk, 'w').write(json.dumps({'day': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d'), 'n': 40}))
st, r = call('ai/coach', {'draft': 'can i go camping'}, s=S['other']); check('writing helper daily limit (40) enforced', st == 429 or r.get('source') == 'tips', (st, r.get('source') if isinstance(r, dict) else r))
os.remove(uk)

# --- push
st, r = call('push/key', troop=True); check('push key available', st == 200 and len(r.get('publicKey', '')) > 40, st)
st, _ = call('push/subscribe', {'sub': {'endpoint': 'https://evil.example/x', 'keys': {'p256dh': 'a', 'auth': 'b'}}}, troop=True); check('push subscribe needs personal code', st == 401, st)
st, _ = call('push/subscribe', {'sub': {'endpoint': 'http://127.0.0.1/x', 'keys': {'p256dh': 'a', 'auth': 'b'}}}, s=S['scout']); check('push subscribe rejects non-https/garbage', st == 400, st)

# --- codes
st, _ = call('auth/redeem', {'code': 'AAAA-AAAA'}); check('bad personal code refused', st == 401, st)
inactive = next((m for m in people['members'] if m.get('active') is False), None)
if inactive: st, _ = call('auth/redeem', {'code': inactive['code']}); check('inactive member code refused', st == 401, st)
st, _ = call('auth/redeem', {'code': scout['code'].lower().replace('-', ' ')}); check('code is forgiving (lowercase/space)', st == 200, st)
st, _ = call('join', {'code': ' TROOP23 '}); check('troop code forgiving', st == 200, st)
st, _ = call('me', s='not-a-real-token'); check('fake session refused', st == 401, st)

# cleanup the test chat
import shutil
for f in os.listdir(STORE):
    if dmid in f: p = os.path.join(STORE, f); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
for tok in S.values():
    call('auth/signout', {}, s=tok)
bad = [r for r in results if not r[0]]
print(f'\n{len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- photo permission ("no photos") is enforced
cons = [json.load(open(f'{STORE}/{f}')) for f in os.listdir(STORE) if f.startswith('consents%2F')]
none_kid = next((s for c in cons for s in c['scouts'] if s['level'] == 'none'), None)
if none_kid:
    img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img, 'scouts': [none_kid['id']]}, troop=True); pid = r.get('photo', {}).get('id') or r.get('id')
    if not pid: pid = next(p['id'] for p in call('leader/photos', leader=True)[1]['photos'] if p.get('name') == 'Sec Check')
    st, r = call(f'leader/photos/{pid}', {'status': 'approved'}, leader=True)
    check('approving a photo of a "no photos" scout keeps it out of the gallery', r['photo']['status'] == 'hidden', r['photo']['status'])
    st, r = call(f'leader/photos/{pid}', {'public': True}, leader=True); check('cannot make it public', st == 400, st)
    cur = call('leader/settings', leader=True)[1]
    call('leader/settings', {'autoApprove': True, 'by': 'Sec Check'}, leader=True)
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img, 'scouts': [none_kid['id']]}, troop=True)
    st, ph = call('leader/photos', leader=True); mine = [p for p in ph['photos'] if p.get('name') == 'Sec Check']
    check('override toggle still holds back "no photos" scouts', all(p['status'] != 'approved' for p in mine), [p['status'] for p in mine])
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img}, troop=True)
    st, ph = call('leader/photos', leader=True); mine = [p for p in ph['photos'] if p.get('name') == 'Sec Check']
    check('override toggle auto-approves untagged photos', any(p['status'] == 'approved' for p in mine), [p['status'] for p in mine])
    call('leader/settings', {'autoApprove': bool(cur.get('autoApprove')), 'by': 'Sec Check'}, leader=True)
    for p in mine: call(f"leader/photos/{p['id']}", {'status': 'deleted'}, leader=True)
    st, r = call('photos', {'release': False, 'name': 'X', 'image': img}, troop=True); check('photo needs sharing agreement', st == 400, st)
    st, r = call('photos', {'release': True, 'name': 'X', 'image': 'data:text/html;base64,PHNjcmlwdD4='}, troop=True); check('non-image upload refused', st == 400, st)
bad = [r for r in results if not r[0]]
print(f'\nFINAL {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- demo troop is walled off from the real one
dl = call('auth/redeem', {'code': 'xxxx-xxxx'})
if dl[0] == 200:
    tok = dl[1]['token']; check('demo session token is marked', tok.startswith('demo'), tok[:6])
    st, r = call('leader/members', s=tok); names = {m['name'] for m in r.get('members', [])}
    check('demo leader only sees demo people', st == 200 and not (names & {m['name'] for m in active if m['name'] not in ('Demo Leader', 'Demo Scout')}), len(names))
    st, r = call('leader/members', s=tok, troop=True); check('demo token + real troop code still demo', not ({m['name'] for m in r.get('members', [])} & {scout['name']}), st)
    st, r = call('photos', troop=True); real_n = len(r['photos'])
    st, r = call('photos', s=tok); check('demo photos are separate', len(r['photos']) != real_n or real_n == 0, (len(r['photos']), real_n))
    st, _ = call('threads', s=S.get('scout') or ''); 
    call('auth/signout', {}, s=tok)
bad = [r for r in results if not r[0]]
print(f'\nWITH DEMO {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- hikes
S = {k: sess(v) for k, v in dict(scout=scout, other=other_scout, parent=parent, adult=adult, leader=leader).items()}
st, _ = call('hikes', troop=True); check('hikes need a personal code', st == 401, st)
pts = [[30.315 + i * 0.0001, -84.344, None, i * 8, 0] for i in range(40)]
st, r = call('hikes', {'points': pts, 'title': 'Sec hike', 'group': [other_scout['id'], 'm-not-real']}, s=S['scout'])
check('hike saves', st == 200, r)
hid = r['hike']['id']
check('unknown people dropped from hike group', 'm-not-real' not in r['hike']['group'] and scout['id'] in r['hike']['group'], r['hike']['group'])
st, _ = call(f'hikes/{hid}', {'title': 'hacked'}, method='PUT', s=S['other']); check('group member who did not record cannot edit', st == 403, st)
st, _ = call(f'hikes/{hid}', method='DELETE', s=S['parent']); check('others cannot delete a hike', st == 403, st)
st, r = call('hikes', {'points': [[91, 0, None, 0], ['x', 1, 2, 3]]}, s=S['scout']); check('junk track refused', st == 400, st)
st, r = call('hikes', {'manual': True, 'miles': 5000}, s=S['scout']); check('silly manual distance refused', st == 400, st)
st, _ = call(f'adv/{other_scout["id"]}/plan', s=S['scout']); check("scout cannot see another scout's suggestions", st == 403, st)
st, _ = call('leader/adv-needs', s=S['scout']); check('troop planning is leaders only', st == 401, st)
st, _ = call(f'hikes/{hid}', method='DELETE', leader=True); check('leader can delete a hike', st == 200, st)
bad = [r for r in results if not r[0]]
print(f'\nWITH HIKES {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]
for tok in S.values(): call('auth/signout', {}, s=tok)
