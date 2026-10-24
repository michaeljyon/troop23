const d = s => new Date(`${s}T12:00`);
export const today = () => new Date().toLocaleDateString('en-CA');
export function rangeLabel(start, end) {
  if (!start) return '';
  const a = d(start), b = d(end || start);
  const opt = { weekday: 'short', month: 'short', day: 'numeric' };
  if (!end || end === start) return a.toLocaleDateString([], opt);
  if (a.getMonth() === b.getMonth()) return `${a.toLocaleDateString([], { month: 'short', day: 'numeric' })}–${b.getDate()}`;
  return `${a.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}
export function daysUntil(start) {
  return Math.round((d(start) - d(today())) / 86400000);
}
export function whenLabel(start, end) {
  const n = daysUntil(start), m = end ? daysUntil(end) : n;
  if (n > 1) return `In ${n} days`;
  if (n === 1) return 'Tomorrow';
  if (n <= 0 && m >= 0) return 'Happening now';
  return 'Past';
}
export const monthDay = s => { const x = d(s); return { mon: x.toLocaleDateString([], { month: 'short' }).toUpperCase(), day: x.getDate() }; };
