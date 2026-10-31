import { useEffect, useMemo, useRef, useState } from 'react';
import * as A from 'astronomy-engine';
import Icon from '../components/Icon.jsx';
import { PageHead, Section } from '../components/ui.jsx';
import { useApi } from '../lib/api.js';
import { useLocal } from '../lib/store.js';
import { go } from '../lib/router.js';
import SKY from '../lib/skydata.json';

// Tonight's sky for the troop's hometown, an outing's campsite, or wherever the phone is:
// a star chart with constellations, planets and the Moon, plus sunset, darkness, the Moon's
// phase and easy things to find. Star and constellation data: d3-celestial (BSD, Olaf Frohn);
// sky math: Astronomy Engine (MIT, Don Cross).

const HOME = { lat: 30.4383, lng: -84.2807, name: 'Tallahassee' };
const PLANETS = [['Venus', '#FFF3C4'], ['Mars', '#FF8A65'], ['Jupiter', '#FFE0B2'], ['Saturn', '#E6D3A3'], ['Mercury', '#D7CCC8']];
const FINDS = [
  ['Big Dipper', 165.93, 61.75, 'Seven bright stars shaped like a ladle. The two stars at the end of the cup point to Polaris.'],
  ['Polaris, the North Star', 37.95, 89.26, 'Not the brightest star, but it never moves. Face it and you\'re facing north.'],
  ['Cassiopeia', 10.13, 56.54, 'A bright W (or M) on the other side of Polaris from the Big Dipper.'],
  ['Summer Triangle', 279.23, 38.78, 'Three bright stars, Vega, Deneb and Altair, make a big triangle. The Milky Way runs through it on a dark night.'],
  ['Orion the Hunter', 88.79, 7.41, 'Look for three stars in a row: Orion\'s belt. Red Betelgeuse is his shoulder and blue-white Rigel his foot.'],
  ['Sirius', 101.29, -16.72, 'The brightest star in the night sky. Follow Orion\'s belt down and to the left.'],
  ['The Pleiades', 56.75, 24.12, 'A tiny, misty cluster that looks like a mini dipper. How many stars can your patrol count?'],
  ['Scorpius', 247.35, -26.43, 'A curving scorpion low in the south with red Antares at its heart.'],
  ['Leo the Lion', 152.09, 11.97, 'A backward question mark (the lion\'s mane) with bright Regulus at the bottom.'],
  ['Arcturus', 213.92, 19.18, 'Follow the curve of the Big Dipper\'s handle: "arc to Arcturus," a bright orange star.'],
  ['Great Square of Pegasus', 346.19, 15.21, 'Four stars in a big square. Fall\'s best landmark.'],
  ['Andromeda Galaxy', 10.68, 41.27, 'A faint fuzzy smudge 2.5 million light-years away. Best on a moonless night, away from town.'],
];
const dirOf = az => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
const highOf = alt => (alt > 70 ? 'nearly overhead' : alt > 45 ? 'high up' : alt > 20 ? 'partway up' : 'low');
const hm = d => d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function NightSky({ route }) {
  if (route.args[0] === 'point') return <PointMode route={route} />;
  return <Chart route={route} />;
}

