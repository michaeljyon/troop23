import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Empty, Sheet, Pill, Seg } from '../components/ui.jsx';
import { api, useApi, useCol, saveDoc, deleteDoc } from '../lib/api.js';
import { troop, rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';

// Leader tools → Setup: the troop information brought over from TroopWebHost,
// kept up to date here. Merit badge counselors, leadership positions, places
// outings go, and shortcuts to everything else that was imported.
export function Setup({ pass, goTab }) {
  const [part, setPart] = useState('counselors');
  return (
    <>
      <div className="seg setup-seg" role="tablist">
        {[['counselors', 'Counselors'], ['positions', 'Positions'], ['places', 'Places'], ['more', 'More']].map(([k, l]) => <button key={k} role="tab" aria-selected={part === k} className={part === k ? 'on' : ''} onClick={() => setPart(k)}>{l}</button>)}
      </div>
      {part === 'counselors' && <Counselors pass={pass} />}
      {part === 'positions' && <Positions pass={pass} />}
      {part === 'places' && <Places />}
      {part === 'more' && <MoreSetup goTab={goTab} />}
    </>
  );
}

// ------------------------------------------------------------ counselors
export function useBadgeCatalog() {
  const c = useApi('mbcatalog');
  return c.data?.badges || [];
}

function Counselors({ pass }) {
  const list = useCol('counselors');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const shown = list.items.filter(c => !q || `${c.name} ${(c.badges || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
  const badgeCount = new Set(list.items.filter(c => c.active !== false).flatMap(c => c.badges || [])).size;
  return (
    <>
      <p className="small muted mt">Who counsels which merit badges. Scouts look them up under Advancement → Merit badge counselors and can message troop counselors (the two-deep leaders are always included). Contact details aren't stored here.</p>
      <div className="stat-row three">
        <div className="stat"><b>{list.items.filter(c => c.active !== false).length}</b><span>counselors</span></div>
        <div className="stat"><b>{badgeCount}</b><span>badges covered</span></div>
        <div className="stat"><b>{list.items.filter(c => c.active !== false && !(c.badges || []).length).length}</b><span>need badges</span></div>
      </div>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search counselors or badges" aria-label="Search counselors" /></div>
      <div className="btn-row tight"><button className="btn small secondary" onClick={() => setEdit({ name: '', memberId: '', badges: [], notes: '', active: true })}><Icon name="plus" size={16} />Add counselor</button></div>
      {list.loading && !list.data ? <p className="muted">Loading…</p> : shown.length === 0 ? <Empty icon="trophy" title="No counselors yet">Add the adults who counsel merit badges.</Empty> : (
        <ul className="gear-list mt">
          {shown.map(c => (
            <li key={c.id}><button className={`gear-row ${c.active === false ? 'faded' : ''}`} onClick={() => setEdit(c)}>
              <span className="grow"><b>{c.name}</b>{c.memberId ? <span className="tag">Troop</span> : <span className="tag">Outside</span>}
                <span className="small muted">{(c.badges || []).length ? c.badges.slice(0, 6).join(', ') + (c.badges.length > 6 ? ` +${c.badges.length - 6} more` : '') : 'No badges listed yet'}</span>
              </span>
              {c.active === false ? <Pill>Inactive</Pill> : <Pill tone="good">{(c.badges || []).length}</Pill>}
            </button></li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.name : 'Add counselor'} wide>
        {edit && <CounselorForm c={edit} pass={pass} onDone={() => { setEdit(null); list.refresh(); }} />}
      </Sheet>
    </>
  );
}

function CounselorForm({ c, pass, onDone }) {
  const [me] = useMe();
  const [f, setF] = useState({ ...c, badges: [...(c.badges || [])] });
  const [members, setMembers] = useState(null);
  const [bq, setBq] = useState('');
  const [msg, setMsg] = useState('');
  const catalog = useBadgeCatalog();
  useEffect(() => { api('leader/members', { leader: pass }).then(d => setMembers(d.members.filter(m => m.active !== false && m.role === 'adult').sort((a, b) => a.last.localeCompare(b.last)))).catch(() => setMembers([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = b => setF(x => ({ ...x, badges: x.badges.includes(b) ? x.badges.filter(y => y !== b) : [...x.badges, b].sort() }));
  const options = catalog.filter(b => !bq || b.name.toLowerCase().includes(bq.toLowerCase()));
  const custom = bq.trim() && !catalog.some(b => b.name.toLowerCase() === bq.trim().toLowerCase()) && !f.badges.includes(bq.trim());
  async function save() {
    setMsg('');
    try { await saveDoc('counselors', c.id || `mbc-${rid()}`, f, me.name); onDone(); } catch (e) { setMsg(e.message); }
  }
  return (
    <div>
      <label className="field"><span>Troop member <i className="opt">or leave blank for an outside counselor</i></span>
        <select value={f.memberId} onChange={e => { const m = members?.find(x => x.id === e.target.value); setF({ ...f, memberId: e.target.value, name: m ? m.name : f.name }); }}>
          <option value="">Outside the troop</option>
          {(members || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></label>
      <label className="field"><span>Name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} disabled={!!f.memberId} /></label>
      <div className="field"><span>Merit badges ({f.badges.length})</span>
        {f.badges.length > 0 && <div className="chip-wrap mb">{f.badges.map(b => <button key={b} className="chip on" onClick={() => toggle(b)}><Icon name="check" size={14} />{b}</button>)}</div>}
        <div className="search-row"><Icon name="search" size={18} /><input value={bq} onChange={e => setBq(e.target.value)} placeholder="Find or type a badge" aria-label="Find a badge" /></div>
        <div className="chip-wrap badge-pick">
          {custom && <button className="chip" onClick={() => { toggle(bq.trim()); setBq(''); }}><Icon name="plus" size={14} />Add "{bq.trim()}"</button>}
          {options.filter(b => !f.badges.includes(b.name)).slice(0, 60).map(b => <button key={b.name} className="chip sm" onClick={() => toggle(b.name)}>{b.eagle && <span className="eagle-star" aria-label="Eagle-required">★</span>}{b.name}</button>)}
        </div>
      </div>
      <label className="field"><span>Notes <i className="opt">optional, e.g. "weekends only"</i></span><input value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
      <label className="switch-row"><span className="grow"><b>Active counselor</b><span className="small muted">Inactive counselors are hidden from scouts.</span></span><input type="checkbox" role="switch" checked={f.active !== false} onChange={e => setF({ ...f, active: e.target.checked })} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="btn-row"><button className="btn" disabled={!f.name.trim()} onClick={save}>Save</button>
        {c.id && <button className="link-btn small danger" onClick={async () => { if (confirm(`Remove ${c.name} from the counselor list?`)) { await deleteDoc('counselors', c.id); onDone(); } }}><Icon name="trash" size={14} />Remove</button>}</div>
    </div>
  );
}

// ------------------------------------------------------------ positions
function Positions({ pass }) {
  const [data, setData] = useState(null);
  const [who, setWho] = useState('scout');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const load = () => api('leader/members', { leader: pass }).then(setData).catch(() => setData({ members: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p className="muted">Loading…</p>;
  const list = data.members.filter(m => m.active !== false && m.role === who && (!q || `${m.name} ${(m.positions || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ((b.positions || []).length > 0) - ((a.positions || []).length > 0) || a.last.localeCompare(b.last));
  return (
    <>
      <p className="small muted mt">Positions of responsibility. They decide who's on the Patrol Leaders' Council board, show next to names, and count toward rank. Changing them here doesn't change TroopWebHost.</p>
      <Seg label="Show" value={who} onChange={setWho} options={[['scout', 'Scouts'], ['adult', 'Adults']]} />
      <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names or positions" aria-label="Search" /></div>
      <ul className="gear-list mt">
        {list.map(m => (
          <li key={m.id}><button className="gear-row" onClick={() => setEdit(m)}>
            <span className="grow"><b>{m.name}</b><span className="small muted">{(m.positions || []).join(', ') || 'No position'}{m.patrol ? ` · ${m.patrol}` : ''}</span></span>
            <Icon name="edit" size={16} />
          </button></li>
        ))}
      </ul>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name || ''}>
        {edit && <PositionForm m={edit} pass={pass} onDone={() => { setEdit(null); load(); }} />}
      </Sheet>
    </>
  );
}

function PositionForm({ m, pass, onDone }) {
  const [pos, setPos] = useState([...(m.positions || [])]);
  const [custom, setCustom] = useState('');
  const [msg, setMsg] = useState('');
  const catalog = troop.positions?.[m.role === 'scout' ? 'youth' : 'adult'] || [];
  const toggle = p => setPos(x => (x.includes(p) ? x.filter(y => y !== p) : x.length >= 6 ? x : [...x, p]));
  async function save() {
    setMsg('');
    try { await api(`leader/members/${m.id}`, { method: 'POST', body: { positions: pos }, leader: pass }); onDone(); } catch (e) { setMsg(e.message); }
  }
  return (
    <div>
      {pos.length > 0 && <div className="chip-wrap mb">{pos.map(p => <button key={p} className="chip on" onClick={() => toggle(p)}><Icon name="check" size={14} />{p}</button>)}</div>}
      <p className="small muted">Tap to add (up to 6).</p>
      <div className="chip-wrap">{catalog.filter(p => !pos.includes(p)).map(p => <button key={p} className="chip sm" onClick={() => toggle(p)}>{p}</button>)}</div>
      <div className="row-input mt"><input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Other position" aria-label="Other position" /><button className="btn small secondary" disabled={!custom.trim()} onClick={() => { toggle(custom.trim()); setCustom(''); }}>Add</button></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="btn-row"><button className="btn" onClick={save}>Save</button></div>
    </div>
  );
}

// ------------------------------------------------------------ places
function Places() {
  const places = useCol('places');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [me] = useMe();
  const list = places.items.filter(p => !q || `${p.name} ${p.address}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  async function save(p) { await saveDoc('places', p.id || `pl-${rid()}`, p, me.name); setEdit(null); places.refresh(); }
  return (
    <>
      <p className="small muted mt">Campgrounds, parks, churches and other places the troop goes. When a leader types one of these in an outing's "Where", the address, phone, website and map pin fill in.</p>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${places.items.length} places`} aria-label="Search places" /></div>
      <div className="btn-row tight"><button className="btn small secondary" onClick={() => setEdit({ name: '', address: '', phone: '', web: '', mapQ: '', notes: '' })}><Icon name="plus" size={16} />Add place</button></div>
      <ul className="gear-list mt">
        {list.map(p => (
          <li key={p.id}><button className="gear-row" onClick={() => setEdit(p)}>
            <span className="grow"><b>{p.name}</b><span className="small muted">{p.address || 'No address'}</span></span>
            {p.mapQ && <Icon name="pin" size={16} />}
          </button></li>
        ))}
      </ul>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit place' : 'Add place'}>
        {edit && <PlaceForm p={edit} onSave={save} onDelete={async () => { if (confirm(`Delete ${edit.name}?`)) { await deleteDoc('places', edit.id); setEdit(null); places.refresh(); } }} />}
      </Sheet>
    </>
  );
}

function PlaceForm({ p, onSave, onDelete }) {
  const [f, setF] = useState(p);
  const [msg, setMsg] = useState('');
  const set = patch => setF({ ...f, ...patch });
  return (
    <form onSubmit={async e => { e.preventDefault(); setMsg(''); try { await onSave(f); } catch (err) { setMsg(err.message); } }}>
      <label className="field"><span>Name</span><input value={f.name} onChange={e => set({ name: e.target.value })} required /></label>
      <label className="field"><span>Address</span><input value={f.address || ''} onChange={e => set({ address: e.target.value })} /></label>
      <div className="two-col">
        <label className="field"><span>Phone <i className="opt">the place's, not a person's</i></span><input value={f.phone || ''} onChange={e => set({ phone: e.target.value })} inputMode="tel" /></label>
        <label className="field"><span>Map pin <i className="opt">lat, long</i></span><input value={f.mapQ || ''} onChange={e => set({ mapQ: e.target.value })} placeholder="30.45, -84.28" /></label>
      </div>
      <label className="field"><span>Website</span><input value={f.web || ''} onChange={e => set({ web: e.target.value })} inputMode="url" /></label>
      <label className="field"><span>Notes <i className="opt">gate code, where to park…</i></span><input value={f.notes || ''} onChange={e => set({ notes: e.target.value })} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="btn-row"><button className="btn">Save</button>{p.id && <button type="button" className="link-btn small danger" onClick={onDelete}><Icon name="trash" size={14} />Delete</button>}</div>
    </form>
  );
}

// ------------------------------------------------------------ everything else
function MoreSetup({ goTab }) {
  const items = [
    ['users', 'Members, codes and families', 'Personal codes, invites, the Leader switch, parent ↔ scout links, and the two leaders copied on every chat.', () => goTab('members')],
    ['message', 'Groups', 'The TroopWebHost e-mail groups as chat boards and Ask-a-leader requests.', () => goTab('groups')],
    ['settings', 'Patrols, albums and the chat helper', 'Rename or add patrols, extra photo albums, AI writing helper on/off.', () => goTab('settings')],
    ['box', 'Gear and the merit badge library', 'Tents, stoves and the 56 pamphlets. Add, edit, check out.', () => { location.hash = '#/gear'; }],
    ['calendar', 'Outings and calendar', 'Imported TroopWebHost events. Add or edit from Outings.', () => { location.hash = '#/outings?view=calendar'; }],
    ['trophy', 'Advancement', 'Ranks, badges and requirements come from TroopWebHost. To refresh them, export the reports again and re-run the import (README → Importing from TroopWebHost).', () => { location.hash = '#/advancement'; }],
  ];
  return (
    <Section title="Everything else that was imported">
      <ul className="more-list">
        {items.map(([ic, l, sub, fn]) => <li key={l}><button className="more-btn" onClick={fn}><span className="more-ico"><Icon name={ic} size={22} /></span><span className="grow"><b>{l}</b><span>{sub}</span></span><Icon name="chevronR" size={18} /></button></li>)}
      </ul>
    </Section>
  );
}
