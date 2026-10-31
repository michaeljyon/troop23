// Patrol uniform inspections. Patrol leaders (and assistants) inspect their own patrol;
// the SPL, ASPL, troop guides and adult leaders can inspect any patrol. Scores are worked
// out here from the marks, so the numbers can't be made up on the phone.
//
// Who sees what: patrol averages are for everyone signed in. One scout's marks are seen by
// that scout, their parents, leaders, and whoever can inspect that patrol.
import { UNIFORM, MARKS, activeItems, scoreOf } from '../../troop/uniform.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const ANY_RX = /senior patrol|\bspl\b|\baspl\b|troop guide/i;
const PL_RX = /patrol leader/i;

export function inspectorScope(me, isLeader) {
  if (!me) return { any: false, patrol: '' };
  const pos = (me.positions || []).join(', ');
  if (isLeader || me.leader || (me.role === 'scout' && ANY_RX.test(pos))) return { any: true, patrol: me.patrol || '' };
  if (me.role === 'scout' && PL_RX.test(pos) && !/senior/i.test(pos) && me.patrol) return { any: false, patrol: me.patrol };
  return { any: false, patrol: '' };
}
const canInspect = (scope, patrol) => scope.any || (!!scope.patrol && scope.patrol === patrol);

async function config(store) {
  const c = (await store.get('inspect/config', { type: 'json' })) || {};
  const off = Array.isArray(c.off) ? c.off : UNIFORM.filter(i => i.off).map(i => i.id);
  return { off, items: activeItems(off) };
}
async function all(store) {
  const { blobs } = await store.list({ prefix: 'inspect/i/' });
  return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
}
const avgOf = list => { const s = list.filter(x => !x.absent); return s.length ? Math.round(s.reduce((t, x) => t + x.score, 0) / s.length) : null; };

export async function inspectRoutes(store, rest, req, body, now, ctx) {
  const { me, people, isLeader } = ctx;
  if (!me) return err('Sign in with your personal code to see uniform inspections.', 401);
  const scope = inspectorScope(me, isLeader);
  const [what] = rest;
  const mine = new Set([me.id, ...(me.scouts || [])]);
  const seesScout = (insp, sid) => isLeader || me.leader || mine.has(sid) || canInspect(scope, insp.patrol);
  const roster = patrol => people.members.filter(m => m.active !== false && m.role === 'scout' && m.patrol === patrol).map(m => ({ id: m.id, name: m.name, first: m.first, positions: m.positions || [] })).sort((a, b) => a.name.localeCompare(b.name));

  // overview: standings, recent inspections, and what I can do
  if (!what && req.method === 'GET') {
    const cfg = await config(store);
    const list = await all(store);
    const patrols = [...new Set(people.members.filter(m => m.role === 'scout' && m.active !== false && m.patrol).map(m => m.patrol))].sort();
    const month = new Date(now).toISOString().slice(0, 7);
    const standings = patrols.map(p => {
      const ps = list.filter(i => i.patrol === p);
      const mon = ps.filter(i => i.date.startsWith(month));
      return { patrol: p, last: ps[0] ? { date: ps[0].date, avg: ps[0].avg } : null, month: mon.length ? Math.round(mon.reduce((t, i) => t + (i.avg || 0), 0) / mon.length) : null, count: ps.length };
    }).sort((a, b) => (b.month ?? -1) - (a.month ?? -1) || (b.last?.avg ?? -1) - (a.last?.avg ?? -1));
    const recent = list.slice(0, 30).map(i => ({ id: i.id, date: i.date, patrol: i.patrol, avg: i.avg, present: i.scouts.filter(s => !s.absent).length, perfect: i.scouts.filter(s => !s.absent && s.score === 100).length, by: i.by.name, canOpen: isLeader || me.leader || canInspect(scope, i.patrol) || i.scouts.some(s => mine.has(s.id)) }));
    const myResults = list.flatMap(i => i.scouts.filter(s => mine.has(s.id)).map(s => ({ inspection: i.id, date: i.date, patrol: i.patrol, id: s.id, name: s.name, absent: !!s.absent, score: s.score, marks: s.marks }))).slice(0, 20);
    const canPatrols = scope.any ? patrols : scope.patrol ? [scope.patrol] : [];
    return json({ items: cfg.items, off: cfg.off, all: UNIFORM, standings, recent, mine: myResults, can: canPatrols, myPatrol: me.patrol || '', isLeader: !!(isLeader || me.leader) });
  }

  if (what === 'roster' && req.method === 'GET') {
    const patrol = clean(new URL(req.url).searchParams.get('patrol'), 60);
    if (!canInspect(scope, patrol)) return err('Only the patrol leader, the SPL or a leader can inspect this patrol.', 403);
    return json({ patrol, scouts: roster(patrol), items: (await config(store)).items });
  }

  // leaders choose which optional items count
  if (what === 'config' && req.method === 'POST') {
    if (!(isLeader || me.leader)) return err('Only leaders can change the checklist.', 403);
    const off = (Array.isArray(body.off) ? body.off : []).filter(id => UNIFORM.some(i => i.id === id && i.optional));
    await store.setJSON('inspect/config', { off, by: me.name, at: now });
    return json({ ok: true, ...(await config(store)) });
  }

  // save an inspection
  if (!what && req.method === 'POST') {
    const patrol = clean(body.patrol, 60);
    if (!canInspect(scope, patrol)) return err('Only the patrol leader, the SPL or a leader can inspect this patrol.', 403);
    const r = roster(patrol), byIdM = new Map(r.map(s => [s.id, s]));
    const { items } = await config(store);
    const ids = new Set(items.map(i => i.id));
    const scouts = (Array.isArray(body.scouts) ? body.scouts : []).filter(s => byIdM.has(s?.id)).slice(0, 40).map(s => {
      const marks = Object.fromEntries(Object.entries(s.marks || {}).filter(([k, v]) => ids.has(k) && MARKS[v] && !(v === 'na' && !items.find(i => i.id === k).na)));
      const absent = !!s.absent;
      return { id: s.id, name: byIdM.get(s.id).name, absent, marks: absent ? {} : marks, score: absent ? null : scoreOf(marks, items) };
    });
    if (!scouts.filter(s => !s.absent).length) return err('Inspect at least one scout who\'s here.');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date(now).toISOString().slice(0, 10);
    const insp = { id: `in-${rid()}`, date, patrol, by: { id: me.id, name: me.name }, items: items.map(i => i.id), scouts, avg: avgOf(scouts), note: clean(body.note, 300), created: now };
    await store.setJSON(`inspect/i/${insp.id}`, insp);
    return json({ ok: true, inspection: insp });
  }

  const id = clean(what, 40);
  const insp = /^in-[a-z0-9]+$/.test(id) ? await store.get(`inspect/i/${id}`, { type: 'json' }) : null;
  if (!insp) return err('Inspection not found.', 404);
  if (req.method === 'GET') {
    const full = isLeader || me.leader || canInspect(scope, insp.patrol);
    return json({ inspection: { ...insp, scouts: insp.scouts.filter(s => full || seesScout(insp, s.id)) }, items: UNIFORM, canEdit: full, hidden: full ? 0 : insp.scouts.length - insp.scouts.filter(s => seesScout(insp, s.id)).length });
  }
  if (req.method === 'DELETE') {
    if (!(isLeader || me.leader || insp.by.id === me.id)) return err('Only the inspector or a leader can delete this.', 403);
    await store.delete(`inspect/i/${id}`);
    return json({ ok: true });
  }
  return err('Not found', 404);
}
