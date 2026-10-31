import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, useAccount, sessionToken, leaderPass } from '../lib/api.js';
import { go } from '../lib/router.js';
import { shrinkImage } from './Messages.jsx';

// Photo scavenger hunts: leaders make a list, patrols snap a photo of each thing they find,
// leaders judge the photos, and approved finds add points to the patrol board.

const photoUrl = (hid, sid) => `/api/hunt/${hid}/entries/${sid}/photo?${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}`;
const IDEAS = ['Animal tracks', 'Three different kinds of leaves', 'Something that\'s a seed', 'A bird (take a photo, don\'t chase it)', 'Lichen or moss', 'A cloud that looks like an animal', 'Your whole patrol making a human pyramid', 'A trail marker or blaze', 'Something that doesn\'t belong in nature (then pack it out)', 'A spider web', 'Something red', 'Your patrol flag somewhere scenic', 'A knot holding something up', 'Water in nature', 'Something older than all of you'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function Hunts({ route }) {
  const [id, sub] = route.args;
  if (id === 'new') return <Editor />;
  if (id && sub === 'edit') return <Editor id={id} />;
  if (id) return <Hunt id={id} />;
  return <List />;
}

function List() {
  const d = useApi('hunt');
  const acct = useAccount();
  if (!acct) return <div className="content"><PageHead backTo="more" title="Scavenger hunts" /><Empty icon="lock" title="Sign in with your personal code">Scavenger hunts are for signed-in members, so photos stay in the troop.</Empty></div>;
  const hunts = d.data?.hunts || [];
  return (
    <div className="content hunts">
      <PageHead backTo="more" title="Scavenger hunts" sub="Find it, snap it, score points for your patrol.">
        {d.data?.isLeader && <a className="btn small head-btn" href="#/hunts/new"><Icon name="plus" size={16} />New hunt</a>}
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : hunts.length === 0 ? <Empty icon="camera" title="No scavenger hunts yet">{d.data.isLeader ? 'Tap New hunt to make one for the next outing or meeting.' : 'Your leaders will post one here.'}</Empty> : (
        <ul className="fire-list">{hunts.map(h => (
          <li key={h.id}><a href={`#/hunts/${h.id}`}><span className="fl-emoji" aria-hidden="true">{h.status === 'open' ? '📸' : h.status === 'draft' ? '📝' : '🏁'}</span>
            <span className="grow"><span className="fl-title"><b>{h.title}</b>{h.status === 'open' ? <Pill tone="good">Open</Pill> : h.status === 'draft' ? <Pill tone="warn">Draft</Pill> : <Pill>Finished</Pill>}</span><span className="small muted fl-sub">{h.count} things · {h.total} points</span></span><Icon name="chevronR" size={18} /></a></li>
        ))}</ul>
      )}
    </div>
  );
}

