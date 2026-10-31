import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Pill } from '../components/ui.jsx';
import { Confetti } from '../components/Confetti.jsx';
import { api, useApi, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';
import { KNOTS, KNOT_QUIZ } from '../../troop/knots.js';

// Knot trainer: every rank knot and lashing with steps, a step-by-step practice mode,
// a "Tie it!" timer with buddy-checked best times, and a "Which knot?" quiz.

const RANKS = ['All', 'Scout', 'Second Class', 'First Class', 'Bonus'];
const fmt = ms => (ms >= 60000 ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}` : `${(ms / 1000).toFixed(1)}s`);
const byId = Object.fromEntries(KNOTS.map(k => [k.id, k]));

export default function Knots({ route }) {
  const [id, sub] = route.args;
  if (id === 'quiz') return <Quiz />;
  if (byId[id] && sub === 'time') return <Timer k={byId[id]} />;
  if (byId[id] && sub === 'practice') return <Practice k={byId[id]} />;
  if (byId[id]) return <Knot k={byId[id]} />;
  return <Hub rank={route.query.rank} />;
}

function Hub({ rank: want }) {
  const acct = useAccount();
  const d = useApi('knots');
  const rank = RANKS.includes(want) ? want : 'All';
  const can = d.data?.can || {};
  const list = KNOTS.filter(k => rank === 'All' || k.rank === rank);
  const required = KNOTS.filter(k => k.rank !== 'Bonus');
  const done = required.filter(k => can[k.id]).length;
  return (
    <div className="content knots">
      <PageHead backTo="more" title="Knot trainer" sub="Every knot and lashing for Scout through First Class, with practice mode and a timer." />
      <div className="knot-hero">
        <span className="kh-rope" aria-hidden="true">🪢</span>
        <div className="grow">
          {acct ? <><b className="kh-big">{done} of {required.length}</b><span>rank knots and lashings you can tie</span><div className="kh-bar"><i style={{ width: `${(done / required.length) * 100}%` }} /></div></>
            : <><b className="kh-big">Learn them all</b><span>Sign in with your personal code to track what you can tie and save your times.</span></>}
        </div>
      </div>
      <div className="knot-actions">
        <a className="card" href="#/knots/quiz"><span aria-hidden="true">❓</span><b>Which knot?</b><span className="small muted">Pick the right knot for the job</span></a>
        <a className="card" href="#/knots/square/time"><span aria-hidden="true">⏱️</span><b>Tie it!</b><span className="small muted">Race the clock with a buddy</span></a>
      </div>
      <div className="chip-scroll" role="tablist" aria-label="Rank">{RANKS.map(r => <button key={r} role="tab" aria-selected={rank === r} className={`chip ${rank === r ? 'on' : ''}`} onClick={() => go(`knots${r === 'All' ? '' : `?rank=${encodeURIComponent(r)}`}`, { replace: true })}>{r}</button>)}</div>
      <ul className="fire-list">
        {list.map(k => (
          <li key={k.id}><a href={`#/knots/${k.id}`}>
            <span className="fl-emoji" aria-hidden="true">{k.emoji}</span>
            <span className="grow"><span className="fl-title"><b>{k.name}</b>{can[k.id] && <Pill tone="good">✓ Can tie</Pill>}</span><span className="small muted fl-sub">{k.kind} · {k.req}</span></span>
            {d.data?.mine?.[k.id] && <span className="knot-pb" title="Your best time">{fmt(d.data.mine[k.id].ms)}</span>}
            <Icon name="chevronR" size={18} />
          </a></li>
        ))}
      </ul>
      <p className="small muted">Requirements from the Scouts BSA rank requirements. Your Scoutmaster or a leader still signs off on each one.</p>
    </div>
  );
}

