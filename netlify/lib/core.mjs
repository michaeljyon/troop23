// Troop 23 Basecamp API.
//
// Photos + family photo permission come from Pack 6 Photo Trail (itself
// built from the Statewide Synergy conference app's photo gallery). Added
// for a Scouts BSA troop: outings with sign-ups, a gear locker with
// check-out/check-in history, patrol meal plans (shopping list, spending,
// duty roster), a recipe library, the troop pantry and bulletin posts.
//
// Everything sits behind the troop code (TROOP_CODE). Leader-only actions
// also need LEADER_PASSCODE. `store` is Netlify Blobs in production and a
// folder store in `npm run dev`.

import troop from '../../troop/troop.js';
import { resolveSession, memberRoutes, leaderPeople, redeem } from './people.mjs';
import { pushRoutes, notify } from './push.mjs';
import { calendarFeed, calendarLink } from './calendar.mjs';

const MAX_PHOTO_BYTES = 4.2 * 1024 * 1024;
const MAX_THUMB_BYTES = 400 * 1024;
const LEVELS = troop.consentLevels.map(l => l.id);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const err = (message, status = 400) => json({ error: message }, status);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const ID = /^[a-z0-9_-]{1,80}$/i;

export function shortName(name) {
  const w = clean(name, 80).split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  return w.length === 1 ? w[0] : `${w[0]} ${w[w.length - 1][0].toUpperCase()}.`;
}
const scoutName = s => `${s.first}${s.lastInitial ? ` ${s.lastInitial}.` : ''}`;

async function listJSON(store, prefix) {
  const { blobs } = await store.list({ prefix });
  const out = [];
  for (let i = 0; i < blobs.length; i += 60) out.push(...await Promise.all(blobs.slice(i, i + 60).map(b => store.get(b.key, { type: 'json' }))));
  return out.filter(Boolean);
}

// All photo records, from a cached index that's rebuilt after any photo change
// (photos/rev). Keeps the gallery fast with a thousand-plus photos.
async function photoMetas(store) {
  const [rev, idx] = await Promise.all([store.get('photos/rev', { type: 'json' }), store.get('photos/index', { type: 'json' })]);
  if (idx && idx.builtAt > (rev?.at || 0)) return idx.items;
  const builtAt = Date.now();
  const items = await listJSON(store, 'photos/meta/');
  await store.setJSON('photos/index', { builtAt, items });
  return items;
}
const touchPhotos = store => store.setJSON('photos/rev', { at: Date.now() });

// ------------------------------------------------------------ shape/clean
// spec: 's:80' string, 'n' number >= 0, 'b' bool, 'e:a|b' enum, 'date', 'id',
// [spec, max] array, { field: spec } object.
function shape(spec, v) {
  if (Array.isArray(spec)) {
    const [inner, max] = spec;
    return (Array.isArray(v) ? v : []).slice(0, max).map(x => shape(inner, x)).filter(x => x !== '' && x != null);
  }
  if (typeof spec === 'object') {
    const o = {};
    for (const [k, s] of Object.entries(spec)) o[k] = shape(s, v?.[k]);
    return o;
  }
  const [type, arg] = spec.split(':');
  if (type === 's') return clean(v, +arg || 200);
  if (type === 'n') { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0; }
  if (type === 'b') return !!v;
  if (type === 'e') { const o = arg.split('|'); return o.includes(v) ? v : o[0]; }
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
  if (type === 'id') return ID.test(v || '') ? v : '';
  return undefined;
}

