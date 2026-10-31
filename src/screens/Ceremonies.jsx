import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLocal } from '../lib/store.js';
import { go } from '../lib/router.js';
import { CEREMONIES, PLEDGE, FLAG_FACTS, COMMANDS } from '../../troop/ceremonies.js';
import { useBook, AddForm, useWakeLock } from './Campfire.jsx';

// Flag ceremonies and troop ceremonies with scripts, plus a Lead mode that walks the caller
// through one step at a time in big print.

// Troop-written steps: "Caller: Troop, attention." says something; "* …" or "(…)" is an action.
function stepsOf(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    if (/^[*(]/.test(l)) return { who: '', say: '', do: l.replace(/^\*\s*/, '').replace(/^\((.*)\)$/, '$1') };
    const m = l.match(/^([^:]{1,32}):\s*(.+)$/);
    return m ? { who: m[1].trim(), say: m[2].trim(), do: '' } : { who: '', say: '', do: l };
  });
}
const fromTroop = e => ({ id: e.id, troop: e.data, emoji: '⭐', title: e.title, when: e.data.how, roles: [], need: [], steps: stepsOf(e.data.text), tips: [], pending: e.pending, hidden: e.hidden });

export default function Ceremonies({ route }) {
  const [id, sub] = route.args;
  const B = useBook();
  if (id === 'flag-etiquette') return <Facts />;
  if (id === 'commands') return <Commands />;
  const builtIn = CEREMONIES.find(c => c.id === id);
  const troopOne = !builtIn && B.book.find(e => e.kind === 'ceremony' && e.id === id);
  const c = builtIn || (troopOne && fromTroop(troopOne));
  if (id && !c) return <div className="content"><PageHead backTo="ceremonies" title="Ceremonies" />{B.ready ? <Empty icon="info" title="Not found">It may have been deleted.</Empty> : <p className="muted">Loading…</p>}</div>;
  if (c && sub === 'lead') return <Lead c={c} />;
  if (c) return <Ceremony c={c} B={B} hidden={B.meta?.hidden?.includes(c.id)} />;
  return <Hub B={B} />;
}

