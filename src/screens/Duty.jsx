import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api, useApi, useAccount } from '../lib/api.js';

// Campsite duty roster for an outing: troop jobs (color guard, firewood, water…) rotated
// across patrols for each day, with optional names. Shows on Home during the outing.

const JOB_EMOJI = [[/color|flag/i, '🇺🇸'], [/fire|wood/i, '🪵'], [/water/i, '💧'], [/clean|latrine|trash/i, '🧹'], [/campfire|program|game/i, '🔥'], [/kitchen|dish|cook/i, '🍳'], [/gear|quarter/i, '📦'], [/first aid/i, '🩹']];
export const jobEmoji = j => (JOB_EMOJI.find(([rx]) => rx.test(j)) || [null, '✅'])[1];
const dayLabel = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export function DutyRoster({ outing }) {
  const d = useApi(`duty/${outing.id}`);
  const acct = useAccount();
  const [r, setR] = useState(null);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState('');
  const [newJob, setNewJob] = useState('');
  useEffect(() => { if (d.data) setR(d.data.roster); }, [d.data]);
  if (d.error) return <p className="muted">{d.error.message}</p>;
  if (!d.data || !r) return <p className="muted">Loading…</p>;
  const { patrols, canEdit } = d.data;
  const mine = acct?.member?.patrol || '';
  const rotate = () => { const grid = {}; r.dates.forEach((dt, di) => { grid[dt] = {}; r.jobs.forEach((j, ji) => { grid[dt][j] = patrols.length ? patrols[(ji + di) % patrols.length] : ''; }); }); setR({ ...r, grid }); };
  const shuffle = () => { const p = [...patrols].sort(() => Math.random() - 0.5); const grid = {}; r.dates.forEach((dt, di) => { grid[dt] = {}; r.jobs.forEach((j, ji) => { grid[dt][j] = p.length ? p[(ji + di) % p.length] : ''; }); }); setR({ ...r, grid }); };
  const setCell = (dt, j, patrol) => setR({ ...r, grid: { ...r.grid, [dt]: { ...r.grid[dt], [j]: patrol } } });
  const setName = (dt, j, v) => setR({ ...r, names: { ...r.names, [dt]: { ...(r.names?.[dt] || {}), [j]: v } } });
  const save = async () => { setMsg(''); try { const x = await api(`duty/${outing.id}`, { method: 'PUT', body: r }); setR(x.roster); setEdit(false); d.refresh(); } catch (e) { setMsg(e.message); } };
  if (!r.dates.length) return <p className="muted">Add the outing's dates to make a duty roster.</p>;
  return (
    <div className="duty-roster">
      <div className="section-row"><h2 className="section-title">Campsite duties</h2>{canEdit && !edit && <button className="link-btn small" onClick={() => setEdit(true)}><Icon name="edit" size={15} />{r.draft ? 'Set it up' : 'Change'}</button>}</div>
      {r.draft && <p className="small muted">{canEdit ? 'Here\'s a fair rotation to start from. Tap "Set it up" to change it and save it for the troop.' : 'Your PLC hasn\'t posted the duty roster yet. Here\'s a suggestion.'}</p>}
      {r.dates.map(dt => (
        <div key={dt} className="card duty-day">
          <p className="duty-date">{dayLabel(dt)}</p>
          <ul>{r.jobs.map(j => { const p = r.grid?.[dt]?.[j] || ''; return (
            <li key={j} className={p && p === mine ? 'mine' : ''}>
              <span className="dj-emoji" aria-hidden="true">{jobEmoji(j)}</span><span className="grow"><b>{j}</b>{!edit && r.names?.[dt]?.[j] && <span className="small muted"> · {r.names[dt][j]}</span>}</span>
              {edit ? (
                <span className="dj-edit"><select value={p} onChange={e => setCell(dt, j, e.target.value)} aria-label={`${j} on ${dayLabel(dt)}`}><option value="">Nobody</option>{patrols.map(x => <option key={x}>{x}</option>)}</select>
                  <input value={r.names?.[dt]?.[j] || ''} onChange={e => setName(dt, j, e.target.value)} placeholder="Names (optional)" aria-label={`Names for ${j}`} maxLength={80} /></span>
              ) : <span className="dj-patrol">{p || '—'}</span>}
            </li>
          ); })}</ul>
        </div>
      ))}
      {edit && (
        <div className="card">
          <b>Jobs</b>
          <div className="el-chips mt">{r.jobs.map(j => <span key={j} className="chip sm">{jobEmoji(j)} {j}<button className="chip-x" onClick={() => setR({ ...r, jobs: r.jobs.filter(x => x !== j) })} aria-label={`Remove ${j}`}>×</button></span>)}</div>
          <form className="row-input mt" onSubmit={e => { e.preventDefault(); const j = newJob.trim(); if (j && !r.jobs.includes(j)) { setR({ ...r, jobs: [...r.jobs, j] }); setNewJob(''); } }}><input value={newJob} onChange={e => setNewJob(e.target.value)} placeholder="Add a job (Kitchen patrol, Quartermaster…)" maxLength={40} aria-label="Add a job" /><button className="btn small secondary">Add</button></form>
          <div className="btn-row"><button className="btn small secondary" onClick={rotate}><Icon name="refresh" size={15} />Rotate fairly</button><button className="btn small secondary" onClick={shuffle}><Icon name="shuffle" size={15} />Shuffle</button></div>
          {msg && <p className="form-msg" role="alert">{msg}</p>}
          <div className="btn-row"><button className="btn" onClick={save}>Save roster</button><button className="link-btn" onClick={() => { setR(d.data.roster); setEdit(false); }}>Cancel</button></div>
        </div>
      )}
      <p className="small muted">Patrol cooking and cleanup for each meal are on the Meals tab.</p>
    </div>
  );
}

// "Your patrol's job today" on Home, while an outing is happening
export function DutyToday() {
  const acct = useAccount();
  const d = useApi(acct ? 'duty/today' : null);
  const mine = acct?.member?.patrol;
  const rosters = d.data?.rosters || [];
  if (!rosters.length) return null;
  return rosters.map(r => {
    const my = r.jobs.filter(j => j.patrol === mine);
    return (
      <a key={r.outingId} className="alert-card duty-home" href={`#/outing/${r.outingId}?tab=duty`}>
        <span className="alert-ico" aria-hidden="true" style={{ fontSize: 22 }}>{my.length ? jobEmoji(my[0].job) : '📋'}</span>
        <span className="grow"><b>{my.length ? `Today ${mine} has: ${my.map(j => j.job).join(', ')}` : 'Today\'s campsite duties'}</b><span>{r.jobs.map(j => `${j.job}: ${j.patrol}`).join(' · ')}</span></span>
        <Icon name="chevronR" />
      </a>
    );
  });
}