const ING = { name: 's:60', qty: 'n', unit: 's:20' };
const COLS = {
  outings: {
    spec: { title: 's:80', type: `e:${troop.outingTypes.map(t => t.id).join('|')}`, start: 'date', end: 'date', location: 's:160', address: 's:200', placePhone: 's:40', placeWeb: 's:300', mapQ: 's:120',
      meetTime: 's:60', meetPlace: 's:120', returnTime: 's:60', details: 's:3000', cost: 's:60', extras: ['s:80', 40], cancelled: 'b' },
    write: 'leader', del: 'leader', required: ['title', 'start'],
  },
  gear: {
    spec: { name: 's:80', category: 's:40', tag: 's:20', qty: 'n', condition: 'e:good|repair|retired', location: 's:80', notes: 's:500' },
    write: 'member', del: 'leader', keep: ['checkout', 'log'], required: ['name'],
  },
  recipes: {
    spec: { title: 's:80', meal: 'e:dinner|breakfast|lunch|dessert|snack|drink', method: 's:40', serves: 'n', ingredients: [ING, 40], steps: ['s:500', 30], notes: 's:500', by: 's:80' },
    write: 'member', del: 'leader', required: ['title'],
  },
  pantry: {
    spec: { name: 's:60', qty: 'n', unit: 's:20', location: 's:60', low: 'b' },
    write: 'member', del: 'member', required: ['name'],
  },
  plans: {
    spec: { outingId: 'id', patrol: 's:40', grubmaster: 's:80', headcount: 'n', budget: 'n',
      meals: [{ id: 'id', slot: 's:40', recipeId: 's:40', title: 's:80', serves: 'n', ingredients: [ING, 40], notes: 's:300' }, 24] },
    write: 'member', del: 'member', keep: ['checks', 'spend', 'duties', 'prices'], required: ['outingId', 'patrol'],
  },
  rsvps: {
    spec: { outingId: 'id', memberId: 's:40', name: 's:80', patrol: 's:40', role: 'e:scout|adult', status: 'e:yes|maybe|no', note: 's:200' },
    write: 'member', del: 'member', required: ['outingId', 'name'],
  },
  posts: {
    spec: { title: 's:120', body: 's:1500', pinned: 'b', link: 's:200' },
    write: 'leader', del: 'leader', required: ['title'],
  },
  // merit badge counselors (troop members or outside counselors; no contact info stored)
  counselors: {
    spec: { memberId: 's:40', name: 's:80', badges: ['s:60', 120], notes: 's:300', active: 'b' },
    write: 'leader', del: 'leader', required: ['name'],
  },
  // places outings go (from TroopWebHost event locations); suggested when adding an outing
  places: {
    spec: { name: 's:160', address: 's:200', phone: 's:40', web: 's:300', mapQ: 's:120', notes: 's:300' },
    write: 'leader', del: 'leader', required: ['name'],
  },
};

const builtInRecipes = () => troop.recipes.map(r => ({
  ...r, builtIn: true, ingredients: r.ingredients.map(([name, qty, unit]) => ({ name, qty, unit })),
}));

