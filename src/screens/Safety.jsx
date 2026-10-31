import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty } from '../components/ui.jsx';
import { api, useApi, useCol } from '../lib/api.js';
import { useLocal } from '../lib/store.js';
import { useFeatures } from '../lib/features.js';
import { GUIDE, POISON_CONTROL, CALLS } from '../../troop/fieldguide.js';
import { outingKind } from '../lib/outingKind.js';

// Outing safety: two-deep check, weather, the emergency card, the buddy board and the Florida field guide.

const coords = o => { const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(o?.mapQ || ''); return m ? { lat: +m[1], lng: +m[2] } : null; };
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function Safety({ route }) {
  if (route.name === 'buddy') return <BuddyBoard oid={route.query.outing} startMode={route.query.mode === 'count' ? 'count' : 'water'} />;
  if (route.name === 'field') return <FieldGuide id={route.args[0]} />;
  return <Emergency oid={route.args[0]} />;
}

// ---------------------------------------------------------------- on each outing's overview
export function OutingSafety({ outing }) {
  const F = useFeatures();
  const d = useApi(`outsafe/${outing.id}`);
  const td = d.data?.twoDeep;
  const upcoming = (outing.end || outing.start) >= todayISO();
  const kind = outingKind(outing);
  return (
    <Section title="Safety">
      {td && upcoming && td.scouts > 0 && (
        <div className={`card two-deep ${td.ok ? 'ok' : 'warn'}`}>
          <span className="td-ico" aria-hidden="true">{td.ok ? '✅' : '⚠️'}</span>
          <span className="grow"><b>{td.ok ? `Two-deep leadership: ${td.leaders} leaders going` : td.scouts === 0 ? 'No scouts signed up yet' : `Only ${td.leaders} leader${td.leaders === 1 ? '' : 's'} going`}</b>
            <span className="small">{td.ok ? td.leaderNames.join(', ') : 'Every activity needs at least two registered adult leaders 21 or older (and a registered female leader 21+ when girls attend). Basecamp counts members marked as leaders who said they\'re going, so check ages yourself.'}</span></span>
        </div>
      )}
      {upcoming && !kind.indoor && coords(outing) && <Weather where={coords(outing)} start={outing.start} end={outing.end || outing.start} overnight={kind.overnight} />}
      <div className="safety-links">
        <a className="card" href={`#/emergency/${outing.id}`}><span aria-hidden="true">🚑</span><b>Emergency card</b><span className="small muted">Nearest hospital, 911, plan</span></a>
        <a className="card" href={`#/buddy?outing=${outing.id}${kind.indoor || (!kind.overnight && outing.type !== 'paddle') ? '&mode=count' : ''}`}><span aria-hidden="true">👥</span><b>{kind.indoor ? 'Headcount' : 'Buddy board'}</b><span className="small muted">{kind.indoor ? 'Make sure everyone is here' : outing.type === 'paddle' || kind.overnight ? 'Waterfront and headcounts' : 'Buddies and headcounts'}</span></a>
        {F.safety && !kind.indoor && <a className="card" href="#/field"><span aria-hidden="true">🐍</span><b>Field guide</b><span className="small muted">Snakes, gators, lightning</span></a>}
      </div>
    </Section>
  );
}

