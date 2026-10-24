import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet, Seg } from '../components/ui.jsx';
import { useCol, useLeaderMode, saveDoc, deleteDoc } from '../lib/api.js';
import { troop, rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';
import { today } from '../lib/dates.js';
import { go } from '../lib/router.js';
import { OutingRow } from './Home.jsx';

export default function Outings() {
  const outings = useCol('outings');
  const leader = useLeaderMode();
  const [view, setView] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const t = today();
  const list = view === 'upcoming' ? outings.items.filter(o => (o.end || o.start) >= t) : outings.items.filter(o => (o.end || o.start) < t).reverse();

  return (
    <div className="content">
      <PageHead title="Outings" sub="Campouts, hikes, service and meetings. Tap one for sign-ups, meals, gear and packing.">
        {leader && <button className="btn small head-btn" onClick={() => setEditing({})}><Icon name="plus" size={16} />New</button>}
      </PageHead>
      <Seg label="Show" value={view} onChange={setView} options={[['upcoming', 'Upcoming'], ['past', 'Past']]} />
      <div className="gap" />
      {outings.loading && !outings.data ? <p className="muted">Loading…</p>
        : outings.error && !outings.data ? <Empty icon="alert" title="Couldn't load outings">{outings.error.message}</Empty>
        : list.length === 0 ? <Empty icon="tent" title={view === 'upcoming' ? 'Nothing scheduled yet' : 'No past outings'}>{leader ? 'Tap New to add the next outing.' : 'Leaders add outings here.'}</Empty>
        : <ul className="outing-list">{list.map(o => <OutingRow key={o.id} o={o} />)}</ul>}
      {!leader && <p className="small muted center pad-top">Leaders: sign in under More → Leader tools to add outings.</p>}
      <OutingForm outing={editing} onClose={() => setEditing(null)} onSaved={o => { setEditing(null); outings.refresh(); if (o) go(`outing/${o.id}`); }} />
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
    await deleteDoc('outings', outing.id); onSaved(null); go('outings');
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
        <label className="field"><span>Where</span><input value={cur.location} onChange={e => set({ location: e.target.value })} placeholder="Campground, park or address" /></label>
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
