// Hike tracker: record a hike with the phone's GPS (or log one by hand), tag
// the group that went, and keep distance, time and elevation gain for each
// person. Tracks are only visible to signed-in troop members.
//
// Elevation: phones' GPS altitude is noisy, so when a track is saved the
// server looks up ground elevation along the route from the free Open-Meteo
// elevation service (Copernicus DEM, 90 m). If that can't be reached, the
// phone's own altitude readings are used instead.
//
// Privacy: by default the first and last 200 m around the start and finish
// are removed from the saved map (so a hike that starts at home doesn't show
// the house). Distance and elevation are worked out before trimming.
import { loadPeople } from './people.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const err = (message, status = 400) => json({ error: message }, status);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const num = (v, lo, hi) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MILE = 1609.344;
const PRIVACY_M = 200;

// ------------------------------------------------------------- geometry
const R = 6371008.8;
const rad = d => d * Math.PI / 180;
export function dist(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// points carry a segment number (5th value): pausing starts a new segment, and
// the gap between segments isn't counted
const sameSeg = (a, b) => (a[4] || 0) === (b[4] || 0);
export function pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) if (sameSeg(pts[i - 1], pts[i])) d += dist(pts[i - 1], pts[i]); return d; }

// climb and descent with a dead band so GPS/DEM noise doesn't add up
export function climb(eles, band) {
  let gain = 0, loss = 0, ref = null;
  for (const e of eles) {
    if (e == null) continue;
    if (ref == null) { ref = e; continue; }
    if (e - ref >= band) { gain += e - ref; ref = e; } else if (ref - e >= band) { loss += ref - e; ref = e; }
  }
  return { gain, loss };
}
const smooth = (a, w) => a.map((_, i) => {
  const s = a.slice(Math.max(0, i - w), i + w + 1).filter(x => x != null);
  return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null;
});

// Clean a raw track: valid numbers, time order, no teleports.
// Each point: [lat, lng, ele|null, t seconds since start, segment]
function tidy(raw) {
  const out = [];
  for (const p of (Array.isArray(raw) ? raw : []).slice(0, 30000)) {
    if (!Array.isArray(p)) continue;
    const lat = num(p[0], -90, 90), lng = num(p[1], -180, 180), t = num(p[3], 0, 7 * 86400);
    if (lat == null || lng == null || t == null) continue;
    const ele = num(p[2], -500, 9000);
    const seg = Math.round(num(p[4], 0, 999) || 0);
    const prev = out[out.length - 1];
    if (prev && prev[4] === seg) {
      if (t < prev[3]) continue;
      const d = dist(prev, [lat, lng]);
      if (d > 30 && d / Math.max(1, t - prev[3]) > 12) continue;   // faster than 27 mph on foot: a GPS jump
      if (d < 3 && t - prev[3] < 30) continue;                      // standing still
    }
    out.push([+lat.toFixed(6), +lng.toFixed(6), ele == null ? null : +ele.toFixed(1), Math.round(t), seg]);
  }
  return out;
}
function thin(pts, max) {
  if (pts.length <= max) return pts;
  const step = pts.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * step)]);
  out[out.length - 1] = pts[pts.length - 1];
  return out;
}
function movingSeconds(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    if (!sameSeg(pts[i - 1], pts[i])) continue;
    const dt = pts[i][3] - pts[i - 1][3]; const v = dist(pts[i - 1], pts[i]) / Math.max(1, dt);
    if (dt > 0 && dt <= 120 && v >= 0.25) s += dt;
  }
  return s;
}

