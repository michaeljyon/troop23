// Running the troop: PLC meeting planner, quick polls, QR meeting check-in, the Christmas tree sale,
// year in review, the Eagle wall and lost and found.
//   meet/{id}  ·  poll/{id}, poll/{id}/v/{memberId}  ·  attend/{date}  ·  fund/cfg, fund/day/{date}, fund/shift/{id}
//   eagles/{id} (alumni added by hand)  ·  lost/i/{id}, lost/f/{id} (photo)
import { createHash, randomBytes } from 'node:crypto';
import { ATT_MAX } from './people.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const today = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(now));
const PLC_RX = /senior patrol|\bspl\b|\baspl\b|patrol leader|troop guide|scribe/i;
const esc = v => { const s = String(v ?? ''); const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csv = (rows, name) => new Response(rows.map(r => r.map(esc).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
async function listJSON(store, prefix) { const { blobs } = await store.list({ prefix }); return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean); }
export const MEETING_PARTS = [['pre', 'Preopening', 15], ['open', 'Opening', 5], ['skills', 'Skills instruction', 20], ['patrol', 'Patrol meetings', 15], ['game', 'Interpatrol activity', 15], ['close', 'Closing', 5], ['after', 'After the meeting', 10]];
export const TREE_ITEMS = [['f56', 'Fraser fir, 5–6 ft'], ['f67', 'Fraser fir, 6–7 ft'], ['f78', 'Fraser fir, 7–8 ft'], ['f89', 'Fraser fir, 8–9 ft'], ['f10', 'Fraser fir, 9 ft and up'], ['tt', 'Tabletop tree'], ['wr', 'Wreath'], ['st', 'Tree stand'], ['gl', 'Garland']];
const slotCode = (seed, t) => createHash('sha256').update(`${seed}:${Math.floor(t / 60000)}`).digest('hex').slice(0, 6).toUpperCase().replace(/[01O]/g, 'X');

export async function troopOpsRoutes(store, head, rest, req, body, now, { me, isLeader, people, colItems, settings, listAdv, photoMetas, pointsBoard }) {
  const leader = !!(isLeader || me?.leader);
  const plc = !!me && me.role === 'scout' && PLC_RX.test((me.positions || []).join(', '));
  const members = (people?.members || []);
  const active = members.filter(m => m.active !== false);
  const byId = new Map(members.map(m => [m.id, m]));
  const [id, sub, x] = rest;
  const need = () => (!me && !leader ? err('Sign in with your personal code.', 401) : null);

  // ---------------------------------------------------------------- PLC meeting planner
  if (head === 'meet') {
    const n = need(); if (n) return n;
    const canEdit = leader || plc;
    const fix = b => ({ date: isDate(b.date) ? b.date : today(now), title: clean(b.title, 100) || 'Troop meeting', theme: clean(b.theme, 100),
      parts: Object.fromEntries(MEETING_PARTS.map(([k]) => [k, { text: clean(b.parts?.[k]?.text, 600), who: clean(b.parts?.[k]?.who, 80), ref: clean(b.parts?.[k]?.ref, 60), mins: Math.max(0, Math.min(120, Math.round(Number(b.parts?.[k]?.mins) || 0))) }])) });
    if (!id && req.method === 'GET') return json({ meetings: (await listJSON(store, 'meet/')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60), canEdit, today: today(now) });
    if (!id && req.method === 'POST') { if (!canEdit) return err('Leaders and the PLC plan meetings.', 403); const m = { id: `t-${rid()}`, ...fix(body), by: me?.name || 'Leader', created: now }; await store.setJSON(`meet/${m.id}`, m); return json({ ok: true, meeting: m }); }
    if (!/^t-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const m = await store.get(`meet/${id}`, { type: 'json' }); if (!m) return err('Meeting plan not found.', 404);
    if (req.method === 'GET') return json({ meeting: m, canEdit });
    if (!canEdit) return err('Leaders and the PLC plan meetings.', 403);
    if (req.method === 'PUT') { const u = { ...m, ...fix({ ...m, ...body }), updated: now }; await store.setJSON(`meet/${id}`, u); return json({ ok: true, meeting: u }); }
    if (req.method === 'DELETE') { await store.delete(`meet/${id}`); return json({ ok: true }); }
  }

  // ---------------------------------------------------------------- quick polls
  if (head === 'poll') {
    const n = need(); if (n) return n;
    const canMake = leader || plc;
    const inAud = p => leader || p.aud === 'all' || (p.aud === 'scouts' && me?.role === 'scout') || (p.aud === 'adults' && me?.role !== 'scout') || (p.aud === 'leaders' && leader);
    const tally = async p => { const vs = await listJSON(store, `poll/${p.id}/v/`); const c = Object.fromEntries(p.options.map(o => [o.id, 0])); for (const v of vs) for (const o of v.opts) if (o in c) c[o] += 1; return { counts: c, voters: vs.length }; };
    const shape = async p => { const mine = me ? await store.get(`poll/${p.id}/v/${me.id}`, { type: 'json' }) : null; const closed = p.status === 'closed' || (p.closes && p.closes < today(now)); const show = leader || closed || !!mine; return { ...p, closed, mine: mine?.opts || null, ...(show ? await tally(p) : { counts: null, voters: null }) }; };
    if (!id && req.method === 'GET') { const ps = (await listJSON(store, 'poll/')).filter(p => p.id && inAud(p)).sort((a, b) => b.created - a.created).slice(0, 40); return json({ polls: await Promise.all(ps.map(shape)), canMake }); }
    if (!id && req.method === 'POST') {
      if (!canMake) return err('Leaders and the PLC make polls.', 403);
      const options = (Array.isArray(body.options) ? body.options : []).map(t => clean(t, 80)).filter(Boolean).slice(0, 10).map((text, i) => ({ id: `o${i}`, text }));
      if (options.length < 2) return err('Give at least two choices.');
      const p = { id: `p-${rid()}`, q: clean(body.q, 160), options, multi: !!body.multi, aud: ['all', 'scouts', 'adults', 'leaders'].includes(body.aud) ? body.aud : 'all', closes: isDate(body.closes) ? body.closes : '', status: 'open', by: me?.name || 'Leader', created: now };
      if (!p.q) return err('Ask a question.');
      await store.setJSON(`poll/${p.id}`, p); return json({ ok: true, poll: await shape(p) });
    }
    if (!/^p-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const p = await store.get(`poll/${id}`, { type: 'json' }); if (!p || !inAud(p)) return err('Poll not found.', 404);
    if (sub === 'vote' && req.method === 'POST') {
      if (!me) return err('Sign in with your personal code to vote.', 401);
      if (p.status === 'closed' || (p.closes && p.closes < today(now))) return err('This poll is closed.', 409);
      const opts = [...new Set((Array.isArray(body.opts) ? body.opts : []).filter(o => p.options.some(x => x.id === o)))];
      if (!opts.length || (!p.multi && opts.length > 1)) return err(p.multi ? 'Pick at least one.' : 'Pick one.');
      await store.setJSON(`poll/${id}/v/${me.id}`, { opts, at: now }); return json({ ok: true, poll: await shape(p) });
    }
    if (sub === 'close' && req.method === 'POST') { if (!(leader || p.by === me?.name)) return err('Only leaders close polls.', 403); p.status = body.open ? 'open' : 'closed'; await store.setJSON(`poll/${id}`, p); return json({ ok: true, poll: await shape(p) }); }
    if (!sub && req.method === 'DELETE') { if (!leader) return err('Only leaders delete polls.', 403); const { blobs } = await store.list({ prefix: `poll/${id}/v/` }); await Promise.all(blobs.map(b => store.delete(b.key))); await store.delete(`poll/${id}`); return json({ ok: true }); }
  }

  // ---------------------------------------------------------------- meeting check-in
  if (head === 'attend') {
    if (id === 'in' && req.method === 'POST') {
      if (!me) return err('Sign in with your personal code first, then scan again.', 401);
      const s = await store.get(`attend/${today(now)}`, { type: 'json' });
      const code = clean(body.code, 10).toUpperCase();
      if (!s?.open || ![slotCode(s.seed, now), slotCode(s.seed, now - 60000), s.fixed].includes(code)) return err('That check-in code has expired. Scan the code on the screen again.', 409);
      s.list[me.id] = s.list[me.id] || { name: me.name, role: me.role, at: now, how: 'scan' };
      await store.setJSON(`attend/${s.date}`, s);
      return json({ ok: true, title: s.title, count: Object.keys(s.list).length });
    }
    if (!leader) return err('Leaders run check-in.', me ? 403 : 401);
    if (!id && req.method === 'GET') { const all = (await listJSON(store, 'attend/')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30); return json({ sessions: all.map(s => ({ date: s.date, title: s.title, open: s.open, count: Object.keys(s.list).length })), today: today(now) }); }
    if (id === 'export.csv') { const all = (await listJSON(store, 'attend/')).sort((a, b) => a.date.localeCompare(b.date)); return csv([['Date', 'Meeting', 'Name', 'Role', 'How'], ...all.flatMap(s => Object.values(s.list).map(v => [s.date, s.title, v.name, v.role === 'scout' ? 'Scout' : 'Adult', v.how === 'scan' ? 'Scanned' : 'Marked by a leader']))], 'meeting-attendance.csv'); }
    if (id === 'open' && req.method === 'POST') {
      const d = today(now);
      const s = (await store.get(`attend/${d}`, { type: 'json' })) || { date: d, list: {}, seed: randomBytes(12).toString('hex'), fixed: [...randomBytes(6)].map(b => 'ACDEFGHJKMNPQRTUVWXY3469'[b % 24]).join('') };
      s.title = clean(body.title, 80) || s.title || 'Troop meeting'; s.open = true; s.openedBy = me?.name || 'Leader';
      await store.setJSON(`attend/${d}`, s); return json({ ok: true, date: d });
    }
    if (!isDate(id)) return err('Not found', 404);
    const s = await store.get(`attend/${id}`, { type: 'json' }); if (!s) return err('No check-in that day.', 404);
    if (!sub && req.method === 'GET') {
      const scouts = active.filter(m => m.role === 'scout').map(m => ({ id: m.id, name: m.name, patrol: m.patrol || '' }));
      return json({ session: { date: s.date, title: s.title, open: s.open, list: s.list }, code: s.open && id === today(now) ? slotCode(s.seed, now) : '', fixed: s.open ? s.fixed : '', scouts });
    }
    if (sub === 'mark' && req.method === 'POST') { const m = byId.get(body.memberId); if (!m) return err('Pick someone.'); if (body.on) s.list[m.id] = s.list[m.id] || { name: m.name, role: m.role, at: now, how: 'leader' }; else delete s.list[m.id]; await store.setJSON(`attend/${id}`, s); return json({ ok: true, list: s.list }); }
    if (sub === 'close' && req.method === 'POST') { s.open = false; await store.setJSON(`attend/${id}`, s); return json({ ok: true }); }
    void x;
  }

  // ---------------------------------------------------------------- Christmas tree sale
  if (head === 'fund') {
    const n = need(); if (n) return n;
    const cfg = (await store.get('fund/cfg', { type: 'json' })) || { name: 'Christmas Tree Sale', goal: 0, lot: '', hours: '', note: '', items: TREE_ITEMS.map(([k, label]) => ({ id: k, label, price: 0, received: 0 })) };
    if (!id && req.method === 'GET') {
      const days = (await listJSON(store, 'fund/day/')).sort((a, b) => a.date.localeCompare(b.date));
      const sold = {}; for (const d of days) for (const [k, v] of Object.entries(d.sold || {})) sold[k] = (sold[k] || 0) + v;
      const price = Object.fromEntries(cfg.items.map(i => [i.id, i.price]));
      const raised = Math.round(days.reduce((t, d) => t + Object.entries(d.sold || {}).reduce((s, [k, v]) => s + v * (price[k] || 0), 0) + (d.donations || 0), 0));
      const shifts = (await listJSON(store, 'fund/shift/')).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      const hours = {};
      for (const s of shifts) { const len = Math.max(0, (Date.parse(`2000-01-01T${s.end}`) - Date.parse(`2000-01-01T${s.start}`)) / 36e5); for (const v of s.signups) if (v.scout && s.date <= today(now)) hours[v.id] = { name: v.name, hours: (hours[v.id]?.hours || 0) + len }; }
      return json({ cfg, sold, raised, days: leader ? days : days.map(d => ({ date: d.date, total: Object.values(d.sold || {}).reduce((t, v) => t + v, 0) })), shifts, scoutHours: leader ? Object.values(hours).sort((a, b) => b.hours - a.hours) : null, isLeader: leader, me: me?.id || '', myPeople: me ? [me.id, ...(me.scouts || [])].map(i => ({ id: i, name: byId.get(i)?.name || me.name, scout: byId.get(i)?.role === 'scout' })) : [] });
    }
    if (id === 'cfg' && req.method === 'PUT') {
      if (!leader) return err('Leaders set up the sale.', 403);
      const next = { name: clean(body.name, 80) || 'Christmas Tree Sale', goal: Math.max(0, Math.round(Number(body.goal) || 0)), lot: clean(body.lot, 200), hours: clean(body.hours, 300), note: clean(body.note, 1000),
        items: (Array.isArray(body.items) ? body.items : []).slice(0, 30).map(i => ({ id: /^[a-z0-9]{1,12}$/.test(i.id || '') ? i.id : rid().slice(0, 6), label: clean(i.label, 60), price: Math.max(0, Math.round(Number(i.price) * 100) / 100 || 0), received: Math.max(0, Math.round(Number(i.received) || 0)) })).filter(i => i.label) };
      await store.setJSON('fund/cfg', next); return json({ ok: true, cfg: next });
    }
    if (id === 'day' && req.method === 'PUT') {
      if (!leader) return err('Leaders record sales.', 403);
      if (!isDate(body.date)) return err('Pick a date.');
      const sold = Object.fromEntries(cfg.items.map(i => [i.id, Math.max(0, Math.min(999, Math.round(Number(body.sold?.[i.id]) || 0)))]).filter(([, v]) => v));
      const d = { date: body.date, sold, donations: Math.max(0, Math.round(Number(body.donations) || 0)), note: clean(body.note, 300), by: me?.name || 'Leader', at: now };
      await store.setJSON(`fund/day/${body.date}`, d); return json({ ok: true, day: d });
    }
    if (id === 'shifts' && req.method === 'POST') {
      if (!leader) return err('Leaders set up lot shifts.', 403);
      const dates = (Array.isArray(body.dates) ? body.dates : [body.date]).filter(isDate).slice(0, 60);
      const times = (Array.isArray(body.times) ? body.times : [[body.start, body.end]]).filter(t => /^\d{2}:\d{2}$/.test(t?.[0]) && /^\d{2}:\d{2}$/.test(t?.[1]) && t[0] < t[1]).slice(0, 6);
      if (!dates.length || !times.length) return err('Pick dates and shift times.');
      const made = [];
      for (const d of dates) for (const [s, e] of times) { const sh = { id: `s-${rid()}`, date: d, start: s, end: e, adults: Math.max(0, Math.min(20, Math.round(Number(body.adults) || 2))), scouts: Math.max(0, Math.min(30, Math.round(Number(body.scouts) || 3))), signups: [] }; await store.setJSON(`fund/shift/${sh.id}`, sh); made.push(sh); }
      return json({ ok: true, shifts: made });
    }
    if (id === 'shift' && /^s-[a-z0-9]+$/.test(sub || '')) {
      const sh = await store.get(`fund/shift/${sub}`, { type: 'json' }); if (!sh) return err('Shift not found.', 404);
      if (req.method === 'DELETE') { if (!leader) return err('Leaders remove shifts.', 403); await store.delete(`fund/shift/${sub}`); return json({ ok: true }); }
      if (req.method === 'POST') {
        const who = byId.get(body.memberId);
        if (!who) return err('Pick who is working.');
        if (!(leader || who.id === me?.id || (me?.scouts || []).includes(who.id))) return err('You can sign up yourself or your own scouts.', 403);
        sh.signups = sh.signups.filter(v => v.id !== who.id);
        if (body.on) {
          const scout = who.role === 'scout';
          if (sh.signups.filter(v => v.scout === scout).length >= (scout ? sh.scouts : sh.adults)) return err(`This shift has enough ${scout ? 'scouts' : 'adults'}. Pick another one.`, 409);
          sh.signups.push({ id: who.id, name: who.name, scout, at: now });
        }
        await store.setJSON(`fund/shift/${sub}`, sh); return json({ ok: true, shift: sh });
      }
    }
  }


  // ---------------------------------------------------------------- geocaching courses
  if (head === 'geo') {
    const n = need(); if (n) return n;
    const WORDS = ['BOWLINE', 'COMPASS', 'LANTERN', 'TRAILHEAD', 'CAMPFIRE', 'MARSHMALLOW', 'PINECONE', 'CANOE', 'SUMMIT', 'COMPASSROSE', 'TENTSTAKE', 'BACKPACK', 'WAYPOINT', 'BEARING', 'HIKER', 'OWL', 'OTTER', 'FERN', 'ACORN', 'PADDLE'];
    const fixCaches = list => (Array.isArray(list) ? list : []).slice(0, 40).map((c, i) => ({ id: /^c[a-z0-9]{1,10}$/.test(c.id || '') ? c.id : `c${rid().slice(0, 6)}`, name: clean(c.name, 60) || `Cache ${i + 1}`, lat: Number(c.lat), lng: Number(c.lng), hint: clean(c.hint, 200), code: (clean(c.code, 30).toUpperCase().replace(/[^A-Z0-9]/g, '') || `${WORDS[Math.floor(Math.random() * WORDS.length)]}${Math.floor(10 + Math.random() * 90)}`), pts: Math.max(0, Math.min(50, Math.round(Number(c.pts ?? 5)))) })).filter(c => Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && (c.lat || c.lng));
    const strip = c => ({ ...c, caches: c.caches.map(({ code, ...rest }) => (leader ? { code, ...rest } : rest)) });
    const findsOf = async cid => { const { blobs } = await store.list({ prefix: `geo/f/${cid}/` }); return Object.fromEntries(await Promise.all(blobs.map(async b => [b.key.split('/').pop(), await store.get(b.key, { type: 'json' })]))); };
    if (!id && req.method === 'GET') return json({ courses: (await listJSON(store, 'geo/c/')).filter(c => leader || c.status !== 'draft').sort((a, b) => b.created - a.created).map(c => ({ id: c.id, title: c.title, date: c.date, status: c.status, count: c.caches.length })), isLeader: leader });
    if (!id && req.method === 'POST') {
      if (!leader) return err('Leaders set up geocache courses.', 403);
      const c = { id: `g-${rid()}`, title: clean(body.title, 100) || 'Geocache course', note: clean(body.note, 600), date: isDate(body.date) ? body.date : today(now), ordered: !!body.ordered, caches: fixCaches(body.caches), status: 'draft', by: me?.name || 'Leader', created: now };
      await store.setJSON(`geo/c/${c.id}`, c); return json({ ok: true, course: c });
    }
    if (!/^g-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const c = await store.get(`geo/c/${id}`, { type: 'json' });
    if (!c || (c.status === 'draft' && !leader)) return err('Course not found.', 404);
    if (!sub && req.method === 'GET') {
      const all = await findsOf(id);
      const pts = Object.fromEntries(c.caches.map(x => [x.id, x.pts]));
      const board = Object.entries(all).map(([mid, f]) => ({ name: (byId.get(mid)?.first || byId.get(mid)?.name?.split(' ')[0] || '') + (byId.get(mid)?.last ? ` ${byId.get(mid).last[0]}.` : ''), patrol: f.patrol || '', found: Object.keys(f.found || {}).length, pts: Object.keys(f.found || {}).reduce((t, k) => t + (pts[k] || 0), 0), me: mid === me?.id })).sort((a, b) => b.found - a.found || b.pts - a.pts);
      return json({ course: strip(c), mine: me ? all[me.id]?.found || {} : {}, board, isLeader: leader });
    }
    if (!sub && req.method === 'PUT') {
      if (!leader) return err('Leaders change geocache courses.', 403);
      for (const k of ['title', 'note']) if (body[k] !== undefined) c[k] = clean(body[k], k === 'title' ? 100 : 600);
      if (isDate(body.date)) c.date = body.date;
      if (body.ordered !== undefined) c.ordered = !!body.ordered;
      if (body.caches !== undefined) c.caches = fixCaches(body.caches);
      if (['draft', 'open', 'closed'].includes(body.status)) c.status = body.status;
      await store.setJSON(`geo/c/${id}`, c); return json({ ok: true, course: c });
    }
    if (!sub && req.method === 'DELETE') { if (!leader) return err('Leaders delete courses.', 403); const { blobs } = await store.list({ prefix: `geo/f/${id}/` }); await Promise.all(blobs.map(b => store.delete(b.key))); await store.delete(`geo/c/${id}`); return json({ ok: true }); }
    if (sub === 'find' && req.method === 'POST') {
      if (!me) return err('Sign in with your personal code to log finds.', 401);
      if (c.status !== 'open') return err('This course isn\'t open right now.', 409);
      const cache = c.caches.find(x => x.id === body.cacheId);
      if (!cache) return err('Pick a cache.');
      const key = `geo/f/${id}/${me.id}`;
      const f = (await store.get(key, { type: 'json' })) || { patrol: me.patrol || '', found: {}, tries: 0 };
      if (f.found[cache.id]) return json({ ok: true, already: true, found: f.found });
      f.tries = (f.tries || 0) + 1;
      if (f.tries > 25) return err('Too many guesses. Ask a leader.', 429);
      if (String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '') !== cache.code) { await store.setJSON(key, f); return err('That\'s not the code word. Look inside the cache again.', 400); }
      f.found[cache.id] = now; f.patrol = me.patrol || f.patrol;
      await store.setJSON(key, f);
      return json({ ok: true, found: f.found, pts: cache.pts });
    }
  }

  // ---------------------------------------------------------------- year in review
  if (head === 'year' && req.method === 'GET') {
    const y = /^\d{4}$/.test(id || '') ? id : today(now).slice(0, 4);
    const inY = d => (d || '').startsWith(y);
    const [outings, hikes, advs, photos, service] = await Promise.all([colItems(store, 'outings'), colItems(store, 'hikes'), listAdv(), photoMetas(store), listJSON(store, 'service/e/')]);
    const done = outings.filter(o => inY(o.start) && !o.cancelled && o.start <= today(now));
    const nights = done.filter(o => o.type === 'campout' || (o.end && o.end > o.start)).reduce((t, o) => t + Math.max(1, Math.round((Date.parse(o.end || o.start) - Date.parse(o.start)) / 864e5)), 0);
    const yh = hikes.filter(h => inY(h.date));
    const ranks = {}, badges = {}; let eagles = 0, badgeCount = 0;
    for (const a of Object.values(advs)) { for (const r of a?.ranks || []) if (inY(r.earned)) { ranks[r.rank] = (ranks[r.rank] || 0) + 1; if (r.rank === 'Eagle') eagles += 1; } for (const b of a?.badges || []) if (inY(b.earned)) { badges[b.name] = (badges[b.name] || 0) + 1; badgeCount += 1; } }
    const types = {}; for (const o of done) types[o.type] = (types[o.type] || 0) + 1;
    const pts = await pointsBoard().catch(() => null);
    return json({ year: y, outings: done.length, types, nights, hikes: yh.length, miles: Math.round(yh.reduce((t, h) => t + (h.distance || 0) * Math.max(1, (h.group || []).length), 0) / 1609.34), hikeMiles: Math.round(yh.reduce((t, h) => t + (h.distance || 0), 0) / 1609.34),
      ranks, eagles, badgeCount, topBadges: Object.entries(badges).sort((a, b) => b[1] - a[1]).slice(0, 6), photos: photos.filter(p => p.status === 'approved' && new Date(p.at).getFullYear() === Number(y)).length,
      service: Math.round(service.filter(e => e.status === 'ok' && inY(e.date)).reduce((t, e) => t + e.hours, 0)), champion: pts?.board?.[0]?.total ? pts.board[0].patrol : '', biggest: done.slice().sort((a, b) => (Date.parse(b.end || b.start) - Date.parse(b.start)) - (Date.parse(a.end || a.start) - Date.parse(a.start)))[0]?.title || '' });
  }

  // ---------------------------------------------------------------- Eagle wall
  if (head === 'eagles') {
    const n0 = need(); if (n0) return n0;
    if (!id && req.method === 'GET') {
      const advs = await listAdv();
      const list = [];
      for (const [mid, a] of Object.entries(advs)) { const e = (a?.ranks || []).find(r => r.rank === 'Eagle' && r.earned); const m = byId.get(mid); if (e && m) list.push({ id: mid, name: m.name, date: e.earned, year: e.earned.slice(0, 4), project: '' }); }
      for (const e of await listJSON(store, 'eagles/')) list.push({ ...e, manual: true });
      const docs = await Promise.all(list.filter(e => !e.manual).map(async e => [e.id, await store.get(`eagle/${e.id}`, { type: 'json' })]));
      for (const [mid, d] of docs) if (d?.title) list.find(e => e.id === mid).project = d.title;
      return json({ eagles: list.sort((a, b) => (b.year || '').localeCompare(a.year || '') || a.name.localeCompare(b.name)), isLeader: leader });
    }
    if (!leader) return err('Leaders keep the Eagle wall.', 403);
    if (!id && req.method === 'POST') { const e = { id: `e-${rid()}`, name: clean(body.name, 80), year: /^\d{4}$/.test(body.year || '') ? body.year : '', project: clean(body.project, 140) }; if (!e.name || !e.year) return err('Add a name and the year.'); await store.setJSON(`eagles/${e.id}`, e); return json({ ok: true, eagle: e }); }
    if (/^e-[a-z0-9]+$/.test(id || '') && req.method === 'DELETE') { await store.delete(`eagles/${id}`); return json({ ok: true }); }
  }

  // ---------------------------------------------------------------- lost and found
  if (head === 'lost') {
    const n = need(); if (n) return n;
    if (!id && req.method === 'GET') { const all = (await listJSON(store, 'lost/i/')).filter(l => l.id && (l.status === 'open' || now - (l.claimedAt || 0) < 14 * 864e5)).sort((a, b) => b.at - a.at); return json({ items: all, isLeader: leader, me: me?.id || '' }); }
    if (!id && req.method === 'POST') {
      const l = { id: `l-${rid()}`, title: clean(body.title, 80), where: clean(body.where, 120), note: clean(body.note, 300), status: 'open', by: me?.id || 'leader', byName: me?.name || 'Leader', at: now, photo: false };
      if (!l.title) return err('Say what it is.');
      if (body.data) { const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.data); if (!m) return err('Send a photo (JPEG, PNG or WebP).'); const bytes = Buffer.from(m[2], 'base64'); if (bytes.length > ATT_MAX) return err('That photo is too big.'); await store.set(`lost/f/${l.id}`, bytes); l.photo = m[1]; }
      await store.setJSON(`lost/i/${l.id}`, l); return json({ ok: true, item: l });
    }
    if (!/^l-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const l = await store.get(`lost/i/${id}`, { type: 'json' }); if (!l) return err('Not found', 404);
    if (sub === 'photo' && req.method === 'GET') { const d = l.photo && await store.get(`lost/f/${id}`, { type: 'arrayBuffer' }); if (!d) return err('Not found', 404); return new Response(d, { headers: { 'content-type': l.photo, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' } }); }
    if (sub === 'claim' && req.method === 'POST') {
      if (!(leader || l.by === me?.id)) return err('Tell a leader or the person who posted it, and they\'ll mark it returned.', 403); l.status = body.open ? 'open' : 'claimed'; l.claimedBy = me?.name || 'Leader'; l.claimedAt = now; await store.setJSON(`lost/i/${id}`, l); return json({ ok: true, item: l }); }
    if (!sub && req.method === 'DELETE') { if (!(leader || l.by === me?.id)) return err('Only leaders or the person who posted it can remove it.', 403); await store.delete(`lost/i/${id}`); await store.delete(`lost/f/${id}`); return json({ ok: true }); }
  }
  void settings;
  return err('Not found', 404);
}