function Chart({ route }) {
  const oid = route.query.outing;
  const outing = useApi(oid ? `c/outings/${oid}` : null).data?.item;
  const [here, setHere] = useState(null);
  const [locMsg, setLocMsg] = useState('');
  const [red, setRed] = useLocal('sky-red', true);
  const [face, setFace] = useState('south');
  const mq = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/.exec(outing?.mapQ || '');
  const place = here || (mq ? { lat: +mq[1], lng: +mq[3], name: outing.location || outing.title } : HOME);
  const [date, setDate] = useState(() => (route.query.date || (outing?.start) || ymd(new Date())));
  const evening = route.query.date || date;
  const day = oid && outing?.start && !route.query.date && date === ymd(new Date()) && outing.start > date ? outing.start : evening;
  const [hour, setHour] = useState(() => { const n = new Date(); const h = n.getHours() + n.getMinutes() / 60; return h >= 18 || h < 5 ? (h < 5 ? h + 24 : h) : 21; });
  const when = useMemo(() => { const d = new Date(`${day}T00:00:00`); d.setMinutes(Math.round(hour * 60)); return d; }, [day, hour]);
  const sky = useMemo(() => compute(place, when, day), [place.lat, place.lng, when.getTime(), day]); // eslint-disable-line react-hooks/exhaustive-deps
  const locate = () => { setLocMsg('Finding you…'); navigator.geolocation?.getCurrentPosition(p => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'Where you are' }); setLocMsg(''); }, () => setLocMsg('Location is off, so this shows the troop\'s hometown.'), { timeout: 10000, maximumAge: 600000 }); };
  const rot = { north: 180, east: 90, south: 0, west: -90 }[face];
  return (
    <div className={`content sky ${red ? 'red' : ''}`}>
      <PageHead backTo={oid ? `outing/${oid}` : 'more'} eyebrow={`🌌 ${place.name}`} title="Night sky" sub={`${when.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })} at ${hm(when)}`} />
      <div className="sky-tools">
        <button className={`chip sm ${red ? 'on' : ''}`} onClick={() => setRed(!red)} aria-pressed={red}>🔴 Night vision</button>
        <button className="chip sm" onClick={locate}><Icon name="pin" size={14} />Use where I am</button>
        <input type="date" className="sky-date" value={day} onChange={e => { setDate(e.target.value); if (route.query.date) go(`sky${oid ? `?outing=${oid}` : ''}`, { replace: true }); }} aria-label="Date" />
      </div>
      {locMsg && <p className="small muted">{locMsg}</p>}
      <a className="btn big accent sky-point-btn" href={`#/sky/point?lat=${place.lat}&lng=${place.lng}`}><Icon name="expand" size={18} />Point your phone at the sky</a>
      <div className="sky-facts">
        <span><b>🌇 {hm(sky.sunset)}</b>Sunset</span>
        <span><b>🌌 {hm(sky.dark)}</b>Fully dark</span>
        <span><b>{sky.moon.emoji} {sky.moon.pct}%</b>{sky.moon.name}</span>
        <span><b>🌙 {sky.moon.rise ? hm(sky.moon.rise) : '—'}</b>Moonrise</span>
      </div>
      <div className="sky-chart-wrap">
        <svg className="sky-chart" viewBox="-210 -210 420 420" role="img" aria-label={`Star chart for ${hm(when)}, facing ${face}`}>
          <defs><radialGradient id="skyg"><stop offset="0%" stopColor={red ? '#140303' : '#0B1633'} /><stop offset="100%" stopColor={red ? '#070101' : '#03060F'} /></radialGradient></defs>
          <circle r="196" fill="url(#skyg)" />
          <g transform={`rotate(${rot})`}>
            {[30, 60].map(a => <circle key={a} r={196 * (90 - a) / 90} className="sky-ring" />)}
            {sky.lines.map((l, i) => <polyline key={i} points={l.map(p => p.join(',')).join(' ')} className="sky-line" />)}
            {sky.stars.map((s, i) => <circle key={i} cx={s[0]} cy={s[1]} r={s[2]} className="sky-star" />)}
            {sky.labels.map(l => <text key={l.n} x={l.x} y={l.y} className="sky-con" transform={`rotate(${-rot} ${l.x} ${l.y})`}>{l.n}</text>)}
            {sky.named.map(s => <text key={s.n} x={s.x + 4} y={s.y - 3} className="sky-sname" transform={`rotate(${-rot} ${s.x} ${s.y})`}>{s.n}</text>)}
            {sky.planets.map(p => <g key={p.n}><circle cx={p.x} cy={p.y} r="4.2" fill={red ? '#FF6B6B' : p.c} /><text x={p.x + 6} y={p.y + 4} className="sky-planet" transform={`rotate(${-rot} ${p.x} ${p.y})`}>{p.n}</text></g>)}
            {sky.moonPos && <g><circle cx={sky.moonPos.x} cy={sky.moonPos.y} r="7" fill={red ? '#FF8A8A' : '#F5F1E0'} /><text x={sky.moonPos.x + 9} y={sky.moonPos.y + 4} className="sky-planet" transform={`rotate(${-rot} ${sky.moonPos.x} ${sky.moonPos.y})`}>Moon</text></g>}
            {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, az]) => { const [x, y] = proj(0, az, 206); return <text key={t} x={x} y={y + 5} className="sky-dir" transform={`rotate(${-rot} ${x} ${y})`}>{t}</text>; })}
          </g>
          <circle r="196" className="sky-edge" />
        </svg>
      </div>
      <div className="sky-face"><span className="small muted">I'm facing</span>{['north', 'east', 'south', 'west'].map(f => <button key={f} className={`chip sm ${face === f ? 'on' : ''}`} onClick={() => setFace(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
      <p className="small muted center">Hold the phone up and match the bottom edge to the direction you're facing. The middle is straight overhead.</p>
      <label className="sky-time"><span>{hm(when)}</span><input type="range" min="17" max="29" step="0.25" value={hour} onChange={e => setHour(+e.target.value)} aria-label="Time of night" /><span className="small muted">5 PM → 5 AM</span></label>
      {sky.planets.length > 0 && (
        <Section title="Planets tonight">
          <ul className="sky-list">{sky.planets.map(p => <li key={p.n} className="card"><span className="sl-dot" style={{ background: red ? '#FF6B6B' : p.c }} /><span className="grow"><b>{p.n}</b><span className="small">Look {p.dir}, {p.high}. {p.n === 'Venus' ? 'The brightest thing after the Moon.' : p.n === 'Jupiter' ? 'Very bright and steady. Binoculars may show its moons.' : p.n === 'Saturn' ? 'A steady yellowish dot. A small telescope shows the rings.' : p.n === 'Mars' ? 'A steady orange-red dot.' : 'Low and quick to set. A real find!'}</span></span></li>)}</ul>
        </Section>
      )}
      <Section title="Easy finds right now">
        {sky.finds.length ? <ul className="sky-list">{sky.finds.map(f => <li key={f.n} className="card"><span className="sl-star" aria-hidden="true">✦</span><span className="grow"><b>{f.n}</b><span className="small">Look {f.dir}, {f.high}. {f.d}</span></span></li>)}</ul>
          : <p className="small muted">Move the time slider later into the night.</p>}
      </Section>
      <div className="card sky-tips"><b>Stargazing tips</b><ul>
        <li>Give your eyes 20 minutes in the dark. Use a red light (or Night vision mode) so you don't lose it.</li>
        <li>The Moon washes out faint stars. {sky.moon.pct > 60 ? 'Tonight\'s Moon is bright, so look for the bright stars and planets.' : 'Tonight\'s Moon is small or down, so it\'s a good night for faint things.'}</li>
        <li>Lie on your back on a sleeping pad. Satellites look like slow, steady stars sliding across the sky.</li>
      </ul></div>
      <p className="small muted">Star and constellation data from d3-celestial (Olaf Frohn); sky math from Astronomy Engine (Don Cross).</p>
    </div>
  );
}