// ground elevation along the route (Copernicus DEM via Open-Meteo)
async function mapElevations(samples) {
  const out = [];
  for (let i = 0; i < samples.length; i += 100) {
    const chunk = samples.slice(i, i + 100);
    const u = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map(p => p[0].toFixed(5)).join(',')}&longitude=${chunk.map(p => p[1].toFixed(5)).join(',')}`;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(u, { signal: ctl.signal });
      if (!r.ok) return null;
      const d = await r.json();
      if (!Array.isArray(d.elevation) || d.elevation.length !== chunk.length) return null;
      out.push(...d.elevation.map(Number));
    } catch { return null; } finally { clearTimeout(timer); }
  }
  return out;
}

// Work out everything about a recorded track.
export async function analyze(rawPts, { useMap = true, lookup = mapElevations } = {}) {
  const pts = tidy(rawPts);
  if (pts.length < 2) return null;
  const distance = pathLength(pts);
  const elapsed = pts[pts.length - 1][3] - pts[0][3];
  // sample by distance for the profile and the map elevation lookup
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + (sameSeg(pts[i - 1], pts[i]) ? dist(pts[i - 1], pts[i]) : 0));
  const n = Math.min(300, Math.max(2, Math.round(distance / 15)));
  const idx = []; for (let k = 0, j = 0; k < n; k++) { const target = distance * k / (n - 1); while (j < pts.length - 1 && cum[j] < target) j++; idx.push(j); }
  const samples = idx.map(i => pts[i]);
  let eles = null, source = 'gps', band = 4;
  if (useMap && distance > 50) { const m = await lookup(samples); if (m && m.some(x => x !== 0)) { eles = m; source = 'map'; band = 2; } }
  if (!eles) {
    const g = smooth(samples.map(p => p[2]), 3);
    eles = g.some(x => x != null) ? g : null;
    if (!eles) source = 'none';
  }
  const { gain, loss } = eles ? climb(eles, band) : { gain: 0, loss: 0 };
  const known = (eles || []).filter(x => x != null);
  const profile = eles ? idx.map((i, k) => [Math.round(cum[i]), eles[k] == null ? null : +eles[k].toFixed(1)]) : [];
  // give every point the (better) map elevation, so the route can be colored by height
  if (source === 'map') {
    for (let i = 0, k = 0; i < pts.length; i++) {
      while (k < profile.length - 2 && profile[k + 1][0] < cum[i]) k++;
      const [x0, e0] = profile[k], [x1, e1] = profile[Math.min(k + 1, profile.length - 1)];
      const f = x1 > x0 ? Math.min(1, Math.max(0, (cum[i] - x0) / (x1 - x0))) : 0;
      pts[i][2] = +(e0 + (e1 - e0) * f).toFixed(1);
    }
  }
  return {
    pts, cum, distance: Math.round(distance), elapsed, moving: movingSeconds(pts), gain: Math.round(gain), loss: Math.round(loss),
    maxEle: known.length ? Math.round(Math.max(...known)) : null, minEle: known.length ? Math.round(Math.min(...known)) : null, eleSource: source, profile,
  };
}

// drop points near the start and the finish
export function trimEnds(pts, m = PRIVACY_M) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const kept = pts.filter(p => dist(p, a) > m && dist(p, b) > m);
  return kept.length >= 2 ? kept : [];
}

const shape = h => ({
  id: h.id, title: h.title, by: h.by, byName: h.byName, group: h.group, groupNames: h.groupNames, patrol: h.patrol, outingId: h.outingId, outingTitle: h.outingTitle,
  date: h.date, startAt: h.startAt, distance: h.distance, gain: h.gain, loss: h.loss, maxEle: h.maxEle, minEle: h.minEle, moving: h.moving, elapsed: h.elapsed,
  manual: !!h.manual, eleSource: h.eleSource, hideEnds: !!h.hideEnds, notes: h.notes || '', preview: h.preview || [], spark: h.spark || [], kudos: h.kudos || [], created: h.created, updated: h.updated,
});

export async function allHikes(store, colItems) { return (await colItems(store, 'hikes')).filter(Boolean); }

// per-person totals from every hike they were part of
export function hikeTotals(hikes, { year } = {}) {
  const per = new Map();
  for (const h of hikes) {
    if (year && !String(h.date || '').startsWith(String(year))) continue;
    for (const id of h.group || []) {
      const t = per.get(id) || { id, count: 0, distance: 0, gain: 0, longest: 0, moving: 0, over10: 0, over20: 0, last: '' };
      t.count++; t.distance += h.distance || 0; t.gain += h.gain || 0; t.moving += h.moving || 0;
      t.longest = Math.max(t.longest, h.distance || 0);
      if ((h.distance || 0) >= 10 * MILE * 0.98) t.over10++;
      if ((h.distance || 0) >= 20 * MILE * 0.98) t.over20++;
      if ((h.date || '') > t.last) t.last = h.date;
      per.set(id, t);
    }
  }
  return per;
}

export async function hikeRoutes(store, rest, req, body, now, ctx) {
  const { me, isLeader, colItems } = ctx;
  if (!me && !isLeader) return err('Sign in with your personal code to see and record hikes.', 401);
  const [id, sub] = rest;
  const people = ctx.people || await loadPeople(store);
  const byId = new Map(people.members.map(m => [m.id, m]));
  const canEdit = h => isLeader || (me && (h.by === me.id || me.leader));

  if (!id && req.method === 'GET') {
    const url = new URL(req.url);
    const mine = url.searchParams.get('mine') === '1';
    let list = (await allHikes(store, colItems)).sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
    if (mine && me) list = list.filter(h => (h.group || []).includes(me.id));
    return json({ hikes: list.slice(0, 300).map(shape) });
  }
  if (id === 'stats' && req.method === 'GET') {
    const year = new URL(req.url).searchParams.get('year') || '';
    const hikes = await allHikes(store, colItems);
    const per = hikeTotals(hikes, { year });
    const members = [...per.values()].map(t => ({ ...t, name: byId.get(t.id)?.name || 'Former member', role: byId.get(t.id)?.role || '', patrol: byId.get(t.id)?.patrol || '' }))
      .sort((a, b) => b.distance - a.distance);
    const patrols = Object.values(members.reduce((acc, m) => {
      if (!m.patrol) return acc;
      const p = acc[m.patrol] ||= { patrol: m.patrol, distance: 0, gain: 0, hikers: 0 };
      p.distance += m.distance; p.gain += m.gain; p.hikers++; return acc;
    }, {})).sort((a, b) => b.distance - a.distance);
    const years = [...new Set(hikes.map(h => String(h.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    return json({ me: me ? (per.get(me.id) || null) : null, members, patrols, years, count: hikes.filter(h => !year || String(h.date).startsWith(year)).length });
  }
  if (!id && req.method === 'POST') {
    if (!me) return err('Sign in with your personal code to save a hike.', 401);
    const group = [...new Set([me.id, ...(Array.isArray(body.group) ? body.group : [])])].filter(x => byId.get(x)?.active !== false && byId.has(x)).slice(0, 60);
    const hid = `h-${rid()}`;
    const outings = await colItems(store, 'outings');
    const outing = outings.find(o => o.id === body.outingId);
    let h;
    if (body.manual) {
      const miles = num(body.miles, 0.05, 200);
      if (!miles) return err('Enter how far you hiked.');
      const date = DAY.test(body.date || '') ? body.date : new Date(now).toISOString().slice(0, 10);
      const gainFt = num(body.gainFt, 0, 40000) || 0;
      const minutes = num(body.minutes, 0, 7 * 1440) || 0;
      h = { id: hid, manual: true, distance: Math.round(miles * MILE), gain: Math.round(gainFt * 0.3048), loss: null, moving: Math.round(minutes * 60), elapsed: Math.round(minutes * 60),
        date, startAt: Date.parse(`${date}T12:00:00-05:00`), eleSource: gainFt ? 'entered' : 'none', preview: [], maxEle: null, minEle: null };
    } else {
      const a = await analyze(body.points, { useMap: ctx.useMap !== false });
      if (!a || a.distance < 20) return err('That track is too short to save. Walk a little farther and try again.');
      const startAt = num(body.startAt, 1e12, 9e12) || now - a.elapsed * 1000;
      const hideEnds = body.hideEnds !== false;
      const shown = hideEnds ? trimEnds(a.pts) : a.pts;
      const stored = thin(shown, 3000);
      const offset = shown.length ? Math.round(a.cum[a.pts.indexOf(shown[0])] || 0) : 0;   // meters hidden before the first map point
      await store.setJSON(`hikepts/${hid}`, { pts: stored, profile: a.profile, offset });
      const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(startAt);   // date in Florida
      h = { id: hid, manual: false, distance: a.distance, gain: a.gain, loss: a.loss, moving: a.moving, elapsed: a.elapsed, maxEle: a.maxEle, minEle: a.minEle,
        eleSource: a.eleSource, hideEnds, date: DAY.test(body.date || '') ? body.date : local, startAt, preview: thin(shown, 120).map(p => [p[0], p[1], p[4] || 0]),
        spark: thin(a.profile.filter(p => p[1] != null), 48).map(p => Math.round(p[1])) };
    }
    Object.assign(h, {
      title: clean(body.title, 80) || (outing ? outing.title : 'Hike'), notes: clean(body.notes, 600), by: me.id, byName: me.name,
      group, groupNames: group.map(x => byId.get(x)?.name || ''), patrol: clean(body.patrol, 40) || me.patrol || '',
      outingId: outing?.id || '', outingTitle: outing?.title || '', kudos: [], created: now, updated: now,
    });
    await store.setJSON(`c/hikes/${hid}`, h);
    return json({ ok: true, hike: shape(h) });
  }
  const h = id ? await store.get(`c/hikes/${clean(id, 40)}`, { type: 'json' }) : null;
  if (!h) return err('Hike not found.', 404);
  if (!sub && req.method === 'GET') {
    const t = h.manual ? null : await store.get(`hikepts/${h.id}`, { type: 'json' });
    return json({ hike: shape(h), points: t?.pts || [], profile: t?.profile || [], offset: t?.offset || 0, canEdit: canEdit(h) });
  }
  if (sub === 'kudos' && req.method === 'POST') {
    if (!me) return err('Sign in first.', 401);
    h.kudos = (h.kudos || []).includes(me.id) ? h.kudos.filter(x => x !== me.id) : [...(h.kudos || []), me.id];
    await store.setJSON(`c/hikes/${h.id}`, h);
    return json({ ok: true, kudos: h.kudos });
  }
  if (!sub && req.method === 'PUT') {
    if (!canEdit(h)) return err('Only the person who recorded this hike, or a leader, can change it.', 403);
    if (body.title !== undefined) h.title = clean(body.title, 80) || h.title;
    if (body.notes !== undefined) h.notes = clean(body.notes, 600);
    if (Array.isArray(body.group)) { h.group = [...new Set([h.by, ...body.group])].filter(x => byId.has(x)).slice(0, 60); h.groupNames = h.group.map(x => byId.get(x)?.name || ''); }
    if (body.outingId !== undefined) { const o = (await colItems(store, 'outings')).find(x => x.id === body.outingId); h.outingId = o?.id || ''; h.outingTitle = o?.title || ''; }
    h.updated = now;
    await store.setJSON(`c/hikes/${h.id}`, h);
    return json({ ok: true, hike: shape(h) });
  }
  if (!sub && req.method === 'DELETE') {
    if (!canEdit(h)) return err('Only the person who recorded this hike, or a leader, can delete it.', 403);
    await store.delete(`c/hikes/${h.id}`); await store.delete(`hikepts/${h.id}`);
    return json({ ok: true });
  }
  return err('Not found', 404);
}