function Hunt({ id }) {
  const d = useApi(`hunt/${id}`);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState(null);
  const file = useRef(null);
  const [target, setTarget] = useState(null);
  if (d.error) return <div className="content"><PageHead backTo="hunts" title="Scavenger hunt" /><Empty icon="info" title="Can't open this hunt">{d.error.message}</Empty></div>;
  if (!d.data) return <div className="content"><PageHead backTo="hunts" title="Scavenger hunt" /><p className="muted">Loading…</p></div>;
  const { hunt: h, entries, standings, isLeader, myPatrol } = d.data;
  const mine = Object.fromEntries(entries.filter(e => e.patrol === myPatrol).map(e => [e.itemId, e]));
  const send = async ev => {
    const f = ev.target.files?.[0]; ev.target.value = '';
    if (!f || !target) return;
    setBusy(target);
    try {
      const small = await shrinkImage(f);
      await api(`hunt/${id}/entries`, { method: 'POST', body: { itemId: target, data: small.data } });
      d.refresh();
    } catch (e) { alert(e.message); } finally { setBusy(''); setTarget(null); }
  };
  const judge = async (sid, status) => { try { await api(`hunt/${id}/entries/${sid}/judge`, { method: 'POST', body: { status } }); d.refresh(); } catch (e) { alert(e.message); } };
  const setStatus = async status => { await api(`hunt/${id}`, { method: 'PUT', body: { status } }); d.refresh(); };
  const waiting = entries.filter(e => e.status === 'pending');
  return (
    <div className="content hunts">
      <PageHead backTo="hunts" eyebrow={`📸 Scavenger hunt · ${h.status === 'open' ? 'Open' : h.status === 'draft' ? 'Draft' : 'Finished'}`} title={h.title} sub={h.note}>
        {isLeader && <a className="btn small secondary head-btn" href={`#/hunts/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      {isLeader && (
        <div className="btn-row">
          {h.status !== 'open' && <button className="btn accent" onClick={() => setStatus('open')}><Icon name="play" size={16} />{h.status === 'draft' ? 'Start the hunt' : 'Reopen'}</button>}
          {h.status === 'open' && <button className="btn secondary" onClick={() => confirm('Finish the hunt? Patrols can\'t send more photos.') && setStatus('closed')}>Finish the hunt</button>}
        </div>
      )}
      <div className="card pts-card"><ol className="pts-bars">{standings.map((s, i) => (
        <li key={s.patrol}><span className="pb-rank">{i === 0 && s.pts > 0 ? '👑' : i + 1}</span><span className="grow"><span className="pb-name"><b>{s.patrol}{s.patrol === myPatrol ? ' (you)' : ''}</b><b className="pb-total">{s.pts}</b></span><span className="pb-track"><i style={{ width: `${Math.max(2, (s.pts / Math.max(1, ...standings.map(x => x.pts))) * 100)}%` }} /></span><span className="pb-by"><span>✅ {s.found} found</span>{s.waiting > 0 && <span>⏳ {s.waiting} waiting</span>}</span></span></li>
      ))}</ol></div>
      {isLeader && waiting.length > 0 && (
        <Section title={`Photos to judge (${waiting.length})`}>
          <div className="hunt-judge">{waiting.map(e => { const it = h.items.find(x => x.id === e.itemId); return (
            <div key={e.id} className="card hj"><button className="hj-img" onClick={() => setView(e)}><img src={photoUrl(id, e.id)} alt={`${e.patrol}: ${it?.text || ''}`} loading="lazy" /></button>
              <div className="hj-info"><b>{e.patrol}</b><span className="small">{it?.text} · {it?.pts} pts</span><span className="small muted">from {e.byName}</span></div>
              <div className="hj-btns"><button className="btn small" onClick={() => judge(e.id, 'ok')}>✓ Yes</button><button className="btn small secondary" onClick={() => judge(e.id, 'no')}>✗ No</button></div></div>
          ); })}</div>
        </Section>
      )}
      <Section title={myPatrol && !isLeader ? `${myPatrol}'s list` : 'The list'}>
        {!myPatrol && !isLeader && <p className="small muted">Ask a leader to put you in a patrol so you can send photos.</p>}
        <ul className="hunt-items">
          {h.items.map(it => { const e = mine[it.id]; return (
            <li key={it.id} className={`card ${e?.status || ''}`}>
              <span className="hi-pts">{it.pts}<small>pts</small></span>
              <span className="grow"><b>{it.text}</b>{e && <span className="small">{e.status === 'ok' ? '✅ Approved' : e.status === 'no' ? '✗ Not quite. Try another photo.' : '⏳ Waiting for a leader'}</span>}</span>
              {e && <button className="hi-thumb" onClick={() => setView(e)}><img src={photoUrl(id, e.id)} alt="" loading="lazy" /></button>}
              {myPatrol && h.status === 'open' && e?.status !== 'ok' && <button className="btn small" disabled={busy === it.id} onClick={() => { setTarget(it.id); file.current?.click(); }}><Icon name="camera" size={15} />{busy === it.id ? 'Sending…' : e ? 'Retake' : 'Snap it'}</button>}
            </li>
          ); })}
        </ul>
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={send} />
      </Section>
      {isLeader && entries.some(e => e.status !== 'pending') && (
        <Section title="All photos">
          <div className="hunt-grid">{entries.filter(e => e.status !== 'pending').map(e => <button key={e.id} className={`hg ${e.status}`} onClick={() => setView(e)}><img src={photoUrl(id, e.id)} alt={e.patrol} loading="lazy" /><span>{e.patrol}</span></button>)}</div>
        </Section>
      )}
      <p className="small muted">Photograph things, not people (unless the list asks for your patrol). Photos stay here: only leaders and your own patrol can see them.</p>
      <Sheet open={!!view} onClose={() => setView(null)} title={view ? `${view.patrol}: ${h.items.find(x => x.id === view.itemId)?.text || ''}` : ''} wide>
        {view && <div className="hunt-view"><img src={photoUrl(id, view.id)} alt="" />{isLeader && <div className="btn-row"><button className="btn" onClick={() => { judge(view.id, 'ok'); setView(null); }}>✓ Approve</button><button className="btn secondary" onClick={() => { judge(view.id, 'no'); setView(null); }}>✗ Not quite</button></div>}</div>}
      </Sheet>
    </div>
  );
}

function Editor({ id }) {
  const d = useApi(id ? `hunt/${id}` : null);
  const h0 = d.data?.hunt;
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const form = f || (id ? (h0 ? { title: h0.title, date: h0.date, note: h0.note || '', items: h0.items } : null) : { title: 'Scavenger hunt', date: today(), note: '', items: [] });
  if (!form) return <div className="content"><PageHead backTo="hunts" title="Scavenger hunt" /><p className="muted">Loading…</p></div>;
  const set = patch => setF({ ...form, ...patch });
  const add = text => set({ items: [...form.items, { id: '', text, pts: 5 }] });
  const save = async () => {
    setMsg('');
    try { const r = id ? await api(`hunt/${id}`, { method: 'PUT', body: form }) : await api('hunt', { method: 'POST', body: form }); go(`hunts/${r.hunt.id}`, { replace: true }); } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="content hunts">
      <PageHead backTo={id ? `hunts/${id}` : 'hunts'} title={id ? 'Edit hunt' : 'New scavenger hunt'} />
      <div className="card">
        <label className="field"><span>Name</span><input value={form.title} onChange={e => set({ title: e.target.value })} maxLength={100} /></label>
        <label className="field"><span>Date</span><input type="date" value={form.date} onChange={e => set({ date: e.target.value })} /></label>
        <label className="field"><span>Rules or boundaries (optional)</span><textarea rows={2} value={form.note} onChange={e => set({ note: e.target.value })} maxLength={600} placeholder="Stay inside the campsite loop. Back by 4:00." /></label>
      </div>
      <Section title={`Things to find (${form.items.length})`}>
        <ul className="hunt-edit">{form.items.map((it, i) => (
          <li key={i} className="card">
            <input value={it.text} onChange={e => set({ items: form.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} aria-label="Thing to find" maxLength={140} />
            <label className="he-pts"><input type="number" value={it.pts} min={1} max={50} onChange={e => set({ items: form.items.map((x, j) => (j === i ? { ...x, pts: Number(e.target.value) } : x)) })} aria-label="Points" /><span>pts</span></label>
            <button className="icon-btn" onClick={() => set({ items: form.items.filter((_, j) => j !== i) })} aria-label="Remove"><Icon name="x" size={18} /></button>
          </li>
        ))}</ul>
        <AddItem onAdd={add} />
        <p className="small muted mt">Ideas (tap to add):</p>
        <div className="el-chips">{IDEAS.filter(x => !form.items.some(it => it.text === x)).map(x => <button key={x} className="chip sm" onClick={() => add(x)}>+ {x}</button>)}</div>
      </Section>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn big" onClick={save} disabled={!form.items.length}>Save hunt</button>
      {id && <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this hunt and all its photos?')) { await api(`hunt/${id}`, { method: 'DELETE' }); go('hunts'); } }}><Icon name="trash" size={14} />Delete hunt</button></p>}
      <p className="small muted">New hunts start as a draft. Open it when the patrols are ready to go.</p>
    </div>
  );
}

function AddItem({ onAdd }) {
  const [t, setT] = useState('');
  return <form className="row-input mt" onSubmit={e => { e.preventDefault(); if (t.trim()) { onAdd(t.trim()); setT(''); } }}><input value={t} onChange={e => setT(e.target.value)} placeholder="Something to find" aria-label="Add something to find" maxLength={140} /><button className="btn small" disabled={!t.trim()}>Add</button></form>;
}
