// Campsite explorer: troop favorites. Each signed-in member picks up to 5 places they'd like to camp;
// everyone sees the counts, and signed-in members see who picked what (first name, last initial).
//   explore/v/{memberId}   { ids: [...], at }
import { CAMPSITES } from '../../troop/campsites.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const IDS = new Set(CAMPSITES.map(c => c.id));
export const MAX_PICKS = 5;
const PLC_RX = /senior patrol|\bspl\b|\baspl\b|patrol leader|troop guide|scribe/i;
const short = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0] || ''; };

export async function exploreRoutes(store, rest, req, body, now, { me, isLeader, people }) {
  const leader = !!(isLeader || me?.leader);
  const canPlan = leader || (!!me && me.role === 'scout' && PLC_RX.test((me.positions || []).join(', ')));
  const byId = new Map((people?.members || []).map(m => [m.id, m]));
  const all = async () => {
    const { blobs } = await store.list({ prefix: 'explore/v/' });
    return Promise.all(blobs.map(async b => ({ mid: b.key.split('/').pop(), ...(await store.get(b.key, { type: 'json' })) })));
  };
  const view = async () => {
    const votes = await all();
    const counts = {}, who = {};
    for (const v of votes) {
      const m = byId.get(v.mid);
      if (!m || m.active === false) continue;          // people no longer on the roster don't count
      for (const id of (v.ids || []).filter(x => IDS.has(x))) {
        counts[id] = (counts[id] || 0) + 1;
        (who[id] ||= []).push({ name: short(m.name), scout: m.role === 'scout', patrol: m.patrol || '' });
      }
    }
    const mine = me ? (votes.find(v => v.mid === me.id)?.ids || []).filter(x => IDS.has(x)) : [];
    // guests on the troop code see counts only
    return json({ counts, who: me || leader ? who : {}, mine, max: MAX_PICKS, canPick: !!me, canPlan });
  };
  if (!rest[0] && req.method === 'GET') return view();
  if (rest[0] === 'pick' && req.method === 'POST') {
    if (!me) return err('Sign in with your personal code to pick favorites.', isLeader ? 403 : 401);
    const id = String(body.id || '');
    if (!IDS.has(id)) return err('That place isn\'t in the explorer.');
    const key = `explore/v/${me.id}`;
    const cur = ((await store.get(key, { type: 'json' }))?.ids || []).filter(x => IDS.has(x) && x !== id);
    if (body.on) {
      if (cur.length >= MAX_PICKS) return err(`You can pick ${MAX_PICKS} favorites. Take one off first.`, 409);
      cur.push(id);
    }
    await store.setJSON(key, { ids: cur, at: now });
    return view();
  }
  return err('Not found', 404);
}
