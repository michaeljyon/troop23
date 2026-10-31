import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet } from '../components/ui.jsx';
import { api, useAccount, useApi } from '../lib/api.js';
import { go } from '../lib/router.js';
import { scrollToTop } from '../lib/scroll.js';
import { MARKS, UNIFORM, scoreOf, ratingOf } from '../../troop/uniform.js';
import { Confetti } from '../components/Confetti.jsx';

// Patrol uniform inspections: the patrol leader taps the drawing (or the list) only
// where something's off. Everything starts as Sharp, so a good uniform takes one tap.

const CYCLE = it => (it.na ? ['good', 'fix', 'miss', 'na'] : ['good', 'fix', 'miss']);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const nice = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const buzz = ms => { try { navigator.vibrate?.(ms); } catch { /* no vibration */ } };

// ------------------------------------------------------------------ the drawing
// An original cartoon scout in a field uniform. Parts fade when Missing and wiggle when they need a fix.
export function UniformFigure({ items, marks = {}, onTap, score, small }) {
  const on = new Set(items.map(i => i.id));
  const st = id => (on.has(id) ? marks[id] || 'good' : 'off');
  const part = id => `uf-part s-${st(id)}`;
  const mood = score == null ? 'ok' : score === 100 ? 'star' : score >= 75 ? 'happy' : score >= 50 ? 'ok' : 'oops';
  return (
    <div className={`uf ${small ? 'small' : ''}`}>
      <svg viewBox="0 0 200 300" role="img" aria-label="Uniform drawing">
        <ellipse cx="100" cy="292" rx="62" ry="6" fill="rgba(0,0,0,.08)" />
        {/* arms */}
        <path d="M30 124 Q24 150 28 176" stroke="var(--uf-skin)" strokeWidth="15" strokeLinecap="round" fill="none" />
        <path d="M170 124 Q176 150 172 176" stroke="var(--uf-skin)" strokeWidth="15" strokeLinecap="round" fill="none" />
        {/* legs: pants */}
        <g className={part('pants')}>
          <path d="M64 168 L100 168 L98 262 L70 262 Z" fill="var(--uf-pants)" />
          <path d="M100 168 L136 168 L130 262 L102 262 Z" fill="var(--uf-pants)" />
          <path d="M99 172 L99 230" stroke="rgba(0,0,0,.15)" strokeWidth="1.5" />
        </g>
        <g className={part('socks')}><rect x="71" y="261" width="26" height="14" rx="3" fill="var(--uf-socks)" /><rect x="103" y="261" width="26" height="14" rx="3" fill="var(--uf-socks)" /></g>
        <g className={part('shoes')}><path d="M66 274 h32 v10 q0 6 -6 6 h-30 q-6 0 -4 -8 z" fill="#3B2A20" /><path d="M102 274 h32 l8 8 q2 8 -4 8 h-30 q-6 0 -6 -6 z" fill="#3B2A20" /></g>
        {/* shirt and sleeves */}
        <g className={part('shirt')}>
          <path d="M60 62 L140 62 L176 92 L168 130 L148 124 L146 168 L54 168 L52 124 L32 130 L24 92 Z" fill="var(--uf-shirt)" stroke="var(--uf-shirt-edge)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 66 L100 166" stroke="var(--uf-shirt-edge)" strokeWidth="1.5" />
          {[86, 106, 126, 146].map(y => <circle key={y} cx="103" cy={y} r="1.8" fill="var(--uf-shirt-edge)" />)}
          <rect x="66" y="98" width="26" height="30" rx="3" fill="none" stroke="var(--uf-shirt-edge)" strokeWidth="1.5" /><path d="M64 98 h30 l-3 9 h-24 z" fill="var(--uf-shirt-edge)" opacity=".35" />
          <rect x="108" y="98" width="26" height="30" rx="3" fill="none" stroke="var(--uf-shirt-edge)" strokeWidth="1.5" /><path d="M106 98 h30 l-3 9 h-24 z" fill="var(--uf-shirt-edge)" opacity=".35" />
        </g>
        <g className={part('belt')}><rect x="54" y="160" width="92" height="10" rx="2" fill="var(--uf-belt)" /><rect x="93" y="158" width="14" height="14" rx="2" fill="#C9A227" stroke="#8C6D12" /></g>
        {/* insignia */}
        <g className={part('loops')}><rect x="56" y="60" width="18" height="7" rx="3" fill="#2E7D4F" transform="rotate(30 65 63)" /><rect x="126" y="60" width="18" height="7" rx="3" fill="#2E7D4F" transform="rotate(-30 135 63)" /></g>
        <g className={part('flag')}><rect x="31" y="82" width="18" height="12" rx="1" fill="#fff" stroke="#B22234" strokeWidth=".8" />{[0, 1, 2, 3].map(k => <rect key={k} x="31" y={83 + k * 3} width="18" height="1.4" fill="#B22234" />)}<rect x="31" y="82" width="8" height="6" fill="#3C3B6E" /></g>
        <g className={part('patrol')}><circle cx="38" cy="114" r="9" fill="var(--uf-patrol)" stroke="#fff" strokeWidth="1.5" /><circle cx="38" cy="114" r="4" fill="#fff" opacity=".7" /></g>
        <g className={part('council')}><path d="M150 80 h22 v10 q-11 8 -22 0 z" fill="#B3262E" stroke="#fff" strokeWidth="1" /><rect x="152" y="93" width="18" height="7" rx="1" fill="#B3262E" /><text x="161" y="99" fontSize="6" fontWeight="800" fill="#fff" textAnchor="middle">23</text></g>
        <g className={part('office')}><circle cx="161" cy="118" r="7" fill="#1D5FBF" stroke="#fff" strokeWidth="1.2" /><path d="M157 118 h8 M161 114 v8" stroke="#fff" strokeWidth="1.6" /></g>
        <g className={part('rank')}><path d="M121 108 l3 6 6 1 -4.5 4.5 1 6.5 -5.5 -3 -5.5 3 1 -6.5 -4.5 -4.5 6 -1 z" fill="#D4A62A" stroke="#7A5A00" strokeWidth=".8" /></g>
        <g className={part('crest')}><circle cx="128" cy="86" r="5.5" fill="#5B2C83" stroke="#fff" strokeWidth="1" /></g>
        {/* neckerchief */}
        <g className={part('neck')}><path d="M76 60 Q100 74 124 60 L104 112 Q100 118 96 112 Z" fill="var(--uf-neck)" /><rect x="93" y="70" width="14" height="10" rx="4" fill="#E9DFC6" stroke="#9C8B60" /></g>
        {/* head */}
        <rect x="92" y="50" width="16" height="14" fill="var(--uf-skin)" />
        <circle cx="100" cy="36" r="22" fill="var(--uf-skin)" />
        <g className={`uf-face m-${mood}`}>
          {mood === 'star' ? <><path d="M84 32 h12 v6 q-6 4 -12 0 z M104 32 h12 v6 q-6 4 -12 0 z M96 34 h8" fill="#1B2420" stroke="#1B2420" strokeWidth="1.5" /><path d="M90 46 q10 9 20 0" stroke="#1B2420" strokeWidth="2.5" fill="none" strokeLinecap="round" /></>
            : <><circle cx="92" cy="34" r="2.6" fill="#1B2420" /><circle cx="108" cy="34" r="2.6" fill="#1B2420" />
              {mood === 'happy' && <path d="M91 44 q9 8 18 0" stroke="#1B2420" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
              {mood === 'ok' && <path d="M93 46 h14" stroke="#1B2420" strokeWidth="2.4" strokeLinecap="round" />}
              {mood === 'oops' && <circle cx="100" cy="46" r="3.5" fill="none" stroke="#1B2420" strokeWidth="2.2" />}</>}
        </g>
        <g className={part('hat')}><path d="M78 24 Q100 2 122 24 Z" fill="var(--uf-pants)" /><path d="M76 24 h40 q10 0 14 4 h-54 z" fill="var(--uf-pants)" /></g>
      </svg>
      {onTap && items.map(it => {
        const s = marks[it.id] || 'good';
        return (
          <button key={it.id} type="button" className={`uf-pin m-${s}`} style={{ left: `${it.spot[0]}%`, top: `${it.spot[1]}%` }}
            onClick={() => onTap(it)} aria-label={`${it.label}: ${MARKS[s].label}. Tap to change.`}>
            <span aria-hidden="true">{it.emoji}</span><i aria-hidden="true">{MARKS[s].short}</i>
          </button>
        );
      })}
    </div>
  );
}

function ScoreRing({ score, size = 76 }) {
  const r = 30, c = 2 * Math.PI * r;
  const color = score >= 90 ? '#2E9E5B' : score >= 75 ? '#7BB33A' : score >= 50 ? '#E9B949' : '#D64545';
  return (
    <svg className="score-ring" width={size} height={size} viewBox="0 0 76 76" aria-label={`Score ${score}`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--sand)" strokeWidth="8" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset .35s ease, stroke .35s' }} />
      <text x="38" y="44" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--ink)">{score}</text>
    </svg>
  );
}

