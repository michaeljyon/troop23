// Phone notifications (Web Push). Signed-in members turn them on per device
// under More → Notifications. Keys are made once and kept in the Blobs store,
// so there is nothing to set up in Netlify.
//
// Blobs:  pushkeys                         { publicKey, privateKey }
//         push/{memberId}/{endpointHash}   { sub, prefs: { messages, boards, news }, ua, at }
import webpush from 'web-push';
import troop from '../../troop/troop.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const DEFAULT_PREFS = { messages: true, boards: true, news: true };

async function keys(store) {
  let k = await store.get('pushkeys', { type: 'json' });
  if (!k) { k = webpush.generateVAPIDKeys(); await store.setJSON('pushkeys', k); }
  return k;
}
async function hash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}
const validSub = s => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 && s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
const cleanPrefs = p => Object.fromEntries(Object.keys(DEFAULT_PREFS).map(k => [k, p?.[k] === undefined ? DEFAULT_PREFS[k] : !!p[k]]));

// /api/push/...  (signed-in members only, except the public key)
export async function pushRoutes(store, rest, req, body, now, me) {
  const [what] = rest;
  if (what === 'key' && req.method === 'GET') return json({ publicKey: (await keys(store)).publicKey });
  if (!me) return err('Sign in with your personal code to get notifications.', 401);
  if (what === 'subscribe' && req.method === 'POST') {
    if (!validSub(body.sub)) return err('That notification setup didn\'t work. Try again.');
    const k = `push/${me.id}/${await hash(body.sub.endpoint)}`;
    const prev = await store.get(k, { type: 'json' });
    const doc = { sub: { endpoint: body.sub.endpoint, keys: { p256dh: body.sub.keys.p256dh, auth: body.sub.keys.auth } }, prefs: cleanPrefs(body.prefs || prev?.prefs), ua: String(req.headers.get('user-agent') || '').slice(0, 160), at: now };
    await store.setJSON(k, doc);
    return json({ ok: true, prefs: doc.prefs });
  }
  if (what === 'status' && req.method === 'POST') {
    if (typeof body.endpoint !== 'string') return json({ on: false });
    const d = await store.get(`push/${me.id}/${await hash(body.endpoint)}`, { type: 'json' });
    return json({ on: !!d, prefs: d?.prefs || DEFAULT_PREFS });
  }
  if (what === 'unsubscribe' && req.method === 'POST') {
    if (typeof body.endpoint === 'string') await store.delete(`push/${me.id}/${await hash(body.endpoint)}`);
    return json({ ok: true });
  }
  if (what === 'test' && req.method === 'POST') {
    const n = await notify(store, [me.id], null, { title: troop.shortName || 'Basecamp', body: 'Notifications are on for this phone. 👍', url: '#/more', tag: 'test' });
    return json({ ok: true, sent: n });
  }
  return null;
}

// Send to members' devices. category: 'messages' | 'boards' | 'news' | null (always).
export async function notify(store, memberIds, category, payload) {
  const want = memberIds ? new Set(memberIds) : null;
  const { blobs } = await store.list({ prefix: 'push/' });
  const targets = blobs.map(b => b.key).filter(k => !want || want.has(k.split('/')[1]));
  if (!targets.length) return 0;
  const k = await keys(store);
  const opts = { vapidDetails: { subject: 'mailto:basecamp@troop23.invalid', publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 * 60 * 24, urgency: 'normal' };
  const data = JSON.stringify({ title: payload.title, body: String(payload.body || '').slice(0, 180), url: payload.url || '#/', tag: payload.tag || '' });
  let sent = 0;
  for (let i = 0; i < targets.length; i += 20) {
    await Promise.allSettled(targets.slice(i, i + 20).map(async key => {
      const d = await store.get(key, { type: 'json' });
      if (!d || (category && d.prefs?.[category] === false)) return;
      try { await webpush.sendNotification(d.sub, data, opts); sent++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await store.delete(key); else console.error('push failed', e.statusCode || e.message); }
    }));
  }
  return sent;
}
