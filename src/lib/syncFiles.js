// Read the CSV files that TroopWebHost, Scoutbook Plus and Black Pug (Scouting Event) export,
// right here in the browser, and keep only troop-safe fields. Contact details, birthdays, ages,
// BSA member IDs, medical, allergies, money and addresses are never read into what gets sent.

export function parseCSV(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const headersOf = rows => Object.keys(rows[0] || {});

// what kind of file is this? (by its columns, so renamed files still work)
export function kindOf(name, rows) {
  const h = new Set(headersOf(rows).map(x => x.toLowerCase()));
  const n = String(name).toLowerCase();
  if ([...h].some(x => /password|passwd|ssn|social security/.test(x)) || /password/.test(n)) return 'blocked';   // never read these
  if (h.has('advancement type') && h.has('advancement')) return 'sb-advancement';
  if (h.has('name') && h.has('adult') && (h.has('leadership') || h.has('patrol'))) return 'twh-roster';
  if (h.has('scout') && h.has('rank') && h.has('date earned') && h.has('date awarded') && !h.has('requirement')) return 'twh-ranks';
  if (h.has('scout') && h.has('merit badge') && h.has('earned') && !h.has('uncompleted requirements')) return 'twh-badges';
  if (h.has('merit badge') && h.has('uncompleted requirements')) return 'twh-mb-progress';
  if (h.has('name') && h.has('rank') && [...h].some(x => /^t\d/.test(x))) return 'twh-rank-reqs';
  if (h.has('participant') && h.has('event') && h.has('date')) return 'twh-participation';
  if (h.has('event') && h.has('start') && h.has('type')) return 'twh-events';
  if (h.has('id') && h.has('checked out to') && !h.has('category')) return 'twh-checked-out';
  if (h.has('id') && h.has('type') && h.has('category')) return 'twh-inventory';
  if (h.has('user name') && h.has('role')) return 'twh-permissions';
  if (h.has('title') && h.has('committee member')) return 'twh-positions';
  if (h.has('group name')) return 'twh-email-groups';
  if (h.has('location') && (h.has('address') || h.has('map')) && !h.has('event')) return 'twh-locations';
  if ((h.has('first name') || h.has('firstname')) && (h.has('last name') || h.has('lastname'))) return 'sb-roster';
  if (/roster/.test(n)) return 'sb-roster';
  return 'unknown';
}
export const KIND_LABEL = {
  'sb-advancement': 'Scoutbook advancement file', 'twh-roster': 'TroopWebHost active roster', 'twh-ranks': 'TroopWebHost rank history', 'twh-badges': 'TroopWebHost merit badge history',
  'twh-mb-progress': 'TroopWebHost merit badges in progress', 'twh-rank-reqs': 'TroopWebHost rank requirements', 'twh-participation': 'TroopWebHost event participation',
  'twh-events': 'TroopWebHost events', 'twh-inventory': 'TroopWebHost inventory', 'twh-checked-out': 'TroopWebHost checked-out items', 'twh-permissions': 'TroopWebHost user permissions',
  'twh-positions': 'TroopWebHost leadership positions', 'twh-email-groups': 'TroopWebHost e-mail groups', 'twh-locations': 'TroopWebHost event locations', 'sb-roster': 'Scoutbook roster report', blocked: 'Skipped: has passwords or private data', unknown: 'Not used',
};

// ------------------------------------------------------------------ helpers (same rules as scripts/import-troopwebhost-all.py)
const DEMO = /demo|^test|scout2|dem0/i;
const LEADER_POS = /scoutmaster|committee|chartered organization|treasurer|training coordinator|outdoor activities coordinator/i;
const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const PREFIX = { Scout: 'BS', Tenderfoot: 'T', 'Second Class': 'SC', 'First Class': 'FC', Star: 'S', Life: 'L', Eagle: 'E' };
const EAGLE_GROUPS = [['Camping'], ['Citizenship in the Community'], ['Citizenship in the Nation'], ['Citizenship in the World'], ['Communication'], ['Cooking'], ['Emergency Preparedness', 'Lifesaving'], ['Environmental Science', 'Sustainability'], ['Family Life'], ['First Aid'], ['Personal Fitness'], ['Personal Management'], ['Swimming', 'Hiking', 'Cycling']];
const splitName = n => { const [last, rest = ''] = String(n).split(/,(.*)/s); const first = rest.trim() ? rest.trim().split(' ')[0].replace(/^"|"$/g, '') : ''; return [first.trim(), last.trim().replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/, '')]; };
const key = (f, l) => `${String(l).trim().toLowerCase()}|${String(f).trim().toLowerCase()}`;
const iso = d => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(String(d || '').trim()); if (!m) return /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(0, 10) : ''; const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; };
const patrolOf = p => String(p || '').replace(/\s*\([A-Z]\)\s*$/, '').trim();
const num = x => { const v = parseFloat(String(x || '').replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };
const base = b => String(b || '').replace(/^\*/, '').replace(/\s*\((?:[^)]*rqmts|old rqmts)\)\s*$/, '').trim();
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function sha10(s) { const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 10); }

