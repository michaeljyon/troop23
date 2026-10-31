// Small helpers for hike tracking: distance, climbing, and friendly numbers.
const R = 6371008.8;
const rad = d => d * Math.PI / 180;
export function dist(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const MILE = 1609.344;
export const miles = m => (m || 0) / MILE;
export const feet = m => (m || 0) * 3.28084;
export const fmtMiles = (m, d = 1) => `${miles(m).toFixed(miles(m) < 10 ? Math.max(d, 1) : d)}`;
export const fmtFeet = m => `${Math.round(feet(m)).toLocaleString()}`;
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtDur(sec) {
  sec = Math.round(sec || 0); const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
// minutes per mile
export function fmtPace(meters, sec) {
  if (!meters || meters < 50 || !sec) return '–';
  const p = sec / miles(meters); const m = Math.floor(p / 60), s = Math.round(p % 60);
  return m > 99 ? '–' : `${m}:${String(s).padStart(2, '0')}`;
}

// Running totals for a live track (GPS altitude only; the server refines
// elevation from map data when the hike is saved).
export function liveStats(pts) {
  let d = 0, moving = 0, gain = 0, ref = null;
  const eles = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0 && (pts[i - 1][4] || 0) === (p[4] || 0)) {
      const seg = dist(pts[i - 1], p), dt = p[3] - pts[i - 1][3];
      d += seg;
      if (dt > 0 && dt <= 120 && seg / dt >= 0.25) moving += dt;
    }
    if (p[2] != null) eles.push(p[2]);
  }
  // smooth, then count climbs bigger than 4 m
  const sm = eles.map((_, i) => { const w = eles.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
  for (const e of sm) { if (ref == null) { ref = e; continue; } if (e - ref >= 4) { gain += e - ref; ref = e; } else if (ref - e >= 4) ref = e; }
  const last = pts[pts.length - 1];
  return { distance: d, moving, gain, ele: sm.length ? sm[sm.length - 1] : null, elapsed: last ? last[3] : 0 };
}
