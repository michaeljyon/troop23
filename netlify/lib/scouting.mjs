// Knot trainer times, patrol points, scavenger hunts, campsite duty rosters and Court of Honor plans.
//   knots/pb/{memberId}        { [knotId]: { ms, at } }   best "tie it" times (buddy-checked)
//   knots/can/{memberId}       { [knotId]: at }            knots a scout says they can tie
//   points/e/{id}              a points award { patrol, pts, reason, by, byName, at }
//   points/season              { start, name }
//   hunt/h/{id}                a scavenger hunt; hunt/s/{hid}/{sid} a photo entry; hunt/f/{hid}/{sid} the photo
//   duty/{outingId}            campsite duty roster for an outing
//   coh/{id}                   a Court of Honor plan
import { ATT_MAX } from './people.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const today = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(now));
const short = m => (m ? `${m.first || m.name.split(' ')[0]} ${(m.last || m.name.split(' ').slice(-1)[0] || '').slice(0, 1)}.`.trim() : '');
const posOf = me => (me?.positions || []).join(', ');
const SPL_RX = /senior patrol|\bspl\b|\baspl\b/i;
const PLC_RX = /senior patrol|\bspl\b|\baspl\b|patrol leader|troop guide|scribe|quartermaster/i;
export const KNOT_IDS = ['square', 'two-half', 'taut-line', 'sheet-bend', 'bowline', 'clove', 'timber', 'figure-8', 'lash-square', 'lash-shear', 'lash-diagonal', 'whipping'];
export const realPatrols = list => list.filter(p => !/adult|leader|parent/i.test(p));
async function listJSON(store, prefix) {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
}

// ---------------------------------------------------------------- knots
export async function knotRoutes(store, rest, req, body, now, { me, people }) {
  const [what] = rest;
  if (!what && req.method === 'GET') {
    const [pbs, cans] = await Promise.all([store.list({ prefix: 'knots/pb/' }), me ? store.get(`knots/can/${me.id}`, { type: 'json' }) : null]);
    const byId = new Map((people?.members || []).map(m => [m.id, m]));
    const boards = {};
    for (const b of pbs.blobs) {
      const mid = b.key.split('/').pop(); const m = byId.get(mid);
      if (!m || m.active === false) continue;
      const pb = (await store.get(b.key, { type: 'json' })) || {};
      for (const [k, v] of Object.entries(pb)) (boards[k] ||= []).push({ name: short(m), patrol: m.patrol || '', ms: v.ms, me: mid === me?.id });
    }
    for (const k of Object.keys(boards)) boards[k] = boards[k].sort((a, b) => a.ms - b.ms).slice(0, 10);
    const mine = me ? (await store.get(`knots/pb/${me.id}`, { type: 'json' })) || {} : {};
    return json({ boards, mine, can: cans || {}, signedIn: !!me });
  }
  if (!me) return err('Sign in with your personal code to save your times.', 401);
  if (what === 'time' && req.method === 'POST') {
    const knot = KNOT_IDS.includes(body.knot) ? body.knot : '';
    const ms = Math.round(Number(body.ms));
    if (!knot) return err('Pick a knot.');
    if (!(ms >= 1500 && ms <= 600000)) return err('That time doesn\'t look right. Try again.');
    if (!body.checked) return err('Have a buddy or leader check the knot first.');
    const key = `knots/pb/${me.id}`;
    const pb = (await store.get(key, { type: 'json' })) || {};
    const best = !pb[knot] || ms < pb[knot].ms;
    if (best) { pb[knot] = { ms, at: now }; await store.setJSON(key, pb); }
    const can = (await store.get(`knots/can/${me.id}`, { type: 'json' })) || {};
    if (!can[knot]) { can[knot] = now; await store.setJSON(`knots/can/${me.id}`, can); }
    return json({ ok: true, best, pb: pb[knot] });
  }
  if (what === 'can' && req.method === 'POST') {
    const knot = KNOT_IDS.includes(body.knot) ? body.knot : '';
    if (!knot) return err('Pick a knot.');
    const key = `knots/can/${me.id}`;
    const can = (await store.get(key, { type: 'json' })) || {};
    if (body.on) can[knot] = now; else delete can[knot];
    await store.setJSON(key, can);
    return json({ ok: true, can });
  }
  return err('Not found', 404);
}

