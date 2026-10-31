import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty } from '../components/ui.jsx';
import { api, useApi, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';

// Summer camp planner: leaders list the camp's merit badges by session (with prerequisites and
// seats); each scout (or parent) picks one badge per session; leaders see who's in each class.

const nice = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');

export default function CampPlan({ route }) {
  const [id, sub] = route.args;
  if (id === 'new') return <Editor />;
  if (id && sub === 'edit') return <Editor id={id} />;
  if (id) return <Camp id={id} />;
  return <List />;
}

function List() {
  const acct = useAccount();
  const d = useApi(acct ? 'camp' : null);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Summer camp" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  return (
    <div className="content campplan">
      <PageHead backTo="more" title="Summer camp" sub="Pick merit badges for each session and see what to finish before camp.">
        {d.data?.isLeader && <a className="btn small head-btn" href="#/camp/new"><Icon name="plus" size={16} />New</a>}
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : d.data.camps.length === 0 ? <Empty icon="tent" title="No summer camp yet">{d.data.isLeader ? 'Add the camp and its merit badge schedule.' : 'Leaders will post the camp here.'}</Empty> : (
        <ul className="fire-list">{d.data.camps.map(c => <li key={c.id}><a href={`#/camp/${c.id}`}><span className="fl-emoji" aria-hidden="true">🏕️</span><span className="grow"><b>{c.name}</b><span className="small muted fl-sub">{[c.place, c.start && `${nice(c.start)}–${nice(c.end)}`, `${c.badges.length} badges`, !c.open && 'Draft'].filter(Boolean).join(' · ')}</span></span><Icon name="chevronR" size={18} /></a></li>)}</ul>
      )}
    </div>
  );
}

