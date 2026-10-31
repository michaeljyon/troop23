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
    check(f'troop code cannot write {col}', st in (401, 403), st)
    st, _ = call(f'c/{col}/x-test-1', {'title': 'Hack', 'name': 'Hack', 'start': '2030-01-01'}, method='PUT', s=S['scout'])
    check(f'scout cannot write {col}', st == 403, st)
for col in ['outings', 'gear', 'recipes', 'posts', 'counselors', 'places']:
    st, items = call(f'c/{col}', troop=True); first = (items.get('items') or [{}])[0].get('id') if st == 200 else None
    if first:
        st, _ = call(f'c/{col}/{first}', method='DELETE', troop=True); check(f'troop code cannot delete {col}', st in (401, 403), st)
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
    st, _ = call('photos', {'release': True, 'name': 'Sec Check', 'image': img, 'scouts': [none_kid['id']]}, troop=True); check('the troop code alone cannot share photos', st == 401, st)
    P2 = sess(parent)
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img, 'scouts': [none_kid['id']]}, s=P2); pid = r.get('photo', {}).get('id') or r.get('id')
    if not pid: pid = next(p['id'] for p in call('leader/photos', leader=True)[1]['photos'] if p.get('name') == 'Sec Check')
    st, r = call(f'leader/photos/{pid}', {'status': 'approved'}, leader=True)
    check('approving a photo of a "no photos" scout keeps it out of the gallery', r['photo']['status'] == 'hidden', r['photo']['status'])
    st, r = call(f'leader/photos/{pid}', {'public': True}, leader=True); check('cannot make it public', st == 400, st)
    cur = call('leader/settings', leader=True)[1]
    call('leader/settings', {'autoApprove': True, 'by': 'Sec Check'}, leader=True)
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img, 'scouts': [none_kid['id']]}, s=P2)
    st, ph = call('leader/photos', leader=True); mine = [p for p in ph['photos'] if p.get('name') == 'Sec Check']
    check('override toggle still holds back "no photos" scouts', all(p['status'] != 'approved' for p in mine), [p['status'] for p in mine])
    st, r = call('photos', {'release': True, 'name': 'Sec Check', 'image': img}, s=P2)
    st, ph = call('leader/photos', leader=True); mine = [p for p in ph['photos'] if p.get('name') == 'Sec Check']
    check('override toggle auto-approves untagged photos', any(p['status'] == 'approved' for p in mine), [p['status'] for p in mine])
    call('leader/settings', {'autoApprove': bool(cur.get('autoApprove')), 'by': 'Sec Check'}, leader=True)
    for p in mine: call(f"leader/photos/{p['id']}", {'status': 'deleted'}, leader=True)
    st, r = call('photos', {'release': False, 'name': 'X', 'image': img}, s=P2); check('photo needs sharing agreement', st == 400, st)
    st, r = call('photos', {'release': True, 'name': 'X', 'image': 'data:text/html;base64,PHNjcmlwdD4='}, s=P2); check('non-image upload refused', st == 400, st)
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

# --- games
import subprocess
Q = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {QUESTIONS} from './troop/quiz.js'; console.log(JSON.stringify(QUESTIONS.filter(q=>q.type==='mc').slice(0,3)))"]))
st, _ = call('quiz/result', {'mode': 'trail', 'answers': [{'id': Q[0]['id'], 'a': Q[0]['a']}]}, troop=True); check('game scores need a personal code', st == 401, st)
st, r = call('quiz/result', {'mode': 'trail', 'answers': [{'id': q['id'], 'a': (q['a'] + 1) % 4} for q in Q], 'points': 99999, 'xp': 99999}, s=S['scout'])
check('wrong answers score nothing (server checks every answer)', st == 200 and r['right'] == 0 and r['points'] == 0, r)
st, r = call('quiz/result', {'mode': 'trail', 'answers': [{'id': 'fake1', 'a': 0}, {'id': Q[0]['id'], 'a': Q[0]['a']}]}, s=S['scout'])
check('made-up question ids are ignored', st == 200 and r['of'] == 1 and r['right'] == 1, r)
st, r = call('quiz/result', {'mode': 'daily', 'answers': [{'id': Q[0]['id'], 'a': Q[0]['a']}]}, s=S['scout'])
check("only today's questions count for the Daily Challenge", st in (400, 409), st)
st, d = call('quiz/daily', s=S['other'])
if not d.get('done'):
    call('quiz/result', {'mode': 'daily', 'answers': [{'id': i, 'a': 0} for i in d['ids']]}, s=S['other'])
