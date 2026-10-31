import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty } from '../components/ui.jsx';
import { api, useApi, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';

// Eagle project tracker: the steps from first idea to the Eagle board of review, with dates,
// the project, beneficiary, coach and volunteer hours. For the scout, their family and leaders.

export const STAGES = [
  ['idea', 'Pick a project idea', 'Talk with the beneficiary and your Scoutmaster.'],
  ['proposal', 'Write the project proposal', 'In the Eagle Scout Service Project Workbook.'],
  ['benef', 'Beneficiary approves the proposal', ''],
  ['unit', 'Scoutmaster approves', ''],
  ['committee', 'Troop committee approves', ''],
  ['council', 'Council or district approves', 'Don\'t start work until this one is done.'],
  ['plan', 'Finish the detailed plan', 'Materials, tools, safety, volunteers, schedule.'],
  ['done', 'Carry out the project', 'Lead the volunteers. Take photos.'],
  ['report', 'Write the final report', 'Get the beneficiary\'s and Scoutmaster\'s sign-off.'],
  ['smc', 'Scoutmaster conference', 'Eagle requirement 6.'],
  ['app', 'Submit the Eagle application', 'With your references and statement of ambitions. Everything except the board of review must be done before your 18th birthday.'],
  ['board', 'Eagle board of review', ''],
];

export default function Eagle({ route }) {
  return route.args[0] ? <Tracker id={route.args[0]} /> : <List />;
}

function List() {
  const acct = useAccount();
  const d = useApi(acct ? 'eagle' : null);
  const only = d.data?.scouts?.length === 1 && !d.data.isLeader ? d.data.scouts[0].id : '';
  useEffect(() => { if (only) go(`eagle/${only}`, { replace: true }); }, [only]);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Eagle projects" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  return (
    <div className="content eagle">
      <PageHead backTo="more" title="Eagle projects" sub="Every step from the first idea to the board of review." />
      {!d.data ? <p className="muted">Loading…</p> : d.data.scouts.length === 0 ? <Empty icon="trophy" title="No Eagle projects yet">Star and Life scouts show up here.</Empty> : (
        <ul className="fire-list">{d.data.scouts.map(s => (
          <li key={s.id}><a href={`#/eagle/${s.id}`}><span className="fl-emoji" aria-hidden="true">🦅</span><span className="grow"><b>{s.name}</b><span className="small muted fl-sub">{s.rank || '—'}{s.project ? ` · ${s.project}` : ''} · {s.stage} of {STAGES.length} steps{s.board ? ` · board ${s.board}` : ''}</span></span><Icon name="chevronR" size={18} /></a></li>
        ))}</ul>
      )}
    </div>
  );
}

function Tracker({ id }) {
  const d = useApi(`eagle/${id}`);
  const [f, setF] = useState(null);
  const [saved, setSaved] = useState(true);
  useEffect(() => { if (d.data) setF(d.data.doc); }, [d.data]);
  if (d.error) return <div className="content"><PageHead backTo="eagle" title="Eagle project" /><Empty icon="lock" title="Can't open this">{d.error.message}</Empty></div>;
  if (!f) return <div className="content"><PageHead backTo="eagle" title="Eagle project" /><p className="muted">Loading…</p></div>;
  const set = patch => { setF(x => ({ ...x, ...patch })); setSaved(false); };
  const n = STAGES.filter(([k]) => f.stages?.[k]).length;
  const next = STAGES.find(([k]) => !f.stages?.[k]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  return (
    <div className="content eagle">
      <PageHead backTo="eagle" eyebrow="🦅 Eagle project" title={d.data.scout.name} sub={f.title || 'Project to be chosen'} />
      <div className="card eagle-prog"><b>{n} of {STAGES.length} steps</b><span className="rr-bar"><i style={{ width: `${(n / STAGES.length) * 100}%` }} /></span>{next && <span className="small">Next: <b>{next[1]}</b></span>}</div>
      <div className="card">
        <label className="field"><span>Project</span><input value={f.title} onChange={e => set({ title: e.target.value })} placeholder="Benches for the nature trail" maxLength={140} /></label>
        <label className="field"><span>Beneficiary</span><input value={f.beneficiary} onChange={e => set({ beneficiary: e.target.value })} placeholder="Who the project helps" maxLength={140} /></label>
        <div className="row2"><label className="field"><span>Eagle coach</span><input value={f.coach} onChange={e => set({ coach: e.target.value })} maxLength={80} /></label><label className="field"><span>Volunteer hours</span><input type="number" min="0" value={f.hours} onChange={e => set({ hours: e.target.value })} /></label></div>
      </div>
      <ol className="eagle-steps">{STAGES.map(([k, label, tip]) => { const on = f.stages?.[k]; return (
        <li key={k} className={on ? 'done' : next?.[0] === k ? 'next' : ''}>
          <button className="es-dot" onClick={() => set({ stages: { ...f.stages, [k]: on ? undefined : today } })} aria-label={on ? `Mark ${label} not done` : `Mark ${label} done`}>{on ? '✓' : ''}</button>
          <span className="grow"><b>{label}</b>{tip && <span className="small muted">{tip}</span>}</span>
          {on && <input type="date" value={on} onChange={e => set({ stages: { ...f.stages, [k]: e.target.value } })} aria-label={`${label} date`} />}
        </li>
      ); })}</ol>
      <label className="field"><span>Notes</span><textarea rows={5} value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="Materials, donors, volunteers, questions for the coach…" maxLength={3000} /></label>
      <div className="save-bar"><button className="btn big" disabled={saved} onClick={async () => { const stages = Object.fromEntries(Object.entries(f.stages || {}).filter(([, v]) => v)); const r = await api(`eagle/${id}`, { method: 'PUT', body: { ...f, stages } }); setF(r.doc); setSaved(true); }}>{saved ? 'Saved ✓' : 'Save'}</button></div>
      <p className="small muted">Use the official Eagle Scout Service Project Workbook for the proposal, plan and report. This tracker just keeps everyone on the same page.</p>
    </div>
  );
}
