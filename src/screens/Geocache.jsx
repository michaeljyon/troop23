import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { Confetti } from '../components/Confetti.jsx';
import { api, useApi, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';
import { useWakeLock } from './Campfire.jsx';

// Troop geocaching: leaders hide caches (each with a code word inside) and save their spots;
// scouts follow a live arrow and distance with their phone's GPS and compass, and log each find
// with the code word. Finds add patrol points. Good practice for First Class 4b.

const R = 6371000, rad = x => (x * Math.PI) / 180;
export const distM = (a, b) => { const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
export const bearing = (a, b) => { const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat)); const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng)); return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360; };
const ft = m => (m < 160 ? `${Math.round(m * 3.281)} ft` : `${(m / 1609.34).toFixed(m < 1609 ? 2 : 1)} mi`);
const ddm = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a); return `${v >= 0 ? pos : neg} ${d}° ${((a - d) * 60).toFixed(3)}′`; };
const dirName = b => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8];
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

function useGPS(on = true) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!on) return undefined;
    if (!navigator.geolocation) { setError('This phone doesn\'t share its location.'); return undefined; }
    const w = navigator.geolocation.watchPosition(p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, heading: p.coords.heading, speed: p.coords.speed }); setError(''); }, e => setError(e.code === 1 ? 'Location is off for Basecamp. Turn it on to find caches.' : 'Looking for GPS…'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(w);
  }, [on]);
  return { pos, error };
}

