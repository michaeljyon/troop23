import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet } from '../components/ui.jsx';
import { api, useApi, useAccount } from '../lib/api.js';

// The Christmas tree sale: progress toward the goal, lot shifts families sign up for, inventory,
// daily sales, and hours each scout worked on the lot.

const money = n => `$${Math.round(n).toLocaleString()}`;
const dayName = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const tm = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`; };
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function Trees() {
  const acct = useAccount();
  const d = useApi(acct ? 'fund' : null);
  const [sheet, setSheet] = useState('');
  const [msg, setMsg] = useState('');
  if (!acct) return <div className="content"><PageHead backTo="more" title="Christmas tree sale" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  if (!d.data) return <div className="content"><PageHead backTo="more" title="Christmas tree sale" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const { cfg, sold, raised, shifts, scoutHours, isLeader, myPeople } = d.data;
  const trees = cfg.items.filter(i => !/wreath|stand|garland/i.test(i.label));
  const treesSold = trees.reduce((t, i) => t + (sold[i.id] || 0), 0), treesIn = trees.reduce((t, i) => t + i.received, 0);
  const pct = cfg.goal ? Math.min(100, (raised / cfg.goal) * 100) : 0;
  const t = todayISO();
  const upcoming = shifts.filter(s => s.date >= t);
  const dates = [...new Set(upcoming.map(s => s.date))];
  const signup = async (s, memberId, on) => { setMsg(''); try { await api(`fund/shift/${s.id}`, { method: 'POST', body: { memberId, on } }); d.refresh(); } catch (e) { setMsg(e.message); } };
  const mine = new Set(myPeople.map(p => p.id));
  return (
    <div className="content trees">
      <PageHead backTo="more" title={cfg.name} sub="Every tree helps pay for camp, gear and adventures." >
        {isLeader && <button className="btn small secondary head-btn" onClick={() => setSheet('setup')}><Icon name="settings" size={15} />Set up</button>}
      </PageHead>
      <div className="tree-hero">
        <span className="th-tree" aria-hidden="true">🎄</span>
        <div className="grow">
          <b className="th-big">{cfg.goal ? `${money(raised)} of ${money(cfg.goal)}` : money(raised)}</b>
          <span>{treesSold} tree{treesSold === 1 ? '' : 's'} sold{treesIn ? ` of ${treesIn}` : ''}</span>
          {cfg.goal > 0 && <div className="th-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>}
        </div>
      </div>
      {(cfg.lot || cfg.hours) && <div className="card tree-lot"><span aria-hidden="true">📍</span><span className="grow">{cfg.lot && <b>{cfg.lot}</b>}{cfg.hours && <span className="small pre">{cfg.hours}</span>}</span>{cfg.lot && <a className="btn small secondary" href={`https://www.google.com/maps/search/${encodeURIComponent(cfg.lot)}`} target="_blank" rel="noopener noreferrer">Map</a>}</div>}
      {cfg.note && <p className="small pre">{cfg.note}</p>}
      {isLeader && <div className="btn-row"><button className="btn accent" onClick={() => setSheet('sales')}><Icon name="plus" size={16} />Record today's sales</button><button className="btn secondary" onClick={() => setSheet('shifts')}><Icon name="calendar" size={16} />Add lot shifts</button></div>}
      <Section title="Lot shifts">
        {dates.length === 0 ? <p className="small muted">{isLeader ? 'Add shifts so families can sign up to work the lot.' : 'Shifts will show up here when the lot schedule is ready.'}</p> : dates.map(dt => (
          <div key={dt} className="card shift-day"><p className="duty-date">{dayName(dt)}</p>
            <ul>{upcoming.filter(s => s.date === dt).map(s => { const ad = s.signups.filter(v => !v.scout), sc = s.signups.filter(v => v.scout); return (
              <li key={s.id}>
                <span className="grow"><b>{tm(s.start)}–{tm(s.end)}</b><span className="small shift-need"><span className={ad.length < s.adults ? 'warn-text' : 'good-text'}>Adults {ad.length}/{s.adults}</span> · <span className={sc.length < s.scouts ? 'warn-text' : 'good-text'}>Scouts {sc.length}/{s.scouts}</span></span>
                  {s.signups.length > 0 && <span className="small muted shift-names">{s.signups.map(v => v.name.split(' ')[0]).join(', ')}</span>}</span>
                <span className="shift-btns">{myPeople.map(p => { const on = s.signups.some(v => v.id === p.id); return <button key={p.id} className={`chip sm ${on ? 'on' : ''}`} onClick={() => signup(s, p.id, !on)} aria-pressed={on}>{on ? '✓ ' : '+ '}{p.name.split(' ')[0]}</button>; })}
                  {isLeader && <button className="icon-btn" onClick={async () => { if (confirm('Remove this shift?')) { await api(`fund/shift/${s.id}`, { method: 'DELETE' }); d.refresh(); } }} aria-label="Remove shift"><Icon name="x" size={16} /></button>}</span>
              </li>
            ); })}</ul>
          </div>
        ))}
        {msg && <p className="form-msg" role="alert">{msg}</p>}
        {myPeople.length > 0 && upcoming.some(s => s.signups.some(v => mine.has(v.id))) && <p className="small good-text">✓ You're on the schedule. Thank you!</p>}
      </Section>
      {isLeader && (
        <>
          <Section title="Inventory">
            <ul className="tree-inv">{cfg.items.map(i => { const s = sold[i.id] || 0; return <li key={i.id}><span className="grow"><b>{i.label}</b><span className="small muted">{i.price ? money(i.price) : 'No price yet'}</span></span><span>{s} sold</span>{i.received > 0 && <span className={`small ${i.received - s <= 3 ? 'warn-text' : 'muted'}`}>{Math.max(0, i.received - s)} left</span>}</li>; })}</ul>
          </Section>
          {scoutHours?.length > 0 && <Section title="Scout hours on the lot"><ul className="svc-table">{scoutHours.map(h => <li key={h.name}><span className="grow">{h.name}</span><span>{Math.round(h.hours * 10) / 10} h</span></li>)}</ul><p className="small muted">Counts finished shifts each scout signed up for.</p></Section>}
          <SalesLog days={d.data.days} cfg={cfg} />
        </>
      )}
      <Sheet open={sheet === 'setup'} onClose={() => setSheet('')} title="Set up the sale">{sheet === 'setup' && <Setup cfg={cfg} onDone={() => { setSheet(''); d.refresh(); }} />}</Sheet>
      <Sheet open={sheet === 'sales'} onClose={() => setSheet('')} title="Record sales">{sheet === 'sales' && <Sales cfg={cfg} days={d.data.days} onDone={() => { setSheet(''); d.refresh(); }} />}</Sheet>
      <Sheet open={sheet === 'shifts'} onClose={() => setSheet('')} title="Add lot shifts">{sheet === 'shifts' && <Shifts onDone={() => { setSheet(''); d.refresh(); }} />}</Sheet>
    </div>
  );
}