function Camp({ id }) {
  const d = useApi(`camp/${id}`);
  const [msg, setMsg] = useState('');
  if (!d.data) return <div className="content"><PageHead backTo="camp" title="Summer camp" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const { camp: c, mine, counts, roster, isLeader } = d.data;
  const blocks = c.blocks.length ? c.blocks : [''];
  const pick = async (mid, picks) => { setMsg(''); try { await api(`camp/${id}/pick`, { method: 'POST', body: { memberId: mid, picks } }); d.refresh(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="content campplan">
      <PageHead backTo="camp" eyebrow={`🏕️ ${c.place || 'Summer camp'}`} title={c.name} sub={c.start ? `${nice(c.start)} – ${nice(c.end)}` : ''}>
        {isLeader && <a className="btn small secondary head-btn" href={`#/camp/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      {c.note && <div className="card fire-how"><p className="pre">{c.note}</p></div>}
      {mine.map(s => (
        <Section key={s.id} title={mine.length > 1 || isLeader ? `${s.first}'s schedule` : 'My schedule'}>
          {blocks.map(b => { const opts = c.badges.filter(x => (x.block || '') === b); const cur = s.picks[b] || ''; const badge = opts.find(x => x.name === cur); return (
            <div key={b} className="card camp-block">
              <b>{b || 'Merit badge'}</b>
              <select value={cur} onChange={e => pick(s.id, { ...s.picks, [b]: e.target.value })} aria-label={`${b || 'Merit badge'} for ${s.name}`}>
                <option value="">Free time / not taking a class</option>
                {opts.map(x => { const n = counts[`${b}|${x.name}`] || 0; const full = x.seats && n >= x.seats && cur !== x.name; return <option key={x.name} value={x.name} disabled={full}>{x.name}{x.seats ? ` (${Math.max(0, x.seats - n)} seats left)` : ''}</option>; })}
              </select>
              {badge?.prereq && <p className="small camp-pre">📝 Before camp: {badge.prereq}</p>}
            </div>
          ); })}
        </Section>
      ))}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      {isLeader && roster && (
        <Section title="Who's in each class">
          {blocks.map(b => <div key={b} className="card"><b>{b || 'Merit badges'}</b><ul className="camp-roster">{c.badges.filter(x => (x.block || '') === b).map(x => { const names = roster[`${b}|${x.name}`] || []; return <li key={x.name}><span className="grow"><b>{x.name}</b> <span className="small muted">({names.length}{x.seats ? ` of ${x.seats}` : ''})</span><span className="small"> {names.join(', ')}</span></span></li>; })}</ul></div>)}
        </Section>
      )}
      <a className="btn secondary small" href="#/packing">Packing list</a>
    </div>
  );
}

function Editor({ id }) {
  const d = useApi(id ? `camp/${id}` : null);
  const [f, setF] = useState(id ? null : { name: 'Summer camp', place: '', start: '', end: '', note: '', blocks: ['Morning 1', 'Morning 2', 'Afternoon 1', 'Afternoon 2'], badges: [], open: false });
  const [msg, setMsg] = useState('');
  useEffect(() => { if (d.data && !f) setF(d.data.camp); }, [d.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <div className="content"><PageHead backTo="camp" title="Summer camp" /><p className="muted">Loading…</p></div>;
  const set = p => setF(x => ({ ...x, ...p }));
  const setB = (i, p) => set({ badges: f.badges.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const save = async () => { setMsg(''); try { const r = id ? await api(`camp/${id}`, { method: 'PUT', body: f }) : await api('camp', { method: 'POST', body: f }); go(`camp/${r.camp.id}`, { replace: true }); } catch (e) { setMsg(e.message); } };
  return (
    <div className="content campplan">
      <PageHead backTo={id ? `camp/${id}` : 'camp'} title={id ? 'Edit camp' : 'New summer camp'} />
      <div className="card">
        <label className="field"><span>Camp</span><input value={f.name} onChange={e => set({ name: e.target.value })} maxLength={100} /></label>
        <label className="field"><span>Where</span><input value={f.place} onChange={e => set({ place: e.target.value })} maxLength={120} /></label>
        <div className="row2"><label className="field"><span>Starts</span><input type="date" value={f.start} onChange={e => set({ start: e.target.value })} /></label><label className="field"><span>Ends</span><input type="date" value={f.end} onChange={e => set({ end: e.target.value })} /></label></div>
        <label className="field"><span>Note for families (optional)</span><textarea rows={3} value={f.note} onChange={e => set({ note: e.target.value })} maxLength={1000} placeholder="Payment due dates, the camp's leader guide link…" /></label>
        <label className="field"><span>Class sessions (one per line)</span><textarea rows={4} value={f.blocks.join('\n')} onChange={e => set({ blocks: e.target.value.split('\n').map(x => x.trimStart()).slice(0, 8) })} /></label>
      </div>
      <Section title={`Merit badges (${f.badges.length})`}>
        <ul className="camp-edit">{f.badges.map((b, i) => (
          <li key={i} className="card">
            <div className="row-input"><input value={b.name} onChange={e => setB(i, { name: e.target.value })} placeholder="Merit badge" aria-label="Merit badge" maxLength={60} /><button className="icon-btn" onClick={() => set({ badges: f.badges.filter((_, j) => j !== i) })} aria-label="Remove"><Icon name="x" size={18} /></button></div>
            <div className="row2"><select value={b.block} onChange={e => setB(i, { block: e.target.value })} aria-label="Session">{f.blocks.filter(Boolean).map(x => <option key={x}>{x}</option>)}</select><input type="number" min="0" value={b.seats || ''} onChange={e => setB(i, { seats: e.target.value })} placeholder="Seats (blank = any)" aria-label="Seats" /></div>
            <input value={b.prereq} onChange={e => setB(i, { prereq: e.target.value })} placeholder="Prerequisites to finish before camp (optional)" aria-label="Prerequisites" maxLength={300} />
          </li>
        ))}</ul>
        <button className="btn secondary small" onClick={() => set({ badges: [...f.badges, { name: '', block: f.blocks.filter(Boolean)[0] || '', prereq: '', seats: 0 }] })}><Icon name="plus" size={15} />Add a merit badge</button>
      </Section>
      <label className="switch-row card"><span className="grow"><b>Open for scouts to pick</b><span className="small muted">Leave off while you set it up.</span></span><input type="checkbox" role="switch" checked={f.open} onChange={e => set({ open: e.target.checked })} aria-label="Open for scouts" /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn big" onClick={save}>Save camp</button>
      {id && <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this camp and everyone\'s picks?')) { await api(`camp/${id}`, { method: 'DELETE' }); go('camp'); } }}><Icon name="trash" size={14} />Delete</button></p>}
    </div>
  );
}
