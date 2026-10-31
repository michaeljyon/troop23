import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, sessionToken, leaderPass } from '../lib/api.js';
import { go } from '../lib/router.js';
import { troop } from '../lib/config.js';
import { CEREMONIES } from '../../troop/ceremonies.js';

// Court of Honor planner (leaders): the agenda with ceremonies and who does what, the awards
// earned but not yet presented (from each scout's advancement record), a printable program,
// and an awards list for the Advancement Chair to record in Scoutbook and TroopWebHost.

const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const USUAL = [
  { kind: 'ceremony', title: 'Opening flag ceremony', ref: 'open-indoor', who: 'Color guard' },
  { kind: 'item', title: 'Welcome and introductions', who: 'Senior Patrol Leader' },
  { kind: 'item', title: 'Scout Oath and Scout Law', who: 'Senior Patrol Leader' },
  { kind: 'awards', title: 'Rank advancements', who: 'Scoutmaster', ref: 'rank' },
  { kind: 'awards', title: 'Merit badges', who: 'Advancement Chair', ref: 'badge' },
  { kind: 'awards', title: 'Special recognition', who: 'Scoutmaster', ref: 'other' },
  { kind: 'item', title: 'Scoutmaster\'s Minute', who: 'Scoutmaster' },
  { kind: 'item', title: 'Thank-yous and announcements', who: 'Committee Chair' },
  { kind: 'ceremony', title: 'Closing flag ceremony', ref: 'close-indoor', who: 'Color guard' },
];
const nice = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date to be set');
const nameOf = (a, mode) => (mode === 'first' ? a.name.replace(/^(\S+).*\s(\S)\S*$/, '$1 $2.') : a.name);
const csvUrl = id => `/api/coh/${id}/csv?${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}`;

export default function Coh({ route }) {
  const [id, sub] = route.args;
  if (id && sub === 'program') return <Program id={id} />;
  if (id) return <Plan id={id} />;
  return <List />;
}

function List() {
  const d = useApi('coh');
  const create = async () => {
    try { const r = await api('coh', { method: 'POST', body: { title: 'Court of Honor', agenda: USUAL } }); go(`coh/${r.coh.id}`); } catch (e) { alert(e.message); }
  };
  if (d.error) return <div className="content"><PageHead backTo="more" title="Court of Honor" /><Empty icon="lock" title="For leaders">{d.error.message}</Empty></div>;
  return (
    <div className="content coh">
      <PageHead backTo="more" title="Court of Honor" sub="Plan the program, gather every award that's been earned, and print the program.">
        <button className="btn small head-btn" onClick={create}><Icon name="plus" size={16} />New</button>
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : d.data.cohs.length === 0 ? <Empty icon="trophy" title="No Courts of Honor planned yet" action={<button className="btn" onClick={create}>Plan one</button>}>Basecamp starts you with the usual agenda and finds every rank and merit badge earned but not yet presented.</Empty> : (
        <ul className="fire-list">{d.data.cohs.map(c => (
          <li key={c.id}><a href={`#/coh/${c.id}`}><span className="fl-emoji" aria-hidden="true">🏅</span><span className="grow"><b>{c.title}</b><span className="small muted fl-sub">{nice(c.date)} · {c.awards} awards{c.awards ? ` · ${c.presented} presented` : ''}</span></span><Icon name="chevronR" size={18} /></a></li>
        ))}</ul>
      )}
    </div>
  );
}