export function Weather({ where, start, end, overnight = true }) {
  const days = Math.round((Date.parse(start) - Date.parse(todayISO())) / 864e5);
  const d = useApi(days <= 7 ? `weather?lat=${where.lat}&lng=${where.lng}` : null);
  if (days > 7) return <div className="card wx muted small"><span aria-hidden="true">🌤️</span> The forecast for the campsite shows up here a week before the outing.</div>;
  if (d.error) return <div className="card wx small muted">🌤️ {d.error.message}</div>;
  if (!d.data) return <div className="card wx small muted">🌤️ Getting the forecast…</div>;
  const ps = d.data.periods.filter(p => p.start.slice(0, 10) >= start && p.start.slice(0, 10) <= end);
  const show = ps.length ? ps : d.data.periods.slice(0, 4);
  const txt = show.map(p => `${p.short} ${p.detail}`).join(' ').toLowerCase();
  const tips = [];
  if (/thunder|t-storm/.test(txt)) tips.push('⚡ Storms possible: plan where everyone goes when thunder roars (a building or hard-topped cars, not tents).');
  if (show.some(p => p.temp >= 90)) tips.push('🥵 Hot: extra water, shade breaks and hats. Watch your buddy for heat illness.');
  if (show.some(p => p.temp <= 40)) tips.push(overnight ? '🥶 Cold nights: warm sleeping bag, a pad underneath, a hat to sleep in and dry socks.' : '🥶 Cold: dress in layers, with a warm hat and gloves.');
  if (show.some(p => (p.rain ?? 0) >= 50)) tips.push(overnight ? '🌧️ Rain likely: rain gear, a ground cloth inside the tent and a dry bag for clothes.' : '🌧️ Rain likely: rain gear and a dry change of socks.');
  return (
    <div className="card wx">
      <div className="wx-head"><b>Weather{d.data.place ? ` near ${d.data.place}` : ''}</b><span className="small muted">National Weather Service</span></div>
      {d.data.alerts.map((a, i) => <p key={i} className="wx-alert">⚠️ <b>{a.event}</b>: {a.headline}</p>)}
      <div className="wx-row">{show.slice(0, 6).map(p => <div key={p.start} className={`wx-p ${p.day ? '' : 'night'}`}><span className="wx-n">{p.name}</span><b>{p.temp}°</b><span className="wx-s">{p.short}</span>{p.rain != null && p.rain > 0 && <span className="wx-r">💧 {p.rain}%</span>}</div>)}</div>
      {tips.map(t => <p key={t} className="small wx-tip">{t}</p>)}
      {!ps.length && <p className="small muted">The outing is a few days out; this is the forecast starting now.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- emergency card
function Emergency({ oid }) {
  const o = useApi(`c/outings/${oid}`).data?.item;
  const d = useApi(`outsafe/${oid}`);
  const [cached, setCached] = useLocal(`emerg-${oid}`, null);
  const [edit, setEdit] = useState(false);
  const card = d.data?.card || cached?.card || {};
  useEffect(() => { if (d.data && o) setCached({ card: d.data.card, title: o.title, address: o.address, location: o.location, mapQ: o.mapQ }); }, [d.data, o]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = o || cached || {};
  const indoor = outingKind(info).indoor;
  const c = coords(info);
  const near = q => (c ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${c.lat},${c.lng},12z` : `https://www.google.com/maps/search/${encodeURIComponent(`${q} near ${info.address || info.location || ''}`)}`);
  return (
    <div className="content emerg">
      <PageHead backTo={`outing/${oid}`} eyebrow="🚑 Emergency card" title={info.title || 'Outing'} sub={info.location || ''}>
        {d.data?.canEdit && <button className="btn small secondary head-btn" onClick={() => setEdit(!edit)}><Icon name="edit" size={15} />{edit ? 'Done' : 'Edit'}</button>}
      </PageHead>
      <a className="btn big emerg-911" href="tel:911"><Icon name="phone" size={20} />Call 911</a>
      {edit ? <EditCard oid={oid} card={card} onSaved={() => { setEdit(false); d.refresh(); }} /> : (
        <>
          <div className="card emerg-list">
            <Row ico="📍" label="Where we are" val={info.address || info.location} link={info.address ? `https://www.google.com/maps/search/${encodeURIComponent(info.address)}` : null} />
            <Row ico="🏥" label="Nearest hospital" val={[card.hospital, card.hospitalAddress].filter(Boolean).join(' · ')} phone={card.hospitalPhone} link={card.hospitalAddress ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(card.hospitalAddress)}` : near('hospital')} linkLabel={card.hospitalAddress ? 'Directions' : 'Find the nearest hospital'} />
            <Row ico={indoor ? '🏢' : '🌲'} label={indoor ? 'Building contact' : 'Ranger or camp office'} val={card.ranger} phone={card.rangerPhone} />
            <Row ico="📣" label="Rally point" val={card.rally} />
            <Row ico="📶" label="Cell service" val={card.cell} />
            <Row ico="☠️" label="Poison Control" val="Free, any time" phone={POISON_CONTROL} />
          </div>
          {card.plan && <div className="card fire-how"><b>Our emergency plan</b><p className="pre">{card.plan}</p></div>}
          <div className="btn-row"><a className="btn secondary small" href={near('urgent care')} target="_blank" rel="noopener noreferrer">Urgent care nearby</a><a className="btn secondary small" href="#/field">🐍 Field guide</a></div>
          {!card.hospital && <p className="small muted">{d.data?.canEdit ? 'Tap Edit to add the nearest hospital, the ranger\'s number and your rally point before the trip.' : 'Your leaders can fill in the nearest hospital and the rally point.'}</p>}
          <p className="small muted">This card is saved on your phone after you open it once, so it works without signal.</p>
        </>
      )}
    </div>
  );
}
function Row({ ico, label, val, phone, link, linkLabel }) {
  return (
    <div className="er-row"><span className="er-ico" aria-hidden="true">{ico}</span><span className="grow"><span className="small muted">{label}</span><b>{val || '—'}</b>
      <span className="er-acts">{phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={14} />{phone}</a>}{link && <a href={link} target="_blank" rel="noopener noreferrer"><Icon name="map" size={14} />{linkLabel || 'Map'}</a>}</span></span></div>
  );
}
function EditCard({ oid, card, onSaved }) {
  const [f, setF] = useState({ hospital: '', hospitalAddress: '', hospitalPhone: '', ranger: '', rangerPhone: '', rally: '', cell: '', plan: '', ...card });
  const [msg, setMsg] = useState('');
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const F = (k, label, ph, ta) => <label className="field"><span>{label}</span>{ta ? <textarea rows={4} value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} /> : <input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />}</label>;
  return (
    <div className="card">
      {F('hospital', 'Nearest hospital', 'Calhoun Liberty Hospital')}{F('hospitalAddress', 'Hospital address', 'Street, city')}{F('hospitalPhone', 'Hospital phone', '850-555-0100')}
      {F('ranger', 'Ranger or camp office', 'Park office')}{F('rangerPhone', 'Ranger phone', '')}{F('rally', 'Rally point', 'The flagpole by the dining hall')}{F('cell', 'Cell service', 'Weak in camp; good at the parking lot')}
      {F('plan', 'Emergency plan', 'Who calls 911, who meets the ambulance, who stays with the scouts, how parents are contacted…', true)}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" onClick={async () => { try { await api(`outsafe/${oid}`, { method: 'PUT', body: f }); onSaved(); } catch (e) { setMsg(e.message); } }}>Save card</button>
    </div>
  );
}

// ---------------------------------------------------------------- buddy board (kept on this phone, works offline)
function BuddyBoard({ oid, startMode = 'water' }) {
  const rsvps = useCol('rsvps', oid ? { outing: oid } : { outing: '_none' });
  const going = rsvps.items.filter(r => r.status === 'yes').map(r => ({ id: r.memberId, name: r.name, scout: r.role === 'scout' }));
  const [b, setB] = useLocal(`buddy-${oid || 'any'}`, { mode: startMode, extra: [], pairs: [], here: {}, inWater: {}, last: 0, every: 10, check: null });
  const [now, setNow] = useState(Date.now());
  const [add, setAdd] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const people = [...going, ...b.extra];
  const name = id => people.find(p => p.id === id)?.name || '?';
  const set = patch => setB({ ...b, ...patch });
  const autopair = () => {
    const ids = people.filter(p => p.scout || b.mode === 'water').map(p => p.id).sort(() => Math.random() - 0.5);
    const pairs = []; for (let i = 0; i < ids.length; i += 2) pairs.push(ids.slice(i, i + 2));
    if (pairs.length > 1 && pairs[pairs.length - 1].length === 1) pairs[pairs.length - 2].push(pairs.pop()[0]);
    set({ pairs, check: null });
  };
  const since = b.last ? Math.floor((now - b.last) / 1000) : null;
  const due = since != null && since >= b.every * 60;
  useEffect(() => { if (due && navigator.vibrate) navigator.vibrate([300, 200, 300]); }, [due]);
  const startCheck = () => set({ check: { at: Date.now(), ok: [] } });
  const confirm = i => { const ok = [...new Set([...(b.check?.ok || []), i])]; set(ok.length >= b.pairs.length ? { check: null, last: Date.now() } : { check: { ...b.check, ok } }); };
  const hereCount = people.filter(p => b.here[p.id]).length;
  return (
    <div className="content buddy">
      <PageHead backTo={oid ? `outing/${oid}` : 'more'} eyebrow="👥 Buddy board" title={b.mode === 'water' ? 'Waterfront' : 'Headcount'} sub="Kept on this phone, so it works without signal." />
      <div className="seg"><button className={b.mode === 'water' ? 'on' : ''} onClick={() => set({ mode: 'water' })}>🏊 Buddy pairs</button><button className={b.mode === 'count' ? 'on' : ''} onClick={() => set({ mode: 'count' })}>✋ Headcount</button></div>
      {people.length === 0 && <p className="small muted mt">Nobody has said they're going yet. Add names below.</p>}
      {b.mode === 'water' ? (
        <>
          {b.check ? (
            <div className="card buddy-check"><b>Buddy check!</b><span>Everyone grabs their buddy's hand and raises it. Tap each pair when you see them together.</span><span className="bc-time">{Math.max(0, Math.floor((now - b.check.at) / 1000))}s</span></div>
          ) : (
            <div className={`card buddy-timer ${due ? 'due' : ''}`}>
              <span className="grow"><b>{since == null ? 'No buddy check yet' : due ? 'Time for a buddy check!' : `Last check ${Math.floor(since / 60)}:${String(since % 60).padStart(2, '0')} ago`}</b><span className="small">Check every <select value={b.every} onChange={e => set({ every: +e.target.value })} aria-label="Minutes between checks">{[5, 10].map(m => <option key={m} value={m}>{m}</option>)}</select> minutes</span></span>
              <button className="btn accent" onClick={startCheck} disabled={!b.pairs.length}>Buddy check</button>
            </div>
          )}
          <div className="btn-row"><button className="btn secondary small" onClick={autopair}><Icon name="shuffle" size={15} />{b.pairs.length ? 'Re-pair everyone' : 'Make buddy pairs'}</button>{b.pairs.length > 0 && <button className="link-btn small" onClick={() => set({ pairs: [], inWater: {}, check: null, last: 0 })}>Clear</button>}</div>
          <ul className="buddy-pairs">{b.pairs.map((pr, i) => {
            const inW = pr.some(id => b.inWater[id]); const ok = b.check?.ok?.includes(i);
            return (
              <li key={i} className={`card ${inW ? 'in' : ''} ${b.check ? (ok ? 'ok' : 'wait') : ''}`}>
                <span className="bp-n">{i + 1}</span><span className="grow"><b>{pr.map(name).join(' + ')}</b><span className="small">{inW ? '🏊 In the water' : 'On shore'}</span></span>
                {b.check ? <button className="btn small" disabled={ok} onClick={() => confirm(i)}>{ok ? '✓' : 'Together'}</button>
                  : <button className={`btn small ${inW ? 'secondary' : ''}`} onClick={() => set({ inWater: { ...b.inWater, ...Object.fromEntries(pr.map(id => [id, !inW])) } })}>{inW ? 'Out' : 'In'}</button>}
              </li>
            );
          })}</ul>
          {b.check && <button className="link-btn small" onClick={() => set({ check: null })}>Cancel check</button>}
          <p className="small muted">Pair buddies from the same ability group (Make buddy pairs mixes everyone, so adjust by hand). Buddies stay together and check in and out together. Follow Safe Swim Defense: a qualified supervisor, lookouts, and swimmers in the right area for their ability.</p>
        </>
      ) : (
        <>
          <div className={`card count-big ${hereCount === people.length && people.length ? 'all' : ''}`}><b>{hereCount} of {people.length}</b><span>{hereCount === people.length && people.length ? 'Everyone is here!' : `Missing: ${people.filter(p => !b.here[p.id]).map(p => p.name.split(' ')[0]).join(', ') || '—'}`}</span></div>
          <div className="btn-row"><button className="link-btn small" onClick={() => set({ here: {} })}>Start a new count</button></div>
          <ul className="count-list">{people.map(p => <li key={p.id}><button className={b.here[p.id] ? 'on' : ''} onClick={() => set({ here: { ...b.here, [p.id]: !b.here[p.id] } })}><span>{b.here[p.id] ? '✓' : ''}</span>{p.name}</button></li>)}</ul>
        </>
      )}
      <form className="row-input mt" onSubmit={e => { e.preventDefault(); if (add.trim()) { set({ extra: [...b.extra, { id: `x-${Date.now()}`, name: add.trim(), scout: true }] }); setAdd(''); } }}><input value={add} onChange={e => setAdd(e.target.value)} placeholder="Add someone not on the list" aria-label="Add a name" maxLength={60} /><button className="btn small secondary">Add</button></form>
    </div>
  );
}

// ---------------------------------------------------------------- Florida field guide
function FieldGuide({ id }) {
  const g = GUIDE.find(x => x.id === id);
  if (g) return (
    <div className="content field">
      <PageHead backTo="field" eyebrow={`${g.emoji} Field guide`} title={g.title} sub={g.short} />
      {g.sections.map(([h, items]) => <div key={h} className="card fire-how"><b>{h}</b><ul>{items.map(t => <li key={t}>{t}</li>)}</ul></div>)}
      <div className="btn-row"><a className="btn emerg-911 small" href="tel:911"><Icon name="phone" size={15} />911</a>{(g.calls || []).map(k => CALLS[k]).filter(Boolean).map(c => <a key={c.phone} className="btn secondary small" href={`tel:${c.phone.replace(/-/g, '')}`}>{c.emoji} {c.label} {c.phone}</a>)}</div>
      <p className="small muted">Safety basics, not a substitute for first aid training. When in doubt, call 911.</p>
    </div>
  );
  if (id) return <div className="content"><PageHead backTo="field" title="Field guide" /><Empty icon="info" title="Not found" /></div>;
  return (
    <div className="content field">
      <PageHead backTo="more" title="Florida field guide" sub="What to watch for outdoors in Florida, and what to do. Saved on your phone, so it works without signal." />
      <ul className="fire-list">{GUIDE.map(x => <li key={x.id}><a href={`#/field/${x.id}`}><span className="fl-emoji" aria-hidden="true">{x.emoji}</span><span className="grow"><b>{x.title}</b><span className="small muted fl-sub">{x.short}</span></span><Icon name="chevronR" size={18} /></a></li>)}</ul>
      <p className="small muted">In an emergency, call 911. Each topic lists any other number that helps, like Poison Control for bites and stings.</p>
    </div>
  );
}