function Knot({ k }) {
  const acct = useAccount();
  const d = useApi('knots');
  const [can, setCan] = useState(null);
  const isCan = can ?? !!d.data?.can?.[k.id];
  const board = d.data?.boards?.[k.id] || [];
  const toggle = async () => { try { await api('knots/can', { method: 'POST', body: { knot: k.id, on: !isCan } }); setCan(!isCan); d.refresh(); } catch (e) { alert(e.message); } };
  return (
    <div className="content knots">
      <PageHead backTo="knots" eyebrow={`${k.emoji} ${k.kind} · ${k.req}`} title={k.name} sub={k.what} />
      <div className="btn-row">
        <a className="btn accent" href={`#/knots/${k.id}/practice`}><Icon name="play" size={16} />Practice step by step</a>
        <a className="btn secondary" href={`#/knots/${k.id}/time`}>⏱️ Tie it!</a>
      </div>
      <div className="card knot-say"><span aria-hidden="true">💬</span><span><b>Say it as you tie it</b><span>{k.say}</span></span></div>
      <Section title="How to tie it">
        <ol className="knot-steps">{k.steps.map((s, i) => <li key={i}><span className="cs-n">{i + 1}</span><span>{s}</span></li>)}</ol>
      </Section>
      <div className="card fire-how"><b>Check it</b><p>{k.check}</p></div>
      <div className="card fire-how"><b>Use it for</b><ul>{k.uses.map(u => <li key={u}>{u}</li>)}</ul></div>
      {k.careful && <div className="card fire-how safety"><b>Careful</b><p>{k.careful}</p></div>}
      <a className="card watch-link" href={k.watch} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🎬</span><span className="grow"><b>Watch it tied</b><span className="small muted">{new URL(k.watch).hostname.replace('www.', '')} · opens in your browser</span></span><Icon name="external" size={18} /></a>
      {acct && <label className="switch-row card can-row"><span className="grow"><b>I can tie this one</b><span className="small muted">Saving a checked time marks it too.</span></span><input type="checkbox" role="switch" checked={isCan} onChange={toggle} aria-label="I can tie this one" /></label>}
      <Section title="Fastest in the troop">
        {board.length ? <ol className="knot-board">{board.map((b, i) => <li key={i} className={b.me ? 'me' : ''}><span className="kb-n">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span><span className="grow"><b>{b.name}</b>{b.patrol && <span className="small muted"> · {b.patrol}</span>}</span><b className="kb-t">{fmt(b.ms)}</b></li>)}</ol>
          : <p className="small muted">No times yet. Be the first: tap Tie it!</p>}
      </Section>
    </div>
  );
}

function Practice({ k }) {
  const [i, setI] = useState(0);
  const done = i >= k.steps.length;
  return (
    <div className="emcee knot-practice" role="dialog" aria-label={`Practice ${k.name}`}>
      <div className="em-top"><button className="icon-btn on-dark" onClick={() => go(`knots/${k.id}`, { replace: true })} aria-label="Stop practicing"><Icon name="x" /></button><span className="grow em-plan">{k.name}</span><span className="em-count">{Math.min(i + 1, k.steps.length)} / {k.steps.length}</span></div>
      <div className="em-bar"><i style={{ width: `${(i / k.steps.length) * 100}%` }} /></div>
      <div className="em-body" onClick={ev => { if (!ev.target.closest('button,a')) setI(x => Math.min(k.steps.length, x + 1)); }}>
        {done ? (
          <div className="em-done"><span className="em-big-emoji" aria-hidden="true">{k.emoji}</span><h2>Nice!</h2><p>{k.check}</p><div className="btn-row" style={{ justifyContent: 'center' }}><button className="btn on-dark-btn" onClick={() => setI(0)}>Again</button><a className="btn accent" href={`#/knots/${k.id}/time`}>Time me</a></div></div>
        ) : (
          <>
            <p className="em-kind">Step {i + 1}</p>
            <h2 className="em-title quiet">{k.steps[i]}</h2>
            <p className="em-peek">💬 {k.say}</p>
          </>
        )}
      </div>
      <div className="em-foot">
        <button className="btn on-dark-btn" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0}><Icon name="chevronL" size={18} />Back</button>
        <span className="grow em-next">{!done && 'Grab a rope. Tap for the next step.'}</span>
        {!done && <button className="btn accent" onClick={() => setI(x => x + 1)}>Next<Icon name="chevronR" size={18} /></button>}
      </div>
    </div>
  );
}