// ---------------------------------------------------------------- patrol points
export async function pointsBoard(store, patrols, opts) {
  const season = (await store.get('points/season', { type: 'json' })) || { start: '', name: '' };
  const since = season.start ? Date.parse(`${season.start}T00:00:00`) : 0;
  const ps = realPatrols(patrols);
  const tally = Object.fromEntries(ps.map(p => [p, { patrol: p, total: 0, by: {} }]));
  const add = (p, pts, kind) => { if (!tally[p]) return; tally[p].total += pts; tally[p].by[kind] = (tally[p].by[kind] || 0) + pts; };
  const entries = (await listJSON(store, 'points/e/')).filter(e => e.at >= since).sort((a, b) => b.at - a.at);
  for (const e of entries) add(e.patrol, e.pts, 'awards');
  const auto = [];
  if (opts.pointsInspect !== false) {
    for (const i of await listJSON(store, 'inspect/i/')) {
      if (!isDate(i.date) || (season.start && i.date < season.start) || typeof i.avg !== 'number') continue;
      const pts = Math.round(i.avg / 10); add(i.patrol, pts, 'inspections'); auto.push({ kind: 'inspections', patrol: i.patrol, pts, reason: `Uniform inspection (${i.avg})`, at: i.created || 0 });
    }
  }
  if (opts.pointsHunts !== false) {
    for (const h of await listJSON(store, 'hunt/h/')) {
      if (h.status === 'draft' || (season.start && (h.date || '') < season.start)) continue;
      const items = Object.fromEntries(h.items.map(x => [x.id, x.pts]));
      const subs = await listJSON(store, `hunt/s/${h.id}/`);
      const per = {};
      for (const s of subs) if (s.status === 'ok') per[s.patrol] = (per[s.patrol] || 0) + (items[s.itemId] || 0);
      for (const [p, pts] of Object.entries(per)) { add(p, pts, 'hunts'); auto.push({ kind: 'hunts', patrol: p, pts, reason: h.title, at: h.closedAt || h.created }); }
    }
  }
  const board = Object.values(tally).sort((a, b) => b.total - a.total);
  return { season, board, recent: entries.slice(0, 60), auto: auto.sort((a, b) => b.at - a.at).slice(0, 30) };
}

export async function pointsRoutes(store, rest, req, body, now, { me, isLeader, settings }) {
  const leader = !!(isLeader || me?.leader);
  const canAward = leader || (!!me && me.role === 'scout' && SPL_RX.test(posOf(me)));
  const [what, id] = rest;
  if (!what && req.method === 'GET') return json({ ...(await pointsBoard(store, settings.patrols, settings.opts)), canAward, isLeader: leader, me: me?.id || '' });
  if (!what && req.method === 'POST') {
    if (!canAward) return err('Leaders, the SPL and the ASPL give patrol points.', 403);
    const patrol = realPatrols(settings.patrols).includes(body.patrol) ? body.patrol : '';
    const pts = Math.round(Number(body.pts));
    if (!patrol) return err('Pick a patrol.');
    if (!pts || Math.abs(pts) > 100) return err('Points must be between -100 and 100.');
    const e = { id: `e-${rid()}`, patrol, pts, reason: clean(body.reason, 100) || 'Points', by: me?.id || 'leader', byName: me?.name || 'Leader', at: now };
    await store.setJSON(`points/e/${e.id}`, e);
    return json({ ok: true, entry: e });
  }
  if (what === 'season' && req.method === 'POST') {
    if (!leader) return err('Only leaders start a new season.', 403);
    const s = { start: isDate(body.start) ? body.start : today(now), name: clean(body.name, 60) || 'New season' };
    await store.setJSON('points/season', s);
    return json({ ok: true, season: s });
  }
  if (what && /^e-[a-z0-9]+$/.test(what) && req.method === 'DELETE') {
    const e = await store.get(`points/e/${what}`, { type: 'json' });
    if (!e) return err('Not found', 404);
    if (!(leader || (canAward && e.by === me?.id))) return err('Only leaders or the person who gave the points can take them back.', 403);
    await store.delete(`points/e/${what}`);
    return json({ ok: true });
  }
  void id;
  return err('Not found', 404);
}