async function listCol(store, col, url) {
  let items = await listJSON(store, `c/${col}/`);
  const outing = url.searchParams.get('outing');
  if (outing) items = items.filter(x => x.outingId === outing);
  if (col === 'recipes') {
    const ids = new Set(items.map(r => r.id));
    items = [...builtInRecipes().filter(r => !ids.has(r.id)), ...items];
    items.sort((a, b) => a.title.localeCompare(b.title));
  } else if (col === 'outings') items.sort((a, b) => a.start.localeCompare(b.start));
  else if (col === 'posts') items.sort((a, b) => (b.pinned - a.pinned) || b.created - a.created);
  else if (col === 'gear' || col === 'pantry') items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

async function getDoc(store, col, id) {
  const d = await store.get(`c/${col}/${id}`, { type: 'json' });
  if (!d && col === 'recipes') return builtInRecipes().find(r => r.id === id) || null;
  return d;
}

async function putDoc(store, col, id, body, isLeader, now) {
  const C = COLS[col];
  if (C.write === 'leader' && !isLeader) return err('Only leaders can change this.', 403);
  const data = shape(C.spec, body);
  for (const f of C.required || []) if (!data[f]) return err(`Add a ${f === 'start' ? 'start date' : f}.`);
  if (col === 'outings' && data.end && data.end < data.start) data.end = data.start;
  const prev = await store.get(`c/${col}/${id}`, { type: 'json' });
  const doc = { ...data, id, created: prev?.created || now, updated: now, updatedBy: clean(body._by, 80) };
  for (const k of C.keep || []) if (prev?.[k] !== undefined) doc[k] = prev[k];
  if (col === 'gear') { doc.log ||= []; doc.checkout ||= null; if (!prev) doc.log.push({ at: now, by: doc.updatedBy, what: 'Added to the gear locker' }); }
  if (col === 'plans') { doc.checks ||= {}; doc.spend ||= []; doc.duties ||= null; doc.prices ||= {}; }
  await store.setJSON(`c/${col}/${id}`, doc);
  return json({ ok: true, item: doc });
}

// ---------------------------------------------------------------- gear
async function gearAction(store, id, action, body, now) {
  const g = await store.get(`c/gear/${id}`, { type: 'json' });
  if (!g) return err('Not found', 404);
  const who = clean(body.who, 80);
  if (!who) return err('Add your name.');
  g.log ||= [];
  if (action === 'checkout') {
    if (g.checkout) return err(`Already checked out to ${g.checkout.who}.`, 409);
    if (g.condition === 'retired') return err('This item is retired.');
    g.checkout = { who, memberId: clean(body.memberId, 40), patrol: clean(body.patrol, 40), outingId: shape('id', body.outingId), outingTitle: clean(body.outingTitle, 80), due: shape('date', body.due), at: now };
    g.log.push({ at: now, by: who, what: `Checked out${g.checkout.outingTitle ? ` for ${g.checkout.outingTitle}` : ''}${g.checkout.patrol ? ` (${g.checkout.patrol})` : ''}` });
  } else if (action === 'checkin') {
    if (!g.checkout) return err('This item is already in the locker.');
    const condition = ['good', 'repair', 'retired'].includes(body.condition) ? body.condition : g.condition;
    const note = clean(body.note, 300);
    g.log.push({ at: now, by: who, what: `Checked in${condition !== 'good' ? ` — needs ${condition === 'repair' ? 'repair' : 'retiring'}` : ''}${note ? `: ${note}` : ''}` });
    g.checkout = null; g.condition = condition;
  } else return err('Not found', 404);
  g.log = g.log.slice(-60); g.updated = now;
  await store.setJSON(`c/gear/${id}`, g);
  return json({ ok: true, item: g });
}

// ---------------------------------------------------------------- plans
async function planAction(store, id, parts, req, body, now) {
  const p = await store.get(`c/plans/${id}`, { type: 'json' });
  if (!p) return err('Start the meal plan first.', 404);
  const [action, sub] = parts;
  if (action === 'check') {
    const key = clean(body.key, 120);
    if (!key) return err('Bad request');
    p.checks ||= {};
    if (body.on) p.checks[key] = clean(body.by, 40) || true; else delete p.checks[key];
  } else if (action === 'spend' && req.method === 'POST') {
    const amount = shape('n', body.amount);
    if (!amount) return err('Enter an amount.');
    p.spend = [...(p.spend || []), { id: rid(), amount, note: clean(body.note, 120), by: clean(body.by, 80), at: now }].slice(-50);
  } else if (action === 'spend' && req.method === 'DELETE' && sub) {
    p.spend = (p.spend || []).filter(s => s.id !== sub);
  } else if (action === 'price') {
    const key = clean(body.key, 120); if (!key) return err('Bad request');
    const price = shape('n', body.price);
    p.prices ||= {};
    if (price) p.prices[key] = price; else delete p.prices[key];
    if (price && body.name) {
      const book = (await store.get('pricebook', { type: 'json' })) || {};
      book[clean(body.name, 60).toLowerCase()] = { price, unit: clean(body.unit, 20), qty: shape('n', body.qty), at: now };
      await store.setJSON('pricebook', book);
    }
  } else if (action === 'duties') {
    const roles = shape(['s:40', 8], body.roles);
    const grid = {};
    for (const [mealId, row] of Object.entries(body.grid || {}).slice(0, 30)) {
      if (!ID.test(mealId)) continue;
      grid[mealId] = Object.fromEntries(roles.map(r => [r, clean(row?.[r], 80)]));
    }
    p.duties = { roles, grid, at: now };
  } else return err('Not found', 404);
  p.updated = now;
  await store.setJSON(`c/plans/${id}`, p);
  return json({ ok: true, item: p });
}

// ---------------------------------------------------------------- settings
async function settings(store) {
  const s = (await store.get('settings', { type: 'json' })) || {};
  return { patrols: s.patrols?.length ? s.patrols : troop.patrols, albums: s.albums || [], aiHelper: s.aiHelper !== false, autoApprove: !!s.autoApprove, autoApproveBy: s.autoApproveBy || '', autoApproveAt: s.autoApproveAt || 0 };
}

// ---------------------------------------------------------------- albums
async function albums(store, withCounts = true) {
  const s = await settings(store);
  const outings = (await listJSON(store, 'c/outings/')).sort((a, b) => b.start.localeCompare(a.start));
  const emoji = t => troop.outingTypes.find(x => x.id === t)?.emoji || '⭐';
  const list = [
    ...outings.map(o => ({ id: o.id, title: o.title, emoji: emoji(o.type), date: o.start, end: o.end || o.start, type: o.type, location: o.location || '', outing: true })),
    ...troop.albums.map(a => ({ ...a, builtIn: true })), ...s.albums,
  ];
  if (!withCounts) return list;
  const photos = (await photoMetas(store)).filter(p => p.status === 'approved').sort((a, b) => b.at - a.at);
  return list.map(a => {
    const inAlbum = photos.filter(p => p.album === a.id);
    return { ...a, count: inAlbum.length, cover: inAlbum[0]?.id || null };
  });
}

// ---------------------------------------------------------------- consent
async function roster(store) {
  const fams = await listJSON(store, 'consents/');
  return fams.flatMap(f => f.scouts.map(s => ({ ...s, familyId: f.id, parent: f.parent.name, updated: f.updated })))
    .sort((a, b) => (a.patrol || '').localeCompare(b.patrol || '') || a.first.localeCompare(b.first));
}

async function saveConsent(store, body, now) {
  if (!body.agreed) return err('Check the box to confirm you\'re the scout\'s parent or guardian.');
  const parent = { name: clean(body.parent?.name, 80), email: clean(body.parent?.email, 160).toLowerCase(), phone: clean(body.parent?.phone, 40) };
  if (!parent.name) return err('Add your name.');
  const signature = clean(body.signature, 80);
  if (!signature) return err('Type your name to sign.');
  const scouts = (Array.isArray(body.scouts) ? body.scouts : []).slice(0, 8).map(s => ({
    id: /^s-[a-z0-9]{6,20}$/.test(s.id || '') ? s.id : `s-${rid()}`,
    first: clean(s.first, 40),
    lastInitial: clean(s.lastInitial, 2).replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase(),
    patrol: clean(s.patrol, 40),
    level: LEVELS.includes(s.level) ? s.level : '',
  })).filter(s => s.first);
  if (!scouts.length) return err('Add at least one scout.');
  if (scouts.some(s => !s.level)) return err('Pick a photo choice for each scout.');
  let id = /^f-[a-z0-9]{6,24}$/.test(body.familyId || '') ? body.familyId : null;
  const prev = id ? await store.get(`consents/${id}`, { type: 'json' }) : null;
  if (!prev) id = `f-${rid()}${rid().slice(-4)}`;
  const rec = {
    id, parent, scouts, signature, agreed: true, created: prev?.created || now, updated: now,
    history: [...(prev?.history || []), { at: now, by: signature, levels: scouts.map(s => `${scoutName(s)}: ${s.level}`) }].slice(-20),
  };
  await store.setJSON(`consents/${id}`, rec);
  return json({ ok: true, familyId: id, record: publicConsent(rec) });
}
const publicConsent = r => ({ id: r.id, parent: r.parent, scouts: r.scouts, signature: r.signature, updated: r.updated });

function checkPhoto(photo, scoutsById) {
  const tagged = (photo.scouts || []).map(id => scoutsById.get(id)).filter(Boolean);
  const levels = tagged.map(s => s.level);
  let flag;
  if (levels.includes('none')) flag = 'blocked';
  else if (!tagged.length) flag = 'untagged';
  else if (levels.every(l => l === 'public')) flag = 'public';
  else flag = 'troop';
  return { flag, tagged: tagged.map(s => ({ id: s.id, name: scoutName(s), patrol: s.patrol, level: s.level })) };
}

// ---------------------------------------------------------------- photos
function decodeImage(dataUrl, max) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
  if (bytes.byteLength > max) return { tooBig: true };
  return { type: m[1], bytes };
}

