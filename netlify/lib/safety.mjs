// Outing safety and logistics: two-deep check, emergency card, weather (National Weather Service),
// carpools and permission slips.
//   emerg/{outingId}            emergency card
//   carpool/{outingId}          drivers and riders
//   slip/{outingId}/cfg         permission slip settings; slip/{outingId}/s/{scoutId} a parent's signature
//   wx/{lat}_{lng}              cached forecast (30 minutes)

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

export async function safetyRoutes(store, head, rest, req, body, now, { me, isLeader, people, colItems, url, settings }) {
  const leader = !!(isLeader || me?.leader);
  const members = people?.members || [];
  const byId = new Map(members.map(m => [m.id, m]));
  const outing = async oid => (/^[\w-]{1,40}$/.test(oid || '') ? (await colItems(store, 'outings')).find(o => o.id === oid) : null);
  const going = async oid => (await colItems(store, 'rsvps')).filter(r => r.outingId === oid && r.status === 'yes');

  // ---------------------------------------------------------------- weather
  if (head === 'weather' && req.method === 'GET') {
    const lat = Number(url.searchParams.get('lat')), lng = Number(url.searchParams.get('lng'));
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return err('Need a location.');
    const key = `wx/${lat.toFixed(2)}_${lng.toFixed(2)}`;
    const cached = await store.get(key, { type: 'json' });
    if (cached && now - cached.at < 30 * 60000) return json(cached);
    const H = { 'User-Agent': '(Troop Basecamp, troop app)', Accept: 'application/geo+json' };
    try {
      const pt = await (await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: H })).json();
      if (!pt?.properties?.forecast) throw new Error('No forecast for this spot. The Weather Service only covers the U.S.');
      const [fc, al] = await Promise.all([fetch(pt.properties.forecast, { headers: H }).then(r => r.json()), fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: H }).then(r => r.json()).catch(() => ({ features: [] }))]);
      const out = {
        at: now, place: [pt.properties.relativeLocation?.properties?.city, pt.properties.relativeLocation?.properties?.state].filter(Boolean).join(', '),
        periods: (fc.properties?.periods || []).slice(0, 14).map(p => ({ name: p.name, start: p.startTime, day: p.isDaytime, temp: p.temperature, unit: p.temperatureUnit, rain: p.probabilityOfPrecipitation?.value ?? null, wind: p.windSpeed, short: p.shortForecast, detail: p.detailedForecast })),
        alerts: (al.features || []).slice(0, 5).map(a => ({ event: a.properties.event, headline: a.properties.headline, severity: a.properties.severity, ends: a.properties.ends || a.properties.expires })),
      };
      await store.setJSON(key, out);
      return json(out);
    } catch (e) {
      if (cached) return json({ ...cached, stale: true });
      return err(`The weather forecast isn't available right now. ${e.message || ''}`.trim(), 502);
    }
  }

  const [oid, sub, x] = rest;
  const o = await outing(oid);
  if (!o) return err('Outing not found.', 404);

  // ---------------------------------------------------------------- two-deep + emergency card
  if (head === 'outsafe') {
    if (req.method === 'GET') {
      const g = await going(oid);
      const leaders = g.filter(r => byId.get(r.memberId)?.leader);
      const adults = g.filter(r => r.role !== 'scout');
      const scouts = g.filter(r => r.role === 'scout');
      const card = (await store.get(`emerg/${oid}`, { type: 'json' })) || {};
      return json({ twoDeep: { leaders: leaders.length, leaderNames: leaders.map(r => r.name), adults: adults.length, scouts: scouts.length, ok: leaders.length >= 2 || scouts.length === 0 }, card, canEdit: leader });
    }
    if (req.method === 'PUT') {
      if (!leader) return err('Leaders fill in the emergency card.', 403);
      const card = {};
      for (const [k, n] of [['hospital', 100], ['hospitalAddress', 200], ['hospitalPhone', 30], ['ranger', 100], ['rangerPhone', 30], ['rally', 200], ['plan', 1500], ['cell', 200]]) card[k] = clean(body[k], n);
      card.updated = now; card.by = me?.name || 'Leader';
      await store.setJSON(`emerg/${oid}`, card);
      return json({ ok: true, card });
    }
  }

  // ---------------------------------------------------------------- carpools
  if (head === 'carpool') {
    const key = `carpool/${oid}`;
    const cp = (await store.get(key, { type: 'json' })) || { drivers: [] };
    const myKids = new Set(me?.scouts || []);
    const view = () => json({ drivers: cp.drivers, me: me?.id || '', myRiders: me ? [me.id, ...(me.scouts || [])].map(id => ({ id, name: byId.get(id)?.name || me.name, scout: byId.get(id)?.role === 'scout' })) : [], kidsOf: me ? { [me.id]: [...myKids] } : {}, isLeader: leader, canDrive: !!me && me.role !== 'scout' });
    if (!me && !leader) return err('Sign in with your personal code to see carpools.', 401);
    if (req.method === 'GET') return view();
    if (!me && !leader) return err('Sign in with your personal code to sign up for rides.', 401);
    const op = body.op;
    if (op === 'drive') {
      if (!me || me.role === 'scout') return err('Only adults can offer to drive.', 403);
      const seats = Math.max(1, Math.min(14, Math.round(Number(body.seats) || 0)));
      let d = cp.drivers.find(v => v.by === me.id);
      if (!d) { d = { id: `d-${rid()}`, by: me.id, name: me.name, riders: [] }; cp.drivers.push(d); }
      Object.assign(d, { seats, leg: ['both', 'to', 'from'].includes(body.leg) ? body.leg : 'both', leave: clean(body.leave, 60), note: clean(body.note, 140), kids: (me.scouts || []).slice(0, 10) });
    } else if (op === 'stop') {
      const d = cp.drivers.find(v => v.id === body.driverId);
      if (!d) return err('Not found', 404);
      if (!(leader || d.by === me?.id)) return err('Only the driver or a leader can take this car off.', 403);
      cp.drivers = cp.drivers.filter(v => v !== d);
    } else if (op === 'ride' || op === 'unride') {
      const d = cp.drivers.find(v => v.id === body.driverId);
      if (!d) return err('That ride isn\'t offered anymore.', 404);
      const rider = byId.get(body.riderId);
      if (!rider) return err('Pick who is riding.');
      const mine = me && (rider.id === me.id || myKids.has(rider.id));
      if (!(leader || mine || (op === 'unride' && d.by === me?.id))) return err('You can sign up yourself or your own scouts.', 403);
      const leg = ['both', 'to', 'from'].includes(body.leg) ? body.leg : d.leg;
      d.riders = d.riders.filter(r => r.id !== rider.id);
      if (op === 'ride') {
        const legs = leg === 'both' ? ['to', 'from'] : [leg];
        for (const l of legs) { const used = d.riders.filter(r => r.leg === 'both' || r.leg === l).length; if (used >= d.seats) return err(`That car is full ${l === 'to' ? 'going' : 'coming home'}.`, 409); }
        if (d.leg !== 'both' && leg !== d.leg) return err(`This car only goes ${d.leg === 'to' ? 'there' : 'home'}.`);
        d.riders.push({ id: rider.id, name: rider.name, scout: rider.role === 'scout', leg, by: me?.id || 'leader' });
      }
    } else return err('Unknown action.');
    cp.updated = now;
    await store.setJSON(key, cp);
    return view();
  }

  // ---------------------------------------------------------------- permission slips
  if (head === 'slip') {
    const cfgKey = `slip/${oid}/cfg`;
    const cfg = (await store.get(cfgKey, { type: 'json' })) || { on: false, text: '', due: '' };
    if (!sub && req.method === 'GET') {
      const { blobs } = await store.list({ prefix: `slip/${oid}/s/` });
      const sigs = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
      const mine = (me?.scouts || []).map(id => ({ id, name: byId.get(id)?.name || '', signed: sigs.find(s => s.scoutId === id) || null }));
      let roster = null;
      if (leader) {
        const g = (await going(oid)).filter(r => r.role === 'scout');
        roster = g.map(r => ({ id: r.memberId, name: r.name, patrol: r.patrol || '', signed: sigs.find(s => s.scoutId === r.memberId) || null }));
        for (const s of sigs) if (!roster.some(r => r.id === s.scoutId)) roster.push({ id: s.scoutId, name: s.scoutName, patrol: '', signed: s, notGoing: true });
      }
      return json({ cfg, mine, roster, isLeader: leader, defaultText: defaultSlip(o, settings) });
    }
    if (sub === 'cfg' && req.method === 'PUT') {
      if (!leader) return err('Leaders set up permission slips.', 403);
      const next = { on: !!body.on, text: clean(body.text, 3000), due: isDate(body.due) ? body.due : '', by: me?.name || 'Leader', at: now };
      await store.setJSON(cfgKey, next);
      return json({ ok: true, cfg: next });
    }
    if (sub === 'sign' && req.method === 'POST') {
      if (!cfg.on) return err('This outing doesn\'t need a permission slip.', 409);
      const scout = byId.get(body.scoutId);
      if (!scout || scout.role !== 'scout') return err('Pick your scout.');
      const isParent = !!me && (me.scouts || []).includes(scout.id);
      if (!isParent && !leader) return err('A parent or guardian signs for their own scout.', 403);
      if (body.paper && !leader) return err('Only leaders record paper forms.', 403);
      if (!body.paper && (!body.agree || clean(body.typed, 80).length < 3)) return err('Check the box and type your full name to sign.');
      const s = { scoutId: scout.id, scoutName: scout.name, by: me?.id || 'leader', byName: me?.name || 'Leader', typed: body.paper ? '' : clean(body.typed, 80), paper: !!body.paper, at: now, textAt: cfg.at || 0 };
      await store.setJSON(`slip/${oid}/s/${scout.id}`, s);
      return json({ ok: true, signed: s });
    }
    if (sub === 'sign' && req.method === 'DELETE') {
      const id = clean(x, 40);
      const s = await store.get(`slip/${oid}/s/${id}`, { type: 'json' });
      if (!s) return err('Not found', 404);
      if (!(leader || s.by === me?.id)) return err('Only the parent who signed or a leader can undo this.', 403);
      await store.delete(`slip/${oid}/s/${id}`);
      return json({ ok: true });
    }
  }
  return err('Not found', 404);
}

export function defaultSlip(o, settings) {
  const when = o.start ? `${o.start}${o.end && o.end !== o.start ? ` to ${o.end}` : ''}` : '';
  return `I give permission for my scout to take part in "${o.title}"${when ? ` (${when})` : ''}${o.location ? ` at ${o.location}` : ''} with ${settings?.unit || 'the troop'}, including travel to and from the activity with adult drivers arranged by the troop. My scout's Annual Health and Medical Record is current and on file with the troop. I understand the troop will try to reach me before any emergency treatment, and I agree to emergency treatment if I can't be reached.`;
}
