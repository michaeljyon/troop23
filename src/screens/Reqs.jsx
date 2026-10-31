import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, useAccount, sessionToken, leaderPass } from '../lib/api.js';
import { go } from '../lib/router.js';
import { REQS, REQ_RANKS } from '../../troop/requirements.js';

// Scout through First Class requirement sign-offs. Leaders (and the youth leaders your troop allows)
// sign; scouts and parents follow along. Download the list for the Advancement Chair.

const dl = p => `/api/${p}?${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}`;
const nice = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const total = Object.values(REQS).reduce((t, l) => t + l.length, 0);

export default function Reqs({ route }) {
  return route.args[0] ? <Scout id={route.args[0]} rank={route.query.rank} /> : <List />;
}

function List() {
  const acct = useAccount();
  const d = useApi(acct ? 'signoff' : null);
  const [q, setQ] = useState('');
  const only = d.data?.scouts?.length === 1 && !d.data.canSign ? d.data.scouts[0].id : '';
  useEffect(() => { if (only) go(`reqs/${only}`, { replace: true }); }, [only]);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Requirements" /><Empty icon="lock" title="Sign in with your personal code">Requirement sign-offs are for scouts, their families and leaders.</Empty></div>;
  const list = (d.data?.scouts || []).filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="content reqs">
      <PageHead backTo="more" title="Requirements" sub="Scout through First Class, signed off one requirement at a time." />
      {d.data?.isLeader && <a className="btn small secondary" href={dl('signoff/export.csv')} download><Icon name="download" size={15} />Download sign-offs for Scoutbook</a>}
      {list.length > 6 && <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a scout" aria-label="Find a scout" /></div>}
      {!d.data ? <p className="muted">Loading…</p> : list.length === 0 ? <Empty icon="users" title="No scouts here">Parents see their own scouts once a leader links them.</Empty> : (
        <ul className="fire-list mt">{list.map(s => (
          <li key={s.id}><a href={`#/reqs/${s.id}`}><span className="fl-emoji" aria-hidden="true">✅</span><span className="grow"><b>{s.name}</b><span className="small muted fl-sub">{s.rank || 'New scout'}{s.patrol ? ` · ${s.patrol}` : ''} · {s.signed} of {total} signed</span></span><Icon name="chevronR" size={18} /></a></li>
        ))}</ul>
      )}
    </div>
  );
}

function Scout({ id, rank: want }) {
  const d = useApi(`signoff/${id}`);
  const [sign, setSign] = useState(null);
  if (d.error) return <div className="content"><PageHead backTo="reqs" title="Requirements" /><Empty icon="lock" title="Can't open this">{d.error.message}</Empty></div>;
  if (!d.data) return <div className="content"><PageHead backTo="reqs" title="Requirements" /><p className="muted">Loading…</p></div>;
  const { scout, signed, canSign, leaderOnly } = d.data;
  const doneIn = r => REQS[r].filter(x => signed[`${r}|${x.id}`]).length;
  const rank = REQ_RANKS.includes(want) ? want : REQ_RANKS.find(r => doneIn(r) < REQS[r].length) || 'First Class';
  const flip = async (r, x, on, date) => { try { await api(`signoff/${id}`, { method: 'POST', body: { rank: r, req: x.id, on, date } }); d.refresh(); } catch (e) { alert(e.message); } };
  return (
    <div className="content reqs">
      <PageHead backTo="reqs" eyebrow={`✅ ${scout.patrol || 'Requirements'}`} title={scout.name} sub={scout.rank ? `Current rank: ${scout.rank}` : 'Working on Scout rank'} />
      <div className="req-ranks">{REQ_RANKS.map(r => { const n = doneIn(r), all = REQS[r].length; return (
        <button key={r} className={`card ${rank === r ? 'on' : ''} ${n === all ? 'done' : ''}`} onClick={() => go(`reqs/${id}?rank=${encodeURIComponent(r)}`, { replace: true })}><b>{r}</b><span className="rr-bar"><i style={{ width: `${(n / all) * 100}%` }} /></span><span className="small">{n} of {all}</span></button>
      ); })}</div>
      <ul className="req-list">{REQS[rank].map(x => { const s = signed[`${rank}|${x.id}`]; const can = canSign && (!x.lead || !leaderOnly); return (
        <li key={x.id} className={`card ${s ? 'done' : ''}`}>
          <span className="rq-id">{x.id}</span>
          <span className="grow"><span>{x.text}{x.lead && <Pill>Leader</Pill>}</span>{s && <span className="small rq-by">✓ {nice(s.date)} · {s.byName}</span>}</span>
          {can && (s ? <button className="link-btn small" onClick={() => confirm(`Undo the sign-off for ${rank} ${x.id}?`) && flip(rank, x, false)}>Undo</button> : <button className="btn small" onClick={() => setSign({ r: rank, x })}>Sign</button>)}
        </li>
      ); })}</ul>
      <p className="small muted">These are short summaries. Check the full requirement in the Scouts BSA Handbook before signing. Record sign-offs in Scoutbook too; the Advancement Chair can download them all from the Requirements page.</p>
      <Sheet open={!!sign} onClose={() => setSign(null)} title={sign ? `${sign.r} ${sign.x.id}` : ''}>{sign && <SignIt s={sign} name={scout.name} onSign={async date => { await flip(sign.r, sign.x, true, date); setSign(null); }} />}</Sheet>
    </div>
  );
}
function SignIt({ s, name, onSign }) {
  const [date, setDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
  return (
    <div>
      <p><b>{s.x.text}</b></p>
      <p className="small muted">I watched {name.split(' ')[0]} complete this requirement.</p>
      <label className="field"><span>Date completed</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="btn" onClick={() => onSign(date)}>Sign off</button>
    </div>
  );
}
