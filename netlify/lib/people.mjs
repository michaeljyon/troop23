// Members, personal sign-in, two-deep messaging and advancement.
//
// Accounts: leaders hand each member a personal code (or invite link).
// Redeeming it on a device creates a session, so the person's own data
// (sign-ups for their family, packing lists, messages, advancement) follows
// them to any phone. The troop code still works for guests.
//
// Messaging follows Scouting America's Safeguarding Youth digital rules:
// every conversation automatically includes the Scoutmaster and the
// Committee Chair (no one-on-one contact), messages can't be deleted by the
// people who sent them, and anyone can report a message for leaders to review.

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const err = (message, status = 400) => json({ error: message }, status);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const keyOf = (first, last) => `${String(last || '').trim().toLowerCase()}|${String(first || '').trim().toLowerCase()}`;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { const b = crypto.getRandomValues(new Uint8Array(8)); const s = [...b].map(x => ALPHA[x % ALPHA.length]).join(''); return `${s.slice(0, 4)}-${s.slice(4)}`; };
const newToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// --------------------------------------------------------------- members
export async function loadPeople(store) {
  return (await store.get('people', { type: 'json' })) || { members: [], guardians: {}, updated: 0 };
}
async function savePeople(store, p) { p.updated = Date.now(); await store.setJSON('people', p); }

const publicMember = m => ({ id: m.id, name: m.name, first: m.first, role: m.role, patrol: m.patrol, positions: m.positions || [], leader: !!m.leader });
const selfMember = m => ({ ...publicMember(m), last: m.last, scouts: m.scouts || [] });

export async function resolveSession(store, req) {
  const tok = req.headers.get('x-session') || new URL(req.url).searchParams.get('s');
  if (!tok || !/^[a-f0-9]{48}$/.test(tok)) return null;
  const s = await store.get(`sessions/${tok}`, { type: 'json' });
  if (!s) return null;
  const p = await loadPeople(store);
  const m = p.members.find(x => x.id === s.memberId && x.active !== false);
  return m ? { member: m, people: p, token: tok } : null;
}