const TYPE = { Campout: 'campout', Hike: 'hike', 'Bike Ride': 'hike', 'Paddle Sports': 'paddle', 'Summer Camp': 'camp', 'Winter Camp': 'camp', 'National High Adventure Camp': 'camp', 'Community Service': 'service', 'Service Hours': 'service', 'Living Christmas': 'service', 'Wallwood Workday': 'service', 'Christmas Tree Sales': 'fundraiser', Fundraiser: 'fundraiser', 'Troop Meeting': 'meeting', 'Council/Committee Meetings': 'meeting', 'Patrol Leadership Council Meeting': 'meeting', 'Assistant Scoutmaster Meeting': 'meeting', 'Outdoor Activities Committee': 'meeting', 'Scout Rank Scoutmaster Conference': 'meeting', 'Scoutmaster Conference': 'meeting', 'Merit Badge Opportunity': 'merit', Training: 'training', 'Order of the Arrow Fellowship': 'oa', 'OA Event': 'oa', 'Pack Outreach Event': 'service', 'Webelos Event': 'service' };
const SKIP_NAMES = new Set(['thanksgiving', 'christmas', 'new years', "new year's", 'easter', 'memorial day', 'spring break', 'labor day', 'independence day', 'fourth of july']);
const kindOfEvent = (t, name) => { const n = name.toLowerCase(); if (t === 'Other' || !TYPE[t]) { if (/tubing|canoe|kayak|paddl/.test(n)) return 'paddle'; if (/meeting|planning/.test(n)) return 'meeting'; if (/campout|camping/.test(n)) return 'campout'; if (/hike|hiking/.test(n)) return 'hike'; } return TYPE[t] || 'other'; };
const parseWhen = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M))?/i.exec(String(s || '').trim()); if (!m) return null; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; let h = m[4] ? +m[4] % 12 : 0; if (m[6] && /p/i.test(m[6])) h += 12; return { date: `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, timed: !!m[4], d: new Date(y, +m[1] - 1, +m[2], h, m[5] ? +m[5] : 0) }; };
const whenLabel = w => (w?.timed ? `${w.d.toLocaleDateString('en-US', { weekday: 'short' })} ${w.d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '');

// ------------------------------------------------------------------ TroopWebHost bundle → Basecamp import
export async function buildTwh(files, { activityFrom, attendFrom, eventsFrom } = {}) {
  const get = k => files.find(f => f.kind === k)?.rows || [];
  const today = new Date();
  const yr = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;   // scouting year starts Aug 1
  activityFrom ||= `${yr - 1}-08-01`; attendFrom ||= `${yr}-08-01`; eventsFrom ||= `${yr}-08-01`;
  const committee = new Set([...get('twh-positions').filter(r => r.Adult === 'Y' && r['Committee Member'] === 'Y').map(r => r.Title.trim()), 'Committee Chair', 'Committee Member']);
  const perm = get('twh-permissions');
  const adultLeaders = new Set(perm.filter(r => ['Adult Leader', 'Site Administrator'].includes(r.Role)).map(r => key(...splitName(r['User Name']))));
  const members = [], guardians = {}, oa = new Set();
  for (const r of get('twh-roster')) {
    let [first, last] = splitName(r.Name);
    const pref = (r['Preferred Name'] || '').trim(); if (pref && pref.length < 20) first = pref;
    if (!first || DEMO.test(r.Name)) continue;
    const k = key(first, last);
    const pos = (r.Leadership || '').split(',').map(s => s.trim()).filter(s => s && !s.startsWith('Z -'));
    const adult = (r.Adult || '').trim().toUpperCase() === 'Y';
    const m = { first, last, role: adult ? 'adult' : 'scout', patrol: adult ? '' : patrolOf(r.Patrol), positions: pos, rank: adult ? '' : (r.Rank || '').trim(), rankDate: iso(r['Rank Date']),
      leader: adult && (LEADER_POS.test(pos.join(', ')) || adultLeaders.has(k) || pos.some(x => committee.has(x))) };
    if ((r['OA Member'] || '').trim().toUpperCase() === 'Y') oa.add(k);
    if (!adult) m.totals = { nights: num(r['Camping Nights']), hiking: num(r['Total Hiking Miles']), service: num(r['Total Service Hours']) };
    members.push(m);
    if (/(^|,\s*)Scoutmaster/.test(r.Leadership || '')) guardians.scoutmaster = k;
    if ((r.Leadership || '').includes('Committee Chair')) guardians.chair = k;
  }
  const mkeys = new Map(members.map(m => [key(m.first, m.last), m]));
  const mkey = name => { const [f, l] = splitName(name); const k = key(f, l); if (mkeys.has(k)) return k; const c = [...mkeys.keys()].filter(kk => kk.startsWith(`${l.toLowerCase()}|`)); return c.length === 1 ? c[0] : k; };
  const adv = new Map();
  const rec = k => { if (!adv.has(k)) adv.set(k, { ranks: [], badges: [], inProgress: [], activity: [] }); return adv.get(k); };
  for (const r of get('twh-ranks')) if (!DEMO.test(r.Scout)) rec(mkey(r.Scout)).ranks.push({ rank: r.Rank, earned: iso(r['Date Earned']), awarded: iso(r['Date Awarded']) });
  for (const r of get('twh-badges')) if (!DEMO.test(r.Scout)) rec(mkey(r.Scout)).badges.push({ name: base(r['Merit Badge']), eagle: r['Merit Badge'].startsWith('*'), earned: iso(r.Earned), awarded: iso(r.Awarded) });
  for (const r of get('twh-mb-progress')) if (!DEMO.test(r.Scout)) rec(mkey(r.Scout)).inProgress.push({ name: base(r['Merit Badge']), eagle: r['Merit Badge'].startsWith('*'), started: iso(r.Started), done: Math.round(num(r['Completed Requirements'])), left: Math.round(num(r['Uncompleted Requirements'])), counselor: (r['Merit Badge Counselor'] || '').trim() });
  const nexts = new Map();
  const reqRows = get('twh-rank-reqs');
  if (reqRows.length) {
    const cols = headersOf(reqRows);
    for (const r of reqRows) {
      if (DEMO.test(r.Name)) continue;
      const cur = (r.Rank || '').trim();
      const nxt = RANKS.includes(cur) && cur !== 'Eagle' ? RANKS[RANKS.indexOf(cur) + 1] : (!cur ? 'Scout' : null);
      if (!nxt) continue;
      const pc = cols.filter(c => new RegExp(`^${PREFIX[nxt]}\\d+[a-z]?$`).test(c));
      nexts.set(mkey(r.Name), { rank: nxt, done: pc.filter(c => (r[c] || '').trim()).length, total: pc.length });
    }
  }
  const attendance = [];
  for (const r of get('twh-participation')) {
    const d = iso(String(r.Date).split(' ')[0]); if (!d) continue;
    const k = mkey(r.Participant); if (!mkeys.has(k)) continue;
    if (d >= attendFrom) attendance.push({ key: k, outingId: `o-twh-${await sha10(`${d}|${r.Event.trim()}`)}` });
    if (mkeys.get(k).role === 'scout' && d >= activityFrom) rec(k).activity.push({ event: r.Event.trim().slice(0, 80), date: d, nights: num(r['Camping Nights']), service: num(r['Service Hours']), hiking: num(r['Hiking Miles']), paddling: num(r['Paddling Miles']) });
  }
  const label = `TroopWebHost export, ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const advOut = [];
  for (const [k, m] of mkeys) {
    if (m.role !== 'scout') continue;
    const a = rec(k);
    const earned = new Set(a.badges.map(b => b.name));
    const ri = r => (RANKS.includes(r) ? RANKS.indexOf(r) : 99);
    a.ranks.sort((x, y) => ri(x.rank) - ri(y.rank));
    a.badges.sort((x, y) => y.earned.localeCompare(x.earned));
    a.inProgress.sort((x, y) => y.done / Math.max(1, y.done + y.left) - x.done / Math.max(1, x.done + x.left));
    a.activity.sort((x, y) => y.date.localeCompare(x.date));
    Object.assign(a, { rank: m.rank, rankDate: m.rankDate, eagleGroups: EAGLE_GROUPS, source: label, totals: m.totals });
    advOut.push({ key: k, record: a, eagleReq: EAGLE_GROUPS.filter(g => g.some(x => earned.has(x))).length, next: nexts.get(k) || null });
  }
  // gear and the merit badge library
  const gear = [];
  const checked = new Map(get('twh-checked-out').map(r => [String(r.ID).trim(), r]));
  for (const r of get('twh-inventory')) {
    const gid = String(r.ID || '').trim(); if (!gid) continue;
    const lib = (r.Type || '').trim() === 'Library';
    const gname = gid.replace(/\s*-\s*EAGLE REQUIRED/, '').trim();
    const item = { id: `g-twh-${await sha10(`${r.Type}|${gid}`)}`, qty: 1, location: (r.Location || '').trim() };
    if (lib) Object.assign(item, { name: `${gname} merit badge pamphlet`, category: 'Merit badge library', tag: gid.includes('EAGLE REQUIRED') ? 'Eagle req.' : '', notes: (r.Condition || '').trim() });
    else { const desc = (r.Description || '').trim(); Object.assign(item, { name: gid.toLowerCase().startsWith('tent') ? 'Troop tent' : desc || gid, category: gid.toLowerCase().includes('tent') ? 'Shelter' : (desc + gid).toLowerCase().includes('stove') ? 'Cooking' : 'Other', tag: gid, notes: [(r.Condition || '').trim(), (r['Replacement Cost'] || '').trim() ? `Replacement cost $${r['Replacement Cost']}` : ''].filter(Boolean).join('; ') }); }
    const c = checked.get(gid) || ((r['Checked Out To'] || '').trim() ? { 'Checked Out To': r['Checked Out To'], 'Date Checked Out': r['Date Checked Out'] } : null);
    if (c && (c['Checked Out To'] || '').trim()) { const [f, l] = splitName(c['Checked Out To']); Object.assign(item, { checkoutKey: mkey(c['Checked Out To']), checkoutName: `${f} ${l}`, checkoutAt: Date.parse(`${iso(c['Date Checked Out']) || '2024-01-01'}T00:00:00Z`) }); }
    gear.push(item);
  }
  // e-mail groups → chat boards / ask-a-leader (members from positions and roles)
  const holders = rx => members.filter(m => m.positions.some(x => rx.test(x))).map(m => key(m.first, m.last));
  const advRole = perm.filter(r => r.Role === 'Rank Advancement').map(r => key(...splitName(r['User Name']))).filter(k => mkeys.has(k));
  const sm = guardians.scoutmaster ? [guardians.scoutmaster] : [];
  const comm = members.filter(m => m.role === 'adult' && m.positions.some(x => committee.has(x))).map(m => key(m.first, m.last));
  const asm = holders(/^assistant scoutmaster$/i);
  const RULES = [
    ['board of review', 'contact', '📋', 'Ready for a board of review? Ask here — the committee will set it up.', comm], ['star, life', 'contact', '⭐', 'Ready for a Scoutmaster conference for Star, Life or Eagle? Ask the Scoutmaster here.', sm],
    ['tenderfoot', 'contact', '🧭', 'Ready for a Scoutmaster conference for Tenderfoot, Second or First Class? Ask here.', [...sm, ...asm]], ['adult patrol', 'board', '🛡️', 'Registered adult leaders.', members.filter(m => m.leader).map(m => key(m.first, m.last))],
    ['advancement', 'board', '🎖️', 'Advancement team.', advRole], ['all adults', 'board', '👪', 'All parents and adults in the troop.', members.filter(m => m.role === 'adult').map(m => key(m.first, m.last))],
    ['assistant scoutmasters', 'board', '🧢', '', asm], ['committee members', 'board', '🏛️', 'Troop committee.', comm], ['den chiefs', 'board', '🐾', 'Scouts serving as den chiefs.', holders(/den chief/i)],
    ['jr assistant', 'board', '🎒', 'Junior Assistant Scoutmasters.', holders(/junior assistant scoutmaster/i)], ['order of the arrow', 'board', '🏹', 'Order of the Arrow members.', [...oa].filter(k => mkeys.has(k))],
    ['outdoor activities', 'board', '🏕️', 'Plans outings and campouts.', holders(/outdoor activities|summer.*camp|equipment/i)],
  ];
  const groups = [];
  for (const r of get('twh-email-groups')) {
    const name = (r['Group Name'] || '').trim();
    if (!name || name.toLowerCase().startsWith('patrol -')) continue;
    const rule = RULES.find(([k]) => name.toLowerCase().includes(k));
    if (!rule) { groups.push({ name, kind: 'board', keys: [] }); continue; }
    groups.push({ name: name.replace('Active Scouts to Request ', 'Request a ').replace(' - For Scouts to Request Leaders', '').replace(' - For Ranks ', ' — '), kind: rule[1], emoji: rule[2], description: rule[3], keys: [...new Set(rule[4])] });
  }
  // events → outings
  const outings = [];
  for (const r of get('twh-events')) {
    const st = parseWhen(r.Start), en = parseWhen(r.End || r.Start) || st;
    if (!st || st.date < eventsFrom) continue;
    const name = (r.Event || '').trim();
    if (SKIP_NAMES.has(name.toLowerCase()) || /admin event only/i.test(name)) continue;
    const loc = (r.Location || '').trim();
    const details = [(r.Highlights || '').trim(), (r.Subgroup || '').trim() && `For: ${r.Subgroup.trim()}`, (r.Leaders || '').trim() && `Leaders: ${r.Leaders.trim().replace(/([a-z])([A-Z])/g, '$1, $2')}`, (r['Campout Nights'] || '').trim() && r['Campout Nights'].trim() !== '0' && `Nights: ${r['Campout Nights'].trim()}`, (r.Distance || '').trim() && `About ${r.Distance.trim()} miles away`, (r['Sign-Up Deadline'] || '').trim() && `Sign up by ${r['Sign-Up Deadline'].trim()} on TroopWebHost`, `TroopWebHost category: ${(r.Type || '').trim()}`].filter(Boolean);
    const cost = (r['Est Cost'] || '').trim();
    outings.push({ id: `o-twh-${await sha10(`${st.date}|${name}`)}`, title: name.replace(/^\s*cancel+ed\s*[-–:]\s*/i, '').slice(0, 80), type: kindOfEvent((r.Type || '').trim(), name), start: st.date, end: en.date,
      location: /^(location pending \(tbd\)|to be determined|tbd)?$/i.test(loc) ? '' : loc, meetTime: whenLabel(st), meetPlace: (r['Departing From'] || '').trim(), returnTime: en && en.timed && en.d - st.d ? whenLabel(en) : '',
      cost: ['0', '0.00', 'N/A', 'n/a'].includes(cost) ? '' : cost, details: details.join('\n'), cancelled: /^\s*cancel+ed\b/i.test(name) });
  }
  // counselors (from badges in progress and the counselor role) and event places
  const counselors = new Map();
  const addC = (name, badge) => {
    const nick = [...name.matchAll(/"([^"]+)"/g)].map(x => x[1]); const plain = name.replace(/"[^"]*"/g, '').trim();
    let first, last; if (plain.includes(',')) { [last, first] = plain.split(/,(.*)/s).map(x => x.trim()); first = first.split(' ')[0]; } else { const p = plain.split(/\s+/); first = p[0]; last = p[p.length - 1]; }
    const m = members.find(mm => mm.last.toLowerCase() === last.toLowerCase() && [first, ...nick].some(f => mm.first.toLowerCase() === f.toLowerCase()));
    const disp = m ? `${m.first} ${m.last}` : `${nick[0] || first} ${last}`;
    const c = counselors.get(disp) || { id: `mbc-${slug(disp)}`, name: disp, memberKey: m ? key(m.first, m.last) : '', badges: new Set() };
    if (badge) c.badges.add(badge); counselors.set(disp, c);
  };
  for (const r of get('twh-mb-progress')) if ((r['Merit Badge Counselor'] || '').trim()) addC(r['Merit Badge Counselor'].trim(), base(r['Merit Badge']));
  for (const r of perm) if (r.Role === 'Merit Badge Counselor') addC(r['User Name']);
  const places = [];
  for (const r of get('twh-locations')) {
    if ((r.Disabled || '').trim().toUpperCase() === 'Y' || !(r.Location || '').trim()) continue;
    let addr = (r.Address || '').trim().replace(/\s{2,}/g, ', ').replace(' USA', '').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');
    if (!/[A-Za-z]{2}/.test(addr)) addr = '';
    const mp = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec((r.Map || '').trim());
    let web = (r['Web Site'] || '').trim(); if (web && !web.startsWith('http')) web = `https://${web}`; if (web.includes('google.com/?')) web = '';
    const nm = r.Location.trim().slice(0, 160);
    places.push({ id: `pl-${await sha10(nm.toLowerCase())}`, name: nm, address: addr.slice(0, 200), phone: (r.Telephone || '').trim().slice(0, 40), web: web.slice(0, 300), mapQ: mp ? `${(+mp[1]).toFixed(6)},${(+mp[2]).toFixed(6)}` : '' });
  }
  const patrols = members.some(m => m.patrol) ? [...new Set(members.map(m => m.patrol).filter(Boolean))].sort().concat('Adults') : [];
  return {
    payload: { members, adv: advOut, attendance, gear, patrols, guardians: guardians.scoutmaster && guardians.chair ? guardians : undefined, groups, outings, counselors: [...counselors.values()].map(c => ({ id: c.id, name: c.name, memberKey: c.memberKey, badges: [...c.badges].sort() })), places },
    counts: { people: members.length, scouts: members.filter(m => m.role === 'scout').length, advancement: advOut.length, attendance: attendance.length, gear: gear.length, groups: groups.length, outings: outings.length, counselors: counselors.size, places: places.length },
  };
}