// azimuth/altitude → chart x,y (north up before rotation; east to the left, as when looking up)
function proj(alt, az, R = 196) {
  const r = R * (90 - alt) / 90, a = az * Math.PI / 180;
  return [Math.round(-r * Math.sin(a) * 10) / 10, Math.round(-r * Math.cos(a) * 10) / 10];
}

function compute(place, when, day) {
  const obs = new A.Observer(place.lat, place.lng, 0);
  const t = A.MakeTime(when);
  const hor = (raDeg, dec) => A.Horizon(t, obs, (((raDeg % 360) + 360) % 360) / 15, dec, 'normal');
  const up = (raDeg, dec) => { const h = hor(raDeg, dec); return h.altitude > 0 ? [...proj(h.altitude, h.azimuth), h] : null; };
  const stars = [];
  for (const [ra, dec, mag] of SKY.stars) { const p = up(ra, dec); if (p) stars.push([p[0], p[1], Math.max(0.55, 3.1 - 0.6 * mag)]); }
  const lines = [];
  for (const segs of Object.values(SKY.lines)) for (const seg of segs) {
    let cur = [];
    for (const [ra, dec] of seg) { const p = up(ra, dec); if (p) cur.push([p[0], p[1]]); else { if (cur.length > 1) lines.push(cur); cur = []; } }
    if (cur.length > 1) lines.push(cur);
  }
  const labels = [];
  for (const [n, ra, dec, rank] of Object.values(SKY.names)) { if (rank > 1) continue; const p = up(ra, dec); if (p && p[2].altitude > 12) labels.push({ n, x: p[0], y: p[1] }); }
  const named = [];
  for (const [n, ra, dec, mag] of SKY.named) { if (mag > 1.3) continue; const p = up(ra, dec); if (p && p[2].altitude > 8) named.push({ n, x: p[0], y: p[1] }); }
  const planets = [];
  for (const [n, c] of PLANETS) {
    const eq = A.Equator(A.Body[n], t, obs, true, true); const h = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
    if (h.altitude > 3) { const [x, y] = proj(h.altitude, h.azimuth); planets.push({ n, c, x, y, dir: dirOf(h.azimuth), high: highOf(h.altitude) }); }
  }
  const meq = A.Equator(A.Body.Moon, t, obs, true, true); const mh = A.Horizon(t, obs, meq.ra, meq.dec, 'normal');
  const moonPos = mh.altitude > 0 ? (([x, y]) => ({ x, y }))(proj(mh.altitude, mh.azimuth)) : null;
  const phase = A.MoonPhase(t), frac = A.Illumination(A.Body.Moon, t).phase_fraction;
  const pname = phase < 10 || phase > 350 ? 'New Moon' : phase < 80 ? 'Waxing crescent' : phase < 100 ? 'First quarter' : phase < 170 ? 'Waxing gibbous' : phase < 190 ? 'Full Moon' : phase < 260 ? 'Waning gibbous' : phase < 280 ? 'Last quarter' : 'Waning crescent';
  const emoji = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round(phase / 45) % 8];
  const noon = A.MakeTime(new Date(`${day}T12:00:00`));
  const safe = f => { try { return f()?.date || null; } catch { return null; } };
  const sunset = safe(() => A.SearchRiseSet(A.Body.Sun, obs, -1, noon, 1));
  const dark = safe(() => A.SearchAltitude(A.Body.Sun, obs, -1, noon, 1, -18));
  const rise = safe(() => A.SearchRiseSet(A.Body.Moon, obs, +1, noon, 1));
  const finds = [];
  for (const [n, ra, dec, d] of FINDS) { const h = hor(ra, dec); if (h.altitude > 15) finds.push({ n, d, dir: dirOf(h.azimuth), high: highOf(h.altitude), alt: h.altitude }); }
  return { stars, lines, labels, named, planets, moonPos, moon: { pct: Math.round(frac * 100), name: pname, emoji, rise }, sunset, dark, finds };
}