// ---------------------------------------------------------------- scavenger hunts
const HUNT_IMG = /^image\/(jpeg|png|webp)$/;
export async function huntRoutes(store, rest, req, body, now, { me, isLeader, settings, url }) {
  const leader = !!(isLeader || me?.leader);
  const myPatrol = me?.patrol && realPatrols(settings.patrols).includes(me.patrol) ? me.patrol : '';
  const [hid, sub, sid] = rest;
  const hkey = x => `hunt/h/${x}`;
  const load = async x => (/^h-[a-z0-9]+$/.test(x || '') ? store.get(hkey(x), { type: 'json' }) : null);
  const fixItems = list => (Array.isArray(list) ? list : []).slice(0, 40).map(x => ({ id: /^i-[a-z0-9]+$/.test(x.id || '') ? x.id : `i-${rid()}`, text: clean(x.text, 140), pts: Math.max(1, Math.min(50, Math.round(Number(x.pts) || 1))) })).filter(x => x.text);

  if (!hid && req.method === 'GET') {
    const hunts = (await listJSON(store, 'hunt/h/')).filter(h => leader || h.status !== 'draft').sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created - a.created)
      .map(h => ({ id: h.id, title: h.title, date: h.date, status: h.status, count: h.items.length, total: h.items.reduce((t, x) => t + x.pts, 0) }));
    return json({ hunts, isLeader: leader, myPatrol });
  }
  if (!hid && req.method === 'POST') {
    if (!leader) return err('Leaders set up scavenger hunts.', 403);
    const h = { id: `h-${rid()}`, title: clean(body.title, 100) || 'Scavenger hunt', date: isDate(body.date) ? body.date : today(now), outingId: clean(body.outingId, 40), note: clean(body.note, 600), items: fixItems(body.items), status: 'draft', by: me?.name || 'Leader', created: now };
    if (!h.items.length) return err('Add at least one thing to find.');
    await store.setJSON(hkey(h.id), h);
    return json({ ok: true, hunt: h });
  }
  const h = await load(hid);
  if (!h || (h.status === 'draft' && !leader)) return err('Scavenger hunt not found.', 404);
  const subs = async () => (await listJSON(store, `hunt/s/${h.id}/`));
  const canSee = s => leader || (!!myPatrol && s.patrol === myPatrol);

  if (!sub && req.method === 'GET') {
    const all = await subs();
    const pts = Object.fromEntries(h.items.map(x => [x.id, x.pts]));
    const standings = {};
    for (const p of realPatrols(settings.patrols)) standings[p] = { patrol: p, pts: 0, found: 0, waiting: 0 };
    for (const s of all) { const t = standings[s.patrol]; if (!t) continue; if (s.status === 'ok') { t.pts += pts[s.itemId] || 0; t.found += 1; } else if (s.status === 'pending') t.waiting += 1; }
    return json({ hunt: h, entries: all.filter(canSee).sort((a, b) => b.at - a.at), standings: Object.values(standings).sort((a, b) => b.pts - a.pts), isLeader: leader, myPatrol });
  }
  if (!sub && req.method === 'PUT') {
    if (!leader) return err('Leaders change scavenger hunts.', 403);
    if (body.title !== undefined) h.title = clean(body.title, 100) || h.title;
    if (body.date !== undefined && isDate(body.date)) h.date = body.date;
    if (body.note !== undefined) h.note = clean(body.note, 600);
    if (body.items !== undefined) { const it = fixItems(body.items); if (!it.length) return err('Add at least one thing to find.'); h.items = it; }
    if (['draft', 'open', 'closed'].includes(body.status)) { h.status = body.status; if (body.status === 'closed') h.closedAt = now; }
    await store.setJSON(hkey(h.id), h);
    return json({ ok: true, hunt: h });
  }
  if (!sub && req.method === 'DELETE') {
    if (!leader) return err('Leaders delete scavenger hunts.', 403);
    for (const p of [`hunt/s/${h.id}/`, `hunt/f/${h.id}/`]) { const { blobs } = await store.list({ prefix: p }); await Promise.all(blobs.map(b => store.delete(b.key))); }
    await store.delete(hkey(h.id));
    return json({ ok: true });
  }
  // a patrol sends a photo for one item
  if (sub === 'entries' && !sid && req.method === 'POST') {
    if (!me) return err('Sign in with your personal code to send photos.', 401);
    if (h.status !== 'open') return err('This scavenger hunt isn\'t open.', 409);
    const patrol = leader && body.patrol ? body.patrol : myPatrol;
    if (!realPatrols(settings.patrols).includes(patrol)) return err('You need to be in a patrol to send photos. Ask a leader to set your patrol.', 403);
    const item = h.items.find(x => x.id === body.itemId);
    if (!item) return err('Pick what you found.');
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(body.data || '');
    if (!m || !HUNT_IMG.test(m[1])) return err('Send a photo (JPEG, PNG or WebP).');
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > ATT_MAX) return err('That photo is too big.');
    const all = await subs();
    const prev = all.find(s => s.patrol === patrol && s.itemId === item.id);
    if (prev?.status === 'ok') return err('Your patrol already got points for that one.', 409);
    if (prev) { await store.delete(`hunt/s/${h.id}/${prev.id}`); await store.delete(`hunt/f/${h.id}/${prev.id}`); }
    const s = { id: `s-${rid()}`, itemId: item.id, patrol, by: me.id, byName: me.name, at: now, status: 'pending', type: m[1], size: bytes.length, note: clean(body.note, 140) };
    await store.set(`hunt/f/${h.id}/${s.id}`, bytes);
    await store.setJSON(`hunt/s/${h.id}/${s.id}`, s);
    return json({ ok: true, entry: s });
  }
  if (sub === 'entries' && sid) {
    if (!/^s-[a-z0-9]+$/.test(sid)) return err('Not found', 404);
    const s = await store.get(`hunt/s/${h.id}/${sid}`, { type: 'json' });
    if (!s || !canSee(s)) return err('Not found', 404);
    if (rest[3] === 'photo' && req.method === 'GET') {
      const data = await store.get(`hunt/f/${h.id}/${sid}`, { type: 'arrayBuffer' });
      if (!data) return err('Not found', 404);
      return new Response(data, { headers: { 'content-type': s.type, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' } });
    }
    if (req.method === 'POST' && rest[3] === 'judge') {
      if (!leader) return err('Leaders judge the photos.', 403);
      s.status = ['ok', 'no', 'pending'].includes(body.status) ? body.status : s.status;
      s.judgedBy = me?.name || 'Leader'; s.reply = clean(body.reply, 140);
      await store.setJSON(`hunt/s/${h.id}/${sid}`, s);
      return json({ ok: true, entry: s });
    }
    if (req.method === 'DELETE') {
      if (!(leader || (s.by === me?.id && s.status !== 'ok'))) return err('Only leaders or the person who sent it can take it back.', 403);
      await store.delete(`hunt/s/${h.id}/${sid}`); await store.delete(`hunt/f/${h.id}/${sid}`);
      return json({ ok: true });
    }
  }
  void url;
  return err('Not found', 404);
}

// ---------------------------------------------------------------- campsite duty roster
export const DEFAULT_DUTIES = ['Color guard', 'Firewood & fire ring', 'Water', 'Campsite cleanup', 'Campfire program'];
const days = (start, end) => {
  const out = []; if (!isDate(start)) return out;
  const d0 = new Date(`${start}T12:00:00Z`), d1 = new Date(`${(isDate(end) ? end : start)}T12:00:00Z`);
  for (let d = d0; d <= d1 && out.length < 10; d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10));
  return out;
};
export function rotate(jobs, patrols, dates) {
  const grid = {};
  dates.forEach((d, di) => { grid[d] = {}; jobs.forEach((j, ji) => { grid[d][j] = patrols.length ? patrols[(ji + di) % patrols.length] : ''; }); });
  return grid;
}
export async function dutyRoutes(store, rest, req, body, now, { me, isLeader, settings, colItems }) {
  const leader = !!(isLeader || me?.leader);
  const canEdit = leader || (!!me && me.role === 'scout' && PLC_RX.test(posOf(me)));
  const patrols = realPatrols(settings.patrols);
  const [oid] = rest;
  if (oid === 'today' && req.method === 'GET') {
    const t = today(now);
    const outings = (await colItems(store, 'outings')).filter(o => !o.cancelled && isDate(o.start) && o.start <= t && (o.end || o.start) >= t);
    const out = [];
    for (const o of outings) {
      const r = await store.get(`duty/${o.id}`, { type: 'json' });
      if (!r?.grid?.[t]) continue;
      const row = r.grid[t];
      out.push({ outingId: o.id, title: o.title, jobs: Object.entries(row).filter(([, p]) => p).map(([job, patrol]) => ({ job, patrol, names: r.names?.[t]?.[job] || '' })) });
    }
    return json({ today: t, rosters: out, myPatrol: me?.patrol || '' });
  }
  if (!/^[\w-]{1,40}$/.test(oid || '')) return err('Not found', 404);
  const o = (await colItems(store, 'outings')).find(x => x.id === oid);
  if (!o) return err('Outing not found.', 404);
  const key = `duty/${oid}`;
  if (req.method === 'GET') {
    const saved = await store.get(key, { type: 'json' });
    const jobs = saved?.jobs || (settings.dutyJobs?.length ? settings.dutyJobs : DEFAULT_DUTIES);
    const dates = days(o.start, o.end);
    return json({ roster: saved || { jobs, dates, grid: rotate(jobs, patrols, dates), names: {}, draft: true }, patrols, canEdit });
  }
  if (req.method === 'PUT') {
    if (!canEdit) return err('Leaders and the Patrol Leaders\' Council set the duty roster.', 403);
    const dates = days(o.start, o.end);
    const jobs = (Array.isArray(body.jobs) ? body.jobs : []).map(j => clean(j, 40)).filter(Boolean).slice(0, 12);
    if (!jobs.length) return err('Add at least one job.');
    const grid = {}, names = {};
    for (const d of dates) {
      grid[d] = {}; names[d] = {};
      for (const j of jobs) { const p = body.grid?.[d]?.[j]; grid[d][j] = patrols.includes(p) ? p : ''; const n = clean(body.names?.[d]?.[j], 80); if (n) names[d][j] = n; }
    }
    const r = { jobs, dates, grid, names, updated: now, by: me?.name || 'Leader' };
    await store.setJSON(key, r);
    return json({ ok: true, roster: r, patrols, canEdit });
  }
  if (req.method === 'DELETE') {
    if (!canEdit) return err('Leaders and the Patrol Leaders\' Council set the duty roster.', 403);
    await store.delete(key);
    return json({ ok: true });
  }
  return err('Not found', 404);
}

// ---------------------------------------------------------------- Court of Honor planner (leaders only)
export async function cohRoutes(store, rest, req, body, now, { me, isLeader, people, listAdv }) {
  const leader = !!(isLeader || me?.leader);
  if (!leader) return err('The Court of Honor planner is for leaders.', me ? 403 : 401);
  const [id, sub] = rest;
  const key = x => `coh/${x}`;
  const fixAgenda = list => (Array.isArray(list) ? list : []).slice(0, 40).map(x => ({ title: clean(x.title, 100), who: clean(x.who, 80), ref: clean(x.ref, 60), note: clean(x.note, 300), kind: ['ceremony', 'awards', 'item'].includes(x.kind) ? x.kind : 'item' })).filter(x => x.title);
  const byId = new Map((people?.members || []).map(m => [m.id, m]));
  const fixAwards = list => (Array.isArray(list) ? list : []).slice(0, 400).map(a => ({ memberId: byId.has(a.memberId) ? a.memberId : '', name: clean(a.name, 80) || byId.get(a.memberId)?.name || '', kind: ['rank', 'badge', 'other'].includes(a.kind) ? a.kind : 'other', item: clean(a.item, 80), earned: isDate(a.earned) ? a.earned : '', presented: !!a.presented })).filter(a => a.item && a.name);

  if (!id && req.method === 'GET') {
    const list = (await listJSON(store, 'coh/')).sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(c => ({ id: c.id, title: c.title, date: c.date, place: c.place, awards: c.awards.length, presented: c.awards.filter(a => a.presented).length }));
    return json({ cohs: list });
  }
  // what's been earned but not yet presented, from each scout's advancement record
  if (id === 'candidates' && req.method === 'GET') {
    const since = isDate(new URL(req.url).searchParams.get('since')) ? new URL(req.url).searchParams.get('since') : '';
    const scouts = (people?.members || []).filter(m => m.role === 'scout' && m.active !== false);
    const advs = await listAdv();
    const out = [];
    for (const s of scouts) {
      const a = advs[s.id]; if (!a) continue;
      for (const r of a.ranks || []) if (r.earned && !r.awarded && (!since || r.earned >= since)) out.push({ memberId: s.id, name: s.name, patrol: s.patrol || '', kind: 'rank', item: r.rank, earned: r.earned });
      for (const b of a.badges || []) if (b.earned && !b.awarded && (!since || b.earned >= since)) out.push({ memberId: s.id, name: s.name, patrol: s.patrol || '', kind: 'badge', item: b.name, eagle: !!b.eagle, earned: b.earned });
    }
    return json({ candidates: out.sort((x, y) => x.name.localeCompare(y.name) || x.kind.localeCompare(y.kind) || x.item.localeCompare(y.item)) });
  }
  if (!id && req.method === 'POST') {
    const c = { id: `c-${rid()}`, title: clean(body.title, 100) || 'Court of Honor', date: isDate(body.date) ? body.date : '', time: clean(body.time, 20), place: clean(body.place, 120), agenda: fixAgenda(body.agenda), awards: fixAwards(body.awards), names: body.names === 'first' ? 'first' : 'full', by: me?.name || 'Leader', created: now, updated: now };
    await store.setJSON(key(c.id), c);
    return json({ ok: true, coh: c });
  }
  if (!/^c-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
  const c = await store.get(key(id), { type: 'json' });
  if (!c) return err('Court of Honor not found.', 404);
  if (sub === 'csv' && req.method === 'GET') {
    const esc = v => { const s = String(v ?? ''); const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [['Scout', 'Award type', 'Award', 'Earned', 'Presented at', 'Court of Honor date'], ...c.awards.map(a => [a.name, a.kind === 'rank' ? 'Rank' : a.kind === 'badge' ? 'Merit badge' : 'Other', a.item, a.earned, a.presented ? c.title : '', c.date])];
    return new Response(rows.map(r => r.map(esc).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="court-of-honor-${c.date || c.id}.csv"`, 'cache-control': 'no-store' } });
  }
  if (!sub && req.method === 'GET') return json({ coh: c });
  if (!sub && req.method === 'PUT') {
    for (const k of ['title', 'time', 'place']) if (body[k] !== undefined) c[k] = clean(body[k], k === 'place' ? 120 : k === 'title' ? 100 : 20);
    if (body.date !== undefined) c.date = isDate(body.date) ? body.date : '';
    if (body.agenda !== undefined) c.agenda = fixAgenda(body.agenda);
    if (body.awards !== undefined) c.awards = fixAwards(body.awards);
    if (body.names !== undefined) c.names = body.names === 'first' ? 'first' : 'full';
    c.updated = now; c.updatedBy = me?.name || 'Leader';
    await store.setJSON(key(id), c);
    return json({ ok: true, coh: c });
  }
  if (!sub && req.method === 'DELETE') { await store.delete(key(id)); return json({ ok: true }); }
  return err('Not found', 404);
}
