import { useState } from 'react';
import OutingsCalendar from './OutingsCalendar.jsx';
import { useApi } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet, Seg } from '../components/ui.jsx';
import { useCol, useLeaderMode, saveDoc, deleteDoc } from '../lib/api.js';
import { troop, rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';
import { today } from '../lib/dates.js';
import { go } from '../lib/router.js';
import { OutingRow } from './Home.jsx';
import { useCalendarLink, webcal, googleAdd } from '../lib/calendar.js';

export default function Outings({ route }) {
  const outings = useCol('outings');
  const albums = useApi('albums');
  const leader = useLeaderMode();
  const view = route?.query?.view || 'upcoming';
  const setView = v => go(`outings${v === 'upcoming' ? '' : `?view=${v}`}`);
  const month = route?.query?.m || '';
  const setMonth = m => go(`outings?view=calendar&m=${m}`);
  const [pq, setPq] = useState('');
  const [py, setPy] = useState('');
  const [pt, setPt] = useState('');
  const [editing, setEditing] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const t = today();
  const pastAll = outings.items.filter(o => (o.end || o.start) < t).reverse();
  const pastYears = [...new Set(pastAll.map(o => o.start.slice(0, 4)))];
  const pastTypes = [...new Set(pastAll.map(o => o.type))];
  const list = view === 'upcoming' ? outings.items.filter(o => (o.end || o.start) >= t)
    : pastAll.filter(o => (!py || o.start.startsWith(py)) && (!pt || o.type === pt) && (!pq || `${o.title} ${o.location}`.toLowerCase().includes(pq.toLowerCase())));
  const photoCount = id => albums.data?.albums?.find(a => a.id === id)?.count || 0;
  const pill = o => (photoCount(o.id) ? <span className="photo-pill"><Icon name="image" size={13} />{photoCount(o.id)}</span> : null);
  const byYear = [];
  for (const o of list) { const y = o.start.slice(0, 4); let g = byYear.find(x => x.y === y); if (!g) byYear.push(g = { y, list: [] }); g.list.push(o); }

  return (
    <div className="content">
      <PageHead title="Outings" sub="Campouts, hikes, service and meetings. Tap one for sign-ups, meals, gear and packing.">
        {leader && <button className="btn small head-btn" onClick={() => setEditing({})}><Icon name="plus" size={16} />New</button>}
      </PageHead>
      <Seg label="Show" value={view} onChange={setView} options={[['upcoming', 'Upcoming'], ['calendar', 'Calendar'], ['past', 'Past']]} />
      <button className="cal-sub-btn" onClick={() => setSubscribing(true)}><Icon name="calendar" size={18} /><span className="grow"><b>Put troop outings in your phone's calendar</b><span>Stays up to date by itself</span></span><Icon name="chevronR" size={16} /></button>
      {view === 'past' && pastAll.length > 0 && (
        <div className="gal-filters">
          <div className="search-row"><Icon name="search" size={18} /><input value={pq} onChange={e => setPq(e.target.value)} placeholder="Search past outings and places" aria-label="Search past outings" /></div>
          <div className="chip-scroll"><button className={`chip ${!py ? 'on' : ''}`} onClick={() => setPy('')}>All years</button>{pastYears.map(y => <button key={y} className={`chip ${py === y ? 'on' : ''}`} onClick={() => setPy(py === y ? '' : y)}>{y}<span className="chip-sub">{pastAll.filter(o => o.start.startsWith(y)).length}</span></button>)}</div>
          {pastTypes.length > 1 && <div className="chip-scroll"><button className={`chip sm ${!pt ? 'on' : ''}`} onClick={() => setPt('')}>Every kind</button>{pastTypes.map(x => { const ty = troop.outingTypes.find(z => z.id === x); return <button key={x} className={`chip sm ${pt === x ? 'on' : ''}`} onClick={() => setPt(pt === x ? '' : x)}>{ty?.emoji} {ty?.label || x}</button>; })}</div>}
        </div>
      )}
      {outings.loading && !outings.data ? <p className="muted">Loading…</p>
        : outings.error && !outings.data ? <Empty icon="alert" title="Couldn't load outings">{outings.error.message}</Empty>
        : view === 'calendar' ? <OutingsCalendar outings={outings.items} month={month} setMonth={setMonth} albums={albums.data?.albums} />
        : list.length === 0 ? <Empty icon="tent" title={view === 'upcoming' ? 'Nothing scheduled yet' : 'No past outings match'}>{view === 'upcoming' ? (leader ? 'Tap New to add the next outing.' : 'Leaders add outings here.') : 'Try another year or search.'}</Empty>
        : view === 'past' ? byYear.map(g => <section key={g.y}><h2 className="section-title sm">{g.y}<span className="muted"> · {g.list.length}</span></h2><ul className="outing-list">{g.list.map(o => <OutingRow key={o.id} o={o} extra={pill(o)} />)}</ul></section>)
        : <ul className="outing-list">{list.map(o => <OutingRow key={o.id} o={o} extra={pill(o)} />)}</ul>}
      {!leader && <p className="small muted center pad-top">Leaders: sign in under More → Leader tools to add outings.</p>}
      <Sheet open={subscribing} onClose={() => setSubscribing(false)} title="Troop calendar"><CalendarSubscribe /></Sheet>
      <OutingForm outing={editing} onClose={() => setEditing(null)} onSaved={o => { setEditing(null); outings.refresh(); if (o) go(`outing/${o.id}`); }} />
    </div>
  );
}

function CalendarSubscribe() {
  const url = useCalendarLink();
  const [copied, setCopied] = useState(false);
  if (!url) return <p className="muted">Getting your calendar link…</p>;
  return (
    <div>
      <p>Subscribe once and every Troop 23 outing shows up in your phone's calendar. Changes and new outings come through on their own, usually within a few hours.</p>
      <div className="btn-col">
        <a className="btn" href={webcal(url)}><Icon name="calendar" size={18} />iPhone, iPad or Mac</a>
        <a className="btn secondary" href={googleAdd(url)} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} />Google Calendar (Android)</a>
        <button className="btn secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { prompt('Copy this link', url); } }}><Icon name="copy" size={18} />{copied ? 'Copied!' : 'Copy link (Outlook and others)'}</button>
      </div>
      <p className="small muted">On Google Calendar, open the link on a computer the first time if your phone doesn't offer to add it. The link is private to Troop 23 families, so please don't post it publicly.</p>
    </div>
  );
}

