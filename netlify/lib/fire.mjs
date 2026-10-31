// Campfire book and ceremonies: what the troop adds on top of the built-in book.
//   fire/i/{id}   a troop item (song words, skit, run-on, cheer, minute, game, ceremony)
//   fire/meta     { hidden: [ids], fav: [ids] }  built-in or troop items leaders hid or starred
//   fire/p/{id}   a campfire plan (an ordered lineup with who does what)
// Leaders and the Patrol Leaders' Council add straight to the book and make plans.
// Other signed-in scouts and parents can suggest; a leader approves the suggestion.

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const REF = /^[a-z0-9-]{1,40}$/;
export const FIRE_KINDS = ['song', 'skit', 'runon', 'cheer', 'minute', 'game', 'ceremony'];
const PLC_RX = /senior patrol|\bspl\b|\baspl\b|patrol leader|troop guide|scribe|chaplain aide|chaplain's aide/i;

export function fireAccess(me, isLeader) {
  const leader = !!(isLeader || me?.leader);
  const plc = !!me && me.role === 'scout' && PLC_RX.test((me.positions || []).join(', '));
  return { leader, add: leader || plc, suggest: !!me, plan: leader || plc };
}

export async function fireRoutes(store, rest, req, body, now, { me, isLeader, settings }) {
  const a = fireAccess(me, isLeader);
  const F = settings.features, O = settings.opts;
  const onFor = kind => (kind === 'ceremony' ? F.ceremonies : F.campfire);
  const offErr = () => err('Leaders have turned this part of Basecamp off.', 403);
  const [what, id, sub] = rest;
  const meta = async () => ({ hidden: [], fav: [], ...((await store.get('fire/meta', { type: 'json' })) || {}) });

  // everything the book and the ceremonies page need, in one call
  if (!what && req.method === 'GET') {
    if (!F.campfire && !F.ceremonies && !a.leader) return offErr();
    const { blobs } = await store.list({ prefix: 'fire/i/' });
    const all = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    const items = all.filter(i => i.status === 'ok' || a.leader || (me && i.by === me.id))
      .filter(i => a.leader || onFor(i.kind))
      .sort((x, y) => x.title.localeCompare(y.title));
    let plans = [];
    if (F.campfire || a.leader) {
      const p = await store.list({ prefix: 'fire/p/' });
      plans = (await Promise.all(p.blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean)
        .map(x => ({ id: x.id, title: x.title, date: x.date, count: x.items.length, byName: x.byName, updated: x.updated }))
        .sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.updated - x.updated);
    }
    return json({ items, meta: await meta(), plans, can: { ...a, suggest: a.suggest && (a.add || O.fireSuggest !== false) }, me: me?.id || '' });
  }

  if (what === 'items') {
    const key = x => `fire/i/${x}`;
    if (!id && req.method === 'POST') {
      if (!me && !a.leader) return err('Sign in with your personal code to add to the book.', 401);
      const kind = FIRE_KINDS.includes(body.kind) ? body.kind : '';
      if (!kind) return err('Pick what kind of thing this is.');
      if (!onFor(kind) && !a.leader) return offErr();
      if (!a.add && O.fireSuggest === false) return err('Leaders have turned suggestions off. Ask your patrol leader to add it.', 403);
      const title = clean(body.title, 100), text = clean(body.text, 8000);
      if (!title) return err('Give it a name.');
      if (!text && !body.ref) return err('Add the words or how it goes.');
      const it = {
        id: `t-${rid()}`, kind, title, text, how: clean(body.how, 1200), ref: REF.test(body.ref || '') ? body.ref : '',
        cast: clean(body.cast, 20), time: clean(body.time, 20), style: clean(body.style, 20),
        status: a.add ? 'ok' : 'pending', by: me?.id || 'leader', byName: me?.name || 'Leader', created: now, updated: now,
      };
      await store.setJSON(key(it.id), it);
      return json({ ok: true, item: it });
    }
    if (!/^t-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const it = await store.get(key(id), { type: 'json' });
    if (!it) return err('Not found', 404);
    const mine = !!me && it.by === me.id;
    if (sub === 'approve' && req.method === 'POST') {
      if (!a.leader) return err('Only leaders approve suggestions.', 403);
      it.status = 'ok'; it.approvedBy = me?.name || 'Leader'; it.updated = now;
      await store.setJSON(key(id), it);
      return json({ ok: true, item: it });
    }
    if (!sub && req.method === 'PUT') {
      if (!(a.add || (mine && it.status === 'pending'))) return err('Only leaders, the PLC, or the person who suggested it can change this.', 403);
      for (const [k, n] of [['title', 100], ['text', 8000], ['how', 1200], ['cast', 20], ['time', 20], ['style', 20]]) if (body[k] !== undefined) it[k] = clean(body[k], n);
      if (!it.title) return err('Give it a name.');
      it.updated = now; it.updatedBy = me?.name || 'Leader';
      await store.setJSON(key(id), it);
      return json({ ok: true, item: it });
    }
    if (!sub && req.method === 'DELETE') {
      if (!(a.leader || mine || (a.add && it.status === 'ok' && it.by === me?.id))) return err('Only leaders or the person who added it can delete it.', 403);
      await store.delete(key(id));
      return json({ ok: true });
    }
    return err('Not found', 404);
  }

  // star a troop favorite (leaders and PLC) or hide something from the troop (leaders)
  if (what === 'meta' && req.method === 'POST') {
    const ref = REF.test(body.id || '') ? body.id : '';
    if (!ref) return err('Bad id');
    const m = await meta();
    const flip = (list, on) => { const s = new Set(m[list]); if (on) s.add(ref); else s.delete(ref); m[list] = [...s].slice(0, 500); };
    if (body.fav !== undefined) { if (!a.add) return err('Only leaders and the PLC can pick troop favorites.', 403); flip('fav', !!body.fav); }
    if (body.hidden !== undefined) { if (!a.leader) return err('Only leaders can hide things from the book.', 403); flip('hidden', !!body.hidden); }
    await store.setJSON('fire/meta', m);
    return json({ ok: true, meta: m });
  }

  if (what === 'plans') {
    if (!F.campfire && !a.leader) return offErr();
    const key = x => `fire/p/${x}`;
    const fix = list => (Array.isArray(list) ? list : []).slice(0, 60).map(x => ({
      ref: clean(x.ref, 60), kind: FIRE_KINDS.includes(x.kind) ? x.kind : 'note', title: clean(x.title, 100), who: clean(x.who, 80), note: clean(x.note, 300),
    })).filter(x => x.title);
    if (!id && req.method === 'POST') {
      if (!a.plan) return err('Leaders and the Patrol Leaders\' Council plan campfires.', 403);
      const p = { id: `p-${rid()}`, title: clean(body.title, 100) || 'Campfire', date: /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : '', items: fix(body.items), by: me?.id || 'leader', byName: me?.name || 'Leader', created: now, updated: now };
      await store.setJSON(key(p.id), p);
      return json({ ok: true, plan: p });
    }
    if (!/^p-[a-z0-9]+$/.test(id || '')) return err('Not found', 404);
    const p = await store.get(key(id), { type: 'json' });
    if (!p) return err('Campfire plan not found.', 404);
    if (req.method === 'GET') return json({ plan: p, canEdit: a.plan });
    if (!a.plan) return err('Leaders and the Patrol Leaders\' Council plan campfires.', 403);
    if (req.method === 'PUT') {
      if (body.title !== undefined) p.title = clean(body.title, 100) || p.title;
      if (body.date !== undefined) p.date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : '';
      if (body.items !== undefined) p.items = fix(body.items);
      p.updated = now; p.updatedBy = me?.name || 'Leader';
      await store.setJSON(key(id), p);
      return json({ ok: true, plan: p });
    }
    if (req.method === 'DELETE') { await store.delete(key(id)); return json({ ok: true }); }
  }
  return err('Not found', 404);
}