async function addPhoto(store, body, now) {
  if (!body.release) return err('Agree to the sharing rules to share photos.');
  const name = clean(body.name, 80);
  if (!name) return err('Add your name so leaders know who shared it.');
  const img = decodeImage(body.image, MAX_PHOTO_BYTES);
  if (!img) return err('That file isn\'t a photo.');
  if (img.tooBig) return err('That photo is too large.');
  const thumb = decodeImage(body.thumb, MAX_THUMB_BYTES);
  const known = new Set((await albums(store, false)).map(a => a.id));
  const id = rid();
  const meta = {
    id, name, display: shortName(name), role: ['scout', 'parent', 'leader'].includes(body.role) ? body.role : 'parent',
    album: known.has(body.album) ? body.album : 'fun', patrol: clean(body.patrol, 40),
    scouts: (Array.isArray(body.scouts) ? body.scouts : []).slice(0, 30).map(s => clean(s, 30)).filter(Boolean),
    caption: clean(body.caption, 200),
    status: troop.photos.requireApproval ? 'pending' : 'approved', public: false,
    type: img.type, size: img.bytes.byteLength, at: now,
  };
  // Leader override: skip review, unless a "no photos" scout is tagged
  if (meta.status === 'pending' && (await settings(store)).autoApprove && checkPhoto(meta, new Map((await roster(store)).map(s => [s.id, s]))).flag !== 'blocked') meta.status = 'approved';
  // photos brought over from an archive keep the date they were taken
  const taken = /^\d{4}-\d{2}-\d{2}$/.test(body.takenAt || '') ? Date.parse(`${body.takenAt}T12:00:00-05:00`) : NaN;
  if (taken > Date.parse('2000-01-01') && taken < now) { meta.at = taken; meta.uploaded = now; meta.source = clean(body.source, 60); }
  await store.set(`photos/img/${id}`, img.bytes, { metadata: { type: img.type } });
  if (thumb && !thumb.tooBig) await store.set(`photos/thumb/${id}`, thumb.bytes, { metadata: { type: thumb.type } });
  await store.setJSON(`photos/meta/${id}`, meta);
  await touchPhotos(store);
  return json({ ok: true, id, status: meta.status });
}

