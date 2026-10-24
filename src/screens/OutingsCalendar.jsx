import { useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { outingType } from '../lib/config.js';
import { today } from '../lib/dates.js';
import { OutingRow } from './Home.jsx';

// Month calendar for Outings: every outing on the days it covers, colored by
// kind, with quick jumps by month/year and a list for the picked day or month.
const TYPE_COLOR = {
  campout: '#2F7D4F', hike: '#6B8E23', paddle: '#2B7BB9', service: '#C2410C', fundraiser: '#B91C1C', meeting: '#64748B',
  merit: '#A16207', training: '#7C3AED', oa: '#9F1239', camp: '#0F766E', trip: '#1D4ED8', other: '#78716C',
};
export const typeColor = t => TYPE_COLOR[t] || TYPE_COLOR.other;
const ym = d => d.slice(0, 7);
const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthName = (m, long = true) => new Date(`${m}-15T12:00`).toLocaleDateString([], { month: long ? 'long' : 'short', year: 'numeric' });
const iso = d => d.toISOString().slice(0, 10);
const eachDay = (a, b) => { const out = []; const d = new Date(`${a}T12:00Z`), e = new Date(`${(b && b >= a ? b : a)}T12:00Z`); for (let i = 0; d <= e && i < 40; i++) { out.push(iso(d)); d.setUTCDate(d.getUTCDate() + 1); } return out; };

export default function OutingsCalendar({ outings, month, setMonth, albums }) {
  const t = today();
  const m = month || ym(t);
  const [day, setDay] = useState('');
  const [jump, setJump] = useState(false);
  const touch = useRef(null);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const o of outings) for (const d of eachDay(o.start, o.end)) { if (!map.has(d)) map.set(d, []); map.get(d).push(o); }
    return map;
  }, [outings]);
  const photoCount = id => albums?.find(a => a.id === id)?.count || 0;

  // grid: weeks of the month, Sunday first
  const first = new Date(`${m}-01T12:00Z`);
  const start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
  const cells = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); cells.push(iso(d)); }
  const weeks = []; for (let i = 0; i < 6; i++) { const w = cells.slice(i * 7, i * 7 + 7); if (i < 4 || w.some(d => ym(d) === m)) weeks.push(w); }
  const inMonth = outings.filter(o => ym(o.start) <= m && ym(o.end || o.start) >= m).sort((a, b) => a.start.localeCompare(b.start));
  const list = day ? (byDay.get(day) || []) : inMonth;
  const go = n => { setDay(''); setMonth(addMonths(m, n)); };
  const months = useMemo(() => [...new Set(outings.map(o => ym(o.start)))].sort(), [outings]);
  const years = [...new Set([...months.map(x => x.slice(0, 4)), t.slice(0, 4)])].sort();

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous month"><Icon name="chevronL" /></button>
        <button className="cal-title" onClick={() => setJump(j => !j)} aria-expanded={jump}>{monthName(m)} <Icon name="chevronR" size={14} className={jump ? 'rot90' : ''} /></button>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Next month"><Icon name="chevronR" /></button>
        {m !== ym(t) && <button className="chip sm" onClick={() => { setMonth(ym(t)); setDay(t); }}>Today</button>}
      </div>
      {jump && (
        <div className="cal-jump card">
          {years.map(y => (
            <div key={y} className="cal-jump-year">
              <b>{y}</b>
              <div className="cal-jump-months">
                {Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).map(x => {
                  const n = outings.filter(o => ym(o.start) === x).length;
                  return <button key={x} className={`chip sm ${x === m ? 'on' : ''} ${n ? '' : 'empty'}`} onClick={() => { setMonth(x); setDay(''); setJump(false); }}>{new Date(`${x}-15T12:00`).toLocaleDateString([], { month: 'short' })}{n ? <span className="chip-sub">{n}</span> : null}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cal-grid" role="grid" aria-label={monthName(m)}
        onTouchStart={e => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 60) go(dx > 0 ? -1 : 1); }}>
        <div className="cal-dow" role="row">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} role="columnheader">{d}</span>)}</div>
        {weeks.map((w, wi) => (
          <div key={wi} className="cal-week" role="row">
            {w.map(d => {
              const evs = byDay.get(d) || [];
              const cls = ['cal-day', ym(d) !== m && 'out', d === t && 'today', d === day && 'picked', evs.length && 'has', d < t && 'past'].filter(Boolean).join(' ');
              return (
                <button key={d} role="gridcell" className={cls} onClick={() => setDay(d === day ? '' : d)} aria-label={`${new Date(`${d}T12:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}: ${evs.map(o => o.title).join(', ')}` : ''}`} aria-pressed={d === day}>
                  <span className="cal-num">{Number(d.slice(8))}</span>
                  <span className="cal-bars">
                    {evs.slice(0, 3).map(o => <i key={o.id} className={`${o.start === d ? 'b-st' : ''} ${(o.end || o.start) === d ? 'b-en' : ''} ${o.cancelled ? 'b-x' : ''}`} style={{ background: typeColor(o.type) }} title={o.title} />)}
                    {evs.length > 3 && <em>+{evs.length - 3}</em>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="cal-legend">{[...new Set(inMonth.map(o => o.type))].map(ty => <span key={ty}><i style={{ background: typeColor(ty) }} />{outingType(ty).label}</span>)}</div>

      <h2 className="section-title sm cal-list-title">
        {day ? new Date(`${day}T12:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${monthName(m)} · ${inMonth.length} event${inMonth.length === 1 ? '' : 's'}`}
        {day && <button className="link-btn small" onClick={() => setDay('')}>Whole month</button>}
      </h2>
      {list.length === 0 ? <p className="muted small">{day ? 'Nothing on this day.' : 'Nothing scheduled this month.'}</p> : (
        <ul className="outing-list">
          {list.map(o => <OutingRow key={o.id} o={o} showYear={o.start.slice(0, 4) !== t.slice(0, 4)} extra={photoCount(o.id) > 0 ? <span className="photo-pill"><Icon name="image" size={13} />{photoCount(o.id)}</span> : null} />)}
        </ul>
      )}
      {months.length > 0 && (
        <div className="btn-row tight cal-ends">
          {months[0] < m && <button className="link-btn small" onClick={() => { setMonth(months.filter(x => x < m).at(-1)); setDay(''); }}><Icon name="chevronL" size={14} />Earlier events</button>}
          <span className="grow" />
          {months.at(-1) > m && <button className="link-btn small" onClick={() => { setMonth(months.find(x => x > m)); setDay(''); }}>Later events<Icon name="chevronR" size={14} /></button>}
        </div>
      )}
    </div>
  );
}
