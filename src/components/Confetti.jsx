import { useMemo } from 'react';

export function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.6 + Math.random() * 1.4, color: ['#E8833A', '#2E9E5B', '#1D5FBF', '#E9B949', '#D64545'][i % 5], rot: Math.random() * 360 })), []);
  return <div className="confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color, transform: `rotate(${b.rot}deg)` }} />)}</div>;
}
