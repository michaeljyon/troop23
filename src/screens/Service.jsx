import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, useAccount, sessionToken, leaderPass } from '../lib/api.js';
import { SERVICE_GOALS } from '../../troop/requirements.js';

// Service hours: scouts (or parents) log hours, leaders approve them, and totals count toward
// Tenderfoot, Second Class, Star and Life. Leaders can log a whole group project at once.

const dl = p => `/api/${p}?${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}`;
const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const nice = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
// the next service goal after the scout's current rank
const goalFor = rank => { const i = RANKS.indexOf(rank || 'Scout'); return SERVICE_GOALS.find(([r]) => RANKS.indexOf(r) > i) || null; };

export default function Service() {
  const acct = useAccount();
  const d = useApi(acct ? 'service' : null);
  const [log, setLog] = useState(false);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Service hours" /><Empty icon="lock" title="Sign in with your personal code">Service hours are kept for each scout.</Empty></div>;
  if (!d.data) return <div className="content"><PageHead backTo="more" title="Service hours" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const { entries, totals, isLeader } = d.data;
  const pending = entries.filter(e => e.status === 'pending');
  const judge = async (id, status) => { await api(`service/${id}/approve`, { method: 'POST', body: { status } }); d.refresh(); };
  const del = async id => { if (confirm('Remove these hours?')) { await api(`service/${id}`, { method: 'DELETE' }); d.refresh(); } };
  return (
    <div className="content service">
      <PageHead backTo="more" title="Service hours" sub="Log every hour of service. A leader approves them, and they count toward your next rank.">
        <button className="btn small head-btn" onClick={() => setLog(true)}><Icon name="plus" size={16} />Log hours</button>
      </PageHead>
      {!isLeader && totals.map(t => { const g = goalFor(t.rank); return (
        <div key={t.id} className="card svc-total">
          <b>{t.name}</b><span className="svc-big">{t.total}<small> hours</small></span>
          {g ? <><span className="small">Toward {g[0]}: <b>{Math.min(t.sinceRank, g[1])} of {g[1]}</b> hours since {t.rankDate ? `earning ${t.rank}` : 'joining'}{g[2] ? ` (${Math.min(t.conservationSinceRank, g[2])} of ${g[2]} conservation)` : ''}</span><span className="rr-bar"><i style={{ width: `${Math.min(100, (t.sinceRank / g[1]) * 100)}%` }} /></span></> : <span className="small">All rank service done. Keep serving!</span>}
        </div>
      ); })}
      {isLeader && pending.length > 0 && (
        <Section title={`To approve (${pending.length})`}>
          <ul className="svc-list">{pending.map(e => <li key={e.id} className="card"><span className="grow"><b>{e.name}</b> · {e.hours} h · {e.project}{e.conservation && <Pill tone="good">Conservation</Pill>}<span className="small muted">{nice(e.date)} · logged by {e.byName}{e.note ? ` · ${e.note}` : ''}</span></span><button className="btn small" onClick={() => judge(e.id, 'ok')}>✓</button><button className="btn small secondary" onClick={() => judge(e.id, 'no')}>✗</button></li>)}</ul>
        </Section>
      )}
      {isLeader && (
        <Section title="Troop totals" action={<a className="link-btn small" href={dl('service/export.csv')} download><Icon name="download" size={15} />CSV</a>}>
          <ul className="svc-table">{totals.filter(t => t.total > 0).map(t => { const g = goalFor(t.rank); return <li key={t.id}><span className="grow"><b>{t.name}</b><span className="small muted"> {t.rank || 'New scout'}</span></span><span>{t.total} h</span>{g && <span className={`small ${t.sinceRank >= g[1] ? 'good-text' : 'muted'}`}>{Math.min(t.sinceRank, g[1])}/{g[1]} for {g[0]}</span>}</li>; })}</ul>
          {!totals.some(t => t.total > 0) && <p className="small muted">No approved hours yet.</p>}
        </Section>
      )}
      <Section title="History">
        {entries.length === 0 ? <p className="small muted">Nothing logged yet.</p> : <ul className="svc-list">{entries.slice(0, 80).map(e => (
          <li key={e.id} className={`card ${e.status}`}><span className="grow"><b>{e.hours} h · {e.project}</b>{e.conservation && <Pill tone="good">Conservation</Pill>}<span className="small muted">{isLeader || totals.length > 1 ? `${e.name} · ` : ''}{nice(e.date)} · {e.status === 'ok' ? `approved${e.approvedBy ? ` by ${e.approvedBy}` : ''}` : e.status === 'no' ? 'not approved' : 'waiting for a leader'}</span></span>
            {(isLeader || (e.status !== 'ok' && e.by === d.data.me)) && <button className="icon-btn" onClick={() => del(e.id)} aria-label="Remove"><Icon name="x" size={16} /></button>}</li>
        ))}</ul>}
      </Section>
      <p className="small muted">Tenderfoot needs 1 hour, Second Class 2, First Class 3, Star 6, and Life 6 (at least 3 conservation), done after earning the rank before. Your Scoutmaster approves the projects.</p>
      <Sheet open={log} onClose={() => setLog(false)} title="Log service hours">{log && <LogForm d={d.data} acct={acct} onDone={() => { setLog(false); d.refresh(); }} />}</Sheet>
    </div>
  );
}

function LogForm({ d, acct, onDone }) {
  const people = d.isLeader ? d.scouts : [acct.member, ...(acct.scouts || [])].filter(p => p && (p.role === 'scout' || d.totals.some(t => t.id === p.id)));
  const [ids, setIds] = useState(people.length === 1 ? [people[0].id] : []);
  const [f, setF] = useState({ date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()), hours: 1, project: '', conservation: false, note: '' });
  const [msg, setMsg] = useState('');
  const flip = id => setIds(x => (x.includes(id) ? x.filter(y => y !== id) : d.isLeader ? [...x, id] : [id]));
  return (
    <div>
      <div className="field"><span>{d.isLeader ? 'Scouts (pick everyone who served)' : 'Who served'}</span><div className="el-chips svc-pick">{people.map(p => <button key={p.id} className={`chip sm ${ids.includes(p.id) ? 'on' : ''}`} onClick={() => flip(p.id)}>{p.name}</button>)}</div></div>
      <div className="row2"><label className="field"><span>Date</span><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label><label className="field"><span>Hours</span><input type="number" step="0.25" min="0.25" max="24" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} /></label></div>
      <label className="field"><span>Project</span><input value={f.project} onChange={e => setF({ ...f, project: e.target.value })} placeholder="Scouting for Food, park cleanup…" maxLength={120} /></label>
      <label className="check-row"><input type="checkbox" checked={f.conservation} onChange={e => setF({ ...f, conservation: e.target.checked })} /><span>Conservation project (trail work, cleanups, planting…)</span></label>
      <label className="field"><span>Note (optional)</span><input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} maxLength={300} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" disabled={!ids.length || !f.project.trim()} onClick={async () => { try { await api('service', { method: 'POST', body: { ...f, memberIds: ids } }); onDone(); } catch (e) { setMsg(e.message); } }}>{d.isLeader ? `Log for ${ids.length || ''} scout${ids.length === 1 ? '' : 's'}` : 'Send to a leader'}</button>
    </div>
  );
}
