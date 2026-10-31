// Sync center: bring troop records in from TroopWebHost, Scoutbook Plus and Black Pug (Scouting
// Event), compare them, and send Basecamp's own records back out. None of these systems offer an
// API, so everything moves as the CSV files each one already exports. Files are read in the
// browser and only troop-safe fields are sent here: never BSA member IDs, contact details,
// birthdays, medical or money.
//
// Who can use it: leaders whose position is one of the sync roles (Scoutmaster, Committee Chair,
// Advancement Chair, Webmaster by default; set in Leader tools → Settings), or the leader passcode.
import { loadPeople, importData, keyOf } from './people.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const base = b => String(b || '').replace(/^\*/, '').replace(/\s*\((?:[^)]*rqmts|old rqmts|\d{4}[^)]*)\)\s*$/i, '').replace(/\s+merit badge$/i, '').trim();
const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const normRank = r => RANKS.find(x => x.toLowerCase() === String(r || '').replace(/\s+rank$/i, '').trim().toLowerCase()) || '';

export const SYNC_ROLES = {
  scoutmaster: { label: 'Scoutmaster', rx: /^scoutmaster$/i },
  chair: { label: 'Committee Chair', rx: /^committee chair$/i },
  advancement: { label: 'Advancement Chair', rx: /advancement (chair|coordinator)|committee advancement/i },
  webmaster: { label: 'Webmaster', rx: /^(troop )?webmaster$/i },
};
export function syncRolesOf(me) {
  const pos = me?.positions || [];
  return Object.entries(SYNC_ROLES).filter(([, r]) => pos.some(p => r.rx.test(p))).map(([k]) => k);
}

async function getJ(store, k, d) { return (await store.get(k, { type: 'json' })) ?? d; }
async function logIt(store, entry) {
  const log = await getJ(store, 'sync/log', []);
  log.unshift(entry);
  await store.setJSON('sync/log', log.slice(0, 60));
  const st = await getJ(store, 'sync/status', {});
  st[entry.source] = { at: entry.at, by: entry.by, summary: entry.summary };
  await store.setJSON('sync/status', st);
}

// match an outside name to a Basecamp member: exact first+last, then nickname-ish (same last name, first starts the same)
function matcher(members) {
  const byKey = new Map(members.map(m => [keyOf(m.first, m.last), m]));
  return (first, last) => {
    const exact = byKey.get(keyOf(first, last));
    if (exact) return exact;
    const f = String(first || '').trim().toLowerCase(), l = String(last || '').trim().toLowerCase();
    const c = members.filter(m => m.last.toLowerCase() === l && (m.first.toLowerCase().startsWith(f.slice(0, 3)) || f.startsWith(m.first.toLowerCase().slice(0, 3))));
    return c.length === 1 ? c[0] : null;
  };
}