// ---------------------------------------------------------------- point-at-the-sky mode
// The phone's compass and tilt aim a live view of the sky; the camera can show behind it.
// Math: the W3C device orientation angles give a rotation from the phone to east-north-up.
function rotMatrix(alpha, beta, gamma) {
  const d = Math.PI / 180, a = alpha * d, b = beta * d, g = gamma * d;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return [
    [ca * cg - sa * sb * sg, -cb * sa, ca * sg + cg * sa * sb],
    [cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb],
    [-cb * sg, sb, cb * cg],
  ];
}
const mul = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// altitude/azimuth → east-north-up unit vector
const enu = (alt, az) => { const d = Math.PI / 180, ca = Math.cos(alt * d); return [ca * Math.sin(az * d), ca * Math.cos(az * d), Math.sin(alt * d)]; };

function skyObjects(lat, lng) {
  const obs = new A.Observer(lat, lng, 0), t = A.MakeTime(new Date());
  const hz = (raDeg, dec) => { const h = A.Horizon(t, obs, (((raDeg % 360) + 360) % 360) / 15, dec, 'normal'); return enu(h.altitude, h.azimuth); };
  const stars = SKY.stars.map(([ra, dec, mag]) => [hz(ra, dec), Math.max(0.8, 3.6 - 0.65 * mag)]);
  const lines = []; for (const segs of Object.values(SKY.lines)) for (const seg of segs) lines.push(seg.map(([ra, dec]) => hz(ra, dec)));
  const labels = Object.values(SKY.names).filter(n => n[3] <= 2).map(([n, ra, dec]) => ({ n, v: hz(ra, dec) }));
  const named = SKY.named.filter(s => s[3] <= 1.6).map(([n, ra, dec]) => ({ n, v: hz(ra, dec) }));
  const bodies = [...PLANETS.map(([n, c]) => [n, c]), ['Moon', '#F5F1E0']].map(([n, c]) => { const eq = A.Equator(A.Body[n], t, obs, true, true); const h = A.Horizon(t, obs, eq.ra, eq.dec, 'normal'); return { n, c, v: enu(h.altitude, h.azimuth) }; });
  return { stars, lines, labels, named, bodies };
}

