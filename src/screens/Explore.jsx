import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty } from '../components/ui.jsx';
import { api, useApi, useAccount, useLeaderMode } from '../lib/api.js';
import { useLocal } from '../lib/store.js';
import { go } from '../lib/router.js';
import { CAMPSITES } from '../../troop/campsites.js';
import { OutingForm } from './Outings.jsx';

// Campsite explorer: places to camp within about 2½ hours of Tallahassee, picked for scout troops.
// List and map views, filters scouts can tap, a page for each place, and troop favorites
// (each member picks up to 5) so the PLC can see where the troop wants to go.

export const HOME = { lat: 30.4383, lng: -84.2807, name: 'Tallahassee' };
export const KINDS = {
  'state-park': { label: 'State park', emoji: '🌲', color: '#1F7A47', sky: ['#9fd3c7', '#e8f4ea'] },
  'state-forest': { label: 'State forest', emoji: '🌳', color: '#3C6E2F', sky: ['#b5d99c', '#eef6e4'] },
  'national-forest': { label: 'National forest', emoji: '🏕️', color: '#55632A', sky: ['#c6dca0', '#f3f1dc'] },
  wmd: { label: 'River camp', emoji: '🛶', color: '#1F6E8C', sky: ['#9fd0e6', '#e7f4f8'] },
  corps: { label: 'Lake campground', emoji: '⛵', color: '#2C5D9E', sky: ['#a9c8ef', '#eaf2fb'] },
  county: { label: 'County park', emoji: '🏞️', color: '#7A5A1F', sky: ['#f2d49b', '#fbf2df'] },
  city: { label: 'City park', emoji: '🏞️', color: '#7A5A1F', sky: ['#f2d49b', '#fbf2df'] },
  'scout-camp': { label: 'Scout camp', emoji: '⚜️', color: '#B85A1C', sky: ['#f6c08f', '#fdeedd'] },
  refuge: { label: 'Wildlife refuge', emoji: '🐊', color: '#4E6B3A', sky: ['#bcd6a4', '#eef4e2'] },
  trail: { label: 'Backpacking trail', emoji: '🎒', color: '#6B4E9E', sky: ['#cdbcf0', '#f2edfb'] },
};
const KIND_GROUPS = [['parks', 'State parks', ['state-park']], ['forests', 'Forests', ['state-forest', 'national-forest']], ['water', 'Rivers & lakes', ['wmd', 'corps']], ['scout', 'Scout camps', ['scout-camp']], ['local', 'Town & county', ['county', 'city']], ['back', 'Backcountry', ['trail', 'refuge']]];
export const ACTS = {
  swim: ['🏊', 'Swim'], springs: ['💧', 'Springs'], paddle: ['🛶', 'Paddle'], hike: ['🥾', 'Hike'], fish: ['🎣', 'Fish'], beach: ['🏖️', 'Beach'],
  caves: ['🦇', 'Caves'], bike: ['🚲', 'Bike'], snorkel: ['🤿', 'Snorkel'], wildlife: ['🦌', 'Wildlife'], history: ['🏛️', 'History'], boat: ['🚤', 'Boating'], horse: ['🐎', 'Horses'],
};
const DRIVES = [[0, 'Any drive'], [60, 'Under 1 hr'], [90, 'Under 1½ hr'], [120, 'Under 2 hr']];
const byId = new Map(CAMPSITES.map(c => [c.id, c]));
const youth = c => !!c.camping.youthGroup;
export const driveLabel = m => { const r = Math.round(m / 15) * 15; const h = Math.floor(r / 60), n = r % 60; return `${h ? `${h} hr` : ''}${h && n ? ' ' : ''}${n ? `${n} min` : ''}`; };
const dirUrl = c => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
const groupCount = CAMPSITES.filter(youth).length;

export default function Explore({ route }) {
  const id = route.args[0];
  const votes = useApi('explore');
  if (id) return <Place c={byId.get(id)} votes={votes} />;
  return <Hub route={route} votes={votes} />;
}

