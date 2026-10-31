import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Seg } from '../components/ui.jsx';
import { api, useAccount, useApi } from '../lib/api.js';
import { go } from '../lib/router.js';
import { readLocal, writeLocal } from '../lib/store.js';
import { Confetti } from '../components/Confetti.jsx';
export { Confetti };
import { QUESTIONS, byId, RANKS, TOPICS, LEVELS, BADGES, isRight } from '../../troop/quiz.js';

// Basecamp Games: quizzes and puzzles by rank and topic, a Daily Challenge,
// a Speed Round, and Campfire Clash — a live game for the whole troop.

const topicOf = id => TOPICS.find(t => t.id === id) || { label: 'Mixed', emoji: '🎲' };
const rankOf = id => RANKS.find(r => r.id === id);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const levelOf = xp => { let l = 0; LEVELS.forEach((x, i) => { if (xp >= x.xp) l = i; }); return { n: l + 1, name: LEVELS[l].name, at: LEVELS[l].xp, next: LEVELS[l + 1]?.xp ?? null }; };

// little sounds and buzzes (can be muted)
let actx = null;
function beep(kind) {
  if (readLocal('game-sound', true) === false) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { right: [660, 880], wrong: [220, 160], tick: [880], win: [523, 659, 784, 1046] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === 'wrong' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, actx.currentTime + i * 0.09); g.gain.exponentialRampToValueAtTime(0.18, actx.currentTime + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.09 + 0.16);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + i * 0.09); o.stop(actx.currentTime + i * 0.09 + 0.18);
    });
  } catch { /* no audio */ }
  try { navigator.vibrate?.(kind === 'wrong' ? [60, 40, 60] : kind === 'right' ? 30 : 0); } catch { /* no vibration */ }
}
function SoundToggle() {
  const [on, setOn] = useState(() => readLocal('game-sound', true) !== false);
  return <button type="button" className="icon-btn sm" onClick={() => { writeLocal('game-sound', !on); setOn(!on); }} aria-label={on ? 'Turn sound off' : 'Turn sound on'}>{on ? '🔊' : '🔇'}</button>;
}

// pick questions for a game
function pickQuestions({ mode, topic, rank, n }) {
  let pool = QUESTIONS.filter(q => (!topic || q.t === topic) && (!rank || q.r === rank));
  if (mode === 'speed') pool = pool.filter(q => q.type === 'mc' || q.type === 'tf');
  if (mode === 'puzzle') pool = pool.filter(q => ['order', 'match', 'scramble'].includes(q.type));
  if (mode === 'puzzle' && pool.length < 3) pool = QUESTIONS.filter(q => ['order', 'match', 'scramble'].includes(q.type) && (!topic || q.t === topic));
  if (mode === 'puzzle' && pool.length < 3) pool = QUESTIONS.filter(q => ['order', 'match', 'scramble'].includes(q.type));
  return shuffle(pool).slice(0, n);
}