function SalesLog({ days, cfg }) {
  if (!days.length) return null;
  const price = Object.fromEntries(cfg.items.map(i => [i.id, i.price]));
  return (
    <Section title="Sales by day">
      <ul className="svc-table">{days.slice().reverse().map(d => { const n = Object.values(d.sold || {}).reduce((t, v) => t + v, 0); const $ = Object.entries(d.sold || {}).reduce((t, [k, v]) => t + v * (price[k] || 0), 0) + (d.donations || 0); return <li key={d.date}><span className="grow">{dayName(d.date)}{d.note ? <span className="small muted"> · {d.note}</span> : ''}</span><span>{n} items</span><b>{money($)}</b></li>; })}</ul>
    </Section>
  );
}

function Setup({ cfg, onDone }) {
  const [f, setF] = useState(cfg);
  const [msg, setMsg] = useState('');
  const setI = (i, p) => setF(x => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...p } : it)) }));
  return (
    <div>
      <label className="field"><span>Name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={80} /></label>
      <label className="field"><span>Goal ($)</span><input type="number" min="0" value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} /></label>
      <label className="field"><span>Lot address</span><input value={f.lot} onChange={e => setF({ ...f, lot: e.target.value })} maxLength={200} /></label>
      <label className="field"><span>Lot hours</span><textarea rows={3} value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} maxLength={300} placeholder={'Weekdays 4–8pm\nSat–Sun 9am–8pm'} /></label>
      <label className="field"><span>Note for families (optional)</span><textarea rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} maxLength={1000} placeholder="Wear your Class B and dress warm. Gloves help!" /></label>
      <div className="field"><span>What we sell: price and how many came in</span>
        {f.items.map((it, i) => <div key={i} className="tree-item-edit"><input value={it.label} onChange={e => setI(i, { label: e.target.value })} aria-label="Item" maxLength={60} /><input type="number" min="0" step="0.01" value={it.price} onChange={e => setI(i, { price: e.target.value })} aria-label={`${it.label} price`} placeholder="$" /><input type="number" min="0" value={it.received} onChange={e => setI(i, { received: e.target.value })} aria-label={`${it.label} received`} placeholder="In" /><button className="icon-btn" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} aria-label={`Remove ${it.label}`}><Icon name="x" size={16} /></button></div>)}
        <button className="link-btn small" onClick={() => setF({ ...f, items: [...f.items, { id: '', label: '', price: 0, received: 0 }] })}>+ Add an item</button></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" onClick={async () => { try { await api('fund/cfg', { method: 'PUT', body: f }); onDone(); } catch (e) { setMsg(e.message); } }}>Save</button>
    </div>
  );
}