export async function syncRoutes(store, rest, req, body, now, ctx) {
  const { me, isLeader, passcode, settings } = ctx;
  const allowed = settings.syncRoles || ['scoutmaster', 'chair', 'advancement', 'webmaster'];
  const mine = syncRolesOf(me);
  const can = passcode || (isLeader && (allowed.includes('any') || mine.some(r => allowed.includes(r))));
  if (!isLeader) return err('Sync is for troop leaders.', 401);
  const [what] = rest;
  const by = me?.name || 'Leader (passcode)';

  if (!what && req.method === 'GET') {
    const [status, log, compare, camp, roster] = await Promise.all([getJ(store, 'sync/status', {}), getJ(store, 'sync/log', []), getJ(store, 'sync/compare', null), getJ(store, 'sync/camp', []), getJ(store, 'sync/roster', null)]);
    const p = await loadPeople(store);
    const holders = Object.fromEntries(Object.entries(SYNC_ROLES).map(([k, r]) => [k, p.members.filter(m => m.active !== false && m.role !== 'scout' && (m.positions || []).some(x => r.rx.test(x))).map(m => m.name)]));
    return json({ can, mine, allowed, roles: Object.fromEntries(Object.entries(SYNC_ROLES).map(([k, r]) => [k, r.label])), holders, status, log: log.slice(0, 25), compare, camp: camp.slice(0, 6), roster });
  }
  if (!can) return err(`Only ${allowed.map(r => SYNC_ROLES[r]?.label || 'leaders').join(', ')} can run syncs. Leaders can change this in Settings.`, 403);

  // ---- TroopWebHost exports (roster, advancement, activity, gear, groups, events, counselors, places)
  if (what === 'twh' && req.method === 'POST') {
    const p0 = await loadPeople(store);
    const before = new Set(p0.members.filter(m => m.active !== false).map(m => keyOf(m.first, m.last)));
    const r = body.members?.length ? await (await importData(store, { ...body, source: undefined }, now)).json() : { members: { added: 0, updated: 0 } };
    const incoming = new Set((body.members || []).map(m => keyOf(m.first, m.last)));
    const missing = body.members?.length ? p0.members.filter(m => m.active !== false && !incoming.has(keyOf(m.first, m.last)) && !/^(DEMO|XXXX)/.test(String(m.code || '').replace('-', ''))).map(m => ({ id: m.id, name: m.name, role: m.role })) : [];
    // events → outings: new ones are added; ones a leader edited in Basecamp are left alone
    let outAdded = 0, outUpdated = 0, outKept = 0;
    for (const o of (body.outings || []).slice(0, 400)) {
      if (!/^o-twh-[a-f0-9]{10}$/.test(o.id || '')) continue;
      const prev = await store.get(`c/outings/${o.id}`, { type: 'json' });
      if (prev && prev.updatedBy && !String(prev.updatedBy).startsWith('TroopWebHost')) { outKept++; continue; }   // a leader edited it here
      const doc = { title: clean(o.title, 80), type: clean(o.type, 20), start: clean(o.start, 10), end: clean(o.end, 10), location: clean(o.location, 160), meetTime: clean(o.meetTime, 40), meetPlace: clean(o.meetPlace, 120), returnTime: clean(o.returnTime, 40), cost: clean(o.cost, 60), details: clean(o.details, 3000), extras: prev?.extras || [], cancelled: !!o.cancelled };
      await store.setJSON(`c/outings/${o.id}`, { ...(prev || {}), ...doc, id: o.id, created: prev?.created || now, updated: now, updatedBy: 'TroopWebHost import' });
      prev ? outUpdated++ : outAdded++;
    }
    // counselors and places: only add new ones, never overwrite leaders' edits
    let cAdded = 0, pAdded = 0;
    const pNow = await loadPeople(store), idOf = new Map(pNow.members.map(m => [keyOf(m.first, m.last), m.id]));
    for (const c of (body.counselors || []).slice(0, 300)) {
      if (!/^mbc-[a-z0-9-]{1,60}$/.test(c.id || '')) continue;
      if (await store.get(`c/counselors/${c.id}`, { type: 'json' })) continue;
      await store.setJSON(`c/counselors/${c.id}`, { id: c.id, name: clean(c.name, 80), memberId: idOf.get(c.memberKey) || '', badges: (c.badges || []).map(b => clean(b, 60)).slice(0, 60), notes: '', active: true, created: now, updated: now, updatedBy: 'TroopWebHost import' });
      cAdded++;
    }
    for (const pl of (body.places || []).slice(0, 300)) {
      if (!/^pl-[a-f0-9]{10}$/.test(pl.id || '')) continue;
      if (await store.get(`c/places/${pl.id}`, { type: 'json' })) continue;
      await store.setJSON(`c/places/${pl.id}`, { id: pl.id, name: clean(pl.name, 160), address: clean(pl.address, 200), phone: clean(pl.phone, 40), web: /^https?:\/\//.test(pl.web || '') ? clean(pl.web, 300) : '', mapQ: clean(pl.mapQ, 40), notes: '', created: now, updated: now, updatedBy: 'TroopWebHost import' });
      pAdded++;
    }
    const files = (body.files || []).map(f => clean(f, 60)).slice(0, 20);
    const summary = [r.members && `${r.members.added} people added, ${r.members.updated} updated`, body.adv?.length && `advancement for ${body.adv.length} scouts`, (outAdded || outUpdated) && `${outAdded} outings added, ${outUpdated} updated${outKept ? `, ${outKept} kept as leaders edited them` : ''}`, r.gear && `${r.gear} gear items`, cAdded && `${cAdded} counselors`, pAdded && `${pAdded} places`].filter(Boolean).join(' · ') || 'Nothing new';
    await logIt(store, { at: now, by, source: 'twh', summary, files });
    await store.setJSON('sync/twh-missing', missing);
    return json({ ok: true, summary, missing, result: r, outings: { added: outAdded, updated: outUpdated, kept: outKept } });
  }

  // members in Basecamp but no longer in TroopWebHost: leaders choose who to switch off
  if (what === 'deactivate' && req.method === 'POST') {
    const ids = new Set((body.ids || []).slice(0, 200));
    const p = await loadPeople(store);
    let n = 0;
    for (const m of p.members) if (ids.has(m.id) && m.active !== false) { m.active = false; n++; }
    p.updated = now; await store.setJSON('people', p);
    await logIt(store, { at: now, by, source: 'roster-cleanup', summary: `${n} people marked as no longer in the troop` });
    return json({ ok: true, deactivated: n });
  }

  // ---- Scoutbook Plus advancement (Reports → Quick Export → Advancement), or Black Pug's "Scoutbook Export"
  if ((what === 'scoutbook' || what === 'camp') && req.method === 'POST') {
    const p = await loadPeople(store);
    const scouts = p.members.filter(m => m.active !== false && m.role === 'scout');
    const match = matcher(scouts);
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 8000);
    const per = new Map(), unmatched = new Set();
    for (const r of rows) {
      const m = match(clean(r.first, 40), clean(r.last, 40));
      if (!m) { unmatched.add(`${clean(r.first, 40)} ${clean(r.last, 40)}`.trim()); continue; }
      const type = /rank/i.test(r.type) ? 'rank' : /merit/i.test(r.type) ? 'badge' : /award/i.test(r.type) ? 'award' : 'other';
      if (/requirement/i.test(r.type) && what === 'scoutbook') continue;
      const x = per.get(m.id) || { id: m.id, name: m.name, ranks: [], badges: [], awards: [], reqs: [] };
      const item = { name: type === 'rank' ? normRank(r.name) || clean(r.name, 60) : base(clean(r.name, 80)), completed: clean(r.completed, 12), approved: clean(r.approved, 12), awarded: clean(r.awarded, 12) };
      if (/requirement/i.test(r.type)) x.reqs.push({ ...item, req: clean(r.req || r.version, 20) });
      else if (type === 'rank') x.ranks.push(item); else if (type === 'badge') x.badges.push(item); else x.awards.push(item);
      per.set(m.id, x);
    }
    if (what === 'camp') {
      const camp = await getJ(store, 'sync/camp', []);
      const entry = { id: `camp-${now.toString(36)}`, at: now, by, note: clean(body.note, 120) || 'Summer camp', scouts: [...per.values()].map(x => ({ id: x.id, name: x.name, badges: x.badges.filter(b => b.completed).map(b => b.name), partial: [...new Set(x.reqs.map(q => q.name).filter(n => !x.badges.some(b => b.name === n && b.completed)))], awards: x.awards.map(a => a.name) })), unmatched: [...unmatched].slice(0, 60) };
      camp.unshift(entry); await store.setJSON('sync/camp', camp.slice(0, 12));
      const nb = entry.scouts.reduce((t, s) => t + s.badges.length, 0);
      await logIt(store, { at: now, by, source: 'camp', summary: `${entry.note}: ${nb} merit badges finished and ${entry.scouts.reduce((t, s) => t + s.partial.length, 0)} partials for ${entry.scouts.length} scouts` });
      return json({ ok: true, camp: entry });
    }
    // compare with what TroopWebHost says (Basecamp's advancement records come from TroopWebHost)
    const diff = [];
    for (const m of scouts) {
      const sb = per.get(m.id);
      if (!sb) continue;
      const tw = (await store.get(`adv/${m.id}`, { type: 'json' })) || { ranks: [], badges: [] };
      const twRanks = new Set((tw.ranks || []).filter(r => r.earned).map(r => normRank(r.rank)));
      const twBadges = new Set((tw.badges || []).map(b => base(b.name).toLowerCase()));
      const sbRanks = new Set(sb.ranks.filter(r => r.completed).map(r => r.name));
      const sbBadges = new Map(sb.badges.filter(b => b.completed).map(b => [b.name.toLowerCase(), b]));
      const d = {
        id: m.id, name: m.name,
        onlyScoutbook: [...[...sbRanks].filter(r => r && !twRanks.has(r)).map(r => `${r} rank`), ...[...sbBadges.values()].filter(b => !twBadges.has(b.name.toLowerCase())).map(b => b.name)],
        onlyTwh: [...[...twRanks].filter(r => r && !sbRanks.has(r)).map(r => `${r} rank`), ...(tw.badges || []).filter(b => !sbBadges.has(base(b.name).toLowerCase())).map(b => base(b.name))],
        notAwarded: [...sb.ranks, ...sb.badges].filter(x => x.completed && !x.awarded).map(x => x.name),
      };
      if (d.onlyScoutbook.length || d.onlyTwh.length || d.notAwarded.length) diff.push(d);
    }
    const compare = { at: now, by, scouts: per.size, unmatched: [...unmatched].slice(0, 60), diff: diff.sort((a, b) => a.name.localeCompare(b.name)) };
    await store.setJSON('sync/compare', compare);
    const n1 = diff.reduce((t, d) => t + d.onlyScoutbook.length, 0), n2 = diff.reduce((t, d) => t + d.onlyTwh.length, 0);
    await logIt(store, { at: now, by, source: 'scoutbook', summary: `Compared ${per.size} scouts: ${n1} items only in Scoutbook, ${n2} only in TroopWebHost` });
    return json({ ok: true, compare });
  }

  // ---- Scoutbook Plus roster report: who's registered vs who's in Basecamp (names, patrols and positions only)
  if (what === 'roster' && req.method === 'POST') {
    const p = await loadPeople(store);
    const active = p.members.filter(m => m.active !== false && !/^(DEMO|XXXX)/.test(String(m.code || '').replace('-', '')));
    const match = matcher(active);
    const seen = new Set(), notInBasecamp = [], diffs = [];
    for (const r of (Array.isArray(body.rows) ? body.rows : []).slice(0, 600)) {
      const first = clean(r.first, 40), last = clean(r.last, 40);
      if (!first || !last) continue;
      const m = match(first, last);
      if (!m) { notInBasecamp.push({ name: `${first} ${last}`, youth: !!r.youth, patrol: clean(r.patrol, 40) }); continue; }
      seen.add(m.id);
      const pt = clean(r.patrol, 40);
      if (m.role === 'scout' && pt && pt.toLowerCase().replace(/\s*patrol$/, '') !== String(m.patrol || '').toLowerCase().replace(/\s*patrol$/, '')) diffs.push({ id: m.id, name: m.name, field: 'Patrol', basecamp: m.patrol || '—', scoutbook: pt });
    }
    const notRegistered = active.filter(m => !seen.has(m.id)).map(m => ({ id: m.id, name: m.name, role: m.role }));
    const roster = { at: now, by, count: (body.rows || []).length, notInBasecamp, notRegistered, diffs };
    await store.setJSON('sync/roster', roster);
    await logIt(store, { at: now, by, source: 'scoutbook-roster', summary: `${notInBasecamp.length} registered but not in Basecamp, ${notRegistered.length} in Basecamp but not on the Scoutbook roster, ${diffs.length} patrol differences` });
    return json({ ok: true, roster });
  }

  // ---- after elections: give the winners their new positions in Basecamp
  if (what === 'positions' && req.method === 'POST') {
    const e = await store.get(`elect/e/${clean(body.election, 30)}`, { type: 'json' });
    if (!e || e.status !== 'closed') return err('Close the election first.');
    const { blobs } = await store.list({ prefix: `elect/v/${e.id}/` });
    const ballots = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    const p = await loadPeople(store);
    const changes = [];
    for (const pos of e.positions) {
      const counts = Object.fromEntries(pos.candidates.map(c => [c, ballots.filter(b => b.votes?.[pos.id] === c).length]));
      const top = Math.max(0, ...Object.values(counts));
      const winners = pos.candidates.filter(c => top > 0 && counts[c] === top);
      if (winners.length !== 1) { changes.push({ position: pos.title, patrol: pos.patrol, skipped: winners.length > 1 ? 'tie' : 'no votes' }); continue; }
      const w = p.members.find(m => m.id === winners[0]);
      if (!w) continue;
      for (const m of p.members) {   // the old holder (same patrol for patrol positions) gives it up
        if (m.id !== w.id && (m.positions || []).includes(pos.title) && (!pos.patrol || m.patrol === pos.patrol)) m.positions = m.positions.filter(x => x !== pos.title);
      }
      if (!(w.positions || []).includes(pos.title)) w.positions = [...(w.positions || []), pos.title].slice(0, 6);
      changes.push({ position: pos.title, patrol: pos.patrol, name: w.name });
    }
    p.updated = now; await store.setJSON('people', p);
    await logIt(store, { at: now, by, source: 'positions', summary: `${e.title}: ${changes.filter(c => c.name).length} positions updated in Basecamp` });
    return json({ ok: true, changes });
  }
  return err('Not found', 404);
}
