// Basecamp Games: scoring, XP and levels, the Daily Challenge, troop
// leaderboards, and Campfire Clash (live multiplayer quiz rooms).
//
// Answers are always checked here against troop/quiz.js, so scores can't be
// made up on the phone. Live rooms use short polling: each phone asks for the
// room state about once a second (no special servers needed).
import { QUESTIONS, byId, LEVELS, BADGES, TOPICS, isRight } from '../../troop/quiz.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const dayOf = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(t);
const weekOf = t => { const d = new Date(`${dayOf(t)}T12:00:00Z`); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };   // Monday
export const levelOf = xp => { let l = 0; LEVELS.forEach((x, i) => { if (xp >= x.xp) l = i; }); return { n: l + 1, name: LEVELS[l].name, at: LEVELS[l].xp, next: LEVELS[l + 1]?.xp ?? null }; };

// a small seeded shuffle, so a day's challenge or a live room is the same for everyone
function rng(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function dailyIds(day) {
  const r = rng(`daily-${day}`);
  const pool = QUESTIONS.filter(q => q.type === 'mc' || q.type === 'tf');
  const topics = shuffle(TOPICS.map(t => t.id), r).slice(0, 5);
  return topics.map(t => { const p = pool.filter(q => q.t === t); return p[Math.floor(r() * p.length)].id; });
}

async function stats(store, id) {
  return (await store.get(`quiz/stats/${id}`, { type: 'json' })) || { id, xp: 0, games: 0, right: 0, total: 0, bestStreak: 0, topics: {}, weeks: {}, daily: { last: '', streak: 0, best: 0 }, badges: [], law: false };
}
function award(s, list) { for (const b of list) if (!s.badges.includes(b)) s.badges.push(b); }

// ------------------------------------------------------------------ routes
export async function quizRoutes(store, rest, req, body, now, ctx) {
  const { me } = ctx;
  const [what, code, act] = rest;

  // public: the question bank is in the app already; this just says what today's challenge is
  if (what === 'daily' && req.method === 'GET') {
    const day = dayOf(now);
    const done = me ? await store.get(`quiz/daily/${day}/${me.id}`, { type: 'json' }) : null;
    return json({ day, ids: dailyIds(day), done });
  }

  if (!me) return err('Sign in with your personal code to save scores and play together.', 401);

  // ---- finished a game: check every answer, add XP, badges, streaks
  if (what === 'result' && req.method === 'POST') {
    const mode = ['trail', 'speed', 'puzzle', 'daily'].includes(body.mode) ? body.mode : 'trail';
    const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, 60).filter(x => byId[x?.id]);
    if (!answers.length) return err('No answers to score.');
    const day = dayOf(now);
    if (mode === 'daily') {
      const ids = dailyIds(day);
      if (answers.some(x => !ids.includes(x.id))) return err('That isn\'t today\'s challenge.');
      if (await store.get(`quiz/daily/${day}/${me.id}`, { type: 'json' })) return err('You already did today\'s challenge. Come back tomorrow!', 409);
    }
    let right = 0, streak = 0, best = 0, points = 0;
    const checked = answers.map(x => {
      const q = byId[x.id], ok = isRight(q, x.a);
      if (ok) { right++; streak++; best = Math.max(best, streak); points += mode === 'speed' ? 50 : q.type === 'mc' || q.type === 'tf' ? 100 : 150; if (streak >= 3) points += 25; }
      else streak = 0;
      return { id: x.id, ok };
    });
    if (mode === 'daily') points = right * 120 + (right === answers.length ? 200 : 0);
    const s = await stats(store, me.id);
    s.xp += points; s.games++; s.right += right; s.total += answers.length; s.bestStreak = Math.max(s.bestStreak, best);
    const wk = weekOf(now); s.weeks[wk] = (s.weeks[wk] || 0) + points;
    for (const k of Object.keys(s.weeks)) if (k < weekOf(now - 70 * 86400000)) delete s.weeks[k];
    for (const c of checked) { const t = byId[c.id].t; const tt = s.topics[t] || (s.topics[t] = { r: 0, n: 0 }); tt.n++; if (c.ok) tt.r++; }
    const earned = ['first-game'];
    if (mode === 'trail' && right === answers.length && answers.length >= 5) earned.push('perfect');
    if (best >= 5) earned.push('streak5');
    if (checked.some(c => c.id === 'sp4' && c.ok)) earned.push('law');
    if ((s.topics.knots?.r || 0) >= 20) earned.push('knots');
    if ((s.topics.firstaid?.r || 0) >= 20) earned.push('firstaid');
    if (TOPICS.every(t => s.topics[t.id])) earned.push('all-topics');
    if (mode === 'speed' && right >= 20) earned.push('speed20');
    if (mode === 'daily') {
      const yesterday = dayOf(now - 86400000);
      s.daily.streak = s.daily.last === yesterday ? s.daily.streak + 1 : 1; s.daily.last = day; s.daily.best = Math.max(s.daily.best, s.daily.streak);
      if (s.daily.streak >= 3) earned.push('daily3');
      await store.setJSON(`quiz/daily/${day}/${me.id}`, { id: me.id, name: me.name, patrol: me.patrol || '', right, of: answers.length, points, at: now, secs: Math.max(0, Math.min(3600, Number(body.secs) || 0)) });
    }
    const before = new Set(s.badges);
    award(s, earned);
    s.name = me.name; s.patrol = me.patrol || ''; s.role = me.role; s.updated = now;
    await store.setJSON(`quiz/stats/${me.id}`, s);
    return json({ right, of: answers.length, points, bestStreak: best, checked, xp: s.xp, level: levelOf(s.xp), newBadges: s.badges.filter(b => !before.has(b)), daily: s.daily });
  }

  if (what === 'me' && req.method === 'GET') {
    const s = await stats(store, me.id);
    return json({ ...s, level: levelOf(s.xp), week: s.weeks[weekOf(now)] || 0, badgeList: BADGES });
  }

  // ---- leaderboards: this week's XP, all-time XP, and today's challenge
  if (what === 'board' && req.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'quiz/stats/' });
    const all = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    const wk = weekOf(now);
    const row = s => ({ id: s.id, name: s.name, patrol: s.patrol, level: levelOf(s.xp).n });
    const week = all.map(s => ({ ...row(s), xp: s.weeks?.[wk] || 0 })).filter(x => x.xp).sort((a, b) => b.xp - a.xp).slice(0, 25);
    const ever = all.map(s => ({ ...row(s), xp: s.xp })).filter(x => x.xp).sort((a, b) => b.xp - a.xp).slice(0, 25);
    const { blobs: d } = await store.list({ prefix: `quiz/daily/${dayOf(now)}/` });
    const today = (await Promise.all(d.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean).sort((a, b) => b.right - a.right || a.secs - b.secs).slice(0, 25);
    const patrols = Object.values(all.reduce((acc, s) => { if (!s.patrol || !s.weeks?.[wk]) return acc; const p = acc[s.patrol] ||= { patrol: s.patrol, xp: 0, players: 0 }; p.xp += s.weeks[wk]; p.players++; return acc; }, {})).sort((a, b) => b.xp - a.xp);
    return json({ week, ever, today, patrols, weekOf: wk });
  }

  if (what === 'live') return liveRoutes(store, code, act, req, body, now, me);
  return err('Not found', 404);
}

