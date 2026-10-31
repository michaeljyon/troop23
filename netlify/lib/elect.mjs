// Troop elections. Leaders set up positions and candidates; scouts vote once per
// position on their phone; a TV screen shows turnout and (if leaders want) live results.
//
// Ballots are secret: a vote is stored under the voter's id only so nobody votes twice.
// The API never says who voted for whom — only counts, and who has voted (for turnout).
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const ID = /^el-[a-z0-9]+$/;

const scoutsOf = people => people.members.filter(m => m.active !== false && m.role === 'scout');
const eligible = (pos, m) => m.role === 'scout' && m.active !== false && (!pos.patrol || m.patrol === pos.patrol);

async function load(store, id) { return ID.test(id || '') ? store.get(`elect/e/${id}`, { type: 'json' }) : null; }
async function votesFor(store, id) {
  const { blobs } = await store.list({ prefix: `elect/v/${id}/` });
  return (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);   // [{ voter, votes: {posId: candId} }]
}

// what one person sees of an election
function view(e, ballots, people, me, isLeader) {
  const scouts = scoutsOf(people);
  const name = id => people.members.find(m => m.id === id)?.name || 'Former member';
  const voted = new Set(ballots.map(b => b.voter));
  const showCounts = isLeader || e.status === 'closed' || (e.status === 'open' && e.live);
  const positions = e.positions.map(p => {
    const voters = scouts.filter(m => eligible(p, m));
    const counts = Object.fromEntries(p.candidates.map(c => [c, 0]));
    let cast = 0;
    for (const b of ballots) { const c = b.votes[p.id]; if (c && c in counts) { counts[c]++; cast++; } }
    const top = Math.max(0, ...Object.values(counts));
    return {
      id: p.id, title: p.title, patrol: p.patrol || '', eligibleCount: voters.length, cast,
      candidates: p.candidates.map(c => ({ id: c, name: name(c), votes: showCounts ? counts[c] : null, leading: showCounts && top > 0 && counts[c] === top })),
      canVote: !!me && eligible(p, me) && e.status === 'open' && !voted.has(me.id),
    };
  });
  const voterIds = new Set(scouts.filter(m => e.positions.some(p => eligible(p, m))).map(m => m.id));
  return {
    id: e.id, title: e.title, status: e.status, live: !!e.live, created: e.created, opened: e.opened || 0, closed: e.closed || 0,
    positions, turnout: { voted: [...voted].filter(v => voterIds.has(v)).length, of: voterIds.size },
    iVoted: !!me && voted.has(me.id), canVote: positions.some(p => p.canVote), showCounts, isLeader: !!isLeader,
    // leaders see who has voted (never how), for turnout and voting on the leader's phone
    voters: isLeader ? scouts.filter(m => voterIds.has(m.id)).map(m => ({ id: m.id, name: m.name, first: m.first, patrol: m.patrol || '', voted: voted.has(m.id) })).sort((a, b) => a.name.localeCompare(b.name)) : undefined,
  };
}