function useCompass() {
  const [heading, setHeading] = useState(null);
  const [need, setNeed] = useState(typeof DeviceOrientationEvent !== 'undefined' && !!DeviceOrientationEvent.requestPermission);
  const stop = useRef(null);
  const listen = () => {
    const on = e => { const h = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : (e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null ? (360 - e.alpha) % 360 : null; if (h != null) setHeading(h); };
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    addEventListener(evt, on); stop.current = () => removeEventListener(evt, on);
  };
  useEffect(() => { if (!need) listen(); return () => stop.current?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = async () => { try { if ((await DeviceOrientationEvent.requestPermission()) === 'granted') { setNeed(false); listen(); } } catch { setNeed(false); } };
  return { heading, need, ask };
}

export default function Geocache({ route }) {
  const [id, sub, cid] = route.args;
  if (id === 'new') return <Editor />;
  if (id && sub === 'edit') return <Editor id={id} />;
  if (id && sub === 'cards') return <Cards id={id} />;
  if (id && sub === 'go' && cid) return <Navigate id={id} cid={cid} />;
  if (id) return <Course id={id} />;
  return <List />;
}

function List() {
  const acct = useAccount();
  const d = useApi(acct ? 'geo' : null);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Geocaching" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  return (
    <div className="content geo">
      <PageHead backTo="more" title="Geocaching" sub="Follow the arrow, find the cache, log the code word.">
        {d.data?.isLeader && <a className="btn small head-btn" href="#/geocache/new"><Icon name="plus" size={16} />New course</a>}
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : d.data.courses.length === 0 ? <Empty icon="pin" title="No geocache courses yet">{d.data.isLeader ? 'Hide a few caches at camp or a park, then save each spot by standing on it.' : 'Your leaders will set one up.'}</Empty> : (
        <ul className="fire-list">{d.data.courses.map(c => <li key={c.id}><a href={`#/geocache/${c.id}`}><span className="fl-emoji" aria-hidden="true">📍</span><span className="grow"><span className="fl-title"><b>{c.title}</b>{c.status === 'open' ? <Pill tone="good">Open</Pill> : c.status === 'draft' ? <Pill tone="warn">Draft</Pill> : <Pill>Finished</Pill>}</span><span className="small muted fl-sub">{c.count} caches</span></span><Icon name="chevronR" size={18} /></a></li>)}</ul>
      )}
      <a className="card watch-link" href="https://www.geocaching.com/play/map" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🌎</span><span className="grow"><b>Find real geocaches</b><span className="small muted">Search the geocaching.com map near your campsite (free account needed).</span></span><Icon name="external" size={18} /></a>
      <p className="small muted">Leave No Trace: stay on trails, don't dig or damage plants, and put every cache back the way you found it.</p>
    </div>
  );
}

function Course({ id }) {
  const d = useApi(`geo/${id}`);
  const { pos } = useGPS(true);
  if (!d.data) return <div className="content"><PageHead backTo="geocache" title="Geocaching" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const { course: c, mine, board, isLeader } = d.data;
  const firstOpen = c.caches.findIndex(x => !mine[x.id]);
  const setStatus = async status => { await api(`geo/${id}`, { method: 'PUT', body: { status } }); d.refresh(); };
  return (
    <div className="content geo">
      <PageHead backTo="geocache" eyebrow={`📍 ${Object.keys(mine).length} of ${c.caches.length} found`} title={c.title} sub={c.note}>
        {isLeader && <a className="btn small secondary head-btn" href={`#/geocache/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      {isLeader && <div className="btn-row">{c.status !== 'open' ? <button className="btn accent" onClick={() => setStatus('open')}><Icon name="play" size={16} />{c.status === 'draft' ? 'Open the course' : 'Reopen'}</button> : <button className="btn secondary" onClick={() => setStatus('closed')}>Finish the course</button>}<a className="btn secondary" href={`#/geocache/${id}/cards`}><Icon name="file" size={15} />Print cache cards</a></div>}
      <ul className="geo-caches">{c.caches.map((x, i) => { const found = !!mine[x.id]; const locked = c.ordered && !isLeader && i > firstOpen && firstOpen >= 0; const dist = pos ? distM(pos, x) : null; return (
        <li key={x.id} className={`card ${found ? 'found' : ''} ${locked ? 'locked' : ''}`}>
          <span className="gc-n">{found ? '✓' : i + 1}</span>
          <span className="grow"><b>{x.name}</b><span className="small muted">{locked ? 'Find the one before first' : `${ddm(x.lat, 'N', 'S')}  ${ddm(x.lng, 'E', 'W')}`}</span>{dist != null && !locked && <span className="small">{ft(dist)} {dirName(bearing(pos, x))}</span>}{isLeader && <span className="small">Code word: <b>{x.code}</b> · {x.pts} pts</span>}</span>
          {!locked && c.status === 'open' && !found && <a className="btn small" href={`#/geocache/${id}/go/${x.id}`}>Go</a>}
        </li>
      ); })}</ul>
      {board.length > 0 && <Section title="Finds"><ol className="knot-board">{board.map((b, i) => <li key={i} className={b.me ? 'me' : ''}><span className="kb-n">{i + 1}</span><span className="grow"><b>{b.name}</b>{b.patrol && <span className="small muted"> · {b.patrol}</span>}</span><b>{b.found} found</b></li>)}</ol></Section>}
      <p className="small muted">Coordinates are in degrees and decimal minutes, like a real GPS. Finding caches with a phone's GPS counts toward First Class 4b with a leader's OK.</p>
    </div>
  );
}

function Navigate({ id, cid }) {
  const d = useApi(`geo/${id}`);
  const { pos, error } = useGPS(true);
  const { heading, need, ask } = useCompass();
  const [hint, setHint] = useState(false);
  const [log, setLog] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [win, setWin] = useState(null);
  useWakeLock();
  const c = d.data?.course; const x = c?.caches.find(k => k.id === cid);
  const exit = () => go(`geocache/${id}`, { replace: true });
  if (!x) return <div className="emcee geo-nav"><div className="em-top"><button className="icon-btn on-dark" onClick={exit} aria-label="Back"><Icon name="x" /></button><span className="grow em-plan">Geocache</span></div><div className="em-body"><p>{d.error?.message || 'Loading…'}</p></div></div>;
  const dist = pos ? distM(pos, x) : null, brg = pos ? bearing(pos, x) : null;
  const facing = heading ?? (pos?.speed > 0.6 ? pos.heading : null);
  const arrow = brg != null && facing != null ? brg - facing : brg;
  const close = dist != null && dist < Math.max(10, (pos?.acc || 10) * 0.8);
  const submit = async () => { setMsg(''); try { const r = await api(`geo/${id}/find`, { method: 'POST', body: { cacheId: cid, code } }); setWin(r); d.refresh(); } catch (e) { setMsg(e.message); } };
  return (
    <div className={`emcee geo-nav ${close ? 'close' : ''}`} role="dialog" aria-label={`Finding ${x.name}`}>
      {win && <Confetti />}
      <div className="em-top"><button className="icon-btn on-dark" onClick={exit} aria-label="Back to the course"><Icon name="x" /></button><span className="grow em-plan">{x.name}</span>{pos && <span className="em-count">±{Math.round(pos.acc * 3.281)} ft</span>}</div>
      <div className="em-body gn-body">
        {win ? (
          <div className="em-done"><span className="em-big-emoji" aria-hidden="true">🎉</span><h2>Found it!</h2><p>{win.already ? 'You already logged this one.' : `+${win.pts} points for your patrol.`} Put the cache back just how you found it.</p><button className="btn accent" onClick={exit}>Next cache</button></div>
        ) : (
          <>
            <div className="gn-dial" aria-hidden="true">
              <div className="gn-arrow" style={{ transform: `rotate(${arrow ?? 0}deg)`, opacity: arrow == null ? 0.25 : 1 }}>▲</div>
              {facing != null && <div className="gn-north" style={{ transform: `rotate(${-facing}deg)` }}><span>N</span></div>}
            </div>
            <p className="gn-dist">{dist == null ? (error || 'Getting your location…') : ft(dist)}</p>
            <p className="gn-sub">{brg != null ? `${dirName(brg)} · ${Math.round(brg)}°` : ''}{close ? ' · You\'re close! Start looking.' : ''}</p>
            {facing == null && pos && <p className="small gn-tip">{need ? <button className="btn small on-dark-btn" onClick={ask}>Turn on the compass</button> : 'Walk a few steps and the arrow will point the way.'}</p>}
            <p className="gn-coords">{ddm(x.lat, 'N', 'S')}  {ddm(x.lng, 'E', 'W')}</p>
            {x.hint && (hint ? <p className="gn-hint">💡 {x.hint}</p> : <button className="btn small on-dark-btn" onClick={() => setHint(true)}>Show the hint</button>)}
          </>
        )}
      </div>
      {!win && <div className="em-foot"><a className="btn on-dark-btn" href={`https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}`} target="_blank" rel="noopener noreferrer"><Icon name="map" size={16} />Map</a><span className="grow" /><button className="btn accent" onClick={() => setLog(true)}>I found it!</button></div>}
      <Sheet open={log} onClose={() => setLog(false)} title="Log your find">{log && (
        <form onSubmit={e => { e.preventDefault(); submit().then(() => setLog(false)); }}>
          <label className="field"><span>Code word from inside the cache</span><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" spellCheck="false" placeholder="CODE WORD" /></label>
          {msg && <p className="form-msg" role="alert">{msg}</p>}
          <button className="btn" disabled={!code.trim()}>Log it</button>
        </form>
      )}</Sheet>
    </div>
  );
}

function Editor({ id }) {
  const d = useApi(id ? `geo/${id}` : null);
  const [f, setF] = useState(id ? null : { title: 'Geocache course', note: '', date: todayISO(), ordered: false, caches: [] });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(-1);
  useEffect(() => { if (d.data && !f) setF(d.data.course); }, [d.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <div className="content"><PageHead backTo="geocache" title="Geocache course" /><p className="muted">Loading…</p></div>;
  const setC = (i, p) => setF(x => ({ ...x, caches: x.caches.map((k, j) => (j === i ? { ...k, ...p } : k)) }));
  // stand on the spot: average a few GPS readings for a steadier position
  const here = i => {
    setBusy(i); const pts = [];
    const w = navigator.geolocation?.watchPosition(p => { if (p.coords.accuracy < 60) pts.push(p.coords); if (pts.length >= 5) done(); }, () => done(), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    const t = setTimeout(done, 12000);
    function done() { clearTimeout(t); navigator.geolocation.clearWatch(w); setBusy(-1); if (!pts.length) { setMsg('Couldn\'t get a good GPS fix. Step into the open and try again.'); return; } setC(i, { lat: +(pts.reduce((s, p) => s + p.latitude, 0) / pts.length).toFixed(6), lng: +(pts.reduce((s, p) => s + p.longitude, 0) / pts.length).toFixed(6), acc: Math.round(Math.min(...pts.map(p => p.accuracy))) }); }
  };
  const save = async () => { setMsg(''); try { const r = id ? await api(`geo/${id}`, { method: 'PUT', body: f }) : await api('geo', { method: 'POST', body: f }); go(`geocache/${r.course.id}`, { replace: true }); } catch (e) { setMsg(e.message); } };
  return (
    <div className="content geo">
      <PageHead backTo={id ? `geocache/${id}` : 'geocache'} title={id ? 'Edit course' : 'New geocache course'} sub="Hide each cache, stand right on it, and tap Use my spot." />
      <div className="card">
        <label className="field"><span>Name</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={100} /></label>
        <label className="field"><span>Rules or boundaries (optional)</span><textarea rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} maxLength={600} placeholder="Stay on the trails. Back at the flagpole by 3:00." /></label>
        <label className="check-row"><input type="checkbox" checked={f.ordered} onChange={e => setF({ ...f, ordered: e.target.checked })} /><span>Find them in order (each cache unlocks the next)</span></label>
      </div>
      <Section title={`Caches (${f.caches.length})`}>
        <ul className="geo-edit">{f.caches.map((k, i) => (
          <li key={i} className="card">
            <div className="row-input"><input value={k.name} onChange={e => setC(i, { name: e.target.value })} placeholder={`Cache ${i + 1}`} aria-label="Cache name" maxLength={60} /><button className="icon-btn" onClick={() => setF({ ...f, caches: f.caches.filter((_, j) => j !== i) })} aria-label="Remove cache"><Icon name="x" size={18} /></button></div>
            <div className="row2"><input value={k.lat ?? ''} onChange={e => setC(i, { lat: e.target.value })} placeholder="Latitude (30.4383)" aria-label="Latitude" inputMode="decimal" /><input value={k.lng ?? ''} onChange={e => setC(i, { lng: e.target.value })} placeholder="Longitude (-84.2807)" aria-label="Longitude" inputMode="decimal" /></div>
            <button className="btn small secondary" onClick={() => here(i)} disabled={busy === i}><Icon name="pin" size={15} />{busy === i ? 'Getting a steady GPS fix…' : 'Use my spot'}</button>{k.acc && <span className="small muted"> ±{Math.round(k.acc * 3.281)} ft</span>}
            <div className="row2"><input value={k.code || ''} onChange={e => setC(i, { code: e.target.value.toUpperCase() })} placeholder="Code word (blank = we'll pick)" aria-label="Code word" maxLength={30} /><input type="number" min="0" max="50" value={k.pts ?? 5} onChange={e => setC(i, { pts: e.target.value })} aria-label="Points" /></div>
            <input value={k.hint || ''} onChange={e => setC(i, { hint: e.target.value })} placeholder="Hint (optional): under the big oak root" aria-label="Hint" maxLength={200} />
          </li>
        ))}</ul>
        <button className="btn secondary small" onClick={() => setF({ ...f, caches: [...f.caches, { name: '', lat: '', lng: '', hint: '', code: '', pts: 5 }] })}><Icon name="plus" size={15} />Add a cache</button>
      </Section>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn big" onClick={save}>Save course</button>
      {id && <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this course and everyone\'s finds?')) { await api(`geo/${id}`, { method: 'DELETE' }); go('geocache'); } }}><Icon name="trash" size={14} />Delete</button></p>}
      <p className="small muted">New courses start as a draft. Print the cache cards, put one in each container with its code word, then open the course.</p>
    </div>
  );
}

function Cards({ id }) {
  const d = useApi(`geo/${id}`);
  const c = d.data?.course;
  if (!c) return <div className="content"><PageHead backTo={`geocache/${id}`} title="Cache cards" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  return (
    <div className="content geo">
      <div className="no-print"><PageHead backTo={`geocache/${id}`} title="Cache cards" sub="Print, cut out, and put one card in each cache." /><button className="btn" onClick={() => print()}><Icon name="file" size={16} />Print</button></div>
      <div className="geo-cards">{c.caches.map((k, i) => <div key={k.id} className="geo-card"><p className="gcard-n">Cache {i + 1}</p><h3>{k.name}</h3><p>You found it! Log this code word in Basecamp:</p><p className="gcard-code">{k.code}</p><p className="small">Put everything back just how you found it.</p></div>)}</div>
    </div>
  );
}