function Timer({ k }) {
  const acct = useAccount();
  const [state, setState] = useState('ready');   // ready → go → stopped → saved
  const [ms, setMs] = useState(0);
  const [checked, setChecked] = useState(false);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState(null);
  const t0 = useRef(0);
  useEffect(() => {
    if (state !== 'go') return undefined;
    const t = setInterval(() => setMs(Date.now() - t0.current), 50);
    return () => clearInterval(t);
  }, [state]);
  const start = () => { t0.current = Date.now(); setMs(0); setMsg(''); setRes(null); setChecked(false); setState('go'); };
  const stop = () => { setMs(Date.now() - t0.current); setState('stopped'); };
  const save = async () => {
    setMsg('');
    try { const r = await api('knots/time', { method: 'POST', body: { knot: k.id, ms, checked } }); setRes(r); setState('saved'); } catch (e) { setMsg(e.message); }
  };
  return (
    <div className="content knots">
      <PageHead backTo={`knots/${k.id}`} eyebrow="⏱️ Tie it!" title={k.name} sub="Hold the rope, tap Start, tie it, tap Stop. A buddy or a leader checks it." />
      <div className="chip-scroll">{KNOTS.filter(x => x.kind !== 'Rope care').map(x => <button key={x.id} className={`chip sm ${x.id === k.id ? 'on' : ''}`} onClick={() => { setState('ready'); setMs(0); go(`knots/${x.id}/time`, { replace: true }); }}>{x.emoji} {x.name}</button>)}</div>
      <div className={`timer-face ${state}`}>
        <span className="tf-time">{fmt(ms)}</span>
        {state === 'ready' && <button className="btn big accent" onClick={start}>Start</button>}
        {state === 'go' && <button className="btn big tf-stop" onClick={stop}>Stop</button>}
        {(state === 'stopped' || state === 'saved') && <button className="btn secondary" onClick={start}>Go again</button>}
      </div>
      {state === 'stopped' && (
        <div className="card">
          {acct ? (
            <>
              <label className="check-row"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /><span>A buddy or a leader checked my <b>{k.name.toLowerCase()}</b> and it's right.</span></label>
              <p className="small muted">{k.check}</p>
              {msg && <p className="form-msg" role="alert">{msg}</p>}
              <button className="btn" disabled={!checked} onClick={save}>Save my time</button>
            </>
          ) : <p className="small">Sign in with your personal code to save times and get on the troop board.</p>}
        </div>
      )}
      {state === 'saved' && res && (
        <div className="card center">{res.best && <Confetti />}<p className="kim-score" style={{ fontSize: 44 }}>{res.best ? '🏆 New best!' : 'Saved'}</p><p className="small muted">Your best: {fmt(res.pb.ms)}</p><a className="link-btn" href={`#/knots/${k.id}`}>See the troop board</a></div>
      )}
    </div>
  );
}

function Quiz() {
  const [round, setRound] = useState(0);
  return <QuizRound key={round} again={() => setRound(r => r + 1)} />;
}

function QuizRound({ again }) {
  const qs = useMemo(() => [...KNOT_QUIZ].sort(() => Math.random() - 0.5).slice(0, 8).map(([q, a]) => {
    const wrong = KNOTS.filter(k => k.id !== a).sort(() => Math.random() - 0.5).slice(0, 3).map(k => k.id);
    return { q, a, opts: [a, ...wrong].sort(() => Math.random() - 0.5) };
  }), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState('');
  const [score, setScore] = useState(0);
  const q = qs[i];
  if (!q) return (
    <div className="content knots center">
      {score === qs.length && <Confetti />}
      <PageHead backTo="knots" title="Which knot?" />
      <p className="kim-score">{score}<small>/{qs.length}</small></p>
      <b>{score === qs.length ? 'Perfect! You know your knots.' : score >= 6 ? 'Great job!' : 'Good practice. Try again?'}</b>
      <div className="btn-row" style={{ justifyContent: 'center' }}><button className="btn" onClick={again}>Play again</button><a className="btn secondary" href="#/knots">Back to knots</a></div>
    </div>
  );
  const answer = id => { if (picked) return; setPicked(id); if (id === q.a) setScore(s => s + 1); };
  return (
    <div className="content knots">
      <PageHead backTo="knots" eyebrow={`❓ Question ${i + 1} of ${qs.length}`} title="Which knot?" />
      <div className="card quiz-q"><p>{q.q}</p></div>
      <div className="knot-opts">{q.opts.map(id => { const k = byId[id]; const cls = picked ? (id === q.a ? 'right' : id === picked ? 'wrong' : 'dim') : ''; return <button key={id} className={`card ${cls}`} onClick={() => answer(id)} disabled={!!picked}><span aria-hidden="true">{k.emoji}</span><b>{k.name}</b></button>; })}</div>
      {picked && (
        <div className="card fire-how"><b>{picked === q.a ? 'Right!' : `It's the ${byId[q.a].name.toLowerCase()}.`}</b><p>{byId[q.a].what}</p>
          <button className="btn mt" onClick={() => { setPicked(''); setI(x => x + 1); }}>{i + 1 < qs.length ? 'Next question' : 'See my score'}</button></div>
      )}
      <p className="small muted center">Score: {score}</p>
    </div>
  );
}

export function KnotOfTheWeek() {
  const wk = Math.floor(Date.now() / (7 * 864e5));
  const k = KNOTS[wk % KNOTS.length];
  return <a className="alert-card" href={`#/knots/${k.id}`}><span className="alert-ico" aria-hidden="true" style={{ fontSize: 22 }}>{k.emoji}</span><span className="grow"><b>Knot of the week: {k.name}</b><span>{k.say}</span></span><Icon name="chevronR" /></a>;
}