// ------------------------------------------------------------------ hub
export default function Inspect({ route }) {
  if (route.args[0] === 'new') return <Run patrol={route.query.patrol || ''} />;
  if (route.args[0]) return <Detail id={route.args[0]} />;
  return <Hub />;
}

function Hub() {
  const acct = useAccount();
  const d = useApi(acct ? 'inspect' : null);
  const [cfgOpen, setCfgOpen] = useState(false);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Uniform inspection" /><Empty icon="lock" title="Sign in with your personal code">Inspections are kept for each scout, so they need your own code. Ask a leader for it.</Empty></div>;
  const x = d.data;
  const leaderBoard = x?.standings?.filter(s => s.count) || [];
  return (
    <div className="content inspect">
      <PageHead backTo="more" title="Uniform inspection" sub="Sharp patrol, sharp troop. Patrol leaders check their patrol in about a minute." />
      {!x ? <p className="muted">Loading…</p> : (
        <>
          {x.can.length > 0 ? (
            <div className="ins-start">
              <div className="ins-start-art"><UniformFigure items={x.items} small score={100} /></div>
              <div className="grow">
                <p className="g-k">Inspection time</p>
                <b>{x.can.length === 1 ? `Inspect the ${x.can[0]}` : 'Pick a patrol to inspect'}</b>
                <span>Everything starts as Sharp. Tap only what's off.</span>
                <div className="ins-patrols">
                  {(x.can.length === 1 ? x.can : [...x.can].sort((a, b) => (a === x.myPatrol ? -1 : b === x.myPatrol ? 1 : a.localeCompare(b)))).map(p => (
                    <a key={p} className={`btn ${x.can.length === 1 ? 'big accent' : 'small secondary'}`} href={`#/inspect/new?patrol=${encodeURIComponent(p)}`}>{x.can.length === 1 && <Icon name="checklist" size={20} />}{p}</a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="g-guest"><Icon name="info" size={16} /> Your patrol leader runs inspections. Your results show up here.</p>
          )}

          {x.mine.length > 0 && (
            <Section title={x.mine.some(m => m.id !== acct.member.id) ? 'Your scouts' : 'Your last inspections'}>
              <ul className="ins-mine">{x.mine.slice(0, 6).map(m => {
                const r = m.absent ? null : ratingOf(m.score);
                return (
                  <li key={`${m.inspection}-${m.id}`}><a href={`#/inspect/${m.inspection}`}>
                    {m.absent ? <span className="ins-abs">—</span> : <ScoreRing score={m.score} size={52} />}
                    <span className="grow"><b>{m.absent ? 'Absent' : `${r.emoji} ${r.title}`}</b><span className="small muted">{nice(m.date)}{m.id !== acct.member.id ? ` · ${m.name.split(' ')[0]}` : ''}</span>
                      {!m.absent && Object.entries(m.marks || {}).filter(([, v]) => v === 'fix' || v === 'miss').length > 0 && <span className="small">To fix: {Object.entries(m.marks).filter(([, v]) => v === 'fix' || v === 'miss').map(([k]) => UNIFORM.find(i => i.id === k)?.label).filter(Boolean).join(', ')}</span>}</span>
                    <Icon name="chevronR" size={18} />
                  </a></li>
                );
              })}</ul>
            </Section>
          )}

          <Section title="Patrol Cup · this month">
            {leaderBoard.length === 0 ? <Empty icon="trophy" title="No inspections yet">The first patrol inspected takes the lead!</Empty> : (
              <ol className="cup">{x.standings.filter(s => s.count).map((s, i) => (
                <li key={s.patrol} className={i === 0 && s.month != null ? 'lead' : ''}>
                  <span className="cup-n">{i === 0 && s.month != null ? '🏆' : i + 1}</span>
                  <span className="grow"><b>{s.patrol}</b><span className="cup-bar"><i style={{ width: `${s.month ?? s.last?.avg ?? 0}%` }} /></span>
                    <span className="small muted">{s.last ? `Last: ${s.last.avg} on ${nice(s.last.date)}` : ''}{s.month == null ? ' · none this month' : ''}</span></span>
                  <b className="cup-v">{s.month ?? '–'}</b>
                </li>
              ))}</ol>
            )}
          </Section>

          {x.recent.length > 0 && (
            <Section title="Recent inspections">
              <ul className="ins-recent">{x.recent.slice(0, 10).map(r => (
                <li key={r.id}>{r.canOpen ? <a href={`#/inspect/${r.id}`}><Recent r={r} /><Icon name="chevronR" size={18} /></a> : <div><Recent r={r} /></div>}</li>
              ))}</ul>
            </Section>
          )}

          <Section title="What gets checked">
            <ul className="ins-items">{x.items.map(it => <li key={it.id}><span>{it.emoji}</span><span className="grow"><b>{it.label}</b><span className="small muted">{it.tip}</span></span><i>{it.pts}</i></li>)}</ul>
            <p className="small muted">Sharp = full points, Needs a fix = half, Missing = none. Scores are out of 100.{x.isLeader && <> <button className="link-btn small" onClick={() => setCfgOpen(true)}>Change the checklist</button></>}</p>
          </Section>
          {x.isLeader && <Checklist open={cfgOpen} onClose={() => setCfgOpen(false)} off={x.off} onSaved={() => { setCfgOpen(false); d.refresh(); }} />}
        </>
      )}
    </div>
  );
}
const Recent = ({ r }) => (
  <>
    <span className="ins-avg">{r.avg ?? '–'}</span>
    <span className="grow"><b>{r.patrol}</b><span className="small muted">{nice(r.date)} · {r.present} inspected{r.perfect ? ` · ${r.perfect} perfect 🏆` : ''} · by {r.by.split(' ')[0]}</span></span>
  </>
);

function Checklist({ open, onClose, off, onSaved }) {
  const [o, setO] = useState(new Set(off));
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setO(new Set(off)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title="Inspection checklist">
      <p className="muted">Turn off anything your troop doesn't require. Scores are worked out from what's left.</p>
      {UNIFORM.filter(i => i.optional).map(i => (
        <label key={i.id} className="check"><input type="checkbox" checked={!o.has(i.id)} onChange={e => { const n = new Set(o); if (e.target.checked) n.delete(i.id); else n.add(i.id); setO(n); }} /><span>{i.emoji} {i.label}</span></label>
      ))}
      <p className="small muted">Everything else is part of the field uniform and always checked.</p>
      <div className="sheet-foot"><button className="btn big" disabled={busy} onClick={async () => { setBusy(true); try { await api('inspect/config', { method: 'POST', body: { off: [...o] } }); onSaved(); } finally { setBusy(false); } }}>Save checklist</button></div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ running an inspection
function Run({ patrol }) {
  const r = useApi(`inspect/roster?patrol=${encodeURIComponent(patrol)}`);
  const [step, setStep] = useState('roll');   // roll → scouts → done
  const [absent, setAbsent] = useState({});
  const [marks, setMarks] = useState({});
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [flash, setFlash] = useState(null);
  const scouts = r.data?.scouts || [];
  const items = r.data?.items || [];
  const here = scouts.filter(s => !absent[s.id]);
  // the position patch doesn't apply to scouts with no position
  useEffect(() => { if (!scouts.length) return; setMarks(m => { const n = { ...m }; for (const s of scouts) if (!n[s.id] && !s.positions.length) n[s.id] = { office: 'na' }; return n; }); }, [scouts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r.error) return <div className="content"><PageHead backTo="inspect" title="Uniform inspection" /><Empty icon="lock" title="Can't inspect this patrol">{r.error.message}</Empty></div>;
  if (!r.data) return <div className="content"><PageHead backTo="inspect" title="Uniform inspection" /><p className="muted">Getting the patrol…</p></div>;
  if (!scouts.length) return <div className="content"><PageHead backTo="inspect" title={patrol} /><Empty icon="users" title="No scouts in this patrol">Leaders set patrols in Leader tools → Members.</Empty></div>;

  const score = s => scoreOf(marks[s.id], items);
  async function save() {
    setSaving(true); setMsg('');
    try {
      const res = await api('inspect', { method: 'POST', body: { patrol, date: today(), scouts: scouts.map(s => ({ id: s.id, absent: !!absent[s.id], marks: marks[s.id] || {} })) } });
      go(`inspect/${res.inspection.id}?saved=1`, { replace: true });
    } catch (e) { setMsg(e.message); setSaving(false); }
  }

  if (step === 'roll') return (
    <div className="content inspect">
      <PageHead backTo="inspect" title={`Inspect the ${patrol}`} sub="Who's here? Tap anyone who's absent." />
      <ul className="roll">{scouts.map(s => (
        <li key={s.id}><button type="button" className={absent[s.id] ? 'off' : ''} onClick={() => setAbsent(a => ({ ...a, [s.id]: !a[s.id] }))} aria-pressed={!absent[s.id]}>
          <span className="roll-av">{s.first?.[0] || s.name[0]}</span><span className="grow"><b>{s.name}</b>{s.positions.length > 0 && <span className="small muted">{s.positions.join(', ')}</span>}</span>
          <span className={`roll-tag ${absent[s.id] ? 'abs' : 'here'}`}>{absent[s.id] ? 'Absent' : 'Here ✓'}</span>
        </button></li>
      ))}</ul>
      <div className="play-next"><button className="btn big accent" disabled={!here.length} onClick={() => { setI(0); setStep('scouts'); }}>Start inspecting · {here.length} scout{here.length === 1 ? '' : 's'} <Icon name="chevronR" size={18} /></button></div>
    </div>
  );

  if (step === 'scouts') {
    const s = here[i];
    const m = marks[s.id] || {};
    const sc = score(s);
    const rating = ratingOf(sc);
    const tap = it => {
      const cyc = CYCLE(it), cur = m[it.id] || 'good', nx = cyc[(cyc.indexOf(cur) + 1) % cyc.length];
      setMarks(all => ({ ...all, [s.id]: { ...(all[s.id] || {}), [it.id]: nx } }));
      setFlash({ id: it.id, text: `${it.emoji} ${it.label}: ${MARKS[nx].label}`, k: Date.now() }); buzz(nx === 'good' ? 10 : 25);
    };
    const next = () => { if (i + 1 < here.length) setI(i + 1); else setStep('done'); scrollToTop(); };
    const issues = items.filter(it => ['fix', 'miss'].includes(m[it.id]));
    return (
      <div className="content inspect run">
        <div className="play-top">
          <button className="icon-btn" onClick={() => (i ? setI(i - 1) : setStep('roll'))} aria-label="Back"><Icon name="chevronL" size={22} /></button>
          <div className="play-bar"><i style={{ width: `${((i + 1) / here.length) * 100}%` }} /></div>
          <span className="play-count">{i + 1}/{here.length}</span>
        </div>
        <div className="run-head">
          <div className="grow"><p className="g-k">{patrol}</p><h1>{s.name}</h1><span className={`run-rating r-${rating.min}`}>{rating.emoji} {rating.title}</span></div>
          <ScoreRing score={sc} />
        </div>
        <div className="run-grid">
          <div className="run-fig">
            <UniformFigure items={items} marks={m} onTap={tap} score={sc} />
            {flash && <div className="run-flash" key={flash.k}>{flash.text}</div>}
            <p className="small muted center">Tap a pin to change it: ✓ Sharp → ~ Fix → ✗ Missing</p>
          </div>
          <ul className="run-list">{items.map(it => {
            const v = m[it.id] || 'good';
            return (
              <li key={it.id} className={`m-${v}`}>
                <span className="rl-emoji">{it.emoji}</span><span className="grow rl-label">{it.label}</span>
                <span className="rl-seg" role="group" aria-label={it.label}>
                  {CYCLE(it).map(k => <button key={k} type="button" className={v === k ? 'on' : ''} aria-pressed={v === k} onClick={() => { setMarks(all => ({ ...all, [s.id]: { ...(all[s.id] || {}), [it.id]: k } })); buzz(10); }} aria-label={MARKS[k].label} title={MARKS[k].label}>{MARKS[k].short}</button>)}
                </span>
              </li>
            );
          })}</ul>
        </div>
        <div className="play-next run-next">
          <button className="btn big accent" onClick={next}>{issues.length ? `Next · ${issues.length} to fix` : sc === 100 ? 'All sharp! Next ✓' : 'Next'} <Icon name="chevronR" size={18} /></button>
        </div>
      </div>
    );
  }

  // done: patrol summary
  const scores = here.map(s => ({ s, sc: score(s) }));
  const avg = Math.round(scores.reduce((t, x) => t + x.sc, 0) / scores.length);
  const rating = ratingOf(avg);
  return (
    <div className="content inspect">
      {avg >= 90 && <Confetti />}
      <div className="res-card">
        <p className="g-k">{patrol} · patrol average</p>
        <div className="ins-big">{avg}</div>
        <p className="res-sub">{rating.emoji} {rating.title}. {rating.line}</p>
      </div>
      <ul className="ins-sum">{scores.map(({ s, sc }) => {
        const iss = items.filter(it => ['fix', 'miss'].includes(marks[s.id]?.[it.id]));
        return <li key={s.id}><button type="button" onClick={() => { setI(here.indexOf(s)); setStep('scouts'); }}><ScoreRing score={sc} size={48} /><span className="grow"><b>{s.name}</b><span className="small muted">{iss.length ? `Fix: ${iss.map(x => x.label).join(', ')}` : 'All sharp ✨'}</span></span><Icon name="edit" size={16} /></button></li>;
      })}
        {scouts.filter(s => absent[s.id]).map(s => <li key={s.id} className="abs"><div><span className="ins-abs">—</span><span className="grow"><b>{s.name}</b><span className="small muted">Absent</span></span></div></li>)}
      </ul>
      {msg && <p className="form-msg">{msg}</p>}
      <div className="btn-row"><button className="btn big accent" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save inspection'}</button></div>
      <p className="small muted center">Each scout sees their own result and what to fix. Everyone sees the patrol average.</p>
    </div>
  );
}

// ------------------------------------------------------------------ one inspection
function Detail({ id }) {
  const d = useApi(`inspect/${id}`);
  const acct = useAccount();
  const [open, setOpen] = useState(null);
  const saved = location.hash.includes('saved=1');
  const insp = d.data?.inspection;
  const items = useMemo(() => (insp ? UNIFORM.filter(i => insp.items.includes(i.id)) : []), [insp]);
  if (d.error) return <div className="content"><PageHead backTo="inspect" title="Inspection" /><Empty icon="alert" title="Can't open this inspection">{d.error.message}</Empty></div>;
  if (!insp) return <div className="content"><PageHead backTo="inspect" title="Inspection" /><p className="muted">Loading…</p></div>;
  const rating = insp.avg != null ? ratingOf(insp.avg) : null;
  const sel = insp.scouts.find(s => s.id === open) || insp.scouts.find(s => s.id === acct?.member.id && !s.absent);
  return (
    <div className="content inspect">
      {saved && insp.avg >= 90 && <Confetti />}
      <PageHead backTo="inspect" title={insp.patrol} sub={`${nice(insp.date)} · inspected by ${insp.by.name}`} />
      {saved && <p className="saved-note"><Icon name="check" size={16} /> Saved. Nice work, inspector!</p>}
      {d.data.canEdit && rating && (
        <div className="res-card ins-res"><p className="g-k">Patrol average</p><div className="ins-big">{insp.avg}</div><p className="res-sub">{rating.emoji} {rating.title}</p></div>
      )}
      {sel && (
        <div className="ins-one">
          <UniformFigure items={items} marks={sel.marks} score={sel.score} small />
          <div className="grow">
            <b>{sel.name}</b>
            <div className="ins-one-score"><ScoreRing score={sel.score} size={64} /><span>{ratingOf(sel.score).emoji} {ratingOf(sel.score).title}<span className="small muted">{ratingOf(sel.score).line}</span></span></div>
            <ul className="ins-marks">{items.map(it => { const v = sel.marks?.[it.id] || 'good'; return <li key={it.id} className={`m-${v}`}><span>{it.emoji}</span><span className="grow">{it.label}</span><b>{MARKS[v].label}</b></li>; })}</ul>
          </div>
        </div>
      )}
      <Section title={d.data.canEdit ? 'Every scout' : 'Results'}>
        <ul className="ins-sum">{insp.scouts.map(s => (
          <li key={s.id} className={`${s.absent ? 'abs' : ''} ${sel?.id === s.id ? 'sel' : ''}`}>
            {s.absent ? <div><span className="ins-abs">—</span><span className="grow"><b>{s.name}</b><span className="small muted">Absent</span></span></div>
              : <button type="button" onClick={() => { setOpen(s.id); scrollToTop({ behavior: 'smooth' }); }}><ScoreRing score={s.score} size={48} /><span className="grow"><b>{s.name}</b><span className="small muted">{(() => { const iss = Object.entries(s.marks).filter(([, v]) => v === 'fix' || v === 'miss').map(([k]) => UNIFORM.find(x => x.id === k)?.label).filter(Boolean); return iss.length ? `Fix: ${iss.join(', ')}` : 'All sharp ✨'; })()}</span></span><Icon name="chevronR" size={16} /></button>}
          </li>
        ))}</ul>
        {d.data.hidden > 0 && <p className="small muted">Patrol average {insp.avg}. Other scouts' results are just for them and their leaders.</p>}
      </Section>
      {d.data.canEdit && (acct?.member.leader || insp.by.id === acct?.member.id) && (
        <div className="btn-row"><button className="link-btn small" onClick={async () => { if (confirm('Delete this inspection?')) { await api(`inspect/${id}`, { method: 'DELETE' }); go('inspect', { replace: true }); } }}><Icon name="trash" size={15} />Delete inspection</button></div>
      )}
    </div>
  );
}