function Hub({ B }) {
  const [adding, setAdding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const hidden = new Set(B.meta?.hidden || []);
  const show = c => showHidden || !hidden.has(c.id);
  const troopOnes = B.book.filter(e => e.kind === 'ceremony' && (showHidden || !e.hidden) && (!e.pending || B.can.leader || e.data.by === B.me));
  const row = (c, extra) => (
    <li key={c.id} className={hidden.has(c.id) ? 'is-hidden' : ''}><a href={`#/ceremonies/${c.id}`}><span className="fl-emoji" aria-hidden="true">{c.emoji}</span><span className="grow"><span className="fl-title"><b>{c.title}</b>{extra}{hidden.has(c.id) && <Pill>Hidden</Pill>}</span><span className="small muted fl-sub">{c.when}</span></span><Icon name="chevronR" size={18} /></a></li>
  );
  const nHidden = CEREMONIES.filter(c => hidden.has(c.id)).length + B.book.filter(e => e.kind === 'ceremony' && e.hidden).length;
  return (
    <div className="content fire">
      <PageHead backTo="more" title="Ceremonies" sub="Flag ceremonies and troop ceremonies, with a script the caller can read from a phone.">
        {B.can.suggest && <button className="btn small head-btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{B.can.add ? 'Add' : 'Suggest'}</button>}
      </PageHead>
      <div className="cer-quick">
        <a className="card" href="#/ceremonies/commands"><span aria-hidden="true">📣</span><b>Commands</b><span className="small muted">What the caller says</span></a>
        <a className="card" href="#/ceremonies/flag-etiquette"><span aria-hidden="true">🇺🇸</span><b>Flag etiquette</b><span className="small muted">The rules in plain words</span></a>
      </div>
      <Section title="Flag ceremonies"><ul className="fire-list">{CEREMONIES.filter(c => c.group === 'flag' && show(c)).map(c => row(c))}</ul></Section>
      <Section title="Troop ceremonies"><ul className="fire-list">{CEREMONIES.filter(c => c.group === 'troop' && show(c)).map(c => row(c))}</ul></Section>
      {(troopOnes.length > 0 || B.can.suggest) && (
        <Section title="Our troop's ceremonies">
          {troopOnes.length ? <ul className="fire-list">{troopOnes.map(e => row({ id: e.id, emoji: '⭐', title: e.title, when: e.data.how || `Added by ${e.data.byName}` }, e.pending ? <Pill tone="warn">Suggested</Pill> : <Pill tone="info">Our troop</Pill>))}</ul>
            : <p className="small muted">Add your own: a crossover, an Eagle ceremony, a reading for the flag folds, or your troop's way of doing things.</p>}
        </Section>
      )}
      {B.can.leader && nHidden > 0 && <p className="center"><button className="link-btn small" onClick={() => setShowHidden(x => !x)}>{showHidden ? 'Hide the hidden ones' : `Show hidden (${nHidden})`}</button></p>}
      <Sheet open={adding} onClose={() => setAdding(false)} title={B.can.add ? 'Add a ceremony' : 'Suggest a ceremony'}>
        {adding && <AddForm kind="ceremony" kinds={['ceremony']} can={B.can} onDone={() => { setAdding(false); B.load(); }} />}
      </Sheet>
    </div>
  );
}

function Ceremony({ c, B, hidden }) {
  const [editing, setEditing] = useState(false);
  const flag = async body => { try { await api('fire/meta', { method: 'POST', body: { id: c.id, ...body } }); B.load(); } catch (er) { alert(er.message); } };
  const t = c.troop;
  const canChange = t && (B.can.add || (t.by === B.me && t.status !== 'ok'));
  return (
    <div className="content fire cer">
      <PageHead backTo="ceremonies" eyebrow={`${c.emoji} ${c.group === 'troop' ? 'Troop ceremony' : t ? 'Our troop\'s ceremony' : 'Flag ceremony'}`} title={c.title} sub={c.when} />
      {c.pending && <div className="note-status draft"><Icon name="clock" size={18} /><span className="grow">Suggested by {t.byName}. Waiting for a leader.</span>{B.can.leader && <button className="btn small" onClick={async () => { await api(`fire/items/${t.id}/approve`, { method: 'POST', body: {} }); B.load(); }}>Approve</button>}</div>}
      {c.steps.length > 0 && <a className="btn big accent" href={`#/ceremonies/${c.id}/lead`}><Icon name="play" size={18} />Lead it, step by step</a>}
      {(c.roles.length > 0 || c.need.length > 0) && (
        <div className="cer-prep">
          {c.roles.length > 0 && <div className="card"><b>Who you need</b><ul>{c.roles.map(r => <li key={r}>{r}</li>)}</ul></div>}
          {c.need.length > 0 && <div className="card"><b>What you need</b><ul>{c.need.map(r => <li key={r}>{r}</li>)}</ul></div>}
        </div>
      )}
      {c.fold && <FoldDiagram />}
      <Section title="The script">
        <ol className="cer-steps">{c.steps.map((s, i) => <Step key={i} s={s} n={i + 1} />)}</ol>
      </Section>
      {c.tips.length > 0 && <div className="card fire-how"><b>Tips</b><ul>{c.tips.map(x => <li key={x}>{x}</li>)}</ul></div>}
      {canChange && <p className="fd-own"><button className="link-btn small" onClick={() => setEditing(true)}><Icon name="edit" size={14} />Edit</button><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this ceremony?')) { await api(`fire/items/${t.id}`, { method: 'DELETE' }); B.load(); go('ceremonies'); } }}><Icon name="trash" size={14} />Delete</button></p>}
      {B.can.leader && <p className="center"><button className="link-btn small" onClick={() => flag({ hidden: !hidden })}>{hidden ? 'Show this to the troop again' : 'Hide this from the troop'}</button></p>}
      <Sheet open={editing} onClose={() => setEditing(false)} title={`Edit ${c.title}`}>
        {editing && <AddForm kind="ceremony" kinds={['ceremony']} can={B.can} existing={t} onDone={() => { setEditing(false); B.load(); }} />}
      </Sheet>
    </div>
  );
}

function Step({ s, n }) {
  return (
    <li className="cer-step">
      <span className="cs-n">{n}</span>
      <span className="grow">
        {s.who && <span className="cs-who">{s.who}</span>}
        {s.say && <span className="cs-say">“{s.say}”</span>}
        {s.words === 'PLEDGE' && <span className="cs-words">{PLEDGE}</span>}
        {s.do && <span className="cs-do">{s.do}</span>}
      </span>
    </li>
  );
}

function Lead({ c }) {
  const [i, setI] = useState(0);
  const [big, setBig] = useLocal('cer-big', true);
  useWakeLock();
  const s = c.steps[i];
  const done = i >= c.steps.length;
  const step = d => setI(x => Math.max(0, Math.min(c.steps.length, x + d)));
  useEffect(() => { const k = ev => { if (ev.key === 'ArrowRight' || ev.key === ' ') step(1); if (ev.key === 'ArrowLeft') step(-1); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
  const exit = () => go(`ceremonies/${c.id}`, { replace: true });
  return (
    <div className={`emcee lead ${big ? 'big' : ''}`} role="dialog" aria-label={`Leading ${c.title}`}>
      <div className="em-top"><button className="icon-btn on-dark" onClick={exit} aria-label="Stop leading"><Icon name="x" /></button><span className="grow em-plan">{c.title}</span><button className="chip sm on-dark-chip" onClick={() => setBig(!big)} aria-pressed={big}>A+</button><span className="em-count">{Math.min(i + 1, c.steps.length)} / {c.steps.length}</span></div>
      <div className="em-bar"><i style={{ width: `${(i / c.steps.length) * 100}%` }} /></div>
      <div className="em-body" onClick={ev => { if (!ev.target.closest('button')) step(1); }}>
        {done ? (
          <div className="em-done"><span className="em-big-emoji" aria-hidden="true">✅</span><h2>Ceremony complete</h2><p>Nice work. Thank your color guard.</p><button className="btn accent" onClick={exit}>Done</button></div>
        ) : (
          <>
            {s.who && <p className="em-kind">{s.who}</p>}
            {s.say ? <h2 className="em-say">“{s.say}”</h2> : <h2 className="em-title quiet">{s.do}</h2>}
            {s.words === 'PLEDGE' && <p className="em-words pledge">{PLEDGE}</p>}
            {s.say && s.do && <p className="em-how">{s.do}</p>}
            {c.steps[i + 1] && <p className="em-peek">Next: {c.steps[i + 1].who ? `${c.steps[i + 1].who}: ` : ''}{c.steps[i + 1].say || c.steps[i + 1].do}</p>}
          </>
        )}
      </div>
      <div className="em-foot">
        <button className="btn on-dark-btn" onClick={() => step(-1)} disabled={i === 0}><Icon name="chevronL" size={18} />Back</button>
        <span className="grow em-next">{!done && 'Tap anywhere for the next step'}</span>
        {!done && <button className="btn accent" onClick={() => step(1)}>Next<Icon name="chevronR" size={18} /></button>}
      </div>
    </div>
  );
}

function Facts() {
  return (
    <div className="content fire">
      <PageHead backTo="ceremonies" eyebrow="🇺🇸 Quick reference" title="Flag etiquette" sub="The main rules of the U.S. Flag Code, in plain words." />
      <ul className="facts">{FLAG_FACTS.map(([h, t]) => <li key={h} className="card"><b>{h}</b><span>{t}</span></li>)}</ul>
      <div className="card pledge-card"><b>The Pledge of Allegiance</b><p>{PLEDGE}</p></div>
      <p className="small muted">Source: the U.S. Flag Code, 4 U.S.C. §§ 4–10. When the President or the Governor orders flags to half-staff, follow the order's dates.</p>
    </div>
  );
}

function Commands() {
  return (
    <div className="content fire">
      <PageHead backTo="ceremonies" eyebrow="📣 Quick reference" title="Ceremony commands" sub="What the caller says, and what everyone does." />
      <ul className="facts">{COMMANDS.map(([h, t]) => <li key={h} className="card"><b>“{h}”</b><span>{t}</span></li>)}</ul>
      <p className="small muted">Call each command loud and clear, then pause long enough for everyone to do it.</p>
    </div>
  );
}

// A simple drawing of the folds, so new scouts can see the shape at each stage.
function FoldDiagram() {
  const stripes = (x, y, w, h, n) => Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + (h / n) * i} width={w} height={h / n} fill={i % 2 ? '#fff' : '#B22234'} />);
  const blue = '#3C3B6E';
  const stars = (x, y, w, h, n) => Array.from({ length: n }, (_, i) => <circle key={i} cx={x + ((i % 4) + 0.5) * (w / 4)} cy={y + (Math.floor(i / 4) + 0.5) * (h / Math.ceil(n / 4))} r="1.6" fill="#fff" />);
  const panels = [
    ['Flat and level', <g key="a">{stripes(6, 10, 88, 46, 13)}<rect x="6" y="10" width="38" height="25" fill={blue} />{stars(6, 10, 38, 25, 12)}</g>],
    ['Half, the long way', <g key="b">{stripes(6, 22, 88, 23, 6)}<rect x="6" y="22" width="38" height="23" fill={blue} />{stars(6, 22, 38, 23, 8)}</g>],
    ['Half again, blue out', <g key="c"><rect x="6" y="28" width="88" height="12" fill="#B22234" /><rect x="6" y="31" width="88" height="3" fill="#fff" /><rect x="6" y="28" width="38" height="12" fill={blue} />{stars(6, 28, 38, 12, 4)}</g>],
    ['Triangle folds', <g key="d"><rect x="6" y="28" width="52" height="12" fill={blue} />{stars(6, 28, 52, 12, 4)}<path d="M58 28h12l-12 12z" fill="#B22234" /><path d="M70 28l-12 12h12z" fill="#fff" stroke="#B22234" strokeWidth=".6" /><path d="M70 28h12l-12 12z" fill="#B22234" /><path d="M82 28l-12 12h12z" fill="#fff" stroke="#B22234" strokeWidth=".6" /></g>],
    ['Tucked: only stars', <g key="e"><path d="M26 46 50 16 74 46z" fill={blue} />{[[50, 25], [44, 33], [56, 33], [38, 41], [50, 41], [62, 41]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="#fff" />)}</g>],
  ];
  return (
    <div className="fold-diagram" role="img" aria-label="Folding the flag: flat, folded in half lengthwise, folded again with the blue field out, triangle folds from the striped end, and a tucked triangle showing only stars.">
      {panels.map(([label, g], i) => <figure key={i}><svg viewBox="0 0 100 60" aria-hidden="true">{g}</svg><figcaption><b>{i + 1}</b> {label}</figcaption></figure>)}
    </div>
  );
}