async function photoList(store) {
  const [metas, scouts] = await Promise.all([photoMetas(store), roster(store)]);
  const byId = new Map(scouts.map(s => [s.id, s]));
  return metas.filter(p => p.status === 'approved').sort((a, b) => b.at - a.at)
    .map(({ id, display, caption, at, album, patrol, scouts: tagged }) => {
      const t = (tagged || []).map(x => byId.get(x)).filter(Boolean);
      return { id, name: display, caption, at, album, patrol, tags: t.map(scoutName), tagIds: t.map(x => x.id), tagPatrols: [...new Set(t.map(x => x.patrol).filter(Boolean))] };
    });
}

async function photoFile(store, id, { leader = false, thumb = false } = {}) {
  const meta = await store.get(`photos/meta/${clean(id, 40)}`, { type: 'json' });
  if (!meta || (meta.status !== 'approved' && !leader)) return new Response('Not found', { status: 404 });
  let res = thumb ? await store.getWithMetadata(`photos/thumb/${meta.id}`, { type: 'arrayBuffer' }) : null;
  res ||= await store.getWithMetadata(`photos/img/${meta.id}`, { type: 'arrayBuffer' });
  if (!res) return new Response('Not found', { status: 404 });
  return new Response(res.data, { headers: { 'content-type': res.metadata?.type || meta.type || 'image/jpeg', 'cache-control': leader ? 'no-store' : 'private, max-age=86400' } });
}

// ---------------------------------------------------------------- CSV
function toCSV(rows) {
  const cols = [...rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set())];
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
const iso = t => (t ? new Date(t).toISOString() : '');

