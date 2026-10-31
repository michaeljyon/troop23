import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { dist, feet, miles, MILE } from '../lib/geo.js';

// Trail map for hikes. Leaflet and the tiles load only when a map is shown.
// Base maps: Topo (OpenTopoMap), Satellite and Hybrid (USGS imagery, public
// domain), USGS Topo (public domain) and Street (OpenStreetMap). Overlays:
// marked hiking trails (Waymarked Trails) and hillshade (USGS). Each map's
// credit is shown in the corner, as their terms ask.
const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const USGS = 'Map services and data: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>';
const NM = s => `https://basemap.nationalmap.gov/arcgis/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;
export const BASES = {
  topo: { label: 'Topo', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', native: 17, attribution: `${OSM}, SRTM · Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`, swatch: 'linear-gradient(135deg,#cfe3b6,#e9dcb0 55%,#b9cf9c)' },
  sat: { label: 'Satellite', url: NM('USGSImageryOnly'), native: 16, attribution: USGS, swatch: 'linear-gradient(135deg,#2f4a2a,#5b6b3c 50%,#3c5a4a)', dark: true },
  hybrid: { label: 'Hybrid', url: NM('USGSImageryTopo'), native: 16, attribution: USGS, swatch: 'linear-gradient(135deg,#2f4a2a,#6b7b4c 50%,#3c5a4a)', dark: true },
  usgs: { label: 'USGS Topo', url: NM('USGSTopo'), native: 16, attribution: USGS, swatch: 'linear-gradient(135deg,#f3efe2,#dfe8cf 60%,#e8d9b9)' },
  street: { label: 'Street', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', native: 19, attribution: OSM, swatch: 'linear-gradient(135deg,#f2efe9,#dfe7ef 60%,#f6e7c8)' },
};
const OVERLAYS = {
  trails: { label: 'Hiking trails', url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', native: 18, opacity: 0.85, attribution: 'Trails © <a href="https://waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)' },
  shade: { label: 'Hillshade', url: NM('USGSShadedReliefOnly'), native: 16, opacity: 0.35, attribution: USGS },
};
const COLORS = { elevation: 'Elevation', pace: 'Pace', plain: 'Plain' };
const RAMP = ['#1F7A47', '#4E9F3D', '#9BBF3A', '#E9B949', '#E8833A', '#D35424', '#B3261E'];
const ramp = f => RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(f * (RAMP.length - 1))))];
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// cumulative distance along the shown points (pauses don't count)
function along(points) {
  const c = [0];
  for (let i = 1; i < points.length; i++) c.push(c[i - 1] + ((points[i - 1][4] || 0) === (points[i][4] || 0) ? dist(points[i - 1], points[i]) : 0));
  return c;
}

// points: [[lat, lng, ele?, t?, seg?]]; offset: meters hidden before the first point
// focus: meters along the hike to mark (from the elevation chart); overlay: content drawn over the map
export default function HikeMap({ points = [], live = false, height = 320, here = null, offset = 0, focus = null, overlay = null, className = '', tall = false }) {
  const box = useRef(null);
  const st = useRef({});
  const [base, setBase] = useState(() => pref('hike-base', 'topo'));
  const [over, setOver] = useState(() => pref('hike-over', '').split(',').filter(k => OVERLAYS[k]));
  const [color, setColor] = useState(() => pref('hike-color', 'elevation'));
  const [panel, setPanel] = useState(false);
  const [full, setFull] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cum = useMemo(() => along(points), [points]);
  const hasOverlay = !!overlay;

  useEffect(() => {
    let gone = false;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (gone || !box.current) return;
      const L = mod.default || mod;
      const map = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: !live, preferCanvas: true, zoomSnap: 0.5 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      st.current = { L, map, renderer: L.canvas({ padding: 0.5 }) };
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { gone = true; st.current.map?.remove(); st.current = {}; };
  }, [live]);

  useEffect(() => {   // base map
    const { L, map } = st.current; if (!ready || !map) return;
    st.current.base?.remove();
    const b = BASES[base] || BASES.topo;
    st.current.base = L.tileLayer(b.url, { maxNativeZoom: b.native, maxZoom: 19, attribution: b.attribution, referrerPolicy: 'strict-origin-when-cross-origin', detectRetina: false }).addTo(map);
    st.current.base.bringToBack();
    keep('hike-base', base);
  }, [ready, base]);

  useEffect(() => {   // overlays
    const { L, map } = st.current; if (!ready || !map) return;
    (st.current.over || []).forEach(l => l.remove());
    st.current.over = over.map(k => L.tileLayer(OVERLAYS[k].url, { maxNativeZoom: OVERLAYS[k].native, maxZoom: 19, opacity: OVERLAYS[k].opacity, attribution: OVERLAYS[k].attribution, referrerPolicy: 'strict-origin-when-cross-origin', zIndex: 5 }).addTo(map));
    keep('hike-over', over.join(','));
  }, [ready, over]);

  const fitted = useRef(false);
  const range = useMemo(() => {   // for the legend and colors
    const e = points.map(p => p[2]).filter(x => x != null);
    const sp = [];
    for (let i = 1; i < points.length; i++) { const dt = points[i][3] - points[i - 1][3]; if (dt > 0 && cum[i] > cum[i - 1]) sp.push((cum[i] - cum[i - 1]) / dt); }
    sp.sort((a, b) => a - b);
    return { lo: e.length ? Math.min(...e) : 0, hi: e.length ? Math.max(...e) : 0, hasEle: e.length > points.length * 0.5, s5: sp[Math.floor(sp.length * 0.05)] || 0, s95: sp[Math.floor(sp.length * 0.95)] || 1 };
  }, [points, cum]);
  const mode = color === 'elevation' && !range.hasEle ? 'plain' : color === 'pace' && points.every(p => !p[3]) ? 'plain' : color;

  useEffect(() => {   // the route
    const { L, map, renderer } = st.current; if (!ready || !map) return;
    st.current.route?.remove();
    const layers = [];
    // segments split at pauses
    const segs = [];
    points.forEach((p, i) => { const k = p[4] || 0; if (!segs.length || segs[segs.length - 1].k !== k) segs.push({ k, idx: [] }); segs[segs.length - 1].idx.push(i); });
    const ll = i => [points[i][0], points[i][1]];
    for (const s of segs) layers.push(L.polyline(s.idx.map(ll), { renderer, color: '#0b1a12', weight: live ? 9 : 9, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }), L.polyline(s.idx.map(ll), { renderer, color: '#fff', weight: 7, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }));
    if (mode === 'plain' || live) for (const s of segs) layers.push(L.polyline(s.idx.map(ll), { renderer, color: '#E8833A', weight: 4.5, lineCap: 'round', lineJoin: 'round' }));
    else {
      const val = i => {
        if (mode === 'elevation') { const e = points[i][2] ?? points[i - 1]?.[2]; return range.hi > range.lo ? (e - range.lo) / (range.hi - range.lo) : 0.5; }
        const dt = points[i][3] - points[i - 1][3]; const v = dt > 0 ? (cum[i] - cum[i - 1]) / dt : range.s5;
        return range.s95 > range.s5 ? 1 - (v - range.s5) / (range.s95 - range.s5) : 0.5;   // faster = greener
      };
      for (const s of segs) {
        let run = [s.idx[0]], col = null;
        for (let j = 1; j < s.idx.length; j++) {
          const i = s.idx[j], c = ramp(val(i));
          if (col && c !== col) { layers.push(L.polyline(run.map(ll), { renderer, color: col, weight: 4.5, lineCap: 'round', lineJoin: 'round' })); run = [run[run.length - 1]]; }
          col = c; run.push(i);
        }
        if (run.length > 1) layers.push(L.polyline(run.map(ll), { renderer, color: col, weight: 4.5, lineCap: 'round', lineJoin: 'round' }));
      }
    }
    if (points.length) {
      // mile markers
      if (!live) {
        for (let m = 1, j = 0; ; m++) {
          const target = m * MILE - offset; if (target > cum[cum.length - 1]) break;
          if (target < 0) continue;
          while (j < cum.length - 1 && cum[j] < target) j++;
          layers.push(L.marker(ll(j), { icon: L.divIcon({ className: 'mile-pin', html: `<span>${m}</span>`, iconSize: [22, 22] }), keyboard: false, interactive: false }));
        }
      }
      const first = points[0], last = points[points.length - 1];
      layers.push(L.marker([first[0], first[1]], { icon: L.divIcon({ className: 'end-pin start', html: '<span>▶</span>', iconSize: [24, 24] }), keyboard: false, title: 'Start' }));
      if (live) layers.push(L.marker([last[0], last[1]], { icon: L.divIcon({ className: 'you-pin', html: '<span></span>', iconSize: [22, 22] }), keyboard: false, title: 'You' }));
      else layers.push(L.marker([last[0], last[1]], { icon: L.divIcon({ className: 'end-pin finish', html: '<span>⚑</span>', iconSize: [24, 24] }), keyboard: false, title: 'Finish' }));
    } else if (here && live) layers.push(L.marker(here, { icon: L.divIcon({ className: 'you-pin', html: '<span></span>', iconSize: [22, 22] }), keyboard: false }));
    st.current.route = L.layerGroup(layers).addTo(map);

    if (points.length && live) map.setView([points[points.length - 1][0], points[points.length - 1][1]], Math.max(map.getZoom() || 0, 16), { animate: true });
    else if (points.length && !fitted.current) { map.fitBounds(L.latLngBounds(points.map(p => [p[0], p[1]])), { paddingTopLeft: [30, hasOverlay ? 110 : 30], paddingBottomRight: [60, hasOverlay ? (tall ? 190 : 120) : 30] }); fitted.current = true; }
    else if (!points.length && here) map.setView(here, Math.max(map.getZoom() || 0, 16));
    else if (!st.current.viewSet && !points.length) map.setView([30.4383, -84.2807], 11);   // Tallahassee
    st.current.viewSet = true;
  }, [ready, points, live, here, mode, offset, cum, range, hasOverlay, tall]);

  useEffect(() => {   // marker that follows the elevation chart
    const { L, map } = st.current; if (!ready || !map) return;
    st.current.focus?.remove(); st.current.focus = null;
    if (focus == null || !points.length) return;
    const target = focus - offset; if (target < 0 || target > cum[cum.length - 1]) return;
    let j = 0; while (j < cum.length - 1 && cum[j] < target) j++;
    st.current.focus = L.marker([points[j][0], points[j][1]], { icon: L.divIcon({ className: 'focus-pin', html: '<span></span>', iconSize: [18, 18] }), interactive: false }).addTo(map);
  }, [ready, focus, points, cum, offset]);

  useEffect(() => {   // full screen
    const { map } = st.current; if (!map) return undefined;
    document.body.classList.toggle('no-scroll', full);
    const t = setTimeout(() => map.invalidateSize(), 60);
    const esc = e => e.key === 'Escape' && setFull(false);
    if (full) addEventListener('keydown', esc);
    return () => { clearTimeout(t); removeEventListener('keydown', esc); document.body.classList.remove('no-scroll'); };
  }, [full]);

  if (failed) return <div className="hike-map empty-map" style={{ height }}>The map couldn't load. Check your signal.</div>;
  const dark = BASES[base]?.dark;
  return (
    <div className={`hike-map-wrap ${full ? 'full' : ''} ${dark ? 'on-dark-map' : ''} ${className}`}>
      <div ref={box} className="hike-map" style={{ height: full ? '100%' : height }} />
      <div className="map-tools">
        <button type="button" className="map-btn" onClick={() => setPanel(v => !v)} aria-expanded={panel} aria-label="Map layers"><Icon name="layers" size={19} /></button>
        <button type="button" className="map-btn" onClick={() => setFull(v => !v)} aria-label={full ? 'Exit full screen' : 'Full screen map'}><Icon name={full ? 'shrink' : 'expand'} size={18} /></button>
        <span className="map-zoom"><button type="button" onClick={() => st.current.map?.zoomIn()} aria-label="Zoom in"><Icon name="plus" size={18} /></button><button type="button" onClick={() => st.current.map?.zoomOut()} aria-label="Zoom out"><b>−</b></button></span>
      </div>
      {panel && (
        <div className="map-panel" role="dialog" aria-label="Map layers">
          <p className="mp-h">Map</p>
          <div className="mp-bases">{Object.entries(BASES).map(([k, b]) => (
            <button key={k} type="button" className={base === k ? 'on' : ''} onClick={() => setBase(k)}><span className="mp-sw" style={{ background: b.swatch }} />{b.label}</button>
          ))}</div>
          <p className="mp-h">Overlays</p>
          {Object.entries(OVERLAYS).map(([k, o]) => (
            <label key={k} className="mp-check"><input type="checkbox" checked={over.includes(k)} onChange={e => setOver(v => (e.target.checked ? [...v, k] : v.filter(x => x !== k)))} />{o.label}</label>
          ))}
          {!live && <>
            <p className="mp-h">Color the route by</p>
            <div className="mp-seg">{Object.entries(COLORS).map(([k, l]) => <button key={k} type="button" className={color === k ? 'on' : ''} onClick={() => { setColor(k); keep('hike-color', k); }} disabled={k === 'elevation' && !range.hasEle}>{l}</button>)}</div>
          </>}
        </div>
      )}
      {!live && mode !== 'plain' && points.length > 1 && (
        <div className="map-legend" aria-hidden="true">
          <span>{mode === 'elevation' ? `${Math.round(feet(range.lo))} ft` : 'Fast'}</span><i style={{ background: `linear-gradient(180deg, ${RAMP.join(',')})` }} /><span>{mode === 'elevation' ? `${Math.round(feet(range.hi))} ft` : 'Slow'}</span>
        </div>
      )}
      {overlay && <div className="map-overlay">{overlay}</div>}
    </div>
  );
}

// Lightweight route sketch for lists (no map tiles)
export function RouteThumb({ pts = [], size = 84 }) {
  if (pts.length < 2) return <span className="route-thumb none" style={{ width: size, height: size }} aria-hidden="true">🥾</span>;
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, k = Math.cos(midLat * Math.PI / 180);
  const xs = lngs.map(x => x * k), w = Math.max(...xs) - Math.min(...xs) || 1e-6, h = Math.max(...lats) - Math.min(...lats) || 1e-6;
  const s = (size - 16) / Math.max(w, h), ox = (size - w * s) / 2, oy = (size - h * s) / 2, x0 = Math.min(...xs), y1 = Math.max(...lats);
  const P = pts.map((p, i) => [ox + (xs[i] - x0) * s, oy + (y1 - p[0]) * s]);
  const d = P.map((p, i) => `${i && (pts[i][2] || 0) === (pts[i - 1][2] || 0) ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg className="route-thumb" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs><pattern id="rt-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="rgba(30,74,54,.08)" strokeWidth="1" /></pattern></defs>
      <rect width={size} height={size} fill="url(#rt-grid)" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#E8833A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={P[0][0]} cy={P[0][1]} r="4" fill="#1F7A47" stroke="#fff" strokeWidth="1.5" /><circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r="4" fill="#B3261E" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

// Elevation profile: [[meters along, elevation m], ...]. Hover or drag to see
// the spot on the map (onFocus gets meters along the hike, or null).
export function ElevationChart({ profile = [], onFocus }) {
  const ref = useRef(null);
  const [at, setAt] = useState(null);
  const pts = profile.filter(p => p[1] != null);
  if (pts.length < 2) return null;
  const W = 640, H = 170, L = 46, B = 24, T = 14, R = 10;
  const xMax = pts[pts.length - 1][0] || 1;
  const eles = pts.map(p => feet(p[1]));
  let lo = Math.min(...eles), hi = Math.max(...eles);
  if (hi - lo < 40) { const m = (hi + lo) / 2; lo = m - 20; hi = m + 20; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = v => L + (v / xMax) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(eles[i]).toFixed(1)}`).join('');
  const area = `${line}L${x(xMax).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const totalMi = miles(xMax);
  const step = totalMi > 8 ? 2 : totalMi > 3 ? 1 : totalMi > 1.2 ? 0.5 : 0.25;
  const xt = []; for (let m = 0; m <= totalMi + 1e-9; m += step) xt.push(m);
  function move(e) {
    const r = ref.current.getBoundingClientRect();
    const cx = ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) / r.width * W;
    const v = Math.max(0, Math.min(xMax, (cx - L) / (W - L - R) * xMax));
    let k = 0; while (k < pts.length - 1 && pts[k][0] < v) k++;
    setAt(k); onFocus?.(pts[k][0]);
  }
  const leave = () => { setAt(null); onFocus?.(null); };
  const grade = at != null && at > 0 ? ((pts[at][1] - pts[at - 1][1]) / Math.max(1, pts[at][0] - pts[at - 1][0])) * 100 : null;
  return (
    <figure className="elev-chart">
      <div className="ec-head"><b>Elevation</b>{at != null ? <span className="ec-read">{miles(pts[at][0]).toFixed(2)} mi · <b>{Math.round(eles[at])} ft</b>{grade != null && ` · ${grade >= 0 ? '+' : ''}${grade.toFixed(1)}% grade`}</span> : <span className="ec-read muted">Slide along the chart to see it on the map</span>}</div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation from ${Math.round(Math.min(...eles))} to ${Math.round(Math.max(...eles))} feet over ${totalMi.toFixed(1)} miles`}
        onMouseMove={move} onMouseLeave={leave} onTouchStart={move} onTouchMove={move} onTouchEnd={leave}>
        <defs><linearGradient id="ec-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E8833A" stopOpacity=".45" /><stop offset="1" stopColor="#E8833A" stopOpacity=".04" /></linearGradient></defs>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 8} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text></g>)}
        <path d={area} fill="url(#ec-fill)" /><path d={line} className="line" />
        {xt.map(m => <text key={m} x={x(m * MILE)} y={H - 6} textAnchor={m === 0 ? 'start' : m * MILE > xMax * 0.95 ? 'end' : 'middle'}>{m === 0 ? '0' : `${m} mi`}</text>)}
        {at != null && <g className="ec-cursor"><line x1={x(pts[at][0])} x2={x(pts[at][0])} y1={T} y2={H - B} /><circle cx={x(pts[at][0])} cy={y(eles[at])} r="5.5" /></g>}
      </svg>
    </figure>
  );
}