// --------------------------------------------------------------- threads
const PLC_RX = /senior patrol|\bspl\b|patrol leader|troop guide|quartermaster \(plc\)|scribe/i;
export function guardiansOf(people) {
  const g = people.guardians || {};
  return [g.scoutmaster, g.chair].filter(Boolean);
}
function boardDefs(people, patrols) {
  const active = people.members.filter(m => m.active !== false);
  const g = guardiansOf(people);
  const boards = [
    { id: 'board-troop', kind: 'board', title: 'Whole troop', emoji: '🏕️', members: active.map(m => m.id) },
    { id: 'board-plc', kind: 'board', title: 'Patrol Leaders\' Council', emoji: '🧭', members: [...active.filter(m => m.role === 'scout' && PLC_RX.test((m.positions || []).join(', '))).map(m => m.id), ...active.filter(m => m.leader).map(m => m.id)] },
    ...patrols.filter(p => !/adult/i.test(p)).map(p => ({ id: `patrol-${p.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, kind: 'patrol', patrol: p, title: p, emoji: '🚩', members: active.filter(m => m.role === 'scout' && m.patrol === p).map(m => m.id) })),
    { id: 'board-leaders', kind: 'board', title: 'Adult leaders', emoji: '🛡️', adultsOnly: true, members: active.filter(m => m.leader).map(m => m.id) },
    ...(people.groups || []).filter(gr => gr.kind === 'board').map(gr => {
      const mem = gr.members.filter(id => active.some(m => m.id === id));
      const adultsOnly = mem.length > 0 && mem.every(id => active.find(m => m.id === id)?.role === 'adult');
      return { id: `group-${gr.id}`, kind: 'group', title: gr.name, emoji: gr.emoji || '👥', adultsOnly, members: mem };
    }),
  ];
  return boards.map(b => ({ ...b, members: [...new Set([...b.members, ...(b.adultsOnly ? [] : g)])] }));
}
async function allThreads(store, people, patrols) {
  const { blobs } = await store.list({ prefix: 'threads/' });
  const saved = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
  const byId = new Map(saved.map(t => [t.id, t]));
  const boards = boardDefs(people, patrols).map(b => ({ ...b, last: byId.get(b.id)?.last || null }));
  return [...boards, ...saved.filter(t => t.kind === 'dm')];
}
const canRead = (t, m) => t.members.includes(m.id);  // the Scoutmaster and Committee Chair are members of every conversation
const nameOf = (people, id) => people.members.find(m => m.id === id)?.name || 'Former member';

async function listMsgs(store, threadId, since = 0, limit = 120) {
  const { blobs } = await store.list({ prefix: `msgs/${threadId}/` });
  let keys = blobs.map(b => b.key).sort();
  if (since) keys = keys.filter(k => Number(k.split('/').pop().split('-')[0]) > since);
  keys = keys.slice(-limit);
  return (await Promise.all(keys.map(k => store.get(k, { type: 'json' })))).filter(Boolean);
}

// --------------------------------------------------------------- routes for signed-in members
export async function memberRoutes(store, head, rest, req, body, now, ctx) {
  const { session, patrols } = ctx;
  const me = session?.member;
  const people = session?.people;

  if (head === 'me' && req.method === 'GET' && !rest[0]) {
    if (!me) return err('Not signed in', 401);
    const scouts = (me.scouts || []).map(id => people.members.find(m => m.id === id)).filter(Boolean).map(publicMember);
    return json({ member: selfMember(me), scouts, guardians: guardiansOf(people).map(id => publicMember(people.members.find(m => m.id === id) || { id, name: 'Not set' })) });
  }
  if (head === 'me' && rest[0] === 'data' && rest[1]) {
    if (!me) return err('Not signed in', 401);
    const k = `userdata/${me.id}/${clean(rest[1], 60).replace(/[^a-z0-9_-]/gi, '_')}`;
    if (req.method === 'GET') return json({ value: (await store.get(k, { type: 'json' }))?.value ?? null });
    if (req.method === 'PUT') {
      const s = JSON.stringify(body.value ?? null);
      if (s.length > 50000) return err('Too much data');
      await store.setJSON(k, { value: body.value ?? null, at: now }); return json({ ok: true });
    }
  }
  if (head === 'auth' && rest[0] === 'signout') { if (session) await store.delete(`sessions/${session.token}`); return json({ ok: true }); }

  // directory for messaging and family sign-ups (signed-in members only)
  if (head === 'members' && req.method === 'GET') {
    if (!me) return err('Sign in with your personal code to see the troop directory.', 401);
    return json({ members: people.members.filter(m => m.active !== false).map(publicMember).sort((a, b) => a.name.localeCompare(b.name)) });
  }

  // ---- messaging
  if (head === 'threads') {
    if (!me) return err('Sign in with your personal code to use Messages.', 401);
    const g = guardiansOf(people);
    if (g.length < 2) return err('Messages are off until leaders set the Scoutmaster and Committee Chair (Leader tools → Members).', 409);
    const [tid, sub, mid, act] = rest;
    if (!tid && req.method === 'GET') {
      const reads = (await store.get(`reads/${me.id}`, { type: 'json' })) || {};
      const list = (await allThreads(store, people, patrols)).filter(t => canRead(t, me)).map(t => ({
        id: t.id, kind: t.kind, title: t.kind === 'dm' ? dmTitle(t, people, me) : t.title, emoji: t.emoji || '💬', patrol: t.patrol,
        member: t.members.includes(me.id), count: t.members.length, last: t.last, unread: !!(t.last && t.last.at > (reads[t.id] || 0) && t.last.by !== me.id),
      }));
      list.sort((a, b) => (b.member - a.member) || ((b.last?.at || 0) - (a.last?.at || 0)) || a.title.localeCompare(b.title));
      const ask = (people.groups || []).filter(gr => gr.kind === 'contact').map(gr => ({ id: gr.id, name: gr.name, description: gr.description || '', emoji: gr.emoji || '✋', count: gr.members.length }));
      return json({ threads: list, guardians: g.map(id => nameOf(people, id)), ask });
    }
    if (!tid && req.method === 'POST') {
      // new conversation: me + chosen people (or a contact group) + both guardians
      const grp = body.group ? (people.groups || []).find(x => x.id === body.group && x.kind === 'contact') : null;
      if (body.group && !grp) return err('That group isn\'t available.');
      const chosen = (grp ? grp.members : Array.isArray(body.to) ? body.to : []).filter(id => id !== me.id && people.members.some(m => m.id === id && m.active !== false));
      if (!chosen.length) return err(grp ? 'Nobody is in that group yet. Ask a leader to add people.' : 'Pick at least one person.');
      const members = [...new Set([me.id, ...chosen, ...g])].sort();
      const { blobs } = await store.list({ prefix: 'threads/' });
      for (const b of blobs) {
        const t = await store.get(b.key, { type: 'json' });
        if (t?.kind === 'dm' && t.members.join() === members.join() && (t.groupId || '') === (grp?.id || '')) return json({ thread: { id: t.id } });
      }
      const t = { id: `dm-${rid()}`, kind: 'dm', members, createdBy: me.id, created: now, last: null, ...(grp ? { groupId: grp.id, groupName: grp.name } : {}) };
      await store.setJSON(`threads/${t.id}`, t);
      return json({ thread: { id: t.id } });
    }
    const t = (await allThreads(store, people, patrols)).find(x => x.id === tid);
    if (!t || !canRead(t, me)) return err('Conversation not found.', 404);
    if (!sub && req.method === 'GET') {
      const since = Number(new URL(req.url).searchParams.get('since') || 0);
      const msgs = (await listMsgs(store, t.id, since)).map(x => (x.hidden && !me.leader ? { ...x, text: '', hiddenNote: true } : x));
      if (t.members.includes(me.id) && t.last) {
        const reads = (await store.get(`reads/${me.id}`, { type: 'json' })) || {};
        if ((reads[t.id] || 0) < t.last.at) { reads[t.id] = t.last.at; await store.setJSON(`reads/${me.id}`, reads); }
      }
      return json({
        thread: { id: t.id, kind: t.kind, title: t.kind === 'dm' ? dmTitle(t, people, me) : t.title, emoji: t.emoji || '💬', member: t.members.includes(me.id), adultsOnly: !!t.adultsOnly },
        people: t.members.map(id => ({ ...publicMember(people.members.find(m => m.id === id) || { id, name: 'Former member' }), guardian: g.includes(id) })),
        messages: msgs,
      });
    }
    if (sub === 'msgs' && !mid && req.method === 'POST') {
      if (!t.adultsOnly && !g.every(id => t.members.includes(id))) return err('This conversation is missing a required leader.', 409);
      const text = clean(body.text, 2000);
      if (!text) return err('Write a message first.');
      const m = { id: `${now}-${rid().slice(-6)}`, by: me.id, byName: me.name, role: me.role, text, at: now };
      await store.setJSON(`msgs/${t.id}/${m.id}`, m);
      const saved = (await store.get(`threads/${t.id}`, { type: 'json' })) || { ...t, members: t.kind === 'dm' ? t.members : [] };
      saved.id = t.id; saved.kind = t.kind; saved.last = { at: now, by: me.id, byName: me.first || me.name, text: text.slice(0, 120) };
      if (t.kind !== 'dm') { saved.members = []; saved.title = t.title; }
      await store.setJSON(`threads/${t.id}`, saved);
      const reads = (await store.get(`reads/${me.id}`, { type: 'json' })) || {};
      reads[t.id] = now; await store.setJSON(`reads/${me.id}`, reads);
      return json({ message: m });
    }
    if (sub === 'msgs' && mid && act === 'report' && req.method === 'POST') {
      const k = `msgs/${t.id}/${clean(mid, 40)}`;
      const m = await store.get(k, { type: 'json' });
      if (!m) return err('Not found', 404);
      m.reports = [...(m.reports || []), { by: me.id, byName: me.name, reason: clean(body.reason, 300), at: now }];
      await store.setJSON(k, m);
      await store.setJSON(`reports/${t.id}__${m.id}`, { threadId: t.id, threadTitle: t.title || 'Conversation', msgId: m.id, at: now, open: true });
      return json({ ok: true });
    }
  }

  // ---- advancement (own record, linked scouts, or leaders)
  if (head === 'adv' && req.method === 'GET') {
    if (!me && !ctx.isLeader) return err('Sign in with your personal code to see advancement.', 401);
    const p = people || await loadPeople(store);
    if (!rest[0]) {
      if (!(ctx.isLeader || me?.leader)) {
        const ids = [me.id, ...(me.scouts || [])];
        return json({ scouts: p.members.filter(m => ids.includes(m.id) && m.role === 'scout').map(summary) });
      }
      return json({ scouts: p.members.filter(m => m.role === 'scout' && m.active !== false).map(summary).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    const id = clean(rest[0], 40);
    const allowed = ctx.isLeader || me?.leader || me?.id === id || (me?.scouts || []).includes(id);
    if (!allowed) return err('You can see advancement for yourself and your own scouts.', 403);
    const m = p.members.find(x => x.id === id);
    if (!m) return err('Not found', 404);
    return json({ scout: summary(m), record: (await store.get(`adv/${id}`, { type: 'json' })) || null });
  }
  return null;
}
const summary = m => ({ id: m.id, name: m.name, patrol: m.patrol, positions: m.positions || [], rank: m.rank || '', rankDate: m.rankDate || '', badges: m.badges || 0, eagleReq: m.eagleReq || 0, next: m.next || null, totals: m.totals || null });
function dmTitle(t, people, me) {
  if (t.groupName) return t.createdBy === me.id ? t.groupName : `${t.groupName} · ${people.members.find(m => m.id === t.createdBy)?.first || 'Scout'}`;
  const g = guardiansOf(people);
  const others = t.members.filter(id => id !== me.id && !g.includes(id)).map(id => (people.members.find(m => m.id === id)?.first || nameOf(people, id)));
  if (!others.length) return t.members.filter(id => id !== me.id).map(id => nameOf(people, id)).join(', ') || 'Leaders';
  return others.join(', ');
}

// --------------------------------------------------------------- redeem a personal code
export async function redeem(store, body, req, now) {
  const code = normCode(body.code);
  if (code.length !== 8) return err('That code should look like ABCD-EF23.');
  const p = await loadPeople(store);
  const m = p.members.find(x => normCode(x.code) === code && x.active !== false);
  if (!m) return err('That code doesn\'t match anyone. Check with a leader for a new one.', 401);
  const token = newToken();
  await store.setJSON(`sessions/${token}`, { memberId: m.id, created: now, ua: clean(req.headers.get('user-agent'), 160) });
  m.lastSignIn = now; await savePeople(store, p);
  return json({ ok: true, token, member: selfMember(m) });
}

// --------------------------------------------------------------- leader routes
export async function leaderPeople(store, what, id, sub, req, body, now, ctx) {
  if (what === 'members' && req.method === 'GET') {
    const p = await loadPeople(store);
    return json({ members: p.members, guardians: p.guardians || {}, groups: p.groups || [] });
  }
  if (what === 'members' && req.method === 'POST') {
    const p = await loadPeople(store);
    let m = id ? p.members.find(x => x.id === id) : null;
    if (id && !m) return err('Not found', 404);
    if (!m) {
      const first = clean(body.first, 40), last = clean(body.last, 40);
      if (!first || !last) return err('Add a first and last name.');
      if (p.members.some(x => keyOf(x.first, x.last) === keyOf(first, last))) return err('Someone with that name is already listed.');
      m = { id: `m-${rid()}`, first, last, name: `${first} ${last}`, role: body.role === 'scout' ? 'scout' : 'adult', patrol: '', positions: [], scouts: [], code: newCode(), active: true, created: now };
      p.members.push(m);
    }
    if (sub === 'code') m.code = newCode();
    if (body.patrol !== undefined) m.patrol = clean(body.patrol, 40);
    if (body.leader !== undefined) m.leader = !!body.leader;
    if (body.active !== undefined) m.active = !!body.active;
    if (Array.isArray(body.scouts)) m.scouts = body.scouts.filter(s => p.members.some(x => x.id === s && x.role === 'scout'));
    if (Array.isArray(body.positions)) m.positions = body.positions.map(x => clean(x, 60)).filter(Boolean).slice(0, 6);
    if (sub === 'signout') { const { blobs } = await store.list({ prefix: 'sessions/' }); for (const b of blobs) { const s = await store.get(b.key, { type: 'json' }); if (s?.memberId === m.id) await store.delete(b.key); } }
    await savePeople(store, p);
    return json({ ok: true, member: m });
  }
  if (what === 'groups' && (req.method === 'POST' || req.method === 'DELETE')) {
    const p = await loadPeople(store);
    p.groups ||= [];
    if (req.method === 'DELETE') { p.groups = p.groups.filter(x => x.id !== id); await savePeople(store, p); return json({ ok: true }); }
    let gr = id ? p.groups.find(x => x.id === id) : null;
    if (id && !gr) return err('Not found', 404);
    if (!gr) { gr = { id: `g${rid()}`, name: '', kind: 'board', members: [], created: now }; p.groups.push(gr); }
    if (body.name !== undefined) gr.name = clean(body.name, 80);
    if (!gr.name) return err('Give the group a name.');
    if (body.kind !== undefined) gr.kind = body.kind === 'contact' ? 'contact' : 'board';
    if (body.description !== undefined) gr.description = clean(body.description, 200);
    if (body.emoji !== undefined) gr.emoji = clean(body.emoji, 8);
    if (Array.isArray(body.members)) gr.members = [...new Set(body.members.filter(x => p.members.some(m => m.id === x)))];
    await savePeople(store, p); return json({ ok: true, group: gr });
  }
  if (what === 'guardians' && req.method === 'POST') {
    const p = await loadPeople(store);
    const ok = x => p.members.some(m => m.id === x && m.role === 'adult');
    if (!ok(body.scoutmaster) || !ok(body.chair)) return err('Pick an adult for both.');
    if (body.scoutmaster === body.chair) return err('Pick two different adults so every conversation has two leaders.');
    p.guardians = { scoutmaster: body.scoutmaster, chair: body.chair };
    await savePeople(store, p); return json({ ok: true, guardians: p.guardians });
  }
  if (what === 'reports' && req.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'reports/' });
    const reps = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(r => r?.open);
    const out = [];
    for (const r of reps) { const m = await store.get(`msgs/${r.threadId}/${r.msgId}`, { type: 'json' }); if (m) out.push({ ...r, message: m }); }
    return json({ reports: out.sort((a, b) => b.at - a.at) });
  }
  if (what === 'reports' && req.method === 'POST' && id) {
    // id = threadId__msgId ; body.action = 'hide' | 'keep'
    const r = await store.get(`reports/${id}`, { type: 'json' });
    if (!r) return err('Not found', 404);
    const k = `msgs/${r.threadId}/${r.msgId}`;
    const m = await store.get(k, { type: 'json' });
    if (m && body.action === 'hide') { m.hidden = { by: ctx.leaderName || 'Leader', at: now }; await store.setJSON(k, m); }
    r.open = false; r.resolved = { action: body.action === 'hide' ? 'hidden' : 'kept', at: now };
    await store.setJSON(`reports/${id}`, r);
    return json({ ok: true });
  }
  if (what === 'import' && req.method === 'POST') return importData(store, body, now);
  return null;
}

// --------------------------------------------------------------- import (from scripts/import-troopwebhost-all.py)
async function importData(store, body, now) {
  const p = await loadPeople(store);
  const byKey = new Map(p.members.map(m => [keyOf(m.first, m.last), m]));
  const out = { added: 0, updated: 0 };
  for (const x of (body.members || []).slice(0, 400)) {
    const first = clean(x.first, 40), last = clean(x.last, 40);
    if (!first || !last) continue;
    let m = byKey.get(keyOf(first, last));
    if (!m) {
      m = { id: `m-${rid()}`, first, last, scouts: [], code: newCode(), active: true, created: now };
      p.members.push(m); byKey.set(keyOf(first, last), m); out.added++;
    } else out.updated++;
    Object.assign(m, {
      first, last, name: `${first} ${last}`, role: x.role === 'scout' ? 'scout' : 'adult', patrol: clean(x.patrol, 40),
      positions: (x.positions || []).map(s => clean(s, 60)).filter(Boolean).slice(0, 6),
      rank: clean(x.rank, 20), rankDate: clean(x.rankDate, 12), totals: x.totals || null, active: true,
    });
    if (m.leader === undefined) m.leader = !!x.leader;
  }
  for (const a of body.adv || []) {
    const m = byKey.get(a.key); if (!m) continue;
    await store.setJSON(`adv/${m.id}`, { ...a.record, at: now });
    Object.assign(m, { badges: a.record.badges?.length || 0, eagleReq: a.eagleReq || 0, next: a.next || null, rank: a.record.rank || m.rank, rankDate: a.record.rankDate || m.rankDate });
  }
  if (Array.isArray(body.groups)) {
    p.groups ||= [];
    for (const gi of body.groups) {
      const exists = p.groups.find(x => x.name.toLowerCase() === String(gi.name).toLowerCase());
      if (exists) continue;   // keep leaders' edits on re-import
      p.groups.push({ id: `g${rid()}`, name: clean(gi.name, 80), kind: gi.kind === 'contact' ? 'contact' : 'board', description: clean(gi.description, 200), emoji: clean(gi.emoji, 8), members: (gi.keys || []).map(k => byKey.get(k)?.id).filter(Boolean), created: now, source: 'TroopWebHost e-mail group' });
    }
  }
  if (body.guardians) {
    const sm = byKey.get(body.guardians.scoutmaster), cc = byKey.get(body.guardians.chair);
    if (sm && cc && !(p.guardians?.scoutmaster && p.guardians?.chair)) p.guardians = { scoutmaster: sm.id, chair: cc.id };
  }
  await savePeople(store, p);
  let att = 0;
  for (const r of (body.attendance || []).slice(0, 3000)) {
    const m = byKey.get(r.key); if (!m || !r.outingId) continue;
    const id = `${r.outingId}__${m.id}`.slice(0, 80);
    await store.setJSON(`c/rsvps/${id}`, { id, outingId: r.outingId, memberId: m.id, name: m.name, patrol: m.patrol || '', role: m.role === 'scout' ? 'scout' : 'adult', status: 'yes', attended: true, note: '', created: now, updated: now, updatedBy: 'TroopWebHost import' });
    att++;
  }
  let gear = 0;
  for (const g of (body.gear || []).slice(0, 500)) {
    if (!/^[a-z0-9_-]{1,80}$/i.test(g.id || '')) continue;
    const prev = await store.get(`c/gear/${g.id}`, { type: 'json' });
    let checkout = prev?.checkout || null;
    if (g.checkoutKey && !prev) { const m = byKey.get(g.checkoutKey); checkout = { who: m?.name || g.checkoutName, memberId: m?.id, patrol: m?.patrol || '', outingId: '', outingTitle: '', due: '', at: g.checkoutAt || now }; }
    await store.setJSON(`c/gear/${g.id}`, {
      ...(prev || {}), id: g.id, name: clean(g.name, 80), category: clean(g.category, 40), tag: clean(g.tag, 20), qty: g.qty || 1, condition: prev?.condition || 'good',
      location: clean(g.location, 80), notes: clean(g.notes, 500), checkout, log: prev?.log || [{ at: now, by: 'TroopWebHost import', what: checkout ? `Imported — checked out to ${checkout.who}` : 'Imported from TroopWebHost' }],
      created: prev?.created || now, updated: now, updatedBy: 'TroopWebHost import',
    });
    gear++;
  }
  if (Array.isArray(body.patrols) && body.patrols.length) {
    const s = (await store.get('settings', { type: 'json' })) || {};
    s.patrols = body.patrols.map(x => clean(x, 40)).filter(Boolean);
    await store.setJSON('settings', s);
  }
  return json({ ok: true, members: out, attendance: att, gear, guardians: p.guardians, groups: (p.groups || []).length });
}