export async function electRoutes(store, rest, req, body, now, ctx) {
  const { me, people } = ctx;
  const isLeader = !!(ctx.isLeader || me?.leader);
  if (!me && !ctx.isLeader) return err('Sign in with your personal code to see troop elections.', 401);
  const [id, act] = rest;

  if (!id && req.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'elect/e/' });
    const list = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean).filter(e => isLeader || e.status !== 'draft').sort((a, b) => b.created - a.created);
    const out = [];
    for (const e of list.slice(0, 20)) out.push(view(e, await votesFor(store, e.id), people, me, isLeader));
    return json({ elections: out, isLeader, scouts: isLeader ? scoutsOf(people).map(m => ({ id: m.id, name: m.name, patrol: m.patrol || '', positions: m.positions || [] })).sort((a, b) => a.name.localeCompare(b.name)) : undefined });
  }

  // leaders: create or edit
  if ((!id && req.method === 'POST') || (id && !act && req.method === 'PUT')) {
    if (!isLeader) return err('Only leaders can set up elections.', 403);
    const prev = id ? await load(store, id) : null;
    if (id && !prev) return err('Election not found.', 404);
    const scoutIds = new Set(scoutsOf(people).map(m => m.id));
    const positions = (Array.isArray(body.positions) ? body.positions : []).slice(0, 30).map(p => ({
      id: /^p-[a-z0-9]+$/.test(p?.id || '') ? p.id : `p-${rid()}`,
      title: clean(p?.title, 60), patrol: clean(p?.patrol, 60),
      candidates: [...new Set((Array.isArray(p?.candidates) ? p.candidates : []).filter(c => scoutIds.has(c)))].slice(0, 12),
    })).filter(p => p.title);
    if (!positions.length) return err('Add at least one position.');
    if (prev && prev.status !== 'draft') {
      const voted = (await votesFor(store, id)).length;
      if (voted) return err('Voting has started, so the ballot can\'t change. Close this election and start a new one if something is wrong.', 409);
    }
    const e = { ...(prev || { id: `el-${rid()}`, status: 'draft', created: now, by: me?.name || 'Leader' }), title: clean(body.title, 80) || 'Troop elections', positions, live: body.live !== false, updated: now };
    await store.setJSON(`elect/e/${e.id}`, e);
    return json({ ok: true, election: view(e, [], people, me, isLeader) });
  }

  const e = await load(store, id);
  if (!e || (e.status === 'draft' && !isLeader)) return err('Election not found.', 404);

  if (!act && req.method === 'GET') return json({ election: view(e, await votesFor(store, e.id), people, me, isLeader), now });

  if (act === 'vote' && req.method === 'POST') {
    // a leader can hand their phone to a scout who has no phone: body.for = that scout
    let voter = me;
    if (body.for) {
      if (!isLeader) return err('Only leaders can take votes on their phone.', 403);
      voter = people.members.find(m => m.id === body.for && m.active !== false);
      if (!voter) return err('That scout isn\'t on the roster.', 404);
    }
    if (!voter || voter.role !== 'scout') return err('Only scouts vote in troop elections.', 403);
    if (e.status !== 'open') return err(e.status === 'closed' ? 'Voting has closed.' : 'Voting hasn\'t opened yet.', 409);
    const key = `elect/v/${e.id}/${voter.id}`;
    if (await store.get(key, { type: 'json' })) return err(body.for ? `${voter.first || voter.name} already voted.` : 'You already voted. Thanks!', 409);
    const votes = {};
    for (const p of e.positions) {
      const c = body.votes?.[p.id];
      if (!c) continue;
      if (!eligible(p, voter)) return err(`Only the ${p.patrol} patrol votes for ${p.title}.`, 403);
      if (!p.candidates.includes(c)) return err('That person isn\'t on the ballot.');
      votes[p.id] = c;
    }
    if (!Object.keys(votes).length) return err('Pick someone for at least one position.');
    await store.setJSON(key, { voter: voter.id, votes, at: now, ...(body.for ? { via: me?.id || 'leader' } : {}) });
    return json({ ok: true });
  }

  if (['open', 'close', 'reopen', 'live'].includes(act) && req.method === 'POST') {
    if (!isLeader) return err('Only leaders can run the election.', 403);
    const empty = e.positions.find(p => !p.candidates.length);
    if ((act === 'open' || act === 'reopen') && empty) return err(`Add at least one candidate for ${empty.title}${empty.patrol ? ` (${empty.patrol})` : ''}, or take it off the ballot, before opening voting.`);
    if (act === 'open' || act === 'reopen') { e.status = 'open'; e.opened ||= now; e.closed = 0; }
    if (act === 'close') { e.status = 'closed'; e.closed = now; }
    if (act === 'live') e.live = !!body.live;
    e.updated = now;
    await store.setJSON(`elect/e/${e.id}`, e);
    return json({ ok: true, election: view(e, await votesFor(store, e.id), people, me, isLeader) });
  }

  if (!act && req.method === 'DELETE') {
    if (!isLeader) return err('Only leaders can delete an election.', 403);
    const { blobs } = await store.list({ prefix: `elect/v/${e.id}/` });
    await Promise.all(blobs.map(b => store.delete(b.key)));
    await store.delete(`elect/e/${e.id}`);
    return json({ ok: true });
  }
  return err('Not found', 404);
}