async function exportCSV(store, kind) {
  let rows;
  const outings = new Map((await listJSON(store, 'c/outings/')).map(o => [o.id, o]));
  if (kind === 'permissions') {
    rows = (await roster(store)).map(s => ({ scout: scoutName(s), patrol: s.patrol, photo_choice: troop.consentLevels.find(l => l.id === s.level)?.label || s.level, parent: s.parent, updated: iso(s.updated) }));
  } else if (kind === 'photos') {
    const byId = new Map((await roster(store)).map(s => [s.id, s]));
    rows = (await photoMetas(store)).sort((a, b) => a.at - b.at).map(p => {
      const c = checkPhoto(p, byId);
      return { id: p.id, shared_by: p.name, role: p.role, album: outings.get(p.album)?.title || p.album, patrol: p.patrol, caption: p.caption, status: p.status, ok_for_public: p.public ? 'yes' : '', permission_check: c.flag, scouts_tagged: c.tagged.map(t => t.name).join('; '), shared: iso(p.at) };
    });
  } else if (kind === 'gear') {
    rows = (await listJSON(store, 'c/gear/')).sort((a, b) => a.name.localeCompare(b.name)).map(g => ({
      item: g.name, tag: g.tag, category: g.category, qty: g.qty, condition: g.condition, location: g.location,
      checked_out_to: g.checkout?.who || '', patrol: g.checkout?.patrol || '', outing: g.checkout?.outingTitle || '', due: g.checkout?.due || '', notes: g.notes,
    }));
  } else if (kind === 'gear-log') {
    rows = (await listJSON(store, 'c/gear/')).flatMap(g => (g.log || []).map(l => ({ when: iso(l.at), item: g.name, tag: g.tag, by: l.by, what: l.what }))).sort((a, b) => a.when.localeCompare(b.when));
  } else if (kind === 'signups') {
    rows = (await listJSON(store, 'c/rsvps/')).map(r => ({ outing: outings.get(r.outingId)?.title || r.outingId, date: outings.get(r.outingId)?.start || '', name: r.name, patrol: r.patrol, role: r.role, status: r.status, note: r.note, updated: iso(r.updated) }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.patrol.localeCompare(b.patrol) || a.name.localeCompare(b.name));
  } else if (kind === 'spending') {
    rows = (await listJSON(store, 'c/plans/')).flatMap(p => (p.spend || []).map(s => ({ outing: outings.get(p.outingId)?.title || p.outingId, patrol: p.patrol, amount: s.amount.toFixed(2), note: s.note, by: s.by, when: iso(s.at) })));
  } else return err('Unknown export.');
  return new Response(toCSV(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${troop.id}-${kind}.csv"` } });
}

// ---------------------------------------------------------------- leaders
async function leader(store, req, parts, body, now) {
  const [what, id, sub] = parts;
  if (what === 'check') return json({ ok: true });
  // scratch space for leader-run imports (e.g. a TroopWebHost photo list gathered in the browser)
  if (what === 'inbox' && id && /^[a-z0-9-]{1,40}$/.test(id)) {
    if (req.method === 'POST') { await store.setJSON(`inbox/${id}`, { at: now, data: body }); return json({ ok: true }); }
    if (req.method === 'GET') return json((await store.get(`inbox/${id}`, { type: 'json' })) || {});
    if (req.method === 'DELETE') { await store.delete(`inbox/${id}`); return json({ ok: true }); }
  }
  if (what === 'photos' && req.method === 'GET' && id && sub === 'file') return photoFile(store, id, { leader: true });
  if (what === 'photos' && req.method === 'GET' && id && sub === 'thumb') return photoFile(store, id, { leader: true, thumb: true });
  if (what === 'photos' && req.method === 'GET') {
    const byId = new Map((await roster(store)).map(s => [s.id, s]));
    const all = (await photoMetas(store)).sort((a, b) => b.at - a.at);
    return json({ photos: all.map(p => ({ ...p, check: checkPhoto(p, byId) })) });
  }
  if (what === 'photos' && req.method === 'POST' && id) {
    const meta = await store.get(`photos/meta/${clean(id, 40)}`, { type: 'json' });
    if (!meta) return err('Not found', 404);
    if (body.status === 'deleted') { for (const k of ['meta', 'img', 'thumb']) await store.delete(`photos/${k}/${meta.id}`); await touchPhotos(store); return json({ ok: true }); }
    if (body.status !== undefined) {
      if (!['approved', 'hidden', 'pending'].includes(body.status)) return err('Bad status');
      meta.status = body.status;
    }
    if (body.public !== undefined) {
      if (body.public && checkPhoto(meta, new Map((await roster(store)).map(s => [s.id, s]))).flag !== 'public') return err('Every scout tagged in this photo needs public permission first.');
      meta.public = !!body.public;
    }
    if (Array.isArray(body.scouts)) meta.scouts = body.scouts.slice(0, 30).map(s => clean(s, 30)).filter(Boolean);
    if (body.patrol !== undefined) meta.patrol = clean(body.patrol, 40);
    // tagging a "no photos" scout takes the photo out of the gallery
    if (meta.status === 'approved' && checkPhoto(meta, new Map((await roster(store)).map(s => [s.id, s]))).flag === 'blocked') { meta.status = 'hidden'; meta.public = false; }
    if (body.album !== undefined && (await albums(store, false)).some(a => a.id === body.album)) meta.album = body.album;
    await store.setJSON(`photos/meta/${meta.id}`, meta);
    await touchPhotos(store);
    return json({ ok: true, photo: meta });
  }
  // approve / hide many at once (photos with a "no photos" scout tagged are skipped)
  if (what === 'photos-bulk' && req.method === 'POST') {
    if (!['approved', 'hidden'].includes(body.status)) return err('Bad request');
    if (body.filter === 'archive-untagged') body.ids = (await photoMetas(store)).filter(p => p.status === 'pending' && p.source === 'TroopWebHost' && !(p.scouts || []).length).map(p => p.id);
    if (!Array.isArray(body.ids)) return err('Bad request');
    const byId = new Map((await roster(store)).map(s => [s.id, s]));
    let done = 0, skipped = 0;
    const ids = body.ids.slice(0, 2000);
    for (let i = 0; i < ids.length; i += 25) {
      await Promise.all(ids.slice(i, i + 25).map(async pid => {
        const meta = await store.get(`photos/meta/${clean(pid, 40)}`, { type: 'json' });
        if (!meta) return;
        if (body.status === 'approved' && checkPhoto(meta, byId).flag === 'blocked') { skipped++; return; }
        meta.status = body.status; await store.setJSON(`photos/meta/${meta.id}`, meta); done++;
      }));
    }
    await touchPhotos(store);
    return json({ ok: true, done, skipped });
  }
  if (what === 'permissions' && req.method === 'GET') return json({ families: (await listJSON(store, 'consents/')).sort((a, b) => b.updated - a.updated) });
  if (what === 'permissions' && req.method === 'DELETE' && id) { await store.delete(`consents/${clean(id, 40)}`); return json({ ok: true }); }
  if (what === 'settings' && req.method === 'GET') return json(await settings(store));
  if (what === 'albums' && req.method === 'GET') return json({ albums: await albums(store) });
  if (what === 'settings' && req.method === 'POST') {
    const cur = await settings(store);
    const patrols = body.patrols ? shape(['s:40', 20], body.patrols) : cur.patrols;
    const albumsIn = body.albums ? (Array.isArray(body.albums) ? body.albums : []).slice(0, 40).map(a => ({ id: ID.test(a.id || '') ? a.id : `a-${rid()}`, title: clean(a.title, 60), emoji: clean(a.emoji, 8) || '📷' })).filter(a => a.title) : cur.albums;
    if (!patrols.length) return err('Keep at least one patrol.');
    const raw = (await store.get('settings', { type: 'json' })) || {};
    const next = { ...raw, patrols, albums: albumsIn };
    if (body.aiHelper !== undefined) next.aiHelper = !!body.aiHelper;
    if (body.autoApprove !== undefined) { next.autoApprove = !!body.autoApprove; next.autoApproveBy = clean(body.by, 80); next.autoApproveAt = now; }
    await store.setJSON('settings', next);
    return json({ ok: true, settings: await settings(store) });
  }
  if (what === 'export') return exportCSV(store, id);
  const pr = await leaderPeople(store, what, id, sub, req, body, now, {});
  if (pr) return pr;
  if (what === 'stats') {
    const [photos, fams] = await Promise.all([photoMetas(store), listJSON(store, 'consents/')]);
    const scouts = fams.flatMap(f => f.scouts);
    return json({
      pending: photos.filter(p => p.status === 'pending').length, approved: photos.filter(p => p.status === 'approved').length,
      families: fams.length, scouts: scouts.length, levels: Object.fromEntries(LEVELS.map(l => [l, scouts.filter(s => s.level === l).length])),
    });
  }
  return err('Not found', 404);
}

// ---------------------------------------------------------------- router
// opts: { store, troopCode, leaderPasscode }
export async function handle(req, opts) {
  const pending = [];
  const res = await route(req, { ...opts, pending });
  if (pending.length) await Promise.allSettled(pending);   // no waitUntil: finish notifications before replying
  return res;
}
async function route(req, opts) {
  const { store } = opts;
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/(?:api|\.netlify\/functions\/api)\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const now = Date.now();
  let body = {};
  if (['POST', 'PUT'].includes(req.method)) { try { body = await req.json(); } catch { return err('Bad request'); } }

  try {
    const [head, ...rest] = parts;
    if (head === 'health') return json({ ok: true, app: troop.id });
    if (!opts.troopCode) return err('The troop code isn\'t set yet. Add TROOP_CODE in Netlify → Site configuration → Environment variables.', 503);
    if (head === 'join' && req.method === 'POST') return same(body.code, opts.troopCode) ? json({ ok: true }) : err('That troop code doesn\'t match. Check with your Scoutmaster.', 401);
    if (head === 'auth' && rest[0] === 'redeem' && req.method === 'POST') return redeem(store, body, req, now);

    // work that can finish after the response (phone notifications)
    const later = p => { const q = Promise.resolve(p).catch(e => console.error(e)); if (opts.waitUntil) opts.waitUntil(q); else opts.pending.push(q); return q; };
    if (head === 'calendar.ics' && req.method === 'GET') return calendarFeed(store, url, req);
    const session = await resolveSession(store, req);
    const leaderGiven = req.headers.get('x-leader-passcode') || url.searchParams.get('lk');
    const isLeader = (!!opts.leaderPasscode && same(leaderGiven, opts.leaderPasscode)) || !!session?.member.leader;
    if (head === 'leader') {
      if (!isLeader) return err(opts.leaderPasscode ? 'Wrong leader passcode.' : 'Leader tools are off.', 401);
      return leader(store, req, rest, body, now);
    }

    const code = req.headers.get('x-troop-code') || url.searchParams.get('k');
    if (!same(code, opts.troopCode) && !isLeader && !session) return err('Enter the troop code to continue.', 401);

    if (head === 'push') { const r = await pushRoutes(store, rest, req, body, now, session?.member); if (r) return r; }
    if (head === 'calendar' && rest[0] === 'link' && req.method === 'GET') return calendarLink(store, url);
    const mr = await memberRoutes(store, head, rest, req, body, now, { session, isLeader, patrols: (await settings(store)).patrols, later, notify: (...a) => notify(store, ...a) });
    if (mr) return mr;
    if (head === 'mbcatalog' && req.method === 'GET') {
      const [advs, gear, counselors] = await Promise.all([listJSON(store, 'adv/'), listJSON(store, 'c/gear/'), listJSON(store, 'c/counselors/')]);
      const names = new Map();
      const add = (n, eagle) => { const k = clean(n, 60).replace(/^\*/, '').replace(/\s*\((?:[^)]*rqmts|old rqmts)\)\s*$/i, '').trim(); if (k) names.set(k, names.get(k) || !!eagle); };
      for (const a of advs) { for (const b of a.badges || []) add(b.name, b.eagle); for (const b of a.inProgress || []) add(b.name, b.eagle); }
      for (const g of gear) if (g.category === 'Merit badge library') add(g.name.replace(/ merit badge pamphlet$/i, ''), g.tag === 'Eagle req.');
      for (const c of counselors) for (const b of c.badges || []) add(b);
      return json({ badges: [...names].map(([name, eagle]) => ({ name, eagle })).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (head === 'pricebook' && req.method === 'GET') return json({ book: (await store.get('pricebook', { type: 'json' })) || {} });

    // generic collections: /api/c/:col[/:id]
    if (head === 'c' && COLS[rest[0]]) {
      const [col, id] = rest;
      if (!id && req.method === 'GET') return json({ items: await listCol(store, col, url) });
      if (!id || !ID.test(id)) return err('Bad id');
      if (req.method === 'GET') { const d = await getDoc(store, col, id); return d ? json({ item: d }) : err('Not found', 404); }
      if (req.method === 'PUT') {
        const isNew = col === 'posts' && !(await getDoc(store, col, id));
        const res = await putDoc(store, col, id, body, isLeader, now);
        if (isNew && res.status === 200) later(notify(store, null, 'news', { title: `📣 ${String(body.title || '').slice(0, 80)}`, body: body.body || 'New announcement from the troop leaders.', url: '#/', tag: `post-${id}` }));
        return res;
      }
      if (req.method === 'DELETE') {
        if (COLS[col].del === 'leader' && !isLeader) return err('Only leaders can delete this.', 403);
        await store.delete(`c/${col}/${id}`);
        return json({ ok: true });
      }
    }
    if (head === 'gear' && rest[0] && rest[1] && req.method === 'POST') return gearAction(store, rest[0], rest[1], body, now);
    if (head === 'plans' && rest[0]) return planAction(store, rest[0], rest.slice(1), req, body, now);
    if (head === 'settings' && req.method === 'GET') return json(await settings(store));

    if (head === 'albums' && req.method === 'GET') return json({ albums: await albums(store) });
    if (head === 'photos' && req.method === 'GET' && rest[0]) return photoFile(store, rest[0], { thumb: rest[1] === 'thumb' });
    if (head === 'photos' && req.method === 'GET') return json({ photos: await photoList(store) });
    if (head === 'photos' && req.method === 'POST') return addPhoto(store, body, now);
    if (head === 'roster' && req.method === 'GET') return json({ scouts: (await roster(store)).map(s => ({ id: s.id, name: scoutName(s), patrol: s.patrol })) });
    if (head === 'consent' && req.method === 'POST') return saveConsent(store, body, now);
    if (head === 'consent' && req.method === 'GET' && rest[0]) {
      const r = await store.get(`consents/${clean(rest[0], 40)}`, { type: 'json' });
      return r ? json({ record: publicConsent(r) }) : err('Not found', 404);
    }
    return err('Not found', 404);
  } catch (e) {
    console.error(e);
    return err('Something went wrong on the server.', 500);
  }
}