const blank = { title: '', type: 'campout', start: '', end: '', location: '', address: '', placePhone: '', placeWeb: '', mapQ: '', meetTime: '', meetPlace: '', returnTime: '', cost: '', details: '', extras: [], cancelled: false };

export function OutingForm({ outing, onClose, onSaved }) {
  return (
    <Sheet open={!!outing} onClose={onClose} title={outing?.id ? 'Edit outing' : 'New outing'}>
      {outing && <OutingFields outing={outing} onSaved={onSaved} />}
    </Sheet>
  );
}

function OutingFields({ outing, onSaved }) {
  const [me] = useMe();
  const [cur, setF] = useState(() => ({ ...blank, ...outing, extrasText: (outing.extras || []).join('\n') }));
  const places = useCol('places');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = patch => setF(c => ({ ...c, ...patch }));

  async function save(e) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const id = outing.id || `o-${rid()}`;
      const { extrasText, ...doc } = cur;
      const r = await saveDoc('outings', id, { ...doc, extras: extrasText.split('\n').map(s => s.trim()).filter(Boolean) }, me.name);
      onSaved(r.item);
    } catch (err) { setMsg(err.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete “${outing.title}”? Sign-ups and meal plans stay in the records.`)) return;
    await deleteDoc('outings', outing.id); onSaved(null); go('outings', { replace: true });
  }

  return (
      <form onSubmit={save}>
        <label className="field"><span>Name</span><input value={cur.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Fall Campout at Wakulla" required /></label>
        <div className="field"><span>Type</span>
          <div className="chip-wrap">{troop.outingTypes.map(t => <button type="button" key={t.id} className={`chip ${cur.type === t.id ? 'on' : ''}`} onClick={() => set({ type: t.id })}>{t.emoji} {t.label}</button>)}</div>
        </div>
        <div className="two-col">
          <label className="field"><span>Starts</span><input type="date" value={cur.start} onChange={e => set({ start: e.target.value, end: cur.end && cur.end >= e.target.value ? cur.end : e.target.value })} required /></label>
          <label className="field"><span>Ends</span><input type="date" value={cur.end} min={cur.start} onChange={e => set({ end: e.target.value })} /></label>
        </div>
        <label className="field"><span>Where</span><input value={cur.location} list="placelist" onChange={e => {
          const v = e.target.value; const p = places.items.find(x => x.name.toLowerCase() === v.trim().toLowerCase());
          set(p ? { location: p.name, address: cur.address || p.address || '', placePhone: cur.placePhone || p.phone || '', placeWeb: cur.placeWeb || p.web || '', mapQ: cur.mapQ || p.mapQ || '' } : { location: v });
        }} placeholder="Campground, park or address" /></label>
        <datalist id="placelist">{places.items.map(p => <option key={p.id} value={p.name} />)}</datalist>
        <label className="field"><span>Address <i className="opt">optional, for directions</i></span><input value={cur.address || ''} onChange={e => set({ address: e.target.value })} placeholder="Street, city" /></label>
        <div className="two-col">
          <label className="field"><span>Meet time</span><input value={cur.meetTime} onChange={e => set({ meetTime: e.target.value })} placeholder="Fri 5:30 PM" /></label>
          <label className="field"><span>Meet place</span><input value={cur.meetPlace} onChange={e => set({ meetPlace: e.target.value })} placeholder="Church parking lot" /></label>
          <label className="field"><span>Back by</span><input value={cur.returnTime} onChange={e => set({ returnTime: e.target.value })} placeholder="Sun 12:00 PM" /></label>
          <label className="field"><span>Cost</span><input value={cur.cost} onChange={e => set({ cost: e.target.value })} placeholder="$25 per scout" /></label>
        </div>
        <label className="field"><span>Details</span><textarea rows={4} value={cur.details} onChange={e => set({ details: e.target.value })} placeholder="Plan, program, what to expect" /></label>
        <label className="field"><span>Extra packing items <i className="opt">one per line</i></span><textarea rows={3} value={cur.extrasText} onChange={e => set({ extrasText: e.target.value })} placeholder={'Swimsuit\nLife jacket'} /></label>
        {outing?.id && <label className="check"><input type="checkbox" checked={cur.cancelled} onChange={e => set({ cancelled: e.target.checked })} /> Cancelled</label>}
        {msg && <p className="form-msg" role="alert">{msg}</p>}
        <div className="btn-row">
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save outing'}</button>
          {outing?.id && <button type="button" className="link-btn danger" onClick={remove}><Icon name="trash" size={16} />Delete</button>}
        </div>
      </form>
  );
}