// ================================================================== hub
export default function Games({ route }) {
  const acct = useAccount();
  const rank = route.query.rank || '';
  const topic = route.query.topic || '';
  const setF = patch => { const q = new URLSearchParams(Object.entries({ rank, topic, ...patch }).filter(([, v]) => v)); go(`games${q.toString() ? `?${q}` : ''}`); };
  const me = useApi(acct ? 'quiz/me' : null);
  const daily = useApi('quiz/daily');
  const [code, setCode] = useState('');
  const [boardTab, setBoardTab] = useState('week');
  const [hosting, setHosting] = useState(false);
  const s = me.data;
  const lv = s ? levelOf(s.xp) : null;
  const avail = n => QUESTIONS.filter(q => (!topic || q.t === topic) && (!rank || q.r === rank) && (n ? n(q) : true)).length;
  const params = `${rank ? `&rank=${rank}` : ''}${topic ? `&topic=${topic}` : ''}`;
  return (
    <div className="content games">
      <PageHead backTo="more" title="Games" sub="Quizzes, puzzles and live games to practice what you learn on the trail to Eagle.">
        <span className="head-btn"><SoundToggle /></span>
      </PageHead>

      {acct && s && (
        <div className="g-me">
          <div className="g-level"><span className="g-badge">{lv.n}</span><div className="grow"><b>{lv.name}</b><div className="g-xpbar"><i style={{ width: `${lv.next ? Math.min(100, ((s.xp - lv.at) / (lv.next - lv.at)) * 100) : 100}%` }} /></div><span>{s.xp.toLocaleString()} XP{lv.next ? ` · ${(lv.next - s.xp).toLocaleString()} to ${LEVELS[lv.n].name}` : ''}</span></div></div>
          <div className="g-mini"><span><b>{s.week || 0}</b>this week</span><span><b>🔥 {s.daily?.last === daily.data?.day || s.daily?.last === yesterday() ? s.daily.streak : 0}</b>day streak</span><span><b>{s.badges.length}</b>badges</span></div>
        </div>
      )}
      {!acct && <p className="g-guest"><Icon name="info" size={16} /> You can play as a guest. Sign in with your personal code to save XP, earn badges and join live games.</p>}

      <div className="g-feature">
        <a className={`g-daily ${daily.data?.done ? 'done' : ''}`} href={daily.data?.done ? '#/games?board=today' : '#/play?mode=daily'} onClick={e => { if (daily.data?.done) { e.preventDefault(); setBoardTab('today'); document.querySelector('.g-board')?.scrollIntoView({ behavior: 'smooth' }); } }}>
          <span className="g-k">Daily Challenge</span>
          <b>{daily.data?.done ? `Done! ${daily.data.done.right}/${daily.data.done.of} today` : '5 questions. Same for everyone.'}</b>
          <span>{daily.data?.done ? 'See how the troop did →' : acct ? 'Keep your streak going 🔥' : 'Sign in to count it'}</span>
        </a>
        <div className="g-live">
          <span className="g-k">Campfire Clash · live</span>
          <b>Play together at a meeting</b>
          {acct ? (
            <>
              <form className="g-join" onSubmit={e => { e.preventDefault(); if (code.trim().length === 4) go(`live/${code.trim().toUpperCase()}`); }}>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder="CODE" aria-label="Game code" autoCapitalize="characters" autoComplete="off" spellCheck="false" inputMode="text" />
                <button className="btn small accent" disabled={code.length !== 4}>Join</button>
              </form>
              <button className="link-btn on-dark-link" onClick={() => setHosting(true)}><Icon name="play" size={15} />Host a game</button>
            </>
          ) : <span>Sign in with your personal code to play live.</span>}
        </div>
      </div>

      <Section title="Pick your rank">
        <div className="chip-scroll">
          <button className={`chip ${!rank ? 'on' : ''}`} onClick={() => setF({ rank: '' })}>All ranks</button>
          {RANKS.map(r => <button key={r.id} className={`chip ${rank === r.id ? 'on' : ''}`} onClick={() => setF({ rank: r.id })}>{r.label}</button>)}
        </div>
      </Section>
      <Section title="Pick a topic" action={topic && <button className="link-btn small" onClick={() => setF({ topic: '' })}>All topics</button>}>
        <div className="g-topics">
          {TOPICS.map(t => {
            const n = QUESTIONS.filter(q => q.t === t.id && (!rank || q.r === rank)).length;
            const m = s?.topics?.[t.id]; const pct = m?.n ? Math.round((m.r / m.n) * 100) : null;
            return (
              <button key={t.id} className={`g-topic ${topic === t.id ? 'on' : ''}`} disabled={!n} onClick={() => setF({ topic: topic === t.id ? '' : t.id })}>
                <span className="g-emoji">{t.emoji}</span><b>{t.label}</b>
                <span className="g-sub">{n ? `${n} question${n > 1 ? 's' : ''}` : 'None at this rank'}</span>
                {pct != null && <span className="g-mastery" style={{ '--p': `${pct}%` }}><i />{pct}%</span>}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={`Play${topic ? ` · ${topicOf(topic).label}` : ''}${rank ? ` · ${rankOf(rank).label}` : ''}`}>
        <div className="g-modes">
          <a className="g-mode trail" href={`#/play?mode=trail${params}`}><span className="g-mi">🥾</span><b>Quiz Trail</b><span>10 questions with explanations. Build a streak!</span><i>{Math.min(10, avail())} ready</i></a>
          <a className={`g-mode speed ${avail(q => q.type === 'mc' || q.type === 'tf') < 4 ? 'off' : ''}`} href={`#/play?mode=speed${params}`}><span className="g-mi">⚡</span><b>Speed Round</b><span>60 seconds. Answer as many as you can.</span><i>Beat your best</i></a>
          <a className="g-mode puzzle" href={`#/play?mode=puzzle${params}`}><span className="g-mi">🧩</span><b>Puzzles</b><span>Put things in order, match pairs, unscramble words.</span><i>{QUESTIONS.filter(q => ['order', 'match', 'scramble'].includes(q.type)).length} puzzles</i></a>
        </div>
      </Section>

      {acct && <Board tab={boardTab} setTab={setBoardTab} me={acct.member.id} />}
      {acct && s && (
        <Section title={`Badges · ${s.badges.length} of ${BADGES.length}`}>
          <ul className="g-badges">{BADGES.map(b => <li key={b.id} className={s.badges.includes(b.id) ? 'got' : ''}><span>{b.emoji}</span><b>{b.name}</b><i>{b.desc}</i></li>)}</ul>
        </Section>
      )}
      <p className="small muted center pad-top">Practice for fun — your Scoutmaster and counselors still sign off on requirements, and the Scout Handbook is the guide.</p>
      <HostSheet open={hosting} onClose={() => setHosting(false)} rank={rank} topic={topic} />
    </div>
  );
}
const yesterday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(Date.now() - 86400000);

function Board({ tab, setTab, me }) {
  const b = useApi('quiz/board');
  const d = b.data;
  const rows = !d ? [] : tab === 'week' ? d.week : tab === 'ever' ? d.ever : tab === 'today' ? d.today : d.patrols;
  return (
    <Section title="Leaderboard" className="g-board">
      <Seg value={tab} onChange={setTab} label="Leaderboard" options={[['week', 'Week'], ['today', 'Today'], ['patrols', 'Patrols'], ['ever', 'All time']]} />
      {!d ? <p className="muted mt">Loading…</p> : rows.length === 0 ? <Empty icon="trophy" title={tab === 'today' ? 'No one has done today\'s challenge yet' : 'No scores yet'}>Be the first on the board!</Empty> : (
        <ol className="board mt">{rows.map((r, i) => (
          <li key={r.id || r.patrol} className={r.id === me ? 'me' : ''}>
            <span className="board-n">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
            <span className="grow"><b>{r.name || r.patrol}</b><span className="small muted">{tab === 'patrols' ? `${r.players} player${r.players > 1 ? 's' : ''}` : tab === 'today' ? `${r.right}/${r.of} right${r.secs ? ` · ${r.secs}s` : ''}` : `${r.patrol || ''}${r.patrol ? ' · ' : ''}Level ${r.level}`}</span></span>
            <b className="board-v">{tab === 'today' ? `${r.points} pts` : `${r.xp.toLocaleString()} XP`}</b>
          </li>
        ))}</ol>
      )}
    </Section>
  );
}

// ================================================================== one question
// Shows any kind of question; calls onDone(answerInBankOrder, right) once.
export function QuestionCard({ q, onDone, locked, quick }) {
  const choices = useMemo(() => (q.type === 'mc' ? shuffle(q.c.map((c, i) => ({ c, i }))) : q.type === 'tf' ? [{ c: 'True', i: true }, { c: 'False', i: false }] : []), [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderItems = useMemo(() => (q.type === 'order' ? shuffle(q.o.map((c, i) => ({ c, i }))) : []), [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rights = useMemo(() => (q.type === 'match' ? shuffle(q.m.map((p, i) => ({ c: p[1], i }))) : []), [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const letters = useMemo(() => (q.type === 'scramble' ? (() => { let s; do { s = shuffle(q.w.split('').map((c, i) => ({ c, i }))); } while (s.map(x => x.c).join('') === q.w && q.w.length > 2); return s; })() : []), [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState(null);
  const [seq, setSeq] = useState([]);           // order: original indices chosen; scramble: tile positions
  const [pairs, setPairs] = useState({});        // match: left index -> right original index
  const [leftSel, setLeftSel] = useState(null);
  const [result, setResult] = useState(null);    // { ok, a }
  function finish(a) { if (result || locked) return; const ok = isRight(q, a); setResult({ ok, a }); beep(ok ? 'right' : 'wrong'); onDone(a, ok); }

  const done = !!result;
  const kind = { mc: 'Multiple choice', tf: 'True or false', order: 'Put in order', match: 'Match the pairs', scramble: 'Unscramble' }[q.type];
  return (
    <div className={`qcard ${done ? (result.ok ? 'right' : 'wrong') : ''}`}>
      <div className="q-meta"><span>{topicOf(q.t).emoji} {topicOf(q.t).label}</span><span>{kind}</span></div>
      <h2 className="q-text">{q.q}</h2>

      {(q.type === 'mc' || q.type === 'tf') && (
        <div className={`q-choices ${q.type === 'tf' ? 'two' : ''}`}>
          {choices.map((x, k) => {
            const isAns = q.type === 'tf' ? x.i === q.a : x.i === q.a;
            const cls = done ? (isAns ? 'ans' : picked === k ? 'miss' : 'dim') : '';
            return <button key={String(x.i)} type="button" className={`q-choice ${cls} s${k}`} disabled={done || locked} onClick={() => { setPicked(k); finish(x.i); }}><span className="q-shape" aria-hidden="true">{['▲', '◆', '●', '■'][k]}</span><span>{x.c}</span>{done && isAns && <Icon name="check" size={18} strokeWidth={3} />}</button>;
          })}
        </div>
      )}

      {q.type === 'order' && (
        <div className="q-order">
          <ol className="q-slots">{q.o.map((_, k) => { const it = seq[k] != null ? q.o[seq[k]] : null; const wrongSpot = done && seq[k] !== k; return <li key={k} className={`${it ? 'filled' : ''} ${done ? (wrongSpot ? 'miss' : 'ans') : ''}`}><span className="q-num">{k + 1}</span>{it || <span className="muted">tap below</span>}{done && wrongSpot && <em>{q.o[k]}</em>}</li>; })}</ol>
          {!done && <div className="q-pool">{orderItems.filter(x => !seq.includes(x.i)).map(x => <button key={x.i} type="button" className="q-tile" onClick={() => { const n = [...seq, x.i]; setSeq(n); if (n.length === q.o.length) finish(n); }}>{x.c}</button>)}</div>}
          {!done && seq.length > 0 && <button type="button" className="link-btn small" onClick={() => setSeq(seq.slice(0, -1))}><Icon name="refresh" size={14} />Undo</button>}
        </div>
      )}

      {q.type === 'match' && (
        <div className="q-match">
          <div className="qm-col">{q.m.map((p, i) => <button key={i} type="button" className={`qm-item left ${leftSel === i ? 'sel' : ''} ${pairs[i] != null ? `paired p${i % 6}` : ''} ${done ? (pairs[i] === i ? 'ans' : 'miss') : ''}`} disabled={done} onClick={() => setLeftSel(leftSel === i ? null : i)}>{p[0]}{done && pairs[i] !== i && <em>{p[1]}</em>}</button>)}</div>
          <div className="qm-col">{rights.map(r => { const owner = Object.keys(pairs).find(k => pairs[k] === r.i); return <button key={r.i} type="button" className={`qm-item right ${owner != null ? `paired p${owner % 6}` : ''}`} disabled={done || leftSel == null} onClick={() => { const n = { ...pairs }; for (const k of Object.keys(n)) if (n[k] === r.i) delete n[k]; n[leftSel] = r.i; setPairs(n); setLeftSel(null); if (Object.keys(n).length === q.m.length) finish(q.m.map((_, i) => n[i])); }}>{r.c}</button>; })}</div>
          {!done && <p className="small muted qm-tip">{leftSel == null ? 'Tap an item on the left, then its match on the right.' : 'Now tap its match on the right.'}</p>}
        </div>
      )}

      {q.type === 'scramble' && (
        <div className="q-scramble">
          <div className={`qs-word ${done ? (result.ok ? 'ans' : 'miss') : ''}`}>{q.w.split('').map((_, k) => <span key={k}>{seq[k] != null ? letters[seq[k]].c : ''}</span>)}</div>
          {done && !result.ok && <p className="qs-correct">Answer: <b>{q.w}</b></p>}
          {!done && <div className="qs-tiles">{letters.map((x, k) => <button key={k} type="button" className="qs-tile" disabled={seq.includes(k)} onClick={() => { const n = [...seq, k]; setSeq(n); if (n.length === q.w.length) finish(n.map(i => letters[i].c).join('')); }}>{x.c}</button>)}</div>}
          {!done && <div className="btn-row tight"><button type="button" className="link-btn small" onClick={() => setSeq(seq.slice(0, -1))} disabled={!seq.length}>⌫ Delete</button><span className="small muted">Hint: {q.hint}</span></div>}
        </div>
      )}

      {done && !quick && <div className={`q-why ${result.ok ? 'ok' : 'no'}`}><b>{result.ok ? ['Nice!', 'You got it!', 'Correct!', 'Great job!'][q.id.length % 4] : 'Not quite.'}</b> {q.why}</div>}
    </div>
  );
}

// ================================================================== a game
export function Play({ route }) {
  const acct = useAccount();
  const mode = route.query.mode || 'trail';
  const topic = route.query.topic || '', rank = route.query.rank || '';
  const daily = useApi(mode === 'daily' ? 'quiz/daily' : null);
  const [qs, setQs] = useState(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [left, setLeft] = useState(60);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const t0 = useRef(Date.now());
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (mode === 'daily') { if (daily.data) setQs(daily.data.ids.map(id => byId[id]).filter(Boolean)); }
    else setQs(pickQuestions({ mode, topic, rank, n: mode === 'speed' ? 40 : mode === 'puzzle' ? 5 : 10 }));
    setI(0); setAnswers([]); setStreak(0); setScore(0); setAnswered(false); setLeft(60); setResult(null); t0.current = Date.now();
  }, [mode, topic, rank, daily.data?.day, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // speed round clock
  useEffect(() => {
    if (mode !== 'speed' || result || !qs) return undefined;
    const t = setInterval(() => setLeft(x => { if (x <= 1) { clearInterval(t); return 0; } return x - 1; }), 1000);
    return () => clearInterval(t);
  }, [mode, result, qs]);
  useEffect(() => { if (mode === 'speed' && left === 0 && !result) end(answers); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  async function end(list) {
    const right = list.filter(a => a.ok).length;
    const local = { right, of: list.length, points: score, list };
    if (right >= Math.ceil(list.length * 0.7)) beep('win');
    if (!acct || !list.length) { setResult({ ...local, guest: !acct }); return; }
    setSaving(true);
    try {
      const r = await api('quiz/result', { method: 'POST', body: { mode, answers: list.map(a => ({ id: a.id, a: a.a })), secs: Math.round((Date.now() - t0.current) / 1000) } });
      setResult({ ...local, ...r, list });
    } catch (e) { setResult({ ...local, error: e.message }); } finally { setSaving(false); }
  }
  function onDone(a, ok) {
    const q = qs[i];
    const next = [...answers, { id: q.id, a, ok }];
    setAnswers(next); setAnswered(true);
    const st = ok ? streak + 1 : 0; setStreak(st);
    if (ok) setScore(s => s + (mode === 'speed' ? 50 : 100) + (st >= 3 ? 25 : 0));
    if (mode === 'speed') setTimeout(() => { setAnswered(false); if (i + 1 < qs.length) setI(i + 1); else end(next); }, ok ? 350 : 900);
  }
  function next() { setAnswered(false); if (i + 1 < qs.length) setI(i + 1); else end(answers); }

  const title = mode === 'daily' ? 'Daily Challenge' : mode === 'speed' ? 'Speed Round' : mode === 'puzzle' ? 'Puzzles' : 'Quiz Trail';
  if (mode === 'daily' && daily.data?.done && !result) return <div className="content"><PageHead backTo="games" title="Daily Challenge" /><Empty icon="check" title={`You already played today: ${daily.data.done.right}/${daily.data.done.of}`} action={<a className="btn" href="#/games">Back to Games</a>}>A new challenge appears at midnight. Come back tomorrow to keep your streak!</Empty></div>;
  if (!qs) return <div className="content"><PageHead backTo="games" title={title} /><p className="muted">Getting questions ready…</p></div>;
  if (!qs.length) return <div className="content"><PageHead backTo="games" title={title} /><Empty icon="search" title="No questions for that mix yet" action={<a className="btn" href="#/games">Pick another</a>}>Try a different rank or topic.</Empty></div>;
  if (result) return <Results r={result} mode={mode} title={title} onAgain={() => setRound(x => x + 1)} acct={acct} saving={saving} />;
  const q = qs[i];
  const pct = mode === 'speed' ? (left / 60) * 100 : ((i + (answered ? 1 : 0)) / qs.length) * 100;
  return (
    <div className="content play">
      <div className="play-top">
        <button className="icon-btn" onClick={() => { if (!answers.length || confirm('Quit this game? Your progress won\'t be saved.')) go('games'); }} aria-label="Quit game"><Icon name="x" size={22} /></button>
        <div className="play-bar"><i style={{ width: `${pct}%` }} className={mode === 'speed' && left <= 10 ? 'hurry' : ''} /></div>
        <span className="play-count">{mode === 'speed' ? `${left}s` : `${i + 1}/${qs.length}`}</span>
      </div>
      <div className="play-stats"><span className="play-score">{score} pts</span>{streak >= 2 && <span className="play-streak" key={streak}>🔥 {streak} in a row</span>}<span className="muted small">{title}</span></div>
      <QuestionCard key={`${round}-${i}-${q.id}`} q={q} onDone={onDone} quick={mode === 'speed'} />
      {answered && mode !== 'speed' && <div className="play-next"><button className="btn big" onClick={next}>{i + 1 < qs.length ? <>Next <Icon name="chevronR" size={18} /></> : 'See my score'}</button></div>}
    </div>
  );
}

function Results({ r, mode, title, onAgain, acct, saving }) {
  const pct = r.of ? r.right / r.of : 0;
  const stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct > 0.3 ? 1 : 0;
  const misses = (r.list || []).filter(a => !a.ok).map(a => byId[a.id]);
  return (
    <div className="content play">
      {stars >= 2 && <Confetti />}
      <div className="res-card">
        <p className="g-k">{title}</p>
        <div className="res-stars">{[0, 1, 2].map(k => <span key={k} className={k < stars ? 'on' : ''} style={{ animationDelay: `${k * 0.18}s` }}>★</span>)}</div>
        <h1>{r.right} / {r.of}</h1>
        <p className="res-sub">{stars === 3 ? 'Outstanding! Trail-ready.' : stars === 2 ? 'Great work — almost perfect!' : stars === 1 ? 'Good effort. Review the ones you missed.' : 'Keep practicing — you\'ll get there!'}</p>
        {saving ? <p className="muted">Saving…</p> : acct && r.points != null && !r.error ? (
          <div className="res-xp">
            <span>+{r.points} XP</span>
            {r.level && <span>Level {r.level.n}: {r.level.name}</span>}
            {mode === 'daily' && r.daily && <span>🔥 {r.daily.streak}-day streak</span>}
          </div>
        ) : r.error ? <p className="form-msg">{r.error}</p> : r.guest ? <p className="small muted">Sign in with your personal code to save XP and badges.</p> : null}
        {r.newBadges?.length > 0 && <div className="res-badges">{r.newBadges.map(id => { const b = BADGES.find(x => x.id === id); return b && <div key={id} className="res-badge"><span>{b.emoji}</span><b>New badge: {b.name}</b><i>{b.desc}</i></div>; })}</div>}
      </div>
      <div className="btn-row">
        {mode !== 'daily' && <button className="btn big" onClick={onAgain}><Icon name="refresh" size={18} />Play again</button>}
        <a className="btn secondary big" href="#/games">Back to Games</a>
      </div>
      {misses.length > 0 && (
        <Section title="Review">
          <ul className="review-q">{misses.map(q => <li key={q.id}><b>{q.q}</b><span className="rq-ans">{q.type === 'mc' ? q.c[q.a] : q.type === 'tf' ? (q.a ? 'True' : 'False') : q.type === 'order' ? q.o.join(' → ') : q.type === 'match' ? q.m.map(p => `${p[0]} = ${p[1]}`).join(' · ') : q.w}</span><span className="small muted">{q.why}</span></li>)}</ul>
        </Section>
      )}
    </div>
  );
}

// ================================================================== Campfire Clash
function HostSheet({ open, onClose, rank, topic }) {
  const [f, setF] = useState({ rank, topic, count: 10, teams: false, play: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) setF(x => ({ ...x, rank, topic })); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = QUESTIONS.filter(q => (q.type === 'mc' || q.type === 'tf') && (!f.topic || q.t === f.topic) && (!f.rank || q.r === f.rank)).length;
  async function create() {
    setBusy(true); setMsg('');
    try { const r = await api('quiz/live', { method: 'POST', body: f }); onClose(); go(`live/${r.code}`); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Host a Campfire Clash">
      <p className="muted">Everyone answers on their own phone. Faster right answers score more. Great on a TV or projector at a meeting.</p>
      <label className="field"><span>Topic</span><select value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })}><option value="">All topics</option>{TOPICS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}</select></label>
      <label className="field"><span>Rank</span><select value={f.rank} onChange={e => setF({ ...f, rank: e.target.value })}><option value="">All ranks</option>{RANKS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      <div className="field"><span className="field-label">Questions</span><Seg value={String(f.count)} onChange={v => setF({ ...f, count: Number(v) })} label="Number of questions" options={[['5', '5'], ['10', '10'], ['15', '15']]} /></div>
      <label className="check"><input type="checkbox" checked={f.teams} onChange={e => setF({ ...f, teams: e.target.checked })} /><span>Patrol vs. patrol <span className="small muted">(patrols are ranked by their average score)</span></span></label>
      <label className="check"><input type="checkbox" checked={f.play} onChange={e => setF({ ...f, play: e.target.checked })} /><span>I'll play too <span className="small muted">(leave this off if your screen is on a TV or projector)</span></span></label>
      <p className="small muted">{n} questions match{n < 5 ? ' — pick a wider mix for a longer game' : ''}.</p>
      {msg && <p className="form-msg">{msg}</p>}
      <div className="sheet-foot"><button className="btn big accent" onClick={create} disabled={busy || n < 3}>{busy ? 'Setting up…' : 'Create game'}</button></div>
    </Sheet>
  );
}

const SHAPES = ['▲', '◆', '●', '■'];
export function Live({ route }) {
  const acct = useAccount();
  const code = (route.args[0] || '').toUpperCase();
  const [st, setSt] = useState(null);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [, tick] = useState(0);
  const joined = useRef(false);
  const revealing = useRef(-1);
  const load = async () => {
    try {
      const d = await api(`quiz/live/${code}`);
      setOffset(d.now - Date.now()); setSt(d); setError('');
      if (!d.isHost && !d.inRoom && !joined.current && d.status !== 'done') { joined.current = true; await api(`quiz/live/${code}/join`, { method: 'POST', body: {} }); }
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (!acct || !code) return undefined; load(); const t = setInterval(load, 1100); const c = setInterval(() => tick(x => x + 1), 250); return () => { clearInterval(t); clearInterval(c); }; }, [code, acct]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = st?.endsAt ? Math.max(0, Math.ceil((st.endsAt - (Date.now() + offset)) / 1000)) : 0;
  // the host's phone moves the game along when time runs out or everyone has answered
  useEffect(() => {
    if (!st?.isHost || st.status !== 'question' || revealing.current === st.qi) return;
    if (left <= 0 || (st.answered >= st.players.length && st.players.length > 0)) { revealing.current = st.qi; act('reveal'); }
  }, [st, left]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(a, body = {}) { setError(''); try { await api(`quiz/live/${code}/${a}`, { method: 'POST', body }); load(); } catch (e) { setError(e.message); } }
  async function answer(k) { beep('tick'); setSt(s => ({ ...s, myChoice: k })); try { await api(`quiz/live/${code}/answer`, { method: 'POST', body: { qi: st.qi, choice: k } }); } catch (e) { setError(e.message); } }
  const prevStatus = useRef('');
  useEffect(() => { if (st?.status === 'reveal' && prevStatus.current !== 'reveal') beep(st.reveal?.mine ? 'right' : 'wrong'); if (st?.status === 'done' && prevStatus.current !== 'done') beep('win'); prevStatus.current = st?.status || ''; }, [st?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!acct) return <div className="content"><PageHead backTo="games" title="Campfire Clash" /><Empty icon="lock" title="Sign in to play live">Live games need your personal code so scores go to the right person.</Empty></div>;
  if (!st) return <div className="content"><PageHead backTo="games" title="Campfire Clash" />{error ? <Empty icon="alert" title="Can't open that game" action={<a className="btn" href="#/games">Back to Games</a>}>{error}</Empty> : <p className="muted">Joining {code}…</p>}</div>;
  const myRank = st.players.findIndex(p => p.id === acct.member.id) + 1;
  const myScore = st.players.find(p => p.id === acct.member.id)?.score || 0;
  return (
    <div className={`live live-${st.status}`}>
      <header className="live-top">
        <button className="icon-btn on-dark" onClick={() => go('games')} aria-label="Leave game"><Icon name="chevronL" /></button>
        <b className="grow">Campfire Clash · <span className="live-code">{st.code}</span></b>
        {st.status !== 'lobby' && st.inRoom && <span className="live-me">{myScore.toLocaleString()} pts{myRank ? ` · #${myRank}` : ''}</span>}
      </header>
      <div className="live-body">
        {error && <p className="form-msg">{error}</p>}

        {st.status === 'lobby' && (
          <div className="lobby">
            <p className="g-k">Join code</p>
            <div className="big-code">{st.code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
            <p className="lobby-how">On your phone: <b>Basecamp → More → Games</b>, type the code, tap <b>Join</b>.</p>
            <p className="lobby-meta">{st.topic ? `${topicOf(st.topic).emoji} ${topicOf(st.topic).label}` : '🎲 All topics'} · {st.rank ? rankOf(st.rank)?.label : 'All ranks'} · {st.count} questions{st.teams ? ' · Patrol vs. patrol' : ''}</p>
            <div className="lobby-players">{st.players.map(p => <span key={p.id} className="lp">{p.name.split(' ')[0]}{st.teams && p.patrol ? <i>{p.patrol}</i> : null}</span>)}</div>
            <p className="muted">{st.players.length} player{st.players.length === 1 ? '' : 's'} in</p>
            {st.isHost && <button type="button" className="link-btn small on-dark-link" onClick={() => act('join', st.inRoom ? { leave: true } : {})}>{st.inRoom ? 'Just host (don\'t play)' : 'Play too from this screen'}</button>}
            {st.isHost ? <button className="btn big accent" onClick={() => act('start')} disabled={st.players.length < 1}><Icon name="play" size={20} />{st.players.length ? 'Start the game' : 'Waiting for players…'}</button> : <p className="lobby-wait">You're in! Waiting for {st.hostName.split(' ')[0]} to start…</p>}
          </div>
        )}

        {(st.status === 'question' || st.status === 'reveal') && st.question && (
          <div className="lq">
            <div className="lq-head">
              <span>Question {st.qi + 1} of {st.count}</span>
              {st.status === 'question' ? <span className={`lq-timer ${left <= 5 ? 'hurry' : ''}`}>{left}</span> : <span className="lq-answered">{st.reveal?.answered} answered</span>}
            </div>
            <h2 className="lq-text">{st.question.q}</h2>
            <div className={`lq-choices ${st.question.c.length === 2 ? 'two' : ''}`}>
              {st.question.c.map((c, k) => {
                const rv = st.status === 'reveal' ? st.reveal : null;
                const cls = rv ? (k === rv.correct ? 'ans' : st.myChoice === k ? 'miss' : 'dim') : st.myChoice != null ? (st.myChoice === k ? 'mine' : 'dim') : '';
                return (
                  <button key={k} type="button" className={`lq-choice s${k} ${cls}`} disabled={st.status !== 'question' || st.myChoice != null || !st.inRoom} onClick={() => answer(k)}>
                    <span className="q-shape">{SHAPES[k]}</span><span className="grow">{c}</span>
                    {rv && <span className="lq-count">{rv.dist[k] || 0}</span>}
                  </button>
                );
              })}
            </div>
            {st.status === 'question' && (!st.inRoom ? <p className="lq-locked">{st.answered} of {st.players.length} answered</p> : st.myChoice != null ? <p className="lq-locked">🔒 Locked in! {st.answered} of {st.players.length} answered…</p> : <p className="lq-locked muted">{st.answered} of {st.players.length} answered</p>)}
            {st.status === 'reveal' && (
              <>
                {st.inRoom && <div className={`lq-result ${st.reveal.mine ? 'ok' : 'no'}`}>{st.reveal.mine ? `✓ +${st.reveal.mine} points!` : st.myChoice == null ? 'Too slow this time!' : '✗ Not this time'}</div>}
                <p className="lq-why">{st.reveal.why}</p>
                <Standings st={st} me={acct.member.id} />
              </>
            )}
            {st.isHost && (
              <div className="host-bar">
                {st.status === 'question' ? <button className="btn secondary" onClick={() => { revealing.current = st.qi; act('reveal'); }}>Show answer now</button>
                  : <button className="btn accent big" onClick={() => act('next')}>{st.qi + 1 < st.count ? <>Next question <Icon name="chevronR" size={18} /></> : 'Final results 🏆'}</button>}
                <button className="link-btn small" onClick={() => confirm('End the game for everyone?') && act('end')}>End game</button>
              </div>
            )}
          </div>
        )}

        {st.status === 'done' && (
          <div className="final">
            <Confetti />
            <p className="g-k">Final results</p>
            {st.teamBoard?.length > 1 && <div className="team-win"><span className="tw-k">Winning patrol</span>🏆 {st.teamBoard[0].patrol}<span>{st.teamBoard.map(t => `${t.patrol} ${t.avg}`).join(' · ')}</span></div>}
            <div className="podium">{[1, 0, 2].map(k => st.players[k] && <div key={k} className={`pod p${k + 1}`}><b>{st.players[k].name.split(' ')[0]}</b><span>{st.players[k].score.toLocaleString()}</span><i>{k + 1}</i></div>)}</div>
            <ol className="board mt">{st.players.map((p, i) => <li key={p.id} className={p.id === acct.member.id ? 'me' : ''}><span className="board-n">{i + 1}</span><span className="grow"><b>{p.name}</b>{p.patrol && <span className="small muted">{p.patrol}</span>}</span><b className="board-v">{p.score.toLocaleString()}</b></li>)}</ol>
            <p className="small muted center">Everyone who scored earned XP. The winner gets the Campfire Champ badge.</p>
            <div className="btn-row"><a className="btn big" href="#/games">Back to Games</a></div>
          </div>
        )}
      </div>
    </div>
  );
}
function Standings({ st, me }) {
  const top = st.players.slice(0, 5);
  const mine = st.players.findIndex(p => p.id === me);
  return (
    <div className="standings">
      {st.teamBoard && <div className="team-row">{st.teamBoard.map(t => <span key={t.patrol}><b>{t.patrol}</b> {t.avg}</span>)}</div>}
      <ol>{top.map((p, i) => <li key={p.id} className={p.id === me ? 'me' : ''}><span>{i + 1}</span><b className="grow">{p.name.split(' ')[0]}</b><span>{p.score.toLocaleString()}</span></li>)}</ol>
      {mine >= 5 && <p className="small">You're #{mine + 1} with {st.players[mine].score.toLocaleString()}</p>}
    </div>
  );
}
