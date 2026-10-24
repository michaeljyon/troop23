import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill, Seg } from '../components/ui.jsx';
import { api, useCol, saveDoc, deleteDoc, useLeaderMode, usePatrols } from '../lib/api.js';
import { troop, rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';
import { today } from '../lib/dates.js';
import { go } from '../lib/router.js';

// The troop gear locker: what we own, where it is, who has it.
export default function Gear({ route }) {
  const [me] = useMe();
  const gear = useCol('gear');
  const [q, setQ] = useState('');
  const filter = route.query.filter || 'all';
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const mine = g => g.checkout && g.checkout.who.trim().toLowerCase() === me.name.trim().toLowerCase();
  const F = {
    all: () => true, in: g => !g.checkout && g.condition !== 'retired', out: g => !!g.checkout,
    repair: g => g.condition === 'repair', mine,
  };
  const items = gear.items.filter(F[filter] || F.all).filter(g => !q || `${g.name} ${g.tag} ${g.category} ${g.checkout?.who || ''}`.toLowerCase().includes(q.toLowerCase()));
  const count = k => gear.items.filter(F[k]).length;
  const cats = [...new Set([...troop.gearCategories, ...items.map(g => g.category || 'Other')])].map(c => ({ c, list: items.filter(g => (g.category || 'Other') === c) })).filter(x => x.list.length);
  const current = open && gear.items.find(g => g.id === open);

  return (
    <div className="content">
      <PageHead title="Gear locker" sub="Everything the troop owns. Check it out before a trip, check it back in after.">
        <button className="btn small head-btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add</button>
      </PageHead>
      <div className="stat-row three">
        <button className={`stat ${filter === 'in' ? 'sel' : ''}`} onClick={() => go('gear?filter=in')}><b>{count('in')}</b><span>in the locker</span></button>
        <button className={`stat ${filter === 'out' ? 'sel' : ''}`} onClick={() => go('gear?filter=out')}><b>{count('out')}</b><span>checked out</span></button>
        <button className={`stat ${count('repair') ? 'alert' : ''} ${filter === 'repair' ? 'sel' : ''}`} onClick={() => go('gear?filter=repair')}><b>{count('repair')}</b><span>need repair</span></button>
      </div>
      <div className="search-row">
        <Icon name="search" size={18} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search gear, tags or names" aria-label="Search gear" />
      </div>
      <div className="chip-scroll">
        {[['all', 'All'], ['in', 'Available'], ['out', 'Checked out'], ['repair', 'Needs repair'], ['mine', 'With me']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => go(k === 'all' ? 'gear' : `gear?filter=${k}`)}>{l}{k !== 'all' && <span className="chip-sub">{count(k)}</span>}</button>)}
      </div>

      {gear.loading && !gear.data ? <p className="muted">Loading…</p>
        : gear.items.length === 0 ? <Empty icon="box" title="The gear locker is empty" action={<button className="btn small" onClick={() => setAdding(true)}>Add the first item</button>}>Add tents, stoves, lanterns, dutch ovens, patrol boxes — anything the troop owns.</Empty>
        : items.length === 0 ? <Empty icon="search" title="Nothing matches" />
        : cats.map(({ c, list }) => (
          <Section key={c} title={c}>
            <ul className="gear-list">
              {list.map(g => (
                <li key={g.id}>
                  <button className="gear-row" onClick={() => setOpen(g.id)}>
                    <span className="grow">
                      <b>{g.name}</b>{g.tag && <span className="tag">{g.tag}</span>}{g.qty > 1 && <span className="small muted"> ×{g.qty}</span>}
                      <span className="small muted">{g.checkout ? `With ${g.checkout.who}${g.checkout.outingTitle ? ` · ${g.checkout.outingTitle}` : ''}` : g.location || 'In the locker'}</span>
                    </span>
                    <GearStatus g={g} />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ))}

      <GearSheet item={current} onClose={() => setOpen(null)} onChange={gear.refresh} />
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add gear">
        {adding && <GearForm onSaved={() => { setAdding(false); gear.refresh(); }} />}
      </Sheet>
    </div>
  );
}

export function GearStatus({ g }) {
  if (g.condition === 'retired') return <Pill>Retired</Pill>;
  if (g.checkout) return <Pill tone={g.checkout.due && g.checkout.due < today() ? 'bad' : 'warn'}>{g.checkout.due && g.checkout.due < today() ? 'Overdue' : 'Out'}</Pill>;
  if (g.condition === 'repair') return <Pill tone="bad">Repair</Pill>;
  return <Pill tone="good">In</Pill>;
}

function GearSheet({ item, onClose, onChange }) {
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.name || 'Gear'}>
      {item && <GearDetail key={item.id + (item.updated || '')} g={item} onChange={onChange} onClose={onClose} />}
    </Sheet>
  );
}

function GearDetail({ g, onChange, onClose }) {
  const [me] = useMe();
  const leader = useLeaderMode();
  const patrols = usePatrols() || troop.patrols;
  const outings = useCol('outings');
  const upcoming = outings.items.filter(o => (o.end || o.start) >= today());
  const [mode, setMode] = useState('view');
  const [f, setF] = useState({ who: me.name, patrol: me.patrol, outingId: upcoming[0]?.id || '', due: '', condition: 'good', note: '' });
  const [msg, setMsg] = useState('');

  async function act(action) {
    setMsg('');
    try {
      const o = outings.items.find(x => x.id === f.outingId);
      await api(`gear/${g.id}/${action}`, { method: 'POST', body: { ...f, outingTitle: o?.title || '', due: f.due || o?.end || '' } });
      onChange(); setMode('view');
    } catch (e) { setMsg(e.message); }
  }
  async function remove() { if (confirm(`Delete ${g.name} from the gear locker?`)) { await deleteDoc('gear', g.id); onChange(); onClose(); } }

  if (mode === 'edit') return <GearForm item={g} onSaved={() => { onChange(); setMode('view'); }} />;
  return (
    <div>
      <div className="gear-head">
        <GearStatus g={g} />
        {g.tag && <span className="tag big">{g.tag}</span>}
        <span className="small muted">{g.category}{g.qty > 1 ? ` · ×${g.qty}` : ''}{g.location ? ` · ${g.location}` : ''}</span>
      </div>
      {g.notes && <p className="gear-notes">{g.notes}</p>}

      {g.checkout ? (
        <div className="card soft">
          <p><b>With {g.checkout.who}</b>{g.checkout.patrol && ` · ${g.checkout.patrol}`}</p>
          <p className="small muted">Since {new Date(g.checkout.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{g.checkout.outingTitle && ` · for ${g.checkout.outingTitle}`}{g.checkout.due && ` · due back ${g.checkout.due}`}</p>
          {mode === 'checkin' ? (
            <>
              <label className="field"><span>Checked in by</span><input value={f.who} onChange={e => setF({ ...f, who: e.target.value })} /></label>
              <div className="field"><span>Condition</span><Seg label="Condition" value={f.condition} onChange={condition => setF({ ...f, condition })} options={[['good', 'Good'], ['repair', 'Needs repair'], ['retired', 'Retire it']]} /></div>
              <label className="field"><span>Note <i className="opt">optional</i></span><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Broken pole, missing stakes, needs drying…" /></label>
              <div className="btn-row"><button className="btn" onClick={() => act('checkin')}><Icon name="arrowIn" size={18} />Check in</button><button className="btn secondary" onClick={() => setMode('view')}>Cancel</button></div>
            </>
          ) : <button className="btn" onClick={() => setMode('checkin')}><Icon name="arrowIn" size={18} />Check it back in</button>}
        </div>
      ) : g.condition !== 'retired' && (
        mode === 'checkout' ? (
          <div className="card soft">
            <div className="two-col">
              <label className="field"><span>Checked out to</span><input value={f.who} onChange={e => setF({ ...f, who: e.target.value })} /></label>
              <label className="field"><span>Patrol</span><select value={f.patrol} onChange={e => setF({ ...f, patrol: e.target.value })}><option value="">Troop</option>{patrols.map(p => <option key={p}>{p}</option>)}</select></label>
              <label className="field"><span>For</span><select value={f.outingId} onChange={e => setF({ ...f, outingId: e.target.value })}><option value="">Not for an outing</option>{upcoming.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
              <label className="field"><span>Due back <i className="opt">optional</i></span><input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></label>
            </div>
            <div className="btn-row"><button className="btn" onClick={() => act('checkout')} disabled={!f.who.trim()}><Icon name="arrowOut" size={18} />Check out</button><button className="btn secondary" onClick={() => setMode('view')}>Cancel</button></div>
          </div>
        ) : <button className="btn big" onClick={() => setMode('checkout')}><Icon name="arrowOut" size={20} />Check out</button>
      )}
      {msg && <p className="form-msg" role="alert">{msg}</p>}

      {(g.log || []).length > 0 && (
        <Section title="History">
          <ul className="log">{[...g.log].reverse().slice(0, 15).map((l, i) => <li key={i}><span className="log-when">{new Date(l.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span className="grow">{l.what}{l.by && <span className="muted"> · {l.by}</span>}</span></li>)}</ul>
        </Section>
      )}
      <div className="btn-row">
        <button className="btn secondary small" onClick={() => setMode('edit')}><Icon name="edit" size={16} />Edit details</button>
        {leader && <button className="link-btn danger small" onClick={remove}><Icon name="trash" size={15} />Delete</button>}
      </div>
    </div>
  );
}

function GearForm({ item, onSaved }) {
  const [me] = useMe();
  const [f, setF] = useState({ name: '', category: troop.gearCategories[0], tag: '', qty: 1, condition: 'good', location: '', notes: '', ...item });
  const [msg, setMsg] = useState('');
  async function save(e) {
    e.preventDefault(); setMsg('');
    try { await saveDoc('gear', item?.id || `g-${rid()}`, f, me.name); onSaved(); } catch (err) { setMsg(err.message); }
  }
  return (
    <form onSubmit={save}>
      <label className="field"><span>Item</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. 4-person dome tent" required /></label>
      <div className="two-col">
        <label className="field"><span>Category</span><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{troop.gearCategories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="field"><span>Tag / number</span><input value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} placeholder="T-04" /></label>
        <label className="field"><span>How many</span><input type="number" min="1" value={f.qty} onChange={e => setF({ ...f, qty: +e.target.value || 1 })} /></label>
        <label className="field"><span>Kept in</span><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Trailer, shelf B…" /></label>
      </div>
      <div className="field"><span>Condition</span><Seg label="Condition" value={f.condition} onChange={condition => setF({ ...f, condition })} options={[['good', 'Good'], ['repair', 'Needs repair'], ['retired', 'Retired']]} /></div>
      <label className="field"><span>Notes</span><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Includes rainfly, 8 stakes…" /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn">Save</button>
    </form>
  );
}

// Check out several items for an outing at once.
export function GearPicker({ open, outing, items, onClose, onDone }) {
  const [me] = useMe();
  const patrols = usePatrols() || troop.patrols;
  const [sel, setSel] = useState([]);
  const [patrol, setPatrol] = useState(me.patrol || '');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const avail = items.filter(g => !g.checkout && g.condition !== 'retired' && (!q || g.name.toLowerCase().includes(q.toLowerCase())));
  async function go() {
    setBusy(true);
    for (const id of sel) await api(`gear/${id}/checkout`, { method: 'POST', body: { who: me.name, patrol, outingId: outing.id, outingTitle: outing.title, due: outing.end || outing.start } }).catch(() => {});
    setBusy(false); setSel([]); onDone();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Check out for this trip">
      <label className="field"><span>For patrol</span><select value={patrol} onChange={e => setPatrol(e.target.value)}><option value="">Whole troop</option>{patrols.map(p => <option key={p}>{p}</option>)}</select></label>
      <input className="tag-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search available gear" aria-label="Search available gear" />
      {avail.length === 0 ? <p className="muted">No available gear{q ? ' matches' : ''}.</p> : (
        <ul className="pick-list">{avail.map(g => (
          <li key={g.id}><label className={sel.includes(g.id) ? 'on' : ''}><input type="checkbox" checked={sel.includes(g.id)} onChange={e => setSel(e.target.checked ? [...sel, g.id] : sel.filter(x => x !== g.id))} /><span className="grow"><b>{g.name}</b>{g.tag && <span className="tag">{g.tag}</span>}<span className="small muted">{g.category}{g.condition === 'repair' ? ' · needs repair' : ''}</span></span></label></li>
        ))}</ul>
      )}
      <div className="sheet-foot"><button className="btn big" disabled={!sel.length || busy} onClick={go}>{busy ? 'Checking out…' : `Check out ${sel.length || ''} item${sel.length === 1 ? '' : 's'}`}</button></div>
    </Sheet>
  );
}

// Check everything back in after a trip, flagging anything that needs repair.
export function CheckinAll({ open, items, onClose, onDone }) {
  const [me] = useMe();
  const [cond, setCond] = useState({});
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    for (const g of items) await api(`gear/${g.id}/checkin`, { method: 'POST', body: { who: me.name, condition: cond[g.id] || 'good' } }).catch(() => {});
    setBusy(false); setCond({}); onDone();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Check gear back in">
      <p className="small muted">Everything goes back to the locker. Flag anything that came back broken.</p>
      <ul className="pick-list">{items.map(g => (
        <li key={g.id} className="checkin-row"><span className="grow"><b>{g.name}</b>{g.tag && <span className="tag">{g.tag}</span>}</span>
          <button type="button" className={`chip ${cond[g.id] === 'repair' ? 'on bad' : ''}`} onClick={() => setCond({ ...cond, [g.id]: cond[g.id] === 'repair' ? 'good' : 'repair' })}><Icon name="wrench" size={14} />Needs repair</button></li>
      ))}</ul>
      <div className="sheet-foot"><button className="btn big" disabled={busy} onClick={go}>{busy ? 'Checking in…' : `Check in ${items.length} item${items.length === 1 ? '' : 's'}`}</button></div>
    </Sheet>
  );
}
