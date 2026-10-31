import { useEffect, useRef, useState } from 'react';
import { feet, miles } from '../lib/geo.js';

// Trail map for hikes. Leaflet and the map tiles load only when a map is
// shown. Topo (OpenTopoMap) shows trails and contour lines; Street is
// OpenStreetMap. Both need their credit shown, which Leaflet does.
const LAYERS = {
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM · Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
  street: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
};

// points: [[lat, lng, ele?, t?, seg?], ...]; live: follow the newest point
export default function HikeMap({ points = [], live = false, height = 320, here = null }) {
  const box = useRef(null);
  const st = useRef({});
  const [layer, setLayer] = useState(() => { try { return localStorage.getItem('hike-layer') || 'topo'; } catch { return 'topo'; } });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let gone = false;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (gone || !box.current) return;
      const L = mod.default || mod;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: !live, tap: true });
      st.current = { L, map };
      setReady(true);
    }).catch(() => setFailed(true));
    return () => { gone = true; st.current.map?.remove(); st.current = {}; };
  }, [live]);

  useEffect(() => {   // base layer
    const { L, map } = st.current; if (!ready || !map) return;
    st.current.tiles?.remove();
    const cfg = LAYERS[layer];
    st.current.tiles = L.tileLayer(cfg.url, { maxZoom: cfg.max, attribution: cfg.attribution, referrerPolicy: 'strict-origin-when-cross-origin' }).addTo(map);
    try { localStorage.setItem('hike-layer', layer); } catch { /* private mode */ }
  }, [ready, layer]);

  const fitted = useRef(false);
  useEffect(() => {   // the route
    const { L, map } = st.current; if (!ready || !map) return;
    st.current.route?.remove(); st.current.ends?.remove();
    const segs = [];
    for (const p of points) { const k = p[4] || 0; if (!segs.length || segs[segs.length - 1].k !== k) segs.push({ k, pts: [] }); segs[segs.length - 1].pts.push([p[0], p[1]]); }
    const lines = segs.map(s => s.pts);
    if (lines.length) {
      st.current.route = L.layerGroup([
        L.polyline(lines, { color: '#fff', weight: 8, opacity: 0.9 }),
        L.polyline(lines, { color: '#E8833A', weight: 5, opacity: 1 }),
      ]).addTo(map);
      const first = points[0], last = points[points.length - 1];
      st.current.ends = L.layerGroup([
        L.circleMarker([first[0], first[1]], { radius: 7, color: '#fff', weight: 3, fillColor: '#1F7A47', fillOpacity: 1 }).bindTooltip(live ? 'Start' : 'Start (after privacy trim)'),
        L.circleMarker([last[0], last[1]], { radius: live ? 9 : 7, color: '#fff', weight: 3, fillColor: live ? '#1D5FBF' : '#B3261E', fillOpacity: 1 }).bindTooltip(live ? 'You' : 'Finish'),
      ]).addTo(map);
      if (live) map.setView([last[0], last[1]], Math.max(map.getZoom() || 0, 16));
      else if (!fitted.current) { map.fitBounds(L.latLngBounds(points.map(p => [p[0], p[1]])), { padding: [24, 24] }); fitted.current = true; }
    } else if (here) map.setView(here, 16);
    else if (!st.current.viewSet) map.setView([30.4383, -84.2807], 11);   // Tallahassee
    st.current.viewSet = true;
  }, [ready, points, live, here]);

  if (failed) return <div className="hike-map empty-map" style={{ height }}>The map couldn't load. Check your signal.</div>;
  return (
    <div className="hike-map-wrap">
      <div ref={box} className="hike-map" style={{ height }} />
      <div className="map-layer" role="group" aria-label="Map style">
        {Object.keys(LAYERS).map(k => <button key={k} type="button" className={layer === k ? 'on' : ''} onClick={() => setLayer(k)}>{k === 'topo' ? 'Topo' : 'Street'}</button>)}
      </div>
    </div>
  );
}

// Lightweight route sketch for lists (no map tiles)
export function RouteThumb({ pts = [], size = 84 }) {
  if (pts.length < 2) return <span className="route-thumb none" style={{ width: size, height: size }} aria-hidden="true">🥾</span>;
  const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, k = Math.cos(midLat * Math.PI / 180);
  const xs = lngs.map(x => x * k), w = Math.max(...xs) - Math.min(...xs) || 1e-6, h = Math.max(...lats) - Math.min(...lats) || 1e-6;
  const s = (size - 14) / Math.max(w, h), ox = (size - w * s) / 2, oy = (size - h * s) / 2, x0 = Math.min(...xs), y1 = Math.max(...lats);
  const P = pts.map((p, i) => [ox + (xs[i] - x0) * s, oy + (y1 - p[0]) * s]);
  const d = P.map((p, i) => `${i && (pts[i][2] || 0) === (pts[i - 1][2] || 0) ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg className="route-thumb" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={d} fill="none" stroke="#E8833A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={P[0][0]} cy={P[0][1]} r="3.5" fill="#1F7A47" /><circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r="3.5" fill="#B3261E" />
    </svg>
  );
}

// Elevation profile: [[meters along, elevation m], ...]
export function ElevationChart({ profile = [] }) {
  const pts = profile.filter(p => p[1] != null);
  if (pts.length < 2) return null;
  const W = 640, H = 150, L = 44, B = 22, T = 10;
  const xMax = pts[pts.length - 1][0] || 1;
  const eles = pts.map(p => feet(p[1]));
  let lo = Math.min(...eles), hi = Math.max(...eles);
  if (hi - lo < 40) { const m = (hi + lo) / 2; lo = m - 20; hi = m + 20; }
  const x = v => L + (v / xMax) * (W - L - 8), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(eles[i]).toFixed(1)}`).join('');
  const area = `${line}L${x(xMax).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  const mi = miles(xMax);
  const xt = [0, 0.5, 1].map(f => f * xMax);
  return (
    <figure className="elev-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation from ${Math.round(Math.min(...eles))} to ${Math.round(Math.max(...eles))} feet over ${mi.toFixed(1)} miles`}>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text></g>)}
        <path d={area} className="area" /><path d={line} className="line" />
        {xt.map((v, i) => <text key={i} x={x(v)} y={H - 5} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{miles(v).toFixed(1)} mi</text>)}
      </svg>
      <figcaption>Elevation (feet) along the hike</figcaption>
    </figure>
  );
}