// ---------------------------------------------------------------- picture: the place's photo, or a drawn scene if there isn't one (or it won't load)
export function Picture({ c, big, className = '' }) {
  const [bad, setBad] = useState(false);
  const p = c.photos?.[0];
  return (
    <div className={`ex-pic ${big ? 'big' : ''} ${className}`}>
      {p && !bad ? <img src={p.url} alt={`${c.name}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <Scene c={c} />}
    </div>
  );
}
function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function Scene({ c }) {
  const k = KINDS[c.kind] || KINDS['state-park'];
  const h = hash(c.id);
  const watery = ['wmd', 'corps', 'refuge'].includes(c.kind) || c.activities.includes('paddle') || c.activities.includes('beach');
  const beach = c.activities.includes('beach');
  const trees = Array.from({ length: 7 }, (_, i) => ({ x: 8 + i * 15 + ((h >> i) % 7), s: 0.75 + ((h >> (i + 3)) % 5) / 10 }));
  const g = `g${c.id.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg className="ex-scene" viewBox="0 0 120 68" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={k.sky[0]} /><stop offset="1" stopColor={k.sky[1]} /></linearGradient></defs>
      <rect width="120" height="68" fill={`url(#${g})`} />
      <circle cx={20 + (h % 70)} cy="15" r="7" fill="#FFE29A" opacity=".9" />
      <path d={`M0 44 Q 25 ${30 + (h % 8)} 50 40 T 120 ${36 + (h % 6)} V68 H0Z`} fill={k.color} opacity=".35" />
      {beach ? <path d="M0 52 Q 40 46 120 52 V68 H0Z" fill="#F3E1B2" /> : null}
      {watery ? <path d={`M0 ${beach ? 58 : 54} Q 30 ${beach ? 55 : 50} 60 ${beach ? 58 : 54} T 120 ${beach ? 58 : 54} V68 H0Z`} fill="#4A90B8" opacity=".85" /> : <path d="M0 54 Q 60 48 120 54 V68 H0Z" fill={k.color} opacity=".55" />}
      {!beach && trees.map((t, i) => <path key={i} d={`M${t.x} ${50 - 14 * t.s} l${5 * t.s} ${14 * t.s} h-${10 * t.s}z`} fill={k.color} opacity=".9" />)}
      {c.kind === 'scout-camp' && <path d="M78 54 l9 -12 l9 12z" fill="#fff" opacity=".9" />}
      <text x="108" y="62" fontSize="12" textAnchor="middle">{k.emoji}</text>
    </svg>
  );
}

// ---------------------------------------------------------------- hub: list or map
function Hub({ route, votes }) {
  const acct = useAccount();
  const leader = useLeaderMode();
  const [view, setView] = useLocal('ex-view', 'list');
  useEffect(() => { if (route.query.view === 'map' || route.query.focus) setView('map'); }, [route.query.view, route.query.focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('');
  const [drive, setDrive] = useLocal('ex-drive', 0);
  const [kinds, setKinds] = useState([]);
  const [acts, setActs] = useState([]);
  const [group, setGroup] = useState(false);
  const [sort, setSort] = useLocal('ex-sort', 'near');
  const [busy, setBusy] = useState('');
  const v = votes.data || { counts: {}, mine: [], who: {}, max: 5 };
  const canPlan = !!v.canPlan || !!leader;

  const list = useMemo(() => {
    const kindSet = new Set(KIND_GROUPS.filter(([k]) => kinds.includes(k)).flatMap(([, , ks]) => ks));
    const words = q.trim().toLowerCase();
    const out = CAMPSITES.filter(c => (!drive || c.drive <= drive) && (!kinds.length || kindSet.has(c.kind)) && acts.every(a => c.activities.includes(a)) && (!group || youth(c))
      && (!words || `${c.name} ${c.near} ${c.blurb} ${c.activities.map(a => ACTS[a]?.[1]).join(' ')}`.toLowerCase().includes(words)));
    const fav = c => v.counts[c.id] || 0;
    return out.sort(sort === 'fav' ? (a, b) => fav(b) - fav(a) || a.drive - b.drive : sort === 'az' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.drive - b.drive);
  }, [q, drive, kinds, acts, group, sort, v.counts]);

  const toggle = (arr, set, x) => set(arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]);
  const anyFilter = q || drive || kinds.length || acts.length || group;
  const clear = () => { setQ(''); setDrive(0); setKinds([]); setActs([]); setGroup(false); };
  const top = Object.entries(v.counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ c: byId.get(id), n })).filter(x => x.c);
  const surprise = () => { const pool = list.length ? list : CAMPSITES; go(`explore/${pool[Math.floor(Math.random() * pool.length)].id}`); };

  async function makePoll() {
    const opts = top.slice(0, 6).map(x => x.c.name);
    if (opts.length < 2) return;
    setBusy('poll');
    try { await api('poll', { method: 'POST', body: { q: 'Where should we camp next?', options: opts, aud: 'all' } }); go('polls'); } catch (e) { alert(e.message); } finally { setBusy(''); }
  }

  return (
    <div className="content explore">
      <PageHead backTo="more" />
      <section className="ex-hero">
        <p className="ex-kicker">⛺ Campsite explorer</p>
        <h1>Where should we camp next?</h1>
        <p>{CAMPSITES.length} places to camp within about 2½ hours of Tallahassee. Tap a heart to pick your top {v.max || 5} and help the troop decide.</p>
        <div className="ex-stats">
          <span><b>{CAMPSITES.length}</b>places</span>
          <span><b>{groupCount}</b>with group camps</span>
          {acct ? <span><b>{v.mine.length}/{v.max || 5}</b>your picks</span> : <span><b>{Object.keys(v.counts).length}</b>troop picks</span>}
        </div>
        <div className="ex-hero-btns">
          <button className="btn accent" onClick={surprise}><span aria-hidden="true">🎲</span> Surprise me</button>
        </div>
      </section>

      {top.length > 0 && (
        <Section title="Troop favorites" action={canPlan && top.length >= 2 && <button className="link-btn small" disabled={!!busy} onClick={makePoll}><Icon name="users" size={15} />Make a poll</button>}>
          <div className="ex-favs">
            {top.map(({ c, n }, i) => (
              <a key={c.id} className="ex-fav" href={`#/explore/${c.id}`}>
                <Picture c={c} />
                <span className="ex-rank">{i + 1}</span>
                <span className="ex-fav-body"><b>{c.name}</b><span>❤️ {n} · {driveLabel(c.drive)}</span></span>
              </a>
            ))}
          </div>
        </Section>
      )}

      <div className="ex-bar">
        <div className="seg" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><Icon name="list" size={16} />List</button>
          <button role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}><Icon name="map" size={16} />Map</button>
        </div>
        <label className="ex-search"><Icon name="search" size={17} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search places, towns, things to do" aria-label="Search places" /></label>
      </div>

      <div className="ex-filters">
        <div className="chip-scroll ex-chips" aria-label="Drive time">
          {DRIVES.map(([m, l]) => <button key={m} className={`chip ${drive === m ? 'on' : ''}`} onClick={() => setDrive(m)}>{m ? '🚗 ' : ''}{l}</button>)}
          <button className={`chip group ${group ? 'on' : ''}`} onClick={() => setGroup(!group)} aria-pressed={group}>⛺ Group camp</button>
        </div>
        <div className="chip-scroll ex-chips" aria-label="Kind of place">
          {KIND_GROUPS.map(([k, l]) => <button key={k} className={`chip ${kinds.includes(k) ? 'on' : ''}`} onClick={() => toggle(kinds, setKinds, k)} aria-pressed={kinds.includes(k)}>{l}</button>)}
        </div>
        <div className="chip-scroll ex-chips" aria-label="Things to do">
          {Object.entries(ACTS).map(([k, [e, l]]) => <button key={k} className={`chip ${acts.includes(k) ? 'on' : ''}`} onClick={() => toggle(acts, setActs, k)} aria-pressed={acts.includes(k)}>{e} {l}</button>)}
        </div>
      </div>

      <div className="ex-count">
        <span><b>{list.length}</b> {list.length === 1 ? 'place' : 'places'}{anyFilter ? <> · <button className="link-btn small" onClick={clear}>Clear filters</button></> : ''}</span>
        {view === 'list' && (
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
            <option value="near">Closest first</option>
            <option value="fav">Troop favorites</option>
            <option value="az">A to Z</option>
          </select>
        )}
      </div>

      {view === 'map' ? <ExploreMap list={list} counts={v.counts} focus={route.query.focus} /> : list.length === 0 ? (
        <Empty icon="search" title="No places match" action={<button className="btn secondary" onClick={clear}>Clear filters</button>}>Try a longer drive or fewer things to do.</Empty>
      ) : (
        <div className="ex-grid">{list.map(c => <Card key={c.id} c={c} n={v.counts[c.id] || 0} picked={v.mine.includes(c.id)} />)}</div>
      )}

      <p className="small muted ex-foot">Drive times are estimates from downtown Tallahassee. Info was checked in November 2026; rules, fees and closures change, so call or check the official page before you plan. Photos are from Wikimedia Commons, credited on each place's page.</p>
    </div>
  );
}

function Card({ c, n, picked }) {
  const k = KINDS[c.kind];
  return (
    <a className="ex-card" href={`#/explore/${c.id}`}>
      <div className="ex-card-pic">
        <Picture c={c} />
        <span className="ex-kind" style={{ background: k.color }}>{k.emoji} {k.label}</span>
        <span className={`ex-heart ${picked ? 'on' : ''}`} aria-label={`${n} troop ${n === 1 ? 'pick' : 'picks'}${picked ? ', including you' : ''}`}>{picked ? '❤️' : '🤍'}{n > 0 && <b>{n}</b>}</span>
        <span className="ex-drive">🚗 {driveLabel(c.drive)}</span>
      </div>
      <div className="ex-card-body">
        <h3>{c.name}</h3>
        <p className="ex-near">{c.near} · {c.miles} mi</p>
        <p className="ex-acts">{c.activities.slice(0, 7).map(a => <span key={a} title={ACTS[a]?.[1]}>{ACTS[a]?.[0]}</span>)}</p>
        <p className="ex-tags">
          {youth(c) && <span className="ex-tag good">⛺ Group camp</span>}
          {c.camping.cabins && <span className="ex-tag">🛖 Cabins</span>}
          {c.camping.paddleIn && <span className="ex-tag">🛶 Paddle-in</span>}
          {c.check && <span className="ex-tag warn">⚠️ Check first</span>}
        </p>
      </div>
    </a>
  );
}

// ---------------------------------------------------------------- map (Leaflet loads only when the map is shown)
const ringMiles = min => (min - 10) / 1.12;          // the same estimate the drive times use
const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MAPS = {
  map: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, label: 'Map' },
  sat: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', attribution: 'USGS The National Map', label: 'Satellite', max: 16 },
};
function ExploreMap({ list, counts, focus }) {
  const box = useRef(null);
  const st = useRef({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [base, setBase] = useLocal('ex-base', 'map');
  const [sel, setSel] = useState(focus ? byId.get(focus) || null : null);

  useEffect(() => {
    let gone = false;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (gone || !box.current) return;
      const L = mod.default || mod;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, zoomSnap: 0.5 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      map.setView([HOME.lat, HOME.lng], 7);
      // drive-time rings around Tallahassee
      for (const [m, l] of [[60, '~1 hr'], [90, '~1½ hr'], [120, '~2 hr'], [150, '~2½ hr']]) {
        L.circle([HOME.lat, HOME.lng], { radius: ringMiles(m) * 1609.34, color: '#E8833A', weight: 1.5, dashArray: '5 6', fill: false, interactive: false }).addTo(map);
        const north = [HOME.lat + ringMiles(m) / 69, HOME.lng];
        L.marker(north, { interactive: false, icon: L.divIcon({ className: 'ex-ring-label', html: `<span>${l}</span>`, iconSize: [60, 18], iconAnchor: [30, 9] }) }).addTo(map);
      }
      L.marker([HOME.lat, HOME.lng], { zIndexOffset: 1000, icon: L.divIcon({ className: 'ex-home', html: '<span>⭐</span><b>Tallahassee</b>', iconSize: [96, 30], iconAnchor: [15, 15] }) }).addTo(map);
      st.current = { L, map, layer: L.layerGroup().addTo(map) };
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { gone = true; const m = st.current.map; if (m) { m.stop(); m.off(); m.remove(); } st.current = {}; };
  }, []);

  useEffect(() => {
    const { L, map } = st.current; if (!ready || !map) return;
    st.current.tiles?.remove();
    const b = MAPS[base] || MAPS.map;
    st.current.tiles = L.tileLayer(b.url, { maxNativeZoom: b.max || 19, maxZoom: 18, attribution: b.attribution, referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(map);
  }, [ready, base]);

  useEffect(() => {
    const { L, map, layer } = st.current; if (!ready || !map) return;
    layer.clearLayers();
    for (const c of list) {
      const k = KINDS[c.kind];
      const n = counts[c.id] || 0;
      const m = L.marker([c.lat, c.lng], { title: c.name, icon: L.divIcon({ className: `ex-pin ${sel?.id === c.id ? 'sel' : ''}`, html: `<span style="background:${k.color}">${k.emoji}</span>${n ? `<i>${n}</i>` : ''}`, iconSize: [28, 28], iconAnchor: [14, 14] }) });
      m.on('click', () => setSel(c));
      layer.addLayer(m);
    }
    if (!sel && list.length) map.fitBounds(L.latLngBounds([[HOME.lat, HOME.lng], ...list.map(c => [c.lat, c.lng])]), { padding: [30, 30], maxZoom: 10, animate: false });
  }, [ready, list, counts, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const { map } = st.current; if (ready && map && sel) map.panTo([sel.lat, sel.lng], { animate: false }); }, [ready, sel]);

  return (
    <div className="ex-map-wrap">
      <div ref={box} className="ex-map" role="application" aria-label="Map of places to camp" />
      {!ready && !failed && <p className="ex-map-msg">Loading the map…</p>}
      {failed && <p className="ex-map-msg">The map couldn't load. Check your connection, or use the list.</p>}
      <div className="ex-map-base">{Object.entries(MAPS).map(([k, b]) => <button key={k} className={base === k ? 'on' : ''} onClick={() => setBase(k)}>{b.label}</button>)}</div>
      <div className="ex-legend">{KIND_GROUPS.map(([g, l, ks]) => <span key={g}><i style={{ background: KINDS[ks[0]].color }}>{KINDS[ks[0]].emoji}</i>{l}</span>)}</div>
      {sel && (
        <div className="ex-pop">
          <button className="icon-btn sm ex-pop-x" onClick={() => setSel(null)} aria-label="Close"><Icon name="x" size={16} /></button>
          <a href={`#/explore/${sel.id}`} className="ex-pop-in">
            <Picture c={sel} />
            <span className="grow"><b>{sel.name}</b><span className="small muted">{KINDS[sel.kind].label} · {sel.near}</span><span className="small">🚗 {driveLabel(sel.drive)}{youth(sel) ? ' · ⛺ Group camp' : ''}</span></span>
            <Icon name="chevronR" size={18} />
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- one place
function Place({ c, votes }) {
  const acct = useAccount();
  const leader = useLeaderMode();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  if (!c) return <div className="content"><PageHead backTo="explore" title="Campsite explorer" /><Empty icon="info" title="Place not found" /></div>;
  const k = KINDS[c.kind];
  const v = votes.data || { counts: {}, mine: [], who: {}, max: 5 };
  const picked = v.mine.includes(c.id);
  const n = v.counts[c.id] || 0;
  const who = v.who[c.id] || [];
  const p = c.photos?.[0];
  const isLeader = !!leader || !!acct?.member?.leader;

  async function pick() {
    setMsg(''); setBusy(true);
    try { await api('explore/pick', { method: 'POST', body: { id: c.id, on: !picked } }); votes.refresh(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  const camp = [
    c.camping.youthGroup && ['⛺', 'Group / youth camp', c.camping.youthGroup],
    c.camping.tent && ['🏕️', 'Tent campsites', 'Regular campsites you can drive to.'],
    c.camping.primitive && ['🌲', 'Primitive sites', 'Simple sites with few or no facilities.'],
    c.camping.cabins && ['🛖', 'Cabins and more', c.camping.cabins],
    c.camping.paddleIn && ['🛶', 'Paddle-in camping', 'Sites you reach by canoe or kayak.'],
    c.camping.backpacking && ['🎒', 'Backpacking', 'Hike-in camps for a trip on the trail.'],
  ].filter(Boolean);

  return (
    <div className="content explore ex-place">
      <PageHead backTo="explore" />
      <div className="ex-place-hero">
        <Picture c={c} big />
        <div className="ex-place-title">
          <span className="ex-kind" style={{ background: k.color }}>{k.emoji} {k.label}</span>
          <h1>{c.name}</h1>
          <p>{c.near}</p>
        </div>
      </div>
      {p && <p className="ex-credit">Photo: <a href={p.page} target="_blank" rel="noopener noreferrer">{p.author}, {p.license}</a>, via Wikimedia Commons</p>}

      <div className="ex-facts">
        <span><b>🚗 {driveLabel(c.drive)}</b>drive (about)</span>
        <span><b>{c.miles} mi</b>as the crow flies</span>
        <span><b>{youth(c) ? '⛺ Yes' : '—'}</b>group camp</span>
      </div>

      <div className={`card ex-pick ${picked ? 'on' : ''}`}>
        <div className="grow">
          <b>{picked ? 'One of your top picks!' : 'Want to camp here?'}</b>
          <span className="small">{n ? `${n} ${n === 1 ? 'person has' : 'people have'} picked it${who.length ? `: ${who.map(w => w.name).join(', ')}` : '.'}` : 'Nobody has picked it yet. Be the first!'}</span>
        </div>
        {acct ? <button className={`btn ${picked ? 'secondary' : 'accent'}`} disabled={busy} onClick={pick}>{picked ? '❤️ Picked' : '🤍 Pick it'}</button>
          : <a className="btn secondary small" href="#/more">Sign in to pick</a>}
      </div>
      {acct && <p className="small muted ex-picks-left">You've used {v.mine.length} of your {v.max || 5} picks.</p>}
      {msg && <p className="form-msg" role="alert">{msg}</p>}

      <Section title="Why scouts like it"><p className="ex-blurb">{c.blurb}</p></Section>

      <Section title="Camping here">
        <ul className="ex-camp">{camp.map(([e, t, d]) => <li key={t}><span aria-hidden="true">{e}</span><span><b>{t}</b><span className="small">{d}</span></span></li>)}</ul>
      </Section>

      {c.activities.length > 0 && (
        <Section title="Things to do">
          <div className="ex-act-grid">{c.activities.map(a => <span key={a}><i aria-hidden="true">{ACTS[a]?.[0]}</i>{ACTS[a]?.[1]}</span>)}</div>
        </Section>
      )}

      {(c.check || c.watch) && (
        <Section title="Know before you go">
          {c.check && <div className="ex-note warn"><b>⚠️ Check first</b> {c.check}</div>}
          {c.watch && <div className="ex-note"><b>Good to know</b> {c.watch}</div>}
        </Section>
      )}

      <Section title="How to book">
        {c.reserve && <p>{c.reserve}</p>}
        <div className="btn-row">
          {c.url && <a className="btn secondary small" href={c.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} />Official page</a>}
          {c.reserveUrl && <a className="btn secondary small" href={c.reserveUrl} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={15} />Reserve</a>}
          <a className="btn secondary small" href={dirUrl(c)} target="_blank" rel="noopener noreferrer"><Icon name="route" size={15} />Directions</a>
          <a className="btn secondary small" href={`#/explore?focus=${c.id}`}><Icon name="map" size={15} />On the map</a>
        </div>
        {c.pinApprox && <p className="small muted">The map pin is approximate. Use the official page for exact directions.</p>}
      </Section>

      {isLeader && (
        <div className="card ex-plan">
          <span className="grow"><b>Plan a campout here</b><span className="small">Starts a new outing with the place and map pin filled in.</span></span>
          <button className="btn" onClick={() => setPlan({ title: `Campout at ${c.name}`, type: 'campout', location: c.name, address: c.address || '', mapQ: `${c.lat},${c.lng}`, placeWeb: c.url || '' })}><Icon name="plus" size={16} />New outing</button>
        </div>
      )}
      <OutingForm outing={plan} onClose={() => setPlan(null)} onSaved={o => { setPlan(null); if (o) go(`outing/${o.id}`); }} />

      <p className="small muted ex-foot">Checked November 2026. Rules, fees and closures change, so call or check the official page before you plan.</p>
    </div>
  );
}