// ------------------------------------------------------------------ Scoutbook / Black Pug advancement file (advancement.csv layout)
// Columns: Unit, BSA Member ID, First Name, Middle Name, Last Name, Advancement Type, Advancement, Version, Date Completed, Approved, Awarded
// BSA Member ID is dropped here and never sent.
export function advancementRows(rows) {
  const g = (r, ...names) => { for (const n of names) { const k = Object.keys(r).find(x => x.toLowerCase() === n.toLowerCase()); if (k && r[k]) return r[k]; } return ''; };
  return rows.map(r => ({ first: g(r, 'First Name', 'FirstName'), last: g(r, 'Last Name', 'LastName'), type: g(r, 'Advancement Type', 'Type'), name: g(r, 'Advancement', 'Award'), version: g(r, 'Version'),
    completed: iso(g(r, 'Date Completed', 'Completed', 'Completion Date')), approved: /^(1|true|yes|y)$/i.test(g(r, 'Approved')) ? 'yes' : iso(g(r, 'Approved', 'Approved Date')), awarded: /^(1|true|yes|y)$/i.test(g(r, 'Awarded')) ? 'yes' : iso(g(r, 'Awarded', 'Awarded Date', 'AwardedDate')) }))
    .filter(r => r.first && r.last && r.name);
}

// ------------------------------------------------------------------ Scoutbook roster report: names, youth/adult, patrol, position only
export function rosterRows(rows) {
  const g = (r, re) => { const k = Object.keys(r).find(x => re.test(x)); return k ? r[k] : ''; };
  return rows.map(r => ({ first: g(r, /^first ?name$/i) || g(r, /^first$/i), last: g(r, /^last ?name$/i) || g(r, /^last$/i), patrol: g(r, /patrol/i), position: g(r, /position/i), youth: /youth|scout/i.test(g(r, /member ?type|type|youth|adult/i)) || !!g(r, /patrol/i) }))
    .filter(r => r.first && r.last);
}