// ------------------------------------------------------------------ Campfire Clash
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const QSECS = 20;
const shapeQ = (q, order) => ({ id: q.id, q: q.q, type: q.type, c: q.type === 'tf' ? ['True', 'False'] : order.map(i => q.c[i]), t: q.t });

async function liveRoutes(store, code, act, req, body, now, me) {
  // create a room
  if (!code && req.method === 'POST') {
    const topic = clean(body.topic, 20), rank = clean(body.rank, 20);
    const count = Math.max(3, Math.min(20, Number(body.count) || 10));
    const pool = QUESTIONS.filter(q => (q.type === 'mc' || q.type === 'tf') && (!topic || q.t === topic) && (!rank || q.r === rank));
    if (pool.length < 3) return err('Not enough questions for that mix. Pick a different topic or rank.');
    let c = ''; for (let i = 0; i < 6; i++) { c = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); if (!await store.get(`live/${c}`, { type: 'json' })) break; }
    const r = rng(`${c}-${now}`);
    const qs = shuffle(pool, r).slice(0, count);
    const room = {
      code: c, host: me.id, hostName: me.name, topic, rank, teams: !!body.teams, status: 'lobby', qi: -1, qAt: 0, secs: QSECS,
      qids: qs.map(q => q.id), orders: qs.map(q => (q.type === 'mc' ? shuffle(q.c.map((_, i) => i), r) : [0, 1])), scores: {}, last: null, created: now, updated: now,
    };
    await store.setJSON(`live/${c}`, room);
    if (body.play) await store.setJSON(`live/${c}/p/${me.id}`, { id: me.id, name: me.name, patrol: me.patrol || '', at: now });
    return json({ code: c });
  }
  const c = clean(code, 6).toUpperCase();
  const room = await store.get(`live/${c}`, { type: 'json' });
  if (!room) return err('No game with that code. Check the code on the host\'s screen.', 404);
  const isHost = room.host === me.id;
  const save = async () => { room.updated = now; await store.setJSON(`live/${c}`, room); };

  if (act === 'join' && req.method === 'POST') {
    if (room.status === 'done') return err('That game has ended.', 409);
    if (body.leave) { await store.delete(`live/${c}/p/${me.id}`); return json({ ok: true }); }
    await store.setJSON(`live/${c}/p/${me.id}`, { id: me.id, name: me.name, patrol: me.patrol || '', at: now });
    return json({ ok: true });
  }
  if (act === 'answer' && req.method === 'POST') {
    if (room.status !== 'question' || Number(body.qi) !== room.qi) return err('Too late for that one!', 409);
    if (now - room.qAt > (room.secs + 2) * 1000) return err('Time\'s up!', 409);
    if (!await store.get(`live/${c}/p/${me.id}`, { type: 'json' })) return err('Join the game first.', 403);
    const k = `live/${c}/a/${room.qi}/${me.id}`;
    if (await store.get(k, { type: 'json' })) return json({ ok: true, already: true });
    const shown = Number(body.choice);
    const q = byId[room.qids[room.qi]];
    const orig = q.type === 'tf' ? shown === 0 : room.orders[room.qi][shown];
    await store.setJSON(k, { id: me.id, shown, ok: isRight(q, orig), ms: Math.max(0, now - room.qAt) });
    return json({ ok: true });
  }
  if (act && ['start', 'reveal', 'next', 'end'].includes(act) && req.method === 'POST') {
    if (!isHost) return err('Only the host can run the game.', 403);
    if (act === 'start' || act === 'next') {
      if (act === 'next' && room.status !== 'reveal') return json({ ok: true });
      if (room.qi + 1 >= room.qids.length) { room.status = 'done'; await finish(store, c, room, now); }
      else { room.qi++; room.status = 'question'; room.qAt = now; }
      await save(); return json({ ok: true });
    }
    if (act === 'reveal' && room.status === 'question') {
      const { blobs } = await store.list({ prefix: `live/${c}/a/${room.qi}/` });
      const ans = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
      const dist = [0, 0, 0, 0];
      const gained = {};
      for (const a of ans) {
        dist[a.shown] = (dist[a.shown] || 0) + 1;
        if (a.ok) { const pts = Math.round(500 + 500 * Math.max(0, 1 - a.ms / (room.secs * 1000))); gained[a.id] = pts; room.scores[a.id] = (room.scores[a.id] || 0) + pts; }
      }
      const q = byId[room.qids[room.qi]];
      room.last = { qi: room.qi, correct: q.type === 'tf' ? (q.a ? 0 : 1) : room.orders[room.qi].indexOf(q.a), dist, gained, answered: ans.length, why: q.why };
      room.status = 'reveal'; await save(); return json({ ok: true });
    }
    if (act === 'end') { room.status = 'done'; await finish(store, c, room, now); await save(); return json({ ok: true }); }
    return json({ ok: true });
  }
  if (!act && req.method === 'GET') {
    const { blobs } = await store.list({ prefix: `live/${c}/p/` });
    const players = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    const inRoom = players.some(p => p.id === me.id);
    const board = players.map(p => ({ id: p.id, name: p.name, patrol: p.patrol, score: room.scores[p.id] || 0 })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const teams = room.teams ? Object.values(board.reduce((acc, p) => { const k = p.patrol || 'No patrol'; const t = acc[k] ||= { patrol: k, score: 0, players: 0 }; t.score += p.score; t.players++; return acc; }, {})).map(t => ({ ...t, avg: Math.round(t.score / t.players) })).sort((a, b) => b.avg - a.avg) : null;
    const out = { code: c, status: room.status, host: room.host, hostName: room.hostName, isHost, inRoom, topic: room.topic, rank: room.rank, teams: room.teams, count: room.qids.length, qi: room.qi, secs: room.secs, players: board, teamBoard: teams, now };
    if (room.status === 'question' || room.status === 'reveal') {
      const q = byId[room.qids[room.qi]];
      out.question = shapeQ(q, room.orders[room.qi]);
      out.endsAt = room.qAt + room.secs * 1000;
      const { blobs: ab } = await store.list({ prefix: `live/${c}/a/${room.qi}/` });
      out.answered = ab.length;
      const mine = await store.get(`live/${c}/a/${room.qi}/${me.id}`, { type: 'json' });
      out.myChoice = mine ? mine.shown : null;
      if (room.status === 'reveal') out.reveal = { ...room.last, mine: room.last.gained[me.id] || 0 };
    }
    return json(out);
  }
  return err('Not found', 404);
}

// end of a live game: XP for everyone who played, a badge for the winner
async function finish(store, c, room, now) {
  if (room.finished) return;
  room.finished = true;
  const { blobs } = await store.list({ prefix: `live/${c}/p/` });
  const people = Object.fromEntries((await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean).map(p => [p.id, p]));
  const ids = Object.keys(room.scores);
  const top = ids.sort((a, b) => room.scores[b] - room.scores[a])[0];
  const wk = weekOf(now);
  for (const id of ids) {
    const s = await stats(store, id);
    const xp = Math.round(room.scores[id] / 10);
    s.xp += xp; s.games++; s.weeks[wk] = (s.weeks[wk] || 0) + xp;
    if (id === top && ids.length > 1) award(s, ['live-win']);
    if (people[id]) { s.name = people[id].name; s.patrol = people[id].patrol; }
    award(s, ['first-game']);
    s.updated = now;
    await store.setJSON(`quiz/stats/${id}`, s);
  }
}
