import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet } from '../components/ui.jsx';
import { api, useApi } from '../lib/api.js';
import { go } from '../lib/router.js';
import { useWakeLock } from './Campfire.jsx';

// Patrol points: a running patrol competition. Leaders, the SPL and the ASPL give points;
// uniform inspections and scavenger hunts add points on their own. TV mode for meetings.

const REASONS = ['Patrol spirit', 'Best campsite', 'Patrol yell', 'Service', 'Uniform', 'Attendance', 'Game winner', 'Helping out', 'Leave No Trace'];
const KIND = { awards: ['🏅', 'Awards'], inspections: ['👕', 'Inspections'], hunts: ['📸', 'Hunts'], geocaching: ['📍', 'Geocaching'] };
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }); };

export default function Points({ route }) {
  if (route.args[0] === 'tv') return <TV />;
  return <Board />;
}

function Bars({ board, big }) {
  const max = Math.max(1, ...board.map(b => b.total));
  return (
    <ol className={`pts-bars ${big ? 'big' : ''}`}>
      {board.map((b, i) => (
        <li key={b.patrol}>
          <span className="pb-rank">{i === 0 && b.total > 0 ? '👑' : i + 1}</span>
          <span className="grow">
            <span className="pb-name"><b>{b.patrol}</b><b className="pb-total">{b.total}</b></span>
            <span className="pb-track"><i style={{ width: `${Math.max(2, (Math.max(0, b.total) / max) * 100)}%` }} /></span>
            {!big && <span className="pb-by">{Object.entries(b.by).filter(([, v]) => v).map(([k, v]) => <span key={k}>{KIND[k]?.[0]} {v}</span>)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Board() {
  const d = useApi('points');
  const [give, setGive] = useState(false);
  const [season, setSeason] = useState(false);
  if (d.error) return <div className="content"><PageHead backTo="more" title="Patrol points" /><Empty icon="lock" title="Can't open patrol points">{d.error.message}</Empty></div>;
  if (!d.data) return <div className="content"><PageHead backTo="more" title="Patrol points" /><p className="muted">Loading…</p></div>;
  const { board, recent, auto, season: s } = d.data;
  const del = async id => { if (!confirm('Take these points back?')) return; try { await api(`points/${id}`, { method: 'DELETE' }); d.refresh(); } catch (e) { alert(e.message); } };
  return (
    <div className="content points">
      <PageHead backTo="more" title="Patrol points" sub={s.name ? `${s.name}${s.start ? `, since ${new Date(`${s.start}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}` : 'Every patrol, every point. Inspections and scavenger hunts count too.'}>
        {d.data.canAward && <button className="btn small head-btn" onClick={() => setGive(true)}><Icon name="plus" size={16} />Give points</button>}
      </PageHead>
      {board.length === 0 ? <Empty icon="users" title="No patrols yet">Leaders set up patrols in Leader tools → Settings.</Empty> : <div className="card pts-card"><Bars board={board} /></div>}
      <div className="btn-row"><a className="btn secondary small" href="#/points/tv"><Icon name="expand" size={15} />Show on a TV</a>{d.data.isLeader && <button className="link-btn small" onClick={() => setSeason(true)}>Start a new season</button>}</div>
      <Section title="Latest points">
        {recent.length + auto.length === 0 ? <p className="small muted">Nothing yet this season.</p> : (
          <ul className="pts-log">
            {[...recent.map(e => ({ ...e, kind: 'awards' })), ...auto].sort((a, b) => b.at - a.at).slice(0, 40).map((e, i) => (
              <li key={e.id || `a${i}`}>
                <span className={`pl-pts ${e.pts < 0 ? 'neg' : ''}`}>{e.pts > 0 ? '+' : ''}{e.pts}</span>
                <span className="grow"><span><b>{e.patrol}</b> · {e.reason}</span><span className="small muted">{KIND[e.kind]?.[0]} {e.byName ? `${e.byName} · ` : ''}{e.at ? ago(e.at) : ''}</span></span>
                {e.id && (d.data.isLeader || e.by === d.data.me) && <button className="icon-btn" onClick={() => del(e.id)} aria-label="Take back these points"><Icon name="x" size={16} /></button>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="small muted">Uniform inspections add a patrol's score divided by ten (a 92 is 9 points). Scavenger hunts add each approved item's points. Leaders can switch these off in Settings.</p>
      <Sheet open={give} onClose={() => setGive(false)} title="Give patrol points">{give && <Give patrols={board.map(b => b.patrol)} onDone={() => { setGive(false); d.refresh(); }} />}</Sheet>
      <Sheet open={season} onClose={() => setSeason(false)} title="Start a new season">{season && <Season onDone={() => { setSeason(false); d.refresh(); }} />}</Sheet>
    </div>
  );
}

function Give({ patrols, onDone }) {
  const [patrol, setPatrol] = useState('');
  const [pts, setPts] = useState(5);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const save = async () => { setMsg(''); try { await api('points', { method: 'POST', body: { patrol, pts, reason } }); onDone(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="give">
      <div className="field"><span>Patrol</span><div className="el-chips">{patrols.map(p => <button key={p} className={`chip ${patrol === p ? 'on' : ''}`} onClick={() => setPatrol(p)}>{p}</button>)}</div></div>
      <div className="field"><span>Points</span><div className="give-pts">{[-5, 1, 3, 5, 10, 25].map(n => <button key={n} className={`chip ${pts === n ? 'on' : ''} ${n < 0 ? 'neg' : ''}`} onClick={() => setPts(n)}>{n > 0 ? '+' : ''}{n}</button>)}<input type="number" value={pts} onChange={e => setPts(Number(e.target.value))} aria-label="Points" min={-100} max={100} /></div></div>
      <div className="field"><span>For</span><div className="el-chips">{REASONS.map(r => <button key={r} className={`chip sm ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Or type a reason" maxLength={100} className="mt" /></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn big" onClick={save} disabled={!patrol || !pts}>{patrol ? `Give ${patrol} ${pts > 0 ? '+' : ''}${pts}` : 'Pick a patrol'}</button>
    </div>
  );
}

function Season({ onDone }) {
  const [name, setName] = useState(`${new Date().getFullYear()}–${new Date().getFullYear() + 1} season`);
  const [start, setStart] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
  return (
    <div>
      <p className="small muted">Points from before the start date stop counting. Nothing is deleted.</p>
      <label className="field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></label>
      <label className="field"><span>Starts</span><input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <button className="btn" onClick={async () => { await api('points/season', { method: 'POST', body: { name, start } }); onDone(); }}>Start the season</button>
    </div>
  );
}

function TV() {
  const d = useApi('points');
  useWakeLock();
  useEffect(() => { const t = setInterval(() => d.refresh(), 15000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="emcee pts-tv" role="dialog" aria-label="Patrol points on a TV">
      <div className="em-top"><button className="icon-btn on-dark" onClick={() => go('points', { replace: true })} aria-label="Leave TV mode"><Icon name="x" /></button><span className="grow em-plan">Patrol points{d.data?.season?.name ? ` · ${d.data.season.name}` : ''}</span><span className="em-count">Live</span></div>
      <div className="em-body">{d.data ? <Bars board={d.data.board} big /> : <p>Loading…</p>}</div>
    </div>
  );
}
