// Requirement sign-offs (Scout–First Class), service hours, Eagle project tracker, summer camp planner.
//   signoff/{memberId}          { "Rank|req": { by, byName, at } }
//   service/e/{id}              a service hours entry
//   eagle/{memberId}            Eagle project tracker
//   camp/{id}                   a summer camp; camp/{id}/c/{memberId} a scout's picks
import { REQS, ALL_REQ_IDS } from '../../troop/requirements.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const today = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(now));
const SIGNER_RX = /senior patrol|\bspl\b|\baspl\b|troop guide|patrol leader|instructor|junior assistant/i;
const esc = v => { const s = String(v ?? ''); const t = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csv = (rows, name) => new Response(rows.map(r => r.map(esc).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
async function listJSON(store, prefix) { const { blobs } = await store.list({ prefix }); return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean); }

export async function advance2Routes(store, head, rest, req, body, now, { me, isLeader, people, settings }) {
  const leader = !!(isLeader || me?.leader);
  const members = (people?.members || []).filter(m => m.active !== false);
  const byId = new Map(members.map(m => [m.id, m]));
  const scouts = members.filter(m => m.role === 'scout');
  const youthSigner = !!me && me.role === 'scout' && settings.opts.signYouth !== false && SIGNER_RX.test((me.positions || []).join(', '));
  const canSee = id => leader || youthSigner || me?.id === id || (me?.scouts || []).includes(id);
  const brief = m => ({ id: m.id, name: m.name, first: m.first || m.name.split(' ')[0], patrol: m.patrol || '', rank: m.rank || '', rankDate: m.rankDate || '' });

  // ---------------------------------------------------------------- requirement sign-offs
  if (head === 'signoff') {
    const [mid, sub] = rest;
    if (!mid && req.method === 'GET') {
      const list = leader || youthSigner ? scouts : scouts.filter(s => canSee(s.id));
      const counts = {};
      await Promise.all(list.map(async s => { counts[s.id] = Object.keys((await store.get(`signoff/${s.id}`, { type: 'json' })) || {}).length; }));
      return json({ scouts: list.map(s => ({ ...brief(s), signed: counts[s.id] || 0 })).sort((a, b) => a.name.localeCompare(b.name)), canSign: leader || youthSigner, isLeader: leader });
    }
    if (mid === 'export.csv' && req.method === 'GET') {
      if (!leader) return err('Leaders download sign-offs.', 403);
      const rows = [['Scout', 'Patrol', 'Rank', 'Requirement', 'Summary', 'Date', 'Signed by']];
      for (const s of scouts) {
        const so = (await store.get(`signoff/${s.id}`, { type: 'json' })) || {};
        for (const [k, v] of Object.entries(so).sort()) { const [rank, id] = k.split('|'); rows.push([s.name, s.patrol || '', rank, id, REQS[rank]?.find(r => r.id === id)?.text || '', v.date || '', v.byName]); }
      }
      return csv(rows, 'requirement-signoffs.csv');
    }
    const s = byId.get(mid);
    if (!s || s.role !== 'scout') return err('Scout not found.', 404);
    if (!canSee(s.id)) return err('You can see your own requirements (or your scout\'s).', me ? 403 : 401);
    const key = `signoff/${s.id}`;
    const so = (await store.get(key, { type: 'json' })) || {};
    if (!sub && req.method === 'GET') return json({ scout: brief(s), signed: so, canSign: (leader || youthSigner) && me?.id !== s.id, leaderOnly: !leader });
    if (!sub && req.method === 'POST') {
      if (!(leader || youthSigner)) return err('Leaders (and the scouts your troop allows) sign off requirements.', 403);
      if (me?.id === s.id) return err('Someone else has to sign off your own requirements.', 403);
      const k = `${body.rank}|${body.req}`;
      if (!ALL_REQ_IDS.has(k)) return err('Unknown requirement.');
      if (REQS[body.rank].find(r => r.id === body.req)?.lead && !leader) return err('An adult leader signs this one.', 403);
      if (body.on) so[k] = { by: me?.id || 'leader', byName: me?.name || 'Leader', date: isDate(body.date) ? body.date : today(now), at: now };
      else { if (!so[k]) return json({ ok: true, signed: so }); if (!leader && so[k].by !== me?.id) return err('Only a leader or the person who signed it can undo it.', 403); delete so[k]; }
      await store.setJSON(key, so);
      return json({ ok: true, signed: so });
    }
  }

  // ---------------------------------------------------------------- service hours
  if (head === 'service') {
    const [id, sub] = rest;
    if (!me && !leader) return err('Sign in with your personal code to log service hours.', 401);
    if (!id && req.method === 'GET') {
      const all = await listJSON(store, 'service/e/');
      const mine = leader ? all : all.filter(e => canSee(e.memberId) && (e.memberId === me?.id || (me?.scouts || []).includes(e.memberId)));
      const ids = leader ? scouts.map(s => s.id) : [me?.id, ...(me?.scouts || [])].filter(x => byId.get(x)?.role === 'scout');
      const totals = ids.map(sid => {
        const m = byId.get(sid); const since = m.rankDate || '';
        const es = all.filter(e => e.memberId === sid && e.status === 'ok');
        const sum = l => Math.round(l.reduce((t, e) => t + e.hours, 0) * 10) / 10;
        return { ...brief(m), total: sum(es), sinceRank: sum(es.filter(e => !since || e.date >= since)), conservationSinceRank: sum(es.filter(e => e.conservation && (!since || e.date >= since))) };
      }).sort((a, b) => a.name.localeCompare(b.name));
      return json({ entries: mine.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at), totals, isLeader: leader, me: me?.id || '', scouts: leader ? scouts.map(brief) : [] });
    }
    if (id === 'export.csv' && req.method === 'GET') {
      if (!leader) return err('Leaders download service hours.', 403);
      const all = (await listJSON(store, 'service/e/')).filter(e => e.status === 'ok').sort((a, b) => a.date.localeCompare(b.date));
      return csv([['Scout', 'Date', 'Hours', 'Project', 'Conservation', 'Approved by'], ...all.map(e => [e.name, e.date, e.hours, e.project, e.conservation ? 'Yes' : '', e.approvedBy || ''])], 'service-hours.csv');
    }
    if (!id && req.method === 'POST') {
      const ids = (Array.isArray(body.memberIds) ? body.memberIds : [body.memberId]).filter(Boolean).slice(0, 80);
      const hours = Math.round(Number(body.hours) * 4) / 4;
      if (!(hours > 0 && hours <= 24)) return err('Hours must be between 0.25 and 24.');
      if (!isDate(body.date) || body.date > today(now)) return err('Pick the date of the service.');
      const project = clean(body.project, 120); if (!project) return err('Name the project.');
      const out = [];
      for (const mid of ids) {
        const m = byId.get(mid);
        if (!m || m.role !== 'scout') return err('Pick a scout.');
        if (!(leader || me.id === mid || (me.scouts || []).includes(mid))) return err('You can log hours for yourself or your own scouts.', 403);
        const e = { id: `v-${rid()}`, memberId: mid, name: m.name, date: body.date, hours, project, conservation: !!body.conservation, note: clean(body.note, 300), status: leader ? 'ok' : 'pending', by: me?.id || 'leader', byName: me?.name || 'Leader', approvedBy: leader ? (me?.name || 'Leader') : '', at: now };
        await store.setJSON(`service/e/${e.id}`, e); out.push(e);
      }
      return json({ ok: true, entries: out });
    }
    if (!/^v-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const e = await store.get(`service/e/${id}`, { type: 'json' });
    if (!e) return err('Not found', 404);
    if (sub === 'approve' && req.method === 'POST') {
      if (!leader) return err('Leaders approve service hours.', 403);
      e.status = body.status === 'no' ? 'no' : 'ok'; e.approvedBy = me?.name || 'Leader';
      await store.setJSON(`service/e/${id}`, e);
      return json({ ok: true, entry: e });
    }
    if (!sub && req.method === 'DELETE') {
      if (!(leader || (e.by === me?.id && e.status !== 'ok'))) return err('Only leaders can remove approved hours.', 403);
      await store.delete(`service/e/${id}`);
      return json({ ok: true });
    }
  }

  // ---------------------------------------------------------------- Eagle project tracker
  if (head === 'eagle') {
    const [mid] = rest;
    if (!me && !leader) return err('Sign in with your personal code.', 401);
    if (!mid && req.method === 'GET') {
      const docs = Object.fromEntries((await Promise.all(scouts.map(async s => [s.id, await store.get(`eagle/${s.id}`, { type: 'json' })]))));
      const list = scouts.filter(s => (leader || canSee(s.id)) && (docs[s.id] || /star|life/i.test(s.rank || '') || me?.id === s.id))
        .map(s => ({ ...brief(s), project: docs[s.id]?.title || '', stage: docs[s.id] ? Object.keys(docs[s.id].stages || {}).length : 0, board: docs[s.id]?.stages?.board || '' }));
      return json({ scouts: list.sort((a, b) => b.stage - a.stage || a.name.localeCompare(b.name)), isLeader: leader });
    }
    const s = byId.get(mid);
    if (!s || s.role !== 'scout') return err('Scout not found.', 404);
    if (!(leader || canSee(s.id)) || (youthSigner && !leader && me.id !== s.id && !(me.scouts || []).includes(s.id))) return err('You can see your own Eagle project (or your scout\'s).', 403);
    const key = `eagle/${s.id}`;
    const doc = (await store.get(key, { type: 'json' })) || { title: '', beneficiary: '', coach: '', stages: {}, hours: 0, notes: '' };
    if (req.method === 'GET') return json({ scout: brief(s), doc, canEdit: true });
    if (req.method === 'PUT') {
      for (const [k, n] of [['title', 140], ['beneficiary', 140], ['coach', 80], ['notes', 3000], ['contact', 140]]) if (body[k] !== undefined) doc[k] = clean(body[k], n);
      if (body.hours !== undefined) doc.hours = Math.max(0, Math.min(5000, Math.round(Number(body.hours) || 0)));
      if (body.stages && typeof body.stages === 'object') doc.stages = Object.fromEntries(Object.entries(body.stages).filter(([k, v]) => /^[a-z]{2,12}$/.test(k) && isDate(v)).slice(0, 20));
      doc.updated = now; doc.by = me?.name || 'Leader';
      await store.setJSON(key, doc);
      return json({ ok: true, doc });
    }
  }

  // ---------------------------------------------------------------- summer camp planner
  if (head === 'camp') {
    const [id, sub] = rest;
    if (!me && !leader) return err('Sign in with your personal code.', 401);
    const fix = c => ({
      name: clean(c.name, 100) || 'Summer camp', place: clean(c.place, 120), start: isDate(c.start) ? c.start : '', end: isDate(c.end) ? c.end : '', note: clean(c.note, 1000),
      blocks: (Array.isArray(c.blocks) ? c.blocks : []).map(b => clean(b, 40)).filter(Boolean).slice(0, 8),
      badges: (Array.isArray(c.badges) ? c.badges : []).slice(0, 120).map(b => ({ name: clean(b.name, 60), block: clean(b.block, 40), prereq: clean(b.prereq, 300), seats: Math.max(0, Math.min(99, Math.round(Number(b.seats) || 0))) })).filter(b => b.name),
      open: !!c.open,
    });
    if (!id && req.method === 'GET') return json({ camps: (await listJSON(store, 'camp/')).filter(c => c.id && (leader || c.open)).sort((a, b) => (b.start || '').localeCompare(a.start || '')), isLeader: leader });
    if (!id && req.method === 'POST') {
      if (!leader) return err('Leaders set up summer camp.', 403);
      const c = { id: `k-${rid()}`, ...fix(body), created: now };
      await store.setJSON(`camp/${c.id}`, c);
      return json({ ok: true, camp: c });
    }
    if (!/^k-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const c = await store.get(`camp/${id}`, { type: 'json' });
    if (!c || (!c.open && !leader)) return err('Camp not found.', 404);
    const picksOf = async () => { const { blobs } = await store.list({ prefix: `camp/${id}/c/` }); return Object.fromEntries(await Promise.all(blobs.map(async b => [b.key.split('/').pop(), await store.get(b.key, { type: 'json' })]))); };
    if (!sub && req.method === 'GET') {
      const all = await picksOf();
      const mineIds = [me?.id, ...(me?.scouts || [])].filter(x => byId.get(x)?.role === 'scout');
      const roster = {};
      for (const [mid, p] of Object.entries(all)) for (const [blk, b] of Object.entries(p.picks || {})) (roster[`${blk}|${b}`] ||= []).push(leader ? byId.get(mid)?.name || '' : '');
      return json({ camp: c, mine: mineIds.map(mid => ({ ...brief(byId.get(mid)), picks: all[mid]?.picks || {} })), counts: Object.fromEntries(Object.entries(roster).map(([k, v]) => [k, v.length])), roster: leader ? roster : null, isLeader: leader });
    }
    if (!sub && req.method === 'PUT') { if (!leader) return err('Leaders set up summer camp.', 403); const n = { ...c, ...fix({ ...c, ...body }) }; await store.setJSON(`camp/${id}`, n); return json({ ok: true, camp: n }); }
    if (!sub && req.method === 'DELETE') { if (!leader) return err('Leaders set up summer camp.', 403); const { blobs } = await store.list({ prefix: `camp/${id}/c/` }); await Promise.all(blobs.map(b => store.delete(b.key))); await store.delete(`camp/${id}`); return json({ ok: true }); }
    if (sub === 'pick' && req.method === 'POST') {
      const mid = body.memberId;
      if (!(leader || mid === me?.id || (me?.scouts || []).includes(mid)) || byId.get(mid)?.role !== 'scout') return err('You can pick for yourself or your own scouts.', 403);
      const picks = {};
      for (const [blk, name] of Object.entries(body.picks || {})) if (c.badges.some(b => b.name === name && (b.block || '') === blk)) picks[blk] = name;
      const all = await picksOf();
      for (const [blk, name] of Object.entries(picks)) { const b = c.badges.find(x => x.name === name && (x.block || '') === blk); const taken = Object.entries(all).filter(([m, p]) => m !== mid && p.picks?.[blk] === name).length; if (b.seats && taken >= b.seats) return err(`${name} is full in ${blk || 'that session'}.`, 409); }
      await store.setJSON(`camp/${id}/c/${mid}`, { picks, at: now, by: me?.name || 'Leader' });
      return json({ ok: true, picks });
    }
  }
  return err('Not found', 404);
}