function Plan({ id }) {
  const [c, setC] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [picking, setPicking] = useState(false);
  const [other, setOther] = useState(false);
  useEffect(() => { api(`coh/${id}`).then(r => setC(r.coh)).catch(e => setMsg(e.message)); }, [id]);
  if (!c) return <div className="content"><PageHead backTo="coh" title="Court of Honor" /><p className="muted">{msg || 'Loading…'}</p></div>;
  const set = patch => { setC(x => ({ ...x, ...patch })); setDirty(true); };
  const setAg = fn => set({ agenda: fn(c.agenda) });
  const move = (i, d) => setAg(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => { setMsg(''); try { const r = await api(`coh/${id}`, { method: 'PUT', body: c }); setC(r.coh); setDirty(false); } catch (e) { setMsg(e.message); } };
  const ranks = c.awards.filter(a => a.kind === 'rank').sort((a, b) => RANKS.indexOf(a.item) - RANKS.indexOf(b.item) || a.name.localeCompare(b.name));
  const badges = c.awards.filter(a => a.kind === 'badge');
  const others = c.awards.filter(a => a.kind === 'other');
  const toggle = a => set({ awards: c.awards.map(x => (x === a ? { ...x, presented: !x.presented } : x)) });
  const remove = a => set({ awards: c.awards.filter(x => x !== a) });
  const award = a => (
    <li key={`${a.memberId}-${a.kind}-${a.item}`} className={a.presented ? 'done' : ''}>
      <label className="check-row"><input type="checkbox" checked={a.presented} onChange={() => toggle(a)} aria-label={`${a.item} presented to ${a.name}`} /><span className="grow"><b>{a.name}</b> · {a.item}{a.earned && <span className="small muted"> · earned {new Date(`${a.earned}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}</span></label>
      <button className="icon-btn" onClick={() => remove(a)} aria-label={`Remove ${a.item} for ${a.name}`}><Icon name="x" size={16} /></button>
    </li>
  );
  return (
    <div className="content coh">
      <PageHead backTo="coh" eyebrow="🏅 Court of Honor" title={c.title} sub={nice(c.date)}>
        <a className="btn small secondary head-btn" href={`#/coh/${id}/program`}><Icon name="file" size={15} />Program</a>
      </PageHead>
      <div className="card">
        <label className="field"><span>Name</span><input value={c.title} onChange={e => set({ title: e.target.value })} maxLength={100} /></label>
        <div className="row2"><label className="field"><span>Date</span><input type="date" value={c.date} onChange={e => set({ date: e.target.value })} /></label><label className="field"><span>Time</span><input value={c.time} onChange={e => set({ time: e.target.value })} placeholder="7:00 PM" maxLength={20} /></label></div>
        <label className="field"><span>Place</span><input value={c.place} onChange={e => set({ place: e.target.value })} maxLength={120} placeholder="Fellowship hall" /></label>
      </div>
      <Section title={`Agenda (${c.agenda.length})`} action={c.agenda.length === 0 && <button className="link-btn small" onClick={() => set({ agenda: USUAL })}>Use the usual agenda</button>}>
        <ol className="lineup edit">{c.agenda.map((it, i) => {
          const cer = it.kind === 'ceremony' && CEREMONIES.find(x => x.id === it.ref);
          return (
            <li key={i} className="lu-row">
              <span className="lu-n">{i + 1}</span>
              <span className="grow"><input className="coh-title" value={it.title} onChange={e => setAg(l => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Agenda item" maxLength={100} />
                <input className="lu-who" value={it.who} onChange={e => setAg(l => l.map((x, j) => (j === i ? { ...x, who: e.target.value } : x)))} placeholder="Who leads it?" aria-label={`Who leads ${it.title}`} maxLength={80} />
                {cer && <a className="small" href={`#/ceremonies/${cer.id}`}>Script: {cer.title} →</a>}
                {it.kind === 'awards' && <span className="small muted">{(it.ref === 'rank' ? ranks : it.ref === 'badge' ? badges : others).length} awards</span>}</span>
              <span className="lu-btns"><button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={18} /></button><button className="icon-btn" onClick={() => move(i, 1)} disabled={i === c.agenda.length - 1} aria-label="Move down"><Icon name="down" size={18} /></button><button className="icon-btn" onClick={() => setAg(l => l.filter((_, j) => j !== i))} aria-label={`Remove ${it.title}`}><Icon name="x" size={18} /></button></span>
            </li>
          );
        })}</ol>
        <div className="el-chips">
          <button className="chip sm" onClick={() => setAg(l => [...l, { kind: 'item', title: 'New item', who: '' }])}>+ Item</button>
          {CEREMONIES.filter(x => !c.agenda.some(a => a.ref === x.id)).slice(0, 8).map(x => <button key={x.id} className="chip sm" onClick={() => setAg(l => [...l, { kind: 'ceremony', title: x.title.replace(/ \(indoors\)/, ''), ref: x.id, who: '' }])}>+ {x.emoji} {x.title.replace(/ \(indoors\)/, '')}</button>)}
        </div>
      </Section>
      <Section title={`Awards (${c.awards.length})`} action={<button className="link-btn small" onClick={() => setPicking(true)}><Icon name="download" size={15} />Bring in what's earned</button>}>
        {c.awards.length === 0 && <p className="small muted">Tap "Bring in what's earned" to see every rank and merit badge scouts have earned that hasn't been presented yet.</p>}
        {ranks.length > 0 && <><p className="coh-h">Ranks</p><ul className="coh-awards">{ranks.map(award)}</ul></>}
        {badges.length > 0 && <><p className="coh-h">Merit badges</p><ul className="coh-awards">{badges.map(award)}</ul></>}
        {others.length > 0 && <><p className="coh-h">Special recognition</p><ul className="coh-awards">{others.map(award)}</ul></>}
        <button className="link-btn small" onClick={() => setOther(true)}><Icon name="plus" size={15} />Add another award</button>
        {c.awards.length > 0 && <p className="small muted">Tick each award as it's presented. Then download the list for the Advancement Chair to mark as awarded in Scoutbook and TroopWebHost.</p>}
        {c.awards.length > 0 && <a className="btn small secondary" href={csvUrl(id)} download><Icon name="download" size={15} />Awards list for Scoutbook (CSV)</a>}
      </Section>
      <div className="card"><label className="switch-row"><span className="grow"><b>First name and last initial on the program</b><span className="small muted">Good if the program will be posted or shared outside the troop.</span></span><input type="checkbox" role="switch" checked={c.names === 'first'} onChange={e => set({ names: e.target.checked ? 'first' : 'full' })} aria-label="First name and last initial" /></label></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="save-bar"><button className="btn big" onClick={save} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved ✓'}</button></div>
      <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this Court of Honor plan?')) { await api(`coh/${id}`, { method: 'DELETE' }); go('coh'); } }}><Icon name="trash" size={14} />Delete</button></p>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Earned, not yet presented" wide>{picking && <Candidates have={c.awards} onAdd={list => { set({ awards: [...c.awards, ...list] }); setPicking(false); }} />}</Sheet>
      <Sheet open={other} onClose={() => setOther(false)} title="Add another award">{other && <OtherAward onAdd={a => { set({ awards: [...c.awards, a] }); setOther(false); }} />}</Sheet>
    </div>
  );
}

function Candidates({ have, onAdd }) {
  const [since, setSince] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); });
  const d = useApi(`coh/candidates${since ? `?since=${since}` : ''}`);
  const key = a => `${a.memberId}|${a.kind}|${a.item}`;
  const already = useMemo(() => new Set(have.map(key)), [have]);
  const list = (d.data?.candidates || []).filter(a => !already.has(key(a)));
  const [sel, setSel] = useState(null);
  const chosen = sel || new Set(list.map(key));
  const flip = k => { const s = new Set(chosen); if (s.has(k)) s.delete(k); else s.add(k); setSel(s); };
  const scouts = [...new Set(list.map(a => a.name))];
  return (
    <div>
      <label className="field"><span>Earned since</span><input type="date" value={since} onChange={e => { setSince(e.target.value); setSel(null); }} /></label>
      {!d.data ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="small muted">Nothing new. Every earned rank and merit badge has either been presented or is already on this list.</p> : (
        <>
          <p className="small muted">{list.length} awards for {scouts.length} scouts with no presented date in their advancement record. Untick anything that isn't ready or was already presented. Clear the date to see everything.</p>
          <div className="coh-cands">{scouts.map(n => (
            <div key={n} className="card"><b>{n}</b>
              {list.filter(a => a.name === n).map(a => <label key={key(a)} className="check-row"><input type="checkbox" checked={chosen.has(key(a))} onChange={() => flip(key(a))} /><span>{a.kind === 'rank' ? '⭐' : '🎖️'} {a.item}{a.eagle && <Pill tone="info">Eagle-required</Pill>}<span className="small muted"> · {new Date(`${a.earned}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span></span></label>)}
            </div>
          ))}</div>
          <button className="btn big" disabled={!chosen.size} onClick={() => onAdd(list.filter(a => chosen.has(key(a))).map(a => ({ memberId: a.memberId, name: a.name, kind: a.kind, item: a.item, earned: a.earned, presented: false })))}>Add {chosen.size} awards</button>
        </>
      )}
    </div>
  );
}

function OtherAward({ onAdd }) {
  const [name, setName] = useState('');
  const [item, setItem] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim() && item.trim()) onAdd({ memberId: '', name: name.trim(), kind: 'other', item: item.trim(), earned: '', presented: false }); }}>
      <label className="field"><span>Who</span><input value={name} onChange={e => setName(e.target.value)} maxLength={80} required /></label>
      <label className="field"><span>Award</span><input value={item} onChange={e => setItem(e.target.value)} maxLength={80} placeholder="50-Miler Award, Order of the Arrow, Scout of the Year…" required /></label>
      <button className="btn">Add</button>
    </form>
  );
}

function Program({ id }) {
  const d = useApi(`coh/${id}`);
  const c = d.data?.coh;
  if (!c) return <div className="content"><PageHead backTo={`coh/${id}`} title="Program" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const ranks = c.awards.filter(a => a.kind === 'rank').sort((a, b) => RANKS.indexOf(a.item) - RANKS.indexOf(b.item) || a.name.localeCompare(b.name));
  const byRank = RANKS.map(r => [r, ranks.filter(a => a.item === r)]).filter(([, l]) => l.length);
  const badges = c.awards.filter(a => a.kind === 'badge');
  const byScout = [...new Set(badges.map(a => a.name))].sort().map(n => [n, badges.filter(a => a.name === n).map(a => a.item).sort()]);
  const others = c.awards.filter(a => a.kind === 'other');
  return (
    <div className="content coh">
      <div className="no-print"><PageHead backTo={`coh/${id}`} title="Program" sub="Print it, or save it as a PDF from the print screen." />
        <div className="btn-row"><button className="btn" onClick={() => print()}><Icon name="file" size={16} />Print or save as PDF</button></div></div>
      <article className="program">
        <header><p className="pg-unit">{troop.unit}</p><h1>{c.title}</h1><p>{nice(c.date)}{c.time ? ` · ${c.time}` : ''}</p>{c.place && <p>{c.place}</p>}</header>
        <section><h2>Program</h2><ol className="pg-agenda">{c.agenda.map((a, i) => <li key={i}><span>{a.title}</span>{a.who && <em>{a.who}</em>}</li>)}</ol></section>
        {byRank.length > 0 && <section><h2>Rank advancements</h2>{byRank.map(([r, l]) => <div key={r} className="pg-group"><h3>{r}</h3><p>{l.map(a => nameOf(a, c.names)).join(' · ')}</p></div>)}</section>}
        {byScout.length > 0 && <section><h2>Merit badges</h2>{byScout.map(([n, l]) => <div key={n} className="pg-group"><h3>{nameOf({ name: n }, c.names)}</h3><p>{l.join(' · ')}</p></div>)}</section>}
        {others.length > 0 && <section><h2>Special recognition</h2>{others.map((a, i) => <p key={i}><b>{nameOf(a, c.names)}</b>: {a.item}</p>)}</section>}
        <footer><p>Thank you to every family, leader and merit badge counselor who helped our scouts get here.</p></footer>
      </article>
    </div>
  );
}