function Sales({ cfg, days, onDone }) {
  const [date, setDate] = useState(todayISO());
  const prev = days.find(x => x.date === date);
  const [sold, setSold] = useState(prev?.sold || {});
  const [donations, setDon] = useState(prev?.donations || 0);
  const [note, setNote] = useState(prev?.note || '');
  const total = cfg.items.reduce((t, i) => t + (Number(sold[i.id]) || 0) * i.price, 0) + (Number(donations) || 0);
  return (
    <div>
      <label className="field"><span>Day</span><input type="date" value={date} onChange={e => { setDate(e.target.value); const p = days.find(x => x.date === e.target.value); setSold(p?.sold || {}); setDon(p?.donations || 0); setNote(p?.note || ''); }} /></label>
      <ul className="sales-in">{cfg.items.map(i => <li key={i.id}><span className="grow">{i.label}<span className="small muted"> {i.price ? money(i.price) : ''}</span></span><button className="icon-btn" onClick={() => setSold(s => ({ ...s, [i.id]: Math.max(0, (Number(s[i.id]) || 0) - 1) }))} aria-label={`One fewer ${i.label}`}>−</button><input type="number" min="0" value={sold[i.id] || 0} onChange={e => setSold(s => ({ ...s, [i.id]: e.target.value }))} aria-label={`${i.label} sold`} /><button className="icon-btn" onClick={() => setSold(s => ({ ...s, [i.id]: (Number(s[i.id]) || 0) + 1 }))} aria-label={`One more ${i.label}`}>+</button></li>)}</ul>
      <label className="field"><span>Donations ($)</span><input type="number" min="0" value={donations} onChange={e => setDon(e.target.value)} /></label>
      <label className="field"><span>Note (optional)</span><input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Rainy, slow afternoon" /></label>
      <p><b>Day total: {money(total)}</b></p>
      <button className="btn" onClick={async () => { await api('fund/day', { method: 'PUT', body: { date, sold, donations, note } }); onDone(); }}>Save {dayName(date)}</button>
      <p className="small muted">Saving again for the same day replaces that day's numbers.</p>
    </div>
  );
}

function dayRange(from, to) {
  const out = [];
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`) && out.length < 60; d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function Shifts({ onDone }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [times, setTimes] = useState([['16:00', '18:00'], ['18:00', '20:00']]);
  const [adults, setAdults] = useState(2), [scouts, setScouts] = useState(3);
  const [weekendTimes, setWT] = useState(false);
  const [msg, setMsg] = useState('');
  const dates = dayRange(from, to);
  return (
    <div>
      <div className="row2"><label className="field"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="field"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="field"><span>Shifts each day</span>{times.map(([s, e], i) => <div key={i} className="row-input mt"><input type="time" value={s} onChange={ev => setTimes(t => t.map((x, j) => (j === i ? [ev.target.value, x[1]] : x)))} aria-label="Start" /><input type="time" value={e} onChange={ev => setTimes(t => t.map((x, j) => (j === i ? [x[0], ev.target.value] : x)))} aria-label="End" /><button className="icon-btn" onClick={() => setTimes(t => t.filter((_, j) => j !== i))} aria-label="Remove time">×</button></div>)}
        <button className="link-btn small" onClick={() => setTimes(t => [...t, ['10:00', '12:00']])}>+ Another shift</button></div>
      <label className="check-row"><input type="checkbox" checked={weekendTimes} onChange={e => setWT(e.target.checked)} /><span>Use these times on weekdays only (I'll add weekend shifts separately)</span></label>
      <div className="row2"><label className="field"><span>Adults needed</span><input type="number" min="0" value={adults} onChange={e => setAdults(e.target.value)} /></label><label className="field"><span>Scouts needed</span><input type="number" min="0" value={scouts} onChange={e => setScouts(e.target.value)} /></label></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" onClick={async () => { try { const ds = weekendTimes ? dates.filter(x => ![0, 6].includes(new Date(`${x}T12:00:00`).getDay())) : dates; await api('fund/shifts', { method: 'POST', body: { dates: ds, times, adults, scouts } }); onDone(); } catch (e) { setMsg(e.message); } }}>Add {dates.length * times.length} shifts</button>
    </div>
  );
}