st, _ = call('quiz/result', {'mode': 'daily', 'answers': [{'id': i, 'a': 0} for i in d['ids']]}, s=S['other']); check('Daily Challenge only once a day', st == 409, st)
st, r = call('quiz/live', {'count': 3}, s=S['scout']); code = r['code']
st, _ = call(f'quiz/live/{code}/start', {}, s=S['other']); check('only the host can start a live game', st == 403, st)
call(f'quiz/live/{code}/start', {}, s=S['scout'])
st, _ = call(f'quiz/live/{code}/answer', {'qi': 0, 'choice': 0}, s=S['parent']); check("can't answer a live game without joining", st == 403, st)
st, g = call(f'quiz/live/{code}', s=S['other'])
check('live question never includes the answer', 'a' not in g['question'] and 'why' not in g['question'] and 'orders' not in g, list(g['question'].keys()))
st, _ = call(f'quiz/live/{code}/end', {}, s=S['other']); check('only the host can end a live game', st == 403, st)
call(f'quiz/live/{code}/end', {}, s=S['scout'])
bad = [r for r in results if not r[0]]
print(f'\nWITH GAMES {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- uniform inspections
pl = next(m for m in active if m['role'] == 'scout' and any(p == 'Patrol Leader' for p in m.get('positions', [])))
pl_patrol = pl['patrol']
mate = next(m for m in active if m['role'] == 'scout' and m.get('patrol') == pl_patrol and m['id'] != pl['id'] and not any('Leader' in p for p in m.get('positions', [])))
mate2 = next((m for m in active if m['role'] == 'scout' and m.get('patrol') == pl_patrol and m['id'] not in (pl['id'], mate['id'])), None)
outsider = next(m for m in active if m['role'] == 'scout' and m.get('patrol') and m['patrol'] != pl_patrol and not re.search(r'senior|troop guide|\bspl\b', ', '.join(m.get('positions', [])), re.I))
S.update(pl=sess(pl), mate=sess(mate), outsider=sess(outsider))
st, _ = call('inspect', troop=True); check('inspections need a personal code', st == 401, st)
st, _ = call('inspect', {'patrol': pl_patrol, 'scouts': [{'id': mate['id'], 'marks': {}}]}, s=S['mate']); check('a scout who is not a patrol leader cannot inspect', st == 403, st)
st, _ = call('inspect', {'patrol': outsider['patrol'], 'scouts': [{'id': outsider['id'], 'marks': {}}]}, s=S['pl']); check("a patrol leader cannot inspect another patrol", st == 403, st)
st, _ = call('inspect', {'patrol': pl_patrol, 'scouts': [{'id': mate['id'], 'marks': {}}]}, s=S['parent']); check('parents cannot inspect', st == 403, st)
body = {'patrol': pl_patrol, 'scouts': [{'id': mate['id'], 'marks': {'socks': 'miss', 'shirt': 'fix', 'bogus': 'good'}, 'score': 100}, {'id': outsider['id'], 'marks': {}}] + ([{'id': mate2['id'], 'marks': {}}] if mate2 else [])}
st, r = call('inspect', body, s=S['pl']); check('patrol leader can inspect own patrol', st == 200, r)
ins = r['inspection']; row = next(x for x in ins['scouts'] if x['id'] == mate['id'])
check('scores are worked out on the server', row['score'] < 100 and 'bogus' not in row['marks'], row)
check('scouts from other patrols are dropped', all(x['id'] != outsider['id'] for x in ins['scouts']), [x['id'] for x in ins['scouts']])
if mate2:
    st, d = call(f"inspect/{ins['id']}", s=S['mate'])
    check("a scout sees only their own marks", st == 200 and [x['id'] for x in d['inspection']['scouts']] == [mate['id']], [x['id'] for x in d['inspection']['scouts']])
st, d = call('inspect', s=S['outsider']); check('everyone sees patrol averages', st == 200 and any(x['patrol'] == pl_patrol and x['count'] for x in d['standings']), st)
st, d = call(f"inspect/{ins['id']}", s=S['outsider']); check("other patrols can't see anyone's marks", st == 200 and d['inspection']['scouts'] == [], d.get('inspection', {}).get('scouts'))
st, _ = call(f"inspect/{ins['id']}", method='DELETE', s=S['mate']); check('only the inspector or a leader can delete', st == 403, st)
st, _ = call('inspect/config', {'off': ['shirt']}, s=S['pl']); check('only leaders change the checklist', st == 403, st)
st, _ = call(f"inspect/{ins['id']}", method='DELETE', s=S['pl']); check('inspector can delete their inspection', st == 200, st)
bad = [r for r in results if not r[0]]
print(f'\nWITH INSPECTIONS {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- troop elections
S.update(leader=S.get('leader') or sess(leader))
cands = [m['id'] for m in active if m['role'] == 'scout'][:3]
st, _ = call('elect', {'title': 'x', 'positions': [{'title': 'SPL', 'candidates': cands}]}, s=S['scout']); check('scouts cannot set up elections', st == 403, st)
st, r = call('elect', {'title': 'Sec election', 'live': False, 'positions': [{'title': 'SPL', 'candidates': cands}, {'title': 'Patrol Leader', 'patrol': pl_patrol, 'candidates': [pl['id']]}]}, s=S['leader'])
check('leader can set up an election', st == 200, r); eid = r['election']['id']; spl, plp = [p['id'] for p in r['election']['positions']]
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[0]}}, s=S['scout']); check("can't vote before voting opens", st in (404, 409), st)
st, d = call('elect', s=S['scout']); check('scouts do not see draft elections', all(e['id'] != eid for e in d['elections']), st)
call(f'elect/{eid}/open', {}, s=S['leader'])
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[0]}, 'for': mate['id']}, s=S['scout']); check("a scout can't vote for someone else", st == 403, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[0]}}, s=S['adult']); check('adults do not vote', st == 403, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: 'm-not-real'}}, s=S['scout']); check("can't vote for someone not on the ballot", st == 400, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {plp: pl['id']}}, s=S['outsider']); check('only the patrol votes for its patrol leader', st == 403, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[0]}}, s=S['scout']); check('scout can vote', st == 200, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[1]}}, s=S['scout']); check('scouts vote only once', st == 409, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[1]}, 'for': scout['id']}, s=S['leader']); check("a leader can't add a second vote for a scout who voted", st == 409, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[1], plp: pl['id']}, 'for': mate['id']}, s=S['leader']); check("leader can take a vote on their phone for a scout", st == 200, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[1]}}, s=S['mate']); check('that scout cannot vote again on their own phone', st == 409, st)
st, d = call(f'elect/{eid}', s=S['outsider']); check('results stay hidden while voting when live results are off', all(c['votes'] is None for p in d['election']['positions'] for c in p['candidates']), d['election']['positions'][0]['candidates'])
check('scouts never get the voter list', 'voters' not in d['election'] or d['election']['voters'] is None, list(d['election'].keys()))
st, d = call(f'elect/{eid}', s=S['leader'])
check('leaders see who voted, never how', all(set(v.keys()) <= {'id', 'name', 'first', 'patrol', 'voted'} for v in d['election']['voters']) and 'votes' not in json.dumps(d['election']['voters']), d['election']['voters'][:1])
check('vote counts are right', sum(c['votes'] for c in d['election']['positions'][0]['candidates']) == 2, d['election']['positions'][0])
st, _ = call(f'elect/{eid}/close', {}, s=S['scout']); check('only leaders close voting', st == 403, st)
call(f'elect/{eid}/close', {}, s=S['leader'])
st, d = call(f'elect/{eid}', s=S['outsider']); check('results show to everyone once closed', d['election']['positions'][0]['candidates'][0]['votes'] is not None, st)
st, _ = call(f'elect/{eid}/vote', {'votes': {spl: cands[0]}}, s=S['outsider']); check("can't vote after voting closes", st == 409, st)
st, _ = call(f'elect/{eid}', method='DELETE', s=S['leader']); check('leader can delete an election', st == 200, st)
bad = [r for r in results if not r[0]]
print(f'\nWITH ELECTIONS {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- meeting notes
import base64
png = 'data:image/png;base64,' + base64.b64encode(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082')).decode()
st, _ = call('notes/plc', troop=True); check('notes need a personal code', st == 401, st)
st, _ = call('notes/plc', s=S['parent']); check('parents cannot read PLC notes', st == 403, st)
st, _ = call('notes/committee', s=S['parent']); check('parents cannot read committee minutes', st == 403, st)
st, _ = call('notes/committee', s=S['scout']); check('scouts cannot read committee minutes', st == 403, st)
st, _ = call('notes/plc', {'title': 'x', 'body': 'y'}, s=S['mate']); check('scouts not on the PLC cannot write PLC notes', st == 403, st)
st, r = call('notes/plc', {'title': 'Sec PLC', 'body': 'Plan the campout', 'date': '2026-10-30'}, s=S['pl']); check('patrol leader can write PLC notes', st == 200, r); pn = r['note']['id']
st, r = call(f'notes/plc/{pn}/files', {'name': 'board.png', 'type': 'image/png', 'data': png}, s=S['pl']); check('PLC notes take photos', st == 200, r); pf = r['file']['id']
st, _ = call(f'notes/plc/{pn}/files', {'name': 'evil.html', 'type': 'text/html', 'data': png}, s=S['pl']); check('web pages and scripts are refused as files', st == 400, st)
st, d = call(f'notes/plc/{pn}', s=S['outsider']); check('any scout can read PLC notes', st == 200 and d['note']['body'] == 'Plan the campout' and not d['canEdit'], st)
st, _ = call(f'notes/plc/{pn}', {'title': 'hacked', 'body': ''}, method='PUT', s=S['outsider']); check("scouts can't change PLC notes they didn't write", st == 403, st)
st, r = call(f'notes/committee', {'title': 'Sec committee', 'body': 'Budget'}, s=S['leader']); check('leader can write committee minutes', st == 200 and r['note']['status'] == 'draft', r); cn = r['note']['id']
call(f'notes/committee/{cn}/files', {'name': 'budget.png', 'type': 'image/png', 'data': png}, s=S['leader'])
cf = call(f'notes/committee/{cn}', s=S['leader'])[1]['note']['files'][0]['id']
st, _ = call(f'notes/committee/{cn}', s=S['pl']); check("scouts can't open committee minutes", st == 403, st)
st, _ = call(f'notes/committee/{cn}/files/{cf}', s=S['pl'], raw=True); check("scouts can't download committee files", st == 403, st)
st, _ = call(f'notes/committee/{cn}/approve', {}, s=S['leader']); check('leader can approve minutes', st == 200, st)
st, _ = call(f'notes/committee/{cn}', {'title': 'changed', 'body': 'x'}, method='PUT', s=S['leader']); check('approved minutes are locked', st == 409, st)
st, _ = call(f'notes/committee/{cn}/files', {'name': 'more.png', 'type': 'image/png', 'data': png}, s=S['leader']); check('no new files on approved minutes', st == 409, st)
call(f'notes/committee/{cn}/approve', {'approved': False}, s=S['leader'])
st, _ = call(f'notes/committee/{cn}', {'title': 'changed', 'body': 'x'}, method='PUT', s=S['leader']); check('marking as draft unlocks them', st == 200, st)
for b, nid in (('plc', pn), ('committee', cn)): call(f'notes/{b}/{nid}', method='DELETE', s=S['leader'])
bad = [r for r in results if not r[0]]
print(f'\nWITH NOTES {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- exports and feature switches
def raw_get(path):
    try: r = urllib.request.urlopen(BASE + path); return r.status
    except urllib.error.HTTPError as e: return e.code
check('leaders download exports with their personal code', raw_get(f"leader/export/members?s={S['leader']}") == 200)
check('scouts cannot download exports', raw_get(f"leader/export/members?s={S['scout']}") in (401, 403), raw_get(f"leader/export/members?s={S['scout']}"))
check('exports need sign-in', raw_get('leader/export/members') in (401, 403))
st, r = call('leader/export/members', s=S['leader']); check('roster export has no personal codes', isinstance(r, str) and 'code' not in r.split('\n')[0] and not re.search(r'[A-Z0-9]{4}-[A-Z0-9]{4}', r), r[:120] if isinstance(r, str) else r)
st, _ = call('leader/settings', {'features': {'games': False}}, s=S['scout']); check('scouts cannot change settings', st in (401, 403), st)
call('leader/settings', {'features': {'games': False}, 'opts': {'notesParentsPLC': True}}, s=S['leader'])
st, d = call('settings', s=S['scout']); check('everyone can see which features are on', d['features']['games'] is False and d['opts']['notesParentsPLC'] is True, d.get('features'))
st, _ = call('quiz/me', s=S['scout']); check('a switched-off feature is off on the server too', st == 403, st)
st, _ = call('notes/plc', s=S['parent']); check('parents can read PLC notes when leaders allow it', st == 200, st)
st, _ = call('notes/committee', s=S['parent']); check('committee minutes stay leaders-only even then', st == 403, st)
call('leader/settings', {'features': {'games': True}, 'opts': {'notesParentsPLC': False}}, s=S['leader'])
st, _ = call('quiz/me', s=S['scout']); check('switching it back on works', st == 200, st)
st, _ = call('notes/plc', s=S['parent']); check('parents lose PLC notes again when switched off', st == 403, st)
bad = [r for r in results if not r[0]]
print(f'\nWITH SETTINGS {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- sync center
st, _ = call('sync', s=S['scout']); check('scouts cannot open the Sync center', st == 401, st)
st, _ = call('sync', s=S['parent']); check('parents cannot open the Sync center', st == 401, st)
lp = ', '.join(leader.get('positions', []))
if not re.search(r'^scoutmaster$|committee chair|advancement|^webmaster$', lp, re.I):
    st, _ = call('sync/roster', {'rows': []}, s=S['leader']); check('leaders without a sync role cannot run syncs', st == 403, st)
st, d = call('sync', leader=True); check('leader passcode can open the Sync center', st == 200 and d['can'], st)
st, r = call('sync/roster', {'rows': [{'first': scout['first'], 'last': scout['name'].split(' ')[-1], 'patrol': scout.get('patrol', ''), 'bsaId': '123456789', 'email': 'x@y.z', 'dob': '2012-01-01'}]}, leader=True)
check('roster check works', st == 200, r)
st, d = call('sync', leader=True); blob = json.dumps(d)
check('no BSA IDs, emails or birthdays are kept from sync files', '123456789' not in blob and 'x@y.z' not in blob and '2012-01-01' not in blob)
st, _ = call('sync/twh', {'members': [{'first': 'Hack', 'last': 'Er'}]}, s=S['scout']); check('scouts cannot push TroopWebHost data', st == 401, st)
check('activity export is leaders only', raw_get(f"leader/export/activity?s={S['scout']}") in (401, 403))
bad = [r for r in results if not r[0]]
print(f'\nWITH SYNC {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- campfire book and ceremonies
st, _ = call('fire'); check('campfire book needs the troop code', st == 401, st)
st, d = call('fire', troop=True); check('guests can read the campfire book', st == 200 and not d['can']['suggest'], st)
st, _ = call('fire/items', {'kind': 'song', 'title': 'x', 'text': 'y'}, troop=True); check('guests cannot add to the book', st == 401, st)
st, r = call('fire/items', {'kind': 'skit', 'title': 'Sec skit', 'text': 'A: hi'}, s=S['mate']); check('scouts not on the PLC can only suggest', st == 200 and r['item']['status'] == 'pending', r); sk = r['item']['id']
st, d = call('fire', s=S['outsider']); check('suggestions stay hidden until approved', st == 200 and not any(i['id'] == sk for i in d['items']), st)
st, _ = call(f'fire/items/{sk}/approve', {}, s=S['pl']); check('only leaders approve suggestions', st == 403, st)
st, _ = call(f'fire/items/{sk}', {'title': 'Hacked'}, method='PUT', s=S['outsider']); check("scouts can't change someone else's suggestion", st == 403, st)
st, _ = call(f'fire/items/{sk}/approve', {}, s=S['leader']); check('leader approves a suggestion', st == 200, st)
st, d = call('fire', s=S['outsider']); check('approved suggestions show for everyone', any(i['id'] == sk for i in d['items']), st)
st, _ = call(f'fire/items/{sk}', method='DELETE', s=S['outsider']); check("scouts can't delete someone else's item", st == 403, st)
st, r = call('fire/items', {'kind': 'song', 'ref': 'purple-stew', 'title': 'Purple Stew', 'text': '<img src=x onerror=alert(1)>'}, s=S['pl']); check('the PLC adds straight to the book', st == 200 and r['item']['status'] == 'ok', r); pw = r['item']['id']
st, _ = call('fire/items', {'kind': 'nonsense', 'title': 'x', 'text': 'y'}, s=S['pl']); check('unknown kinds are refused', st == 400, st)
st, _ = call('fire/meta', {'id': 'invisible-bench', 'hidden': True}, s=S['pl']); check('only leaders hide things from the book', st == 403, st)
st, _ = call('fire/meta', {'id': 'invisible-bench', 'fav': True}, s=S['pl']); check('the PLC can pick troop favorites', st == 200, st)
st, _ = call('fire/meta', {'id': '../people', 'fav': True}, s=S['leader']); check('bad ids are refused', st == 400, st)
st, _ = call('fire/plans', {'title': 'x', 'items': []}, s=S['mate']); check('scouts not on the PLC cannot plan campfires', st == 403, st)
st, r = call('fire/plans', {'title': 'Sec campfire', 'date': '2026-11-07', 'items': [{'ref': 'skit:echo-canyon', 'kind': 'skit', 'title': 'Echo Canyon', 'who': 'Foxes'}] * 80}, s=S['pl']); check('the PLC plans campfires (lineup capped)', st == 200 and len(r['plan']['items']) == 60, r); pid = r['plan']['id']
st, d = call(f'fire/plans/{pid}', s=S['parent']); check('anyone in the troop can see a campfire plan', st == 200 and not d['canEdit'], st)
st, _ = call(f'fire/plans/{pid}', method='DELETE', s=S['parent']); check('parents cannot delete campfire plans', st == 403, st)
call('leader/settings', {'opts': {'fireSuggest': False}}, s=S['leader'])
st, _ = call('fire/items', {'kind': 'cheer', 'title': 'x', 'text': 'y'}, s=S['mate']); check('suggestions can be switched off', st == 403, st)
call('leader/settings', {'opts': {'fireSuggest': True}, 'features': {'campfire': False}}, s=S['leader'])
st, _ = call(f'fire/plans/{pid}', s=S['scout']); check('campfire switched off on the server too', st == 403, st)
st, _ = call('fire/items', {'kind': 'ceremony', 'title': 'Crossover', 'text': 'Caller: Welcome'}, s=S['pl']); check('ceremonies still work with campfire off', st == 200, st); cid = _['item']['id'] if st == 200 else ''
call('leader/settings', {'features': {'campfire': True}}, s=S['leader'])
for i in [sk, pw, cid]:
    if i: call(f'fire/items/{i}', method='DELETE', s=S['leader'])
call(f'fire/plans/{pid}', method='DELETE', s=S['leader']); call('fire/meta', {'id': 'invisible-bench', 'fav': False}, s=S['leader'])
bad = [r for r in results if not r[0]]
print(f'\nWITH CAMPFIRE {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- knots, patrol points, hunts, duty rosters, Court of Honor
st, _ = call('knots'); check('knots need the troop code', st == 401, st)
st, _ = call('knots/time', {'knot': 'bowline', 'ms': 20000, 'checked': True}, troop=True); check('guests cannot save knot times', st == 401, st)
st, _ = call('knots/time', {'knot': 'bowline', 'ms': 20000}, s=S['mate']); check('knot times need a buddy check', st == 400, st)
st, _ = call('knots/time', {'knot': 'bowline', 'ms': 200, 'checked': True}, s=S['mate']); check('impossible knot times are refused', st == 400, st)
st, r = call('knots/time', {'knot': 'bowline', 'ms': 21000, 'checked': True}, s=S['mate']); check('scouts save checked knot times', st == 200 and r['pb']['ms'] <= 21000, r)
st, d = call('knots', s=S['outsider']); check('the knot board shows first name and last initial only', st == 200 and all(len(b['name'].split()[-1]) <= 2 for b in d['boards'].get('bowline', [])), d.get('boards'))
st, _ = call('points', {'patrol': scout['patrol'], 'pts': 5, 'reason': 'x'}, s=S['mate']); check('scouts cannot give patrol points', st == 403, st)
pt = next(p for p in call('points', leader=True)[1]['board'])['patrol']
st, r = call('points', {'patrol': pt, 'pts': 500, 'reason': 'x'}, s=S['leader']); check('points are capped', st == 400, st)
st, r = call('points', {'patrol': pt, 'pts': 7, 'reason': '<b>Spirit</b>'}, s=S['leader']); check('leaders give patrol points', st == 200, r); eid = r['entry']['id']
st, d = call('points', s=S['parent']); check('everyone sees the patrol board', st == 200 and any(b['patrol'] == pt and b['total'] >= 7 for b in d['board']), st)
st, _ = call(f'points/{eid}', method='DELETE', s=S['mate']); check('scouts cannot take points back', st == 403, st)
call(f'points/{eid}', method='DELETE', s=S['leader'])
st, _ = call('points/season', {'name': 'x'}, s=S['pl']); check('only leaders start a season', st == 403, st)
st, _ = call('hunt', {'title': 'x', 'items': [{'text': 'a', 'pts': 1}]}, s=S['pl']); check('only leaders make hunts', st == 403, st)
st, r = call('hunt', {'title': 'Sec hunt', 'items': [{'text': 'A pinecone', 'pts': 5}]}, s=S['leader']); hid = r['hunt']['id']; iid = r['hunt']['items'][0]['id']
st, _ = call(f'hunt/{hid}', s=S['mate']); check('draft hunts are hidden from scouts', st == 404, st)
call(f'hunt/{hid}', {'status': 'open'}, method='PUT', s=S['leader'])
st, _ = call(f'hunt/{hid}/entries', {'itemId': iid, 'data': 'data:text/html;base64,' + base64.b64encode(b'<script>1</script>').decode()}, s=S['mate']); check('hunt photos must be images', st in (400, 403), st)
mates = [m for m in active if m['role'] == 'scout' and m.get('patrol')]
st, r = call(f'hunt/{hid}/entries', {'itemId': iid, 'data': png}, s=S['mate']); check('a scout sends a hunt photo for their patrol', st == 200 and r['entry']['status'] == 'pending', r); sid = r.get('entry', {}).get('id')
mate_patrol = r.get('entry', {}).get('patrol')
other = next((k for k in ['outsider', 'scout', 'other'] if k in S and [m for m in active if m.get('code') and m['role'] == 'scout']), None)
st, d = call(f'hunt/{hid}', s=S['parent']); check("parents don't see other patrols' hunt photos", st == 200 and all(e['patrol'] != mate_patrol for e in d['entries']) or d.get('myPatrol') == mate_patrol, st)
st, _ = call(f'hunt/{hid}/entries/{sid}/judge', {'status': 'ok'}, s=S['mate']); check('scouts cannot judge hunt photos', st == 403, st)
st, _ = call(f'hunt/{hid}/entries/{sid}/judge', {'status': 'ok'}, s=S['leader']); check('leaders judge hunt photos', st == 200, st)
st, d = call('points', s=S['leader']); check('approved hunt photos add patrol points', any(b['patrol'] == mate_patrol and b['by'].get('hunts', 0) >= 5 for b in d['board']), [b for b in d['board'] if b['patrol'] == mate_patrol])
st, _ = call(f'hunt/{hid}/entries/{sid}/photo', raw=True); check('hunt photos need sign-in', st == 401, st)
call(f'hunt/{hid}', method='DELETE', s=S['leader'])
oid = next(o['id'] for o in call('c/outings', leader=True)[1]['items'] if o.get('end') and o['end'] > o['start'])
st, d = call(f'duty/{oid}', s=S['parent']); check('anyone can see the duty roster', st == 200 and not d['canEdit'], st)
st, _ = call(f'duty/{oid}', {'jobs': ['x'], 'grid': {}}, method='PUT', s=S['mate']); check('scouts not on the PLC cannot change the duty roster', st == 403, st)
st, r = call(f'duty/{oid}', {**d['roster'], 'grid': {k: {j: 'Not a patrol' for j in v} for k, v in d['roster']['grid'].items()}}, method='PUT', s=S['pl']); check('the PLC saves the duty roster; unknown patrols are dropped', st == 200 and all(p == '' for v in r['roster']['grid'].values() for p in v.values()), r)
call(f'duty/{oid}', method='DELETE', s=S['leader'])
st, _ = call('coh', s=S['pl']); check('scouts cannot open the Court of Honor planner', st == 403, st)
st, _ = call('coh/candidates', s=S['parent']); check("parents can't see the troop's awards list", st == 403, st)
st, r = call('coh', {'title': 'Sec COH', 'awards': [{'memberId': scout['id'], 'kind': 'rank', 'item': 'Star'}]}, s=S['leader']); check('leaders plan a Court of Honor', st == 200 and r['coh']['awards'][0]['name'] == scout['name'], r); cid = r['coh']['id']
check('the awards list downloads for leaders', raw_get(f"coh/{cid}/csv?s={S['leader']}") == 200)
check('the awards list is leaders only', raw_get(f"coh/{cid}/csv?s={S['scout']}") in (401, 403))
call(f'coh/{cid}', method='DELETE', s=S['leader'])
call('leader/settings', {'features': {'points': False}}, s=S['leader'])
st, _ = call('points', s=S['scout']); check('patrol points switched off on the server too', st == 403, st)
call('leader/settings', {'features': {'points': True}}, s=S['leader'])
bad = [r for r in results if not r[0]]
print(f'\nWITH SCOUTING {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- outing safety, carpools, slips, sign-offs, service, Eagle, camp, polls, check-in, tree sale, lost and found, geocaching
plain = next(m for m in active if m['role'] == 'scout' and not m.get('positions') and m['id'] not in (pl['id'], outsider['id']) and m['id'] not in parent.get('scouts', []))
S['plain'] = sess(plain)
kid = M[parent['scouts'][0]]; other_kid = next(m for m in active if m['role'] == 'scout' and m['id'] not in parent['scouts'])
oid2 = next(o['id'] for o in call('c/outings', leader=True)[1]['items'] if o.get('end') and o['end'] > o['start'])
st, _ = call(f'outsafe/{oid2}'); check('safety card needs the troop code', st == 401, st)
st, _ = call(f'outsafe/{oid2}', {'hospital': 'x'}, method='PUT', s=S['parent']); check('only leaders edit the emergency card', st == 403, st)
st, _ = call(f'carpool/{oid2}', {'op': 'drive', 'seats': 3}, s=S['plain']); check('scouts cannot offer to drive', st == 403, st)
st, r = call(f'carpool/{oid2}', {'op': 'drive', 'seats': 1, 'leg': 'both'}, s=S['parent']); check('a parent offers seats', st == 200, r); did = next(v['id'] for v in r['drivers'] if v['by'] == parent['id'])
st, _ = call(f'carpool/{oid2}', {'op': 'ride', 'driverId': did, 'riderId': other_kid['id']}, s=S['parent']); check("parents can't sign up someone else's scout", st == 403, st)
st, _ = call(f'carpool/{oid2}', {'op': 'ride', 'driverId': did, 'riderId': kid['id']}, s=S['parent']); check('parents sign up their own scout', st == 200, st)
st, _ = call(f'carpool/{oid2}', {'op': 'ride', 'driverId': did, 'riderId': plain['id']}, s=S['plain']); check('full cars are full', st == 409, st)
call(f'carpool/{oid2}', {'op': 'stop', 'driverId': did}, s=S['parent'])
call(f'slip/{oid2}/cfg', {'on': True, 'text': 'Permission text'}, method='PUT', s=S['leader'])
st, d = call(f'slip/{oid2}', s=S['parent']); check("parents don't see the troop's slip list", st == 200 and d['roster'] is None, st)
st, _ = call(f'slip/{oid2}/sign', {'scoutId': other_kid['id'], 'agree': True, 'typed': 'Some Parent'}, s=S['parent']); check("parents can't sign for someone else's scout", st == 403, st)
st, _ = call(f'slip/{oid2}/sign', {'scoutId': kid['id'], 'typed': 'Some Parent'}, s=S['parent']); check('a slip needs the box checked', st == 400, st)
st, _ = call(f'slip/{oid2}/sign', {'scoutId': kid['id'], 'agree': True, 'typed': parent['name']}, s=S['parent']); check('parents sign for their own scout', st == 200, st)
st, _ = call(f'slip/{oid2}/sign', {'scoutId': kid['id'], 'paper': True}, s=S['parent']); check('only leaders record paper slips', st == 403, st)
call(f'slip/{oid2}/sign/{kid["id"]}', method='DELETE', s=S['leader']); call(f'slip/{oid2}/cfg', {'on': False, 'text': ''}, method='PUT', s=S['leader'])
st, _ = call(f'signoff/{other_kid["id"]}', s=S['parent']); check("parents can't see another scout's requirements", st == 403, st)
st, _ = call(f'signoff/{plain["id"]}', {'rank': 'Scout', 'req': '1a', 'on': True}, s=S['plain']); check('scouts cannot sign their own requirements', st == 403, st)
st, _ = call(f'signoff/{plain["id"]}', {'rank': 'Scout', 'req': '1a', 'on': True}, s=S['parent']); check('parents cannot sign off requirements', st == 403, st)
st, _ = call(f'signoff/{plain["id"]}', {'rank': 'Scout', 'req': '1a', 'on': True}, s=S['pl']); check('a patrol leader can sign off a requirement', st == 200, st)
st, _ = call(f'signoff/{plain["id"]}', {'rank': 'Tenderfoot', 'req': '10', 'on': True}, s=S['pl']); check('conferences and boards are adult leaders only', st == 403, st)
st, _ = call(f'signoff/{plain["id"]}', {'rank': 'Scout', 'req': '99z', 'on': True}, s=S['leader']); check('unknown requirements are refused', st == 400, st)
call(f'signoff/{plain["id"]}', {'rank': 'Scout', 'req': '1a', 'on': False}, s=S['leader'])
check('sign-off download is leaders only', raw_get(f"signoff/export.csv?s={S['pl']}") in (401, 403))
st, _ = call('service', {'memberId': other_kid['id'], 'date': '2026-10-01', 'hours': 2, 'project': 'x'}, s=S['plain']); check("scouts can't log hours for others", st == 403, st)
st, r = call('service', {'memberId': plain['id'], 'date': '2026-10-01', 'hours': 2, 'project': 'Park cleanup', 'conservation': True}, s=S['plain']); check('scouts log hours, waiting for a leader', st == 200 and r['entries'][0]['status'] == 'pending', r); vid = r['entries'][0]['id']
st, _ = call(f'service/{vid}/approve', {}, s=S['pl']); check('only leaders approve service hours', st == 403, st)
st, _ = call(f'service/{vid}/approve', {}, s=S['leader']); check('leaders approve service hours', st == 200, st)
st, _ = call(f'service/{vid}', method='DELETE', s=S['plain']); check("scouts can't delete approved hours", st == 403, st)
call(f'service/{vid}', method='DELETE', s=S['leader'])
st, _ = call(f'eagle/{other_kid["id"]}', s=S['parent']); check("parents can't open another scout's Eagle project", st == 403, st)
st, _ = call('camp', {'name': 'x'}, s=S['parent']); check('only leaders set up summer camp', st == 403, st)
st, _ = call('poll', {'q': 'x', 'options': ['a', 'b']}, s=S['plain']); check('scouts not on the PLC cannot make polls', st == 403, st)
st, r = call('poll', {'q': 'Campout spot?', 'options': ['Lake', 'River'], 'aud': 'all'}, s=S['leader']); poid = r['poll']['id']
st, d = call('poll', s=S['plain']); pp = next(p for p in d['polls'] if p['id'] == poid); check('poll results stay hidden until you vote', pp['counts'] is None, pp.get('counts'))
st, _ = call(f'poll/{poid}/vote', {'opts': ['o0', 'o1']}, s=S['plain']); check('one choice only on single-choice polls', st == 400, st)
st, r = call(f'poll/{poid}/vote', {'opts': ['o0']}, s=S['plain']); check('scouts vote and then see results', st == 200 and r['poll']['counts']['o0'] == 1, r)
call(f'poll/{poid}/vote', {'opts': ['o1']}, s=S['plain']); st, d = call('poll', s=S['plain']); pp = next(p for p in d['polls'] if p['id'] == poid); check('changing your vote counts once', pp['counts'] == {'o0': 0, 'o1': 1}, pp['counts'])
call(f'poll/{poid}', method='DELETE', s=S['leader'])
st, _ = call('attend/open', {'title': 'x'}, s=S['plain']); check('scouts cannot open check-in', st == 403, st)
call('attend/open', {'title': 'Sec meeting'}, s=S['leader']); td = call('attend', leader=True)[1]['today']; sess_ = call(f'attend/{td}', s=S['leader'])[1]
st, _ = call('attend/in', {'code': 'WRONG1'}, s=S['plain']); check('a wrong check-in code is refused', st == 409, st)
st, _ = call('attend/in', {'code': sess_['code']}, s=S['plain']); check('scouts check in with the code', st == 200, st)
st, _ = call('attend/in', {'code': sess_['code']}, troop=True); check('check-in needs a personal code', st == 401, st)
call(f'attend/{td}/close', {}, s=S['leader'])
st, _ = call('attend/in', {'code': sess_['fixed']}, s=S['plain']); check('closed check-in refuses codes', st == 409, st)
st, _ = call('fund/day', {'date': '2026-12-01', 'sold': {'f67': 3}}, method='PUT', s=S['parent']); check('only leaders record tree sales', st == 403, st)
st, r = call('fund/shifts', {'dates': ['2026-12-05'], 'times': [['10:00', '12:00']], 'adults': 1, 'scouts': 1}, s=S['leader']); shid = r['shifts'][0]['id']
st, _ = call(f'fund/shift/{shid}', {'memberId': other_kid['id'], 'on': True}, s=S['parent']); check("parents can't sign up someone else's scout for a lot shift", st == 403, st)
st, _ = call(f'fund/shift/{shid}', {'memberId': kid['id'], 'on': True}, s=S['parent']); check('parents sign their scout up for a lot shift', st == 200, st)
st, _ = call(f'fund/shift/{shid}', {'memberId': plain['id'], 'on': True}, s=S['plain']); check('full shifts are full', st == 409, st)
st, d = call('fund', s=S['parent']); check('families see the goal but not daily money', d['scoutHours'] is None and all('sold' not in x for x in d['days']), st)
call(f'fund/shift/{shid}', method='DELETE', s=S['leader'])
st, _ = call('lost', troop=True); check('lost and found needs a personal code', st == 401, st)
st, r = call('lost', {'title': 'Blue bottle', 'data': png}, s=S['plain']); lid = r['item']['id']
st, _ = call(f'lost/{lid}', method='DELETE', s=S['outsider']); check("you can't remove someone else's lost-and-found post", st == 403, st)
st, _ = call(f'lost/{lid}/photo', raw=True); check('lost-and-found photos need sign-in', st == 401, st)
call(f'lost/{lid}', method='DELETE', s=S['plain'])
st, r = call('geo', {'title': 'Sec course', 'caches': [{'name': 'Oak', 'lat': 30.44, 'lng': -84.28, 'code': 'acorn', 'pts': 7}]}, s=S['leader']); gid = r['course']['id']; gcid = r['course']['caches'][0]['id']
st, _ = call(f'geo/{gid}', s=S['plain']); check('draft geocache courses are hidden', st == 404, st)
call(f'geo/{gid}', {'status': 'open'}, method='PUT', s=S['leader'])
st, d = call(f'geo/{gid}', s=S['plain']); check("scouts don't get the code words", 'code' not in d['course']['caches'][0], d['course']['caches'][0])
st, _ = call(f'geo/{gid}/find', {'cacheId': gcid, 'code': 'pinecone'}, s=S['plain']); check('wrong code words are refused', st == 400, st)
st, r = call(f'geo/{gid}/find', {'cacheId': gcid, 'code': ' Acorn '}, s=S['plain']); check('the right code word logs a find', st == 200 and r['pts'] == 7, r)
st, d = call('points', s=S['leader']); check('geocache finds add patrol points', any(b['patrol'] == plain.get('patrol') and b['by'].get('geocaching', 0) >= 7 for b in d['board']) or not plain.get('patrol'), [b for b in d['board'] if b['patrol'] == plain.get('patrol')])
call(f'geo/{gid}', method='DELETE', s=S['leader'])
call('leader/settings', {'features': {'carpool': False}}, s=S['leader'])
st, _ = call(f'carpool/{oid2}', s=S['parent']); check('carpools switched off on the server too', st == 403, st)
call('leader/settings', {'features': {'carpool': True}}, s=S['leader'])
bad = [r for r in results if not r[0]]
print(f'\nWITH TROOP TOOLS {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]

# --- hardening: read-only troop code, sign-up ownership, consent ids, names for guests, rate limits, headers
oid3 = next(o['id'] for o in call('c/outings', leader=True)[1]['items'])
st, _ = call(f'c/rsvps/{oid3}__{leader["id"]}', {'outingId': oid3, 'memberId': leader['id'], 'name': 'x', 'status': 'yes'}, method='PUT', troop=True); check('the troop code alone cannot sign anyone up', st == 401, st)
st, _ = call(f'c/rsvps/{oid3}__{leader["id"]}', {'outingId': oid3, 'memberId': leader['id'], 'name': 'x', 'status': 'yes'}, method='PUT', s=S['plain']); check("scouts can't sign up a leader (or anyone else)", st == 403, st)
st, r = call(f'c/rsvps/{oid3}__{plain["id"]}', {'outingId': oid3, 'memberId': plain['id'], 'name': 'Fake Name', 'role': 'adult', 'status': 'yes'}, method='PUT', s=S['plain']); check('sign-ups use the real name and role', st == 200 and r['item']['name'] == plain['name'] and r['item']['role'] == 'scout', r.get('item'))
st, d = call(f'c/rsvps?outing={oid3}', troop=True); check('guests see first names and last initials on sign-ups', all(len(x['name'].split()[-1]) <= 2 for x in d['items'] if ' ' in x['name']), [x['name'] for x in d['items']][:3])
call(f'c/rsvps/{oid3}__{plain["id"]}', method='DELETE', s=S['plain'])
fams = [json.load(open(f'{STORE}/{f}')) for f in os.listdir(STORE) if f.startswith('consents%2F')]
victim = next((sc for f in fams for sc in f['scouts']), None)
if victim:
    st, r = call('consent', {'agreed': True, 'parent': {'name': 'x'}, 'signature': 'x', 'scouts': [{'id': victim['id'], 'first': 'A', 'level': 'public'}]}, s=S['adult'])
    check("a family can't take over another family's photo permission", st == 200 and r['record']['scouts'][0]['id'] != victim['id'], r.get('record', {}).get('scouts'))
    st, rs = call('roster', troop=True); check('the other family\'s choice still stands', next((x for x in rs['scouts'] if x['id'] == victim['id']), None) is not None)
    os.remove(f"{STORE}/consents%2F{r['familyId']}") if st == 200 else None
st, _ = call(f'carpool/{oid3}', troop=True); check('carpools need a personal code', st == 401, st)
st, _ = call('eagles', troop=True); check('the Eagle wall needs a personal code', st == 401, st)
st, _ = call('push/subscribe', {'sub': {'endpoint': 'https://evil.example.com/x', 'keys': {'p256dh': 'a', 'auth': 'b'}}, 'prefs': {}}, s=S['plain']); check('push only goes to real push services', st >= 400, st)
st, r = call(f"leader/members/{plain['id']}", {'leader': True}, leader=True)
st, d = call('leader/members', leader=True); check('a scout can never be made a leader', not next(m for m in d['members'] if m['id'] == plain['id']).get('leader'), st)
import time
def h(path, hdrs):
    r = urllib.request.Request(BASE + path, headers=hdrs)
    try: return urllib.request.urlopen(r).status
    except urllib.error.HTTPError as e: return e.code
codes = [h('leader/check', {'x-leader-passcode': f'wrong-{i}', 'x-forwarded-for': '203.0.113.9'}) for i in range(12)]
check('guessing the leader passcode gets locked out', codes[-1] == 429, codes)
check('the lockout holds even with the right passcode', h('leader/check', {'x-leader-passcode': 'leader', 'x-forwarded-for': '203.0.113.9'}) == 429)
check('other people are not locked out', h('leader/check', {'x-leader-passcode': 'leader', 'x-forwarded-for': '203.0.113.10'}) in (200, 404))
codes = [h('auth/redeem', {}) for _ in range(1)]
for f in os.listdir(STORE):
    if f.startswith('rl%2F'): os.remove(f'{STORE}/{f}')
st, _ = call('%E0%A4%A'); check('a broken URL is a clean error, not a crash', st in (400, 401, 404), st)
bad = [r for r in results if not r[0]]
print(f'\nWITH HARDENING {len(results) - len(bad)}/{len(results)} passed'); [print('FAIL', n, d) for _, n, d in bad]
for tok in S.values(): call('auth/signout', {}, s=tok)