function PointMode({ route }) {
  const lat = +route.query.lat || HOME.lat, lng = +route.query.lng || HOME.lng;
  const canvas = useRef(null), video = useRef(null);
  const view = useRef({ R: null, drag: { az: 180, alt: 35 }, offset: 0, live: false });
  const [status, setStatus] = useState('ask');   // ask → live | drag
  const [cam, setCam] = useState(false);
  const [aim, setAim] = useState('');
  const [offset, setOffset] = useState(0);
  const objs = useRef(null);
  const [red, setRed] = useLocal('sky-red', true);
  useEffect(() => { objs.current = skyObjects(lat, lng); const t = setInterval(() => { objs.current = skyObjects(lat, lng); }, 60000); return () => clearInterval(t); }, [lat, lng]);
  useEffect(() => { view.current.offset = offset; }, [offset]);

  // device sensors
  async function start() {
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') throw new Error('denied'); } } catch { setStatus('drag'); return; }
    let got = false;
    const on = e => {
      let alpha = e.alpha;
      if (typeof e.webkitCompassHeading === 'number') alpha = 360 - e.webkitCompassHeading;
      else if (!e.absolute && e.type !== 'deviceorientationabsolute') return;
      if (alpha == null || e.beta == null) return;
      got = true; view.current.live = true;
      view.current.R = rotMatrix(alpha + view.current.offset, e.beta, e.gamma || 0);
    };
    const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    addEventListener(evt, on);
    view.current.stop = () => removeEventListener(evt, on);
    setStatus('live');
    setTimeout(() => { if (!got) setStatus('drag'); }, 2500);
  }
  useEffect(() => () => { view.current.stop?.(); }, []);

  // camera behind the stars
  useEffect(() => {
    if (!cam) return undefined;
    let stream;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(s => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } }).catch(() => setCam(false));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [cam]);

  // drag to look around (computers, or phones without a compass)
  useEffect(() => {
    const el = canvas.current; if (!el) return undefined;
    let p = null;
    const down = e => { p = [e.clientX, e.clientY]; el.setPointerCapture?.(e.pointerId); };
    const move = e => { if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; p = [e.clientX, e.clientY]; if (view.current.live) { setOffset(o => o - dx * 0.1); return; } const v = view.current.drag; v.az = (v.az - dx * 0.15 + 360) % 360; v.alt = Math.max(-10, Math.min(89, v.alt + dy * 0.15)); };
    const up = () => { p = null; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [status]);

  // draw
  useEffect(() => {
    let raf, lastAim = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current, O = objs.current; if (!c || !O) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      let f, r, u;
      if (view.current.live && view.current.R) {
        const R = view.current.R;
        f = mul(R, [0, 0, -1]); r = mul(R, [1, 0, 0]); u = mul(R, [0, 1, 0]);
        const ang = ((screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
        if (ang) { const r2 = r.map((x, i) => x * Math.cos(ang) - u[i] * Math.sin(ang)); const u2 = u.map((x, i) => x * Math.sin(ang) + u[i] * Math.cos(ang)); r = r2; u = u2; }
      } else {
        const { az, alt } = view.current.drag; f = enu(alt, az); r = enu(0, az + 90); u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      }
      const foc = (Math.max(W, H) / 2) / Math.tan((32 * Math.PI) / 180);
      const P = v => { const z = dot(v, f); if (z < 0.15) return null; return [W / 2 + (dot(v, r) / z) * foc, H / 2 - (dot(v, u) / z) * foc]; };
      const C = red ? { line: 'rgba(255,90,90,.35)', star: '#FF7B7B', text: 'rgba(255,140,140,.9)', hz: 'rgba(255,90,90,.6)' } : { line: 'rgba(140,180,255,.35)', star: '#FFFFFF', text: 'rgba(200,220,255,.9)', hz: 'rgba(120,200,140,.7)' };
      // horizon and compass points
      g.strokeStyle = C.hz; g.lineWidth = 1.5; g.beginPath(); let pen = false;
      for (let az = 0; az <= 360; az += 3) { const p = P(enu(0, az)); if (p) { if (pen) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); pen = true; } else pen = false; }
      g.stroke();
      g.font = '700 15px system-ui'; g.fillStyle = C.hz; g.textAlign = 'center';
      for (const [t, az] of [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]) { const p = P(enu(1, az)); if (p) g.fillText(t, p[0], p[1] - 6); }
      // constellation lines
      g.strokeStyle = C.line; g.lineWidth = 1.2;
      for (const l of O.lines) { g.beginPath(); let on = false; for (const v of l) { const p = P(v); if (p && v[2] > -0.05) { if (on) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); on = true; } else on = false; } g.stroke(); }
      // stars
      g.fillStyle = C.star;
      for (const [v, s] of O.stars) { if (v[2] < -0.02) continue; const p = P(v); if (p && p[0] > -5 && p[0] < W + 5 && p[1] > -5 && p[1] < H + 5) { g.beginPath(); g.arc(p[0], p[1], s, 0, 6.283); g.fill(); } }
      g.font = '600 13px system-ui'; g.fillStyle = C.text; g.textAlign = 'left';
      for (const s of O.named) { if (s.v[2] < 0) continue; const p = P(s.v); if (p) g.fillText(s.n, p[0] + 6, p[1] - 4); }
      g.font = '700 14px system-ui'; g.textAlign = 'center'; g.fillStyle = red ? 'rgba(255,120,120,.75)' : 'rgba(150,190,255,.8)';
      for (const l of O.labels) { if (l.v[2] < 0) continue; const p = P(l.v); if (p) g.fillText(l.n.toUpperCase(), p[0], p[1]); }
      for (const b of O.bodies) { const p = P(b.v); if (!p) continue; g.fillStyle = red ? '#FF6B6B' : b.c; g.beginPath(); g.arc(p[0], p[1], b.n === 'Moon' ? 11 : 5, 0, 6.283); g.fill(); g.font = '800 15px system-ui'; g.fillText(`${b.n}${b.v[2] < 0 ? ' (below the horizon)' : ''}`, p[0], p[1] - 14); }
      // what's in the middle
      const now = performance.now();
      if (now - lastAim > 400) {
        lastAim = now;
        let best = '', bd = 0.9993;
        for (const b of O.bodies) { const d = dot(b.v, f); if (d > 0.997 && d > bd - 0.003) { best = b.n; bd = d + 0.003; } }
        if (!best) for (const s of O.named) { const d = dot(s.v, f); if (d > bd) { best = s.n; bd = d; } }
        if (!best) { let bl = 0.985; for (const l of O.labels) { const d = dot(l.v, f); if (d > bl) { best = l.n; bl = d; } } }
        const alt = Math.asin(Math.max(-1, Math.min(1, f[2]))) * 180 / Math.PI, az = (Math.atan2(f[0], f[1]) * 180 / Math.PI + 360) % 360;
        setAim(`${best ? `${best} · ` : ''}${dirOf(az)}, ${Math.round(alt)}° up`);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [red]);

  return (
    <div className={`emcee sky-point ${red ? 'red' : ''}`} role="dialog" aria-label="Point at the sky">
      {cam && <video ref={video} className="sp-video" playsInline muted />}
      <canvas ref={canvas} className="sp-canvas" />
      <div className="sp-cross" aria-hidden="true" />
      <div className="em-top sp-top"><button className="icon-btn on-dark" onClick={() => go('sky', { replace: true })} aria-label="Leave"><Icon name="x" /></button><span className="grow em-plan">{aim || 'Point at the sky'}</span></div>
      {status === 'ask' && (
        <div className="sp-ask card"><b>Point your phone at the sky</b><p className="small">Basecamp uses your phone's compass and tilt to show what's there. Your phone will ask to allow motion. Nothing is saved or sent.</p>
          <div className="btn-row"><button className="btn accent" onClick={start}>Start</button><button className="btn secondary" onClick={() => setStatus('drag')}>Drag to look around</button></div></div>
      )}
      {status === 'drag' && <p className="sp-hint">Drag to look around. {typeof DeviceOrientationEvent === 'undefined' ? '' : 'Motion sensors aren\'t available here.'}</p>}
      <div className="sp-foot">
        <button className={`chip sm on-dark-chip ${red ? 'on' : ''}`} onClick={() => setRed(!red)} aria-pressed={red}>🔴 Night vision</button>
        <button className={`chip sm on-dark-chip ${cam ? 'on' : ''}`} onClick={() => setCam(!cam)} aria-pressed={cam}>📷 Camera</button>
        {status === 'live' && <span className="small sp-nudge">Stars off a bit? Drag sideways to line them up{offset ? ` (${Math.round(offset)}°)` : ''}.</span>}
      </div>
    </div>
  );
}
