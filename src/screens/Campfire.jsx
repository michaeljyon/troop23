import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { Confetti } from '../components/Confetti.jsx';
import { api, useApi, useAccount, useLeaderMode } from '../lib/api.js';
import { useLocal } from '../lib/store.js';
import { go } from '../lib/router.js';
import { SONGS, SONG_STYLES, SPOTS, SKITS, RUNONS, CHEERS, MINUTES, GAMES, PROGRAM_SHAPE, CAMPFIRE_RULES, KIM_ITEMS } from '../../troop/campfire.js';

// The campfire book: songs, skits, run-ons, cheers, Scoutmaster's Minutes and games,
// plus campfire plans with an emcee mode for running the show from a phone.

export const KINDS = {
  song: { label: 'Songs', one: 'Song', emoji: '🎵', tab: 'songs' },
  skit: { label: 'Skits', one: 'Skit', emoji: '🎭', tab: 'skits' },
  runon: { label: 'Run-ons', one: 'Run-on', emoji: '😂', tab: 'runons' },
  cheer: { label: 'Cheers', one: 'Cheer', emoji: '👏', tab: 'cheers' },
  minute: { label: 'Minutes', one: 'Scoutmaster\'s Minute', emoji: '🌙', tab: 'minutes' },
  game: { label: 'Games', one: 'Game', emoji: '🎯', tab: 'games' },
  ceremony: { label: 'Ceremonies', one: 'Ceremony', emoji: '🇺🇸' },
};
const TABS = [['plans', 'Plans', '🔥'], ['songs', 'Songs', '🎵'], ['skits', 'Skits', '🎭'], ['runons', 'Run-ons', '😂'], ['cheers', 'Cheers', '👏'], ['minutes', 'Minutes', '🌙'], ['games', 'Games', '🎯']];
const TAB_KIND = Object.fromEntries(Object.entries(KINDS).filter(([, v]) => v.tab).map(([k, v]) => [v.tab, k]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const niceDate = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date yet');
const pick = list => list[Math.floor(Math.random() * list.length)];

// Troop-written scripts: "Role: words" is a line, "(…)" or "* …" is a stage direction.
export function parseScript(text) {
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    if (/^[*(]/.test(l)) return ['*', l.replace(/^\*\s*/, '').replace(/^\((.*)\)$/, '$1')];
    const m = l.match(/^([^:]{1,32}):\s*(.+)$/);
    return m ? [m[1].trim(), m[2].trim()] : ['', l];
  });
}

// Everything in the book (built-in plus what the troop added), ready to list and search.
export function useBook() {
  const acct = useAccount();
  const leader = useLeaderMode();
  const d = useApi('fire');
  const data = d.data || { items: [], meta: { hidden: [], fav: [] }, plans: [], can: { leader: !!leader, add: !!leader, suggest: !!acct, plan: !!leader } };
  const book = useMemo(() => {
    const troopItems = data.items || [];
    const wordsFor = Object.fromEntries(troopItems.filter(i => i.kind === 'song' && i.ref && i.status === 'ok').map(i => [i.ref, i]));
    const pendingFor = Object.fromEntries(troopItems.filter(i => i.kind === 'song' && i.ref && i.status !== 'ok').map(i => [i.ref, i]));
    const fav = new Set(data.meta?.fav || []), hidden = new Set(data.meta?.hidden || []);
    const B = (kind, x, extra = {}) => ({ kind, id: x.id, title: x.title, builtin: true, data: x, fav: fav.has(x.id), hidden: hidden.has(x.id), ...extra });
    const T = i => ({ kind: i.kind, id: i.id, title: i.title, builtin: false, troop: i, data: i, fav: fav.has(i.id), hidden: hidden.has(i.id), pending: i.status !== 'ok' });
    const all = [
      ...SONGS.map(s => B('song', s, { words: !!s.words || !!wordsFor[s.id], troopWords: wordsFor[s.id], pendingWords: pendingFor[s.id] })),
      ...SKITS.map(s => B('skit', s)), ...RUNONS.map(s => B('runon', s)), ...CHEERS.map(s => B('cheer', s)), ...MINUTES.map(s => B('minute', s)), ...GAMES.map(s => B('game', s)),
      ...troopItems.filter(i => !i.ref).map(T),
    ];
    return all;
  }, [data]);
  return { ...data, book, load: d.refresh, ready: !!d.data, error: d.error };
}
const subOf = e => {
  const x = e.data;
  if (!e.builtin) return `${e.pending ? 'Suggested by' : 'Added by'} ${x.byName}`;
  if (e.kind === 'song') return `${SONG_STYLES[x.style]}${x.words || e.troopWords ? ' · Words' : ''}`;
  if (e.kind === 'skit') return `${x.cast} scouts · ${x.time}`;
  if (e.kind === 'cheer') return x.how;
  if (e.kind === 'minute') return x.theme;
  if (e.kind === 'game') return `${x.players} · ${x.time} · ${x.where}`;
  if (e.kind === 'runon') return x.lines.map(l => l[1]).join(' ').slice(0, 80);
  return '';
};
const emojiOf = e => (e.kind === 'cheer' && e.data.emoji) || (e.kind === 'game' && e.data.emoji) || KINDS[e.kind].emoji;

export default function Campfire({ route }) {
  const [a, b, c] = route.args;
  if (a === 'kim') return <KimsGame />;
  if (a === 'plan' && b === 'new') return <PlanEditor />;
  if (a === 'plan' && b && c === 'edit') return <PlanEditor id={b} />;
  if (a === 'plan' && b && c === 'emcee') return <Emcee id={b} />;
  if (a === 'plan' && b) return <Plan id={b} />;
  if (KINDS[a] && b) return <Detail kind={a} id={b} />;
  return <Hub tab={route.query.tab} />;
}

function Hub({ tab: want }) {
  const B = useBook();
  const tab = TABS.some(t => t[0] === want) ? want : 'songs';
  const [q, setQ] = useState('');
  const [style, setStyle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const kind = TAB_KIND[tab];
  const visible = B.book.filter(e => (showHidden || !e.hidden) && e.kind !== 'ceremony' && (!e.pending || B.can.leader || e.data.by === B.me));
  const sortFav = list => [...list].sort((x, y) => (y.fav - x.fav) || x.title.localeCompare(y.title));
  const results = q.trim() ? visible.filter(e => `${e.title} ${subOf(e)} ${e.data.about || ''} ${e.data.how || ''}`.toLowerCase().includes(q.trim().toLowerCase())) : null;
  const list = sortFav(visible.filter(e => e.kind === kind && (!style || e.data.style === style)));
  const pending = B.can.leader ? B.book.filter(e => e.pending).concat(B.book.flatMap(e => (e.pendingWords ? [{ ...e, pw: e.pendingWords }] : []))) : [];
  const upcoming = (B.plans || []).filter(p => p.date && p.date >= today()).sort((x, y) => x.date.localeCompare(y.date))[0];
  const surprise = () => { const e = pick(visible.filter(x => ['skit', 'song', 'cheer', 'runon'].includes(x.kind))); if (e) go(`campfire/${e.kind}/${e.id}`); };
  return (
    <div className="content fire">
      <PageHead backTo="more" title="Campfire" sub="Songs, skits, cheers and games for campfires and meetings.">
        {B.can.suggest && <button className="btn small head-btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} />{B.can.add ? 'Add' : 'Suggest'}</button>}
      </PageHead>
      <div className="fire-hero">
        <span className="fire-flames" aria-hidden="true">🔥</span>
        {upcoming ? (
          <div className="grow"><p className="fh-eyebrow">Next campfire · {niceDate(upcoming.date)}</p><b className="fh-title">{upcoming.title}</b><span className="fh-sub">{upcoming.count} acts planned</span>
            <div className="fh-btns"><a className="btn small accent" href={`#/campfire/plan/${upcoming.id}/emcee`}><Icon name="play" size={15} />Emcee mode</a><a className="btn small on-dark-btn" href={`#/campfire/plan/${upcoming.id}`}>See the lineup</a></div></div>
        ) : (
          <div className="grow"><p className="fh-eyebrow">Campfire tonight?</p><b className="fh-title">Build the lineup in two minutes</b><span className="fh-sub">Pick songs and skits, assign patrols, then run it from your phone.</span>
            <div className="fh-btns">{B.can.plan && <a className="btn small accent" href="#/campfire/plan/new"><Icon name="plus" size={15} />Plan a campfire</a>}<button className="btn small on-dark-btn" onClick={surprise}><Icon name="shuffle" size={15} />Surprise me</button></div></div>
        )}
      </div>
      {pending.length > 0 && (
        <div className="card fire-pending">
          <b>Waiting for a leader ({pending.length})</b>
          {pending.map(e => { const it = e.pw || e.troop; return (
            <div key={it.id} className="fp-row"><span className="grow"><b>{e.pw ? `Words for ${e.title}` : e.title}</b><span className="small muted">{KINDS[it.kind].one} · suggested by {it.byName}</span></span>
              <a className="btn small secondary" href={`#/campfire/${e.kind}/${e.id}`}>View</a>
              <button className="btn small" onClick={async () => { await api(`fire/items/${it.id}/approve`, { method: 'POST', body: {} }); B.load(); }}>Approve</button></div>
          ); })}
        </div>
      )}
      <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search songs, skits, cheers…" aria-label="Search the campfire book" /></div>
      {results ? (
        results.length ? <ul className="fire-list">{sortFav(results).map(e => <Row key={`${e.kind}-${e.id}`} e={e} showKind />)}</ul> : <Empty icon="search" title="Nothing matches">Try another word{B.can.suggest ? ', or add it to the book' : ''}.</Empty>
      ) : (
        <>
          <div className="chip-scroll fire-tabs" role="tablist" aria-label="Campfire book">
            {TABS.map(([id, label, em]) => <button key={id} role="tab" aria-selected={tab === id} className={`chip ${tab === id ? 'on' : ''}`} onClick={() => { setStyle(''); go(`campfire?tab=${id}`, { replace: true }); }}><span aria-hidden="true">{em}</span>{label}</button>)}
          </div>
          {tab === 'plans' ? <Plans B={B} /> : (
            <>
              {tab === 'songs' && <div className="chip-scroll fire-styles">{[['', 'All'], ...Object.entries(SONG_STYLES)].map(([k, l]) => <button key={k} className={`chip sm ${style === k ? 'on' : ''}`} onClick={() => setStyle(k)}>{l}</button>)}</div>}
              {tab === 'skits' && <Rules />}
              {tab === 'games' && <a className="card kim-card" href="#/campfire/kim"><span className="kim-eyes" aria-hidden="true">👀</span><span className="grow"><b>Play Kim's Game on this phone</b><span className="small muted">Study the camp gear, then pick out what you saw.</span></span><Icon name="chevronR" size={18} /></a>}
              {tab === 'cheers' && <p className="small muted">Lead one after every skit and song. Tap a cheer for how it goes, or use Emcee mode to get one picked for you.</p>}
              {list.length ? <ul className="fire-list">{list.map(e => <Row key={`${e.kind}-${e.id}`} e={e} />)}</ul> : <Empty icon="info" title="Nothing here yet">{B.can.suggest ? 'Tap Add to put one in the book.' : ''}</Empty>}
              {B.can.leader && B.book.some(e => e.hidden && e.kind === kind) && <p className="center"><button className="link-btn small" onClick={() => setShowHidden(x => !x)}>{showHidden ? 'Hide the hidden ones' : `Show hidden (${B.book.filter(e => e.hidden && e.kind === kind).length})`}</button></p>}
            </>
          )}
        </>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title={B.can.add ? 'Add to the campfire book' : 'Suggest something'}>
        {adding && <AddForm kind={kind || 'song'} can={B.can} onDone={() => { setAdding(false); B.load(); }} />}
      </Sheet>
    </div>
  );
}

function Row({ e, showKind }) {
  return (
    <li className={e.hidden ? 'is-hidden' : ''}><a href={`#/campfire/${e.kind}/${e.id}`}>
      <span className="fl-emoji" aria-hidden="true">{emojiOf(e)}</span>
      <span className="grow"><span className="fl-title"><b>{e.title}</b>{e.fav && <span className="fav-star" title="Troop favorite">★</span>}{!e.builtin && !e.pending && <Pill tone="info">Our troop</Pill>}{e.pending && <Pill tone="warn">Suggested</Pill>}{e.hidden && <Pill>Hidden</Pill>}</span>
        <span className="small muted fl-sub">{showKind ? `${KINDS[e.kind].one} · ` : ''}{subOf(e)}</span></span>
      <Icon name="chevronR" size={18} />
    </a></li>
  );
}

function Rules() {
  return (
    <details className="card fire-rules">
      <summary><b>Campfire rules</b> <span className="small muted">Keep it fun for everyone</span></summary>
      <ul>{CAMPFIRE_RULES.map(r => <li key={r}>{r}</li>)}</ul>
    </details>
  );
}

// ---------------------------------------------------------------- one item
function Detail({ kind, id }) {
  const B = useBook();
  const [big, setBig] = useLocal('fire-big', false);
  const [night, setNight] = useLocal('fire-night', false);
  const [sheet, setSheet] = useState('');
  const e = B.book.find(x => x.kind === kind && x.id === id);
  if (!e) return <div className="content"><PageHead backTo={`campfire?tab=${KINDS[kind]?.tab || 'songs'}`} title={KINDS[kind]?.label || 'Campfire'} />{B.ready ? <Empty icon="info" title="Not found">It may have been deleted.</Empty> : <p className="muted">Loading…</p>}</div>;
  const x = e.data;
  const flag = async body => { try { await api('fire/meta', { method: 'POST', body: { id, ...body } }); B.load(); } catch (er) { alert(er.message); } };
  const del = async it => { if (!confirm('Delete this from the troop\'s book?')) return; await api(`fire/items/${it.id}`, { method: 'DELETE' }); B.load(); if (!it.ref) go(`campfire?tab=${KINDS[kind].tab}`); };
  const canChange = it => B.can.add || B.can.leader || (it.by === B.me && it.status !== 'ok');
  return (
    <div className={`content fire-detail ${night ? 'night' : ''} ${big ? 'big' : ''}`}>
      <PageHead backTo={`campfire?tab=${KINDS[kind].tab}`} eyebrow={`${emojiOf(e)} ${KINDS[kind].one}${e.fav ? ' · ★ Troop favorite' : ''}`} title={e.title} sub={x.about || (kind === 'song' ? `${SONG_STYLES[x.style] || 'Song'}${x.spot ? ` · good for the ${SPOTS[x.spot].toLowerCase()}` : ''}` : kind === 'minute' ? x.theme : '')} />
      <div className="fd-tools">
        <button className={`chip sm ${night ? 'on' : ''}`} aria-pressed={night} onClick={() => setNight(!night)}>🌙 Fire light</button>
        <button className={`chip sm ${big ? 'on' : ''}`} aria-pressed={big} onClick={() => setBig(!big)}>A+ Bigger text</button>
        {B.can.add && <button className={`chip sm ${e.fav ? 'on' : ''}`} aria-pressed={e.fav} onClick={() => flag({ fav: !e.fav })}>★ {e.fav ? 'Favorite' : 'Make favorite'}</button>}
        {B.can.plan && <button className="chip sm" onClick={() => setSheet('plan')}><Icon name="plus" size={14} />Add to a campfire</button>}
      </div>
      {e.pending && <div className="note-status draft"><Icon name="clock" size={18} /><span className="grow">Suggested by {x.byName}. Only leaders and you can see it until a leader approves it.</span>{B.can.leader && <button className="btn small" onClick={async () => { await api(`fire/items/${x.id}/approve`, { method: 'POST', body: {} }); B.load(); }}>Approve</button>}</div>}

      {kind === 'song' && <SongBody e={e} can={B.can} onAdd={() => setSheet('words')} />}
      {kind === 'skit' && <SkitBody e={e} />}
      {kind === 'runon' && <div className="card script">{(e.builtin ? x.lines : parseScript(x.text)).map((l, i) => <Line key={i} l={l} />)}</div>}
      {kind === 'cheer' && <div className="card cheer-card"><span className="cheer-emoji" aria-hidden="true">{x.emoji || '👏'}</span><p className="cheer-how">{x.how || x.text}</p></div>}
      {kind === 'minute' && <div className="card minute-card">{(x.text || '').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
      {kind === 'game' && <GameBody e={e} />}

      {!e.builtin && canChange(x) && <p className="fd-own"><button className="link-btn small" onClick={() => setSheet('edit')}><Icon name="edit" size={14} />Edit</button><button className="link-btn small danger" onClick={() => del(x)}><Icon name="trash" size={14} />Delete</button></p>}
      {B.can.leader && <p className="center"><button className="link-btn small" onClick={() => flag({ hidden: !e.hidden })}>{e.hidden ? 'Show this to the troop again' : 'Hide this from the troop'}</button></p>}
      {e.troopWords && canChange(e.troopWords) && <p className="center"><button className="link-btn small" onClick={() => setSheet('words')}>Change our words</button> · <button className="link-btn small danger" onClick={() => del(e.troopWords)}>Remove our words</button></p>}

      <Sheet open={sheet === 'words' || sheet === 'edit'} onClose={() => setSheet('')} title={sheet === 'words' ? `Our words for ${e.title}` : `Edit ${e.title}`}>
        {sheet === 'words' && <AddForm kind="song" can={B.can} refSong={x} existing={e.troopWords || e.pendingWords} onDone={() => { setSheet(''); B.load(); }} />}
        {sheet === 'edit' && <AddForm kind={kind} can={B.can} existing={x} onDone={() => { setSheet(''); B.load(); }} />}
      </Sheet>
      <Sheet open={sheet === 'plan'} onClose={() => setSheet('')} title="Add to a campfire">
        {sheet === 'plan' && <AddToPlan e={e} plans={B.plans} onDone={() => setSheet('')} />}
      </Sheet>
    </div>
  );
}

function Line({ l: [who, text] }) {
  if (who === '*') return <p className="sc-do">{text}</p>;
  return <p className="sc-line">{who && <b className="sc-who">{who}</b>}<span>{text}</span></p>;
}

function SongBody({ e, can, onAdd }) {
  const x = e.data;
  return (
    <>
      {x.how && <div className="card fire-how"><b>How it goes</b><p>{x.how}</p></div>}
      {x.words && <div className="card song-words">{x.words.map(([label, text], i) => <div key={i} className={`sw-part ${/chorus/i.test(label) ? 'chorus' : ''}`}>{label && <p className="sw-label">{label}</p>}<p className="sw-text">{text}</p></div>)}</div>}
      {!e.builtin && <div className="card song-words"><p className="sw-text">{x.text}</p></div>}
      {e.troopWords && <div className="card song-words troop"><p className="sw-label">Our troop's words · added by {e.troopWords.byName}</p><p className="sw-text">{e.troopWords.text}</p>{e.troopWords.how && <p className="small muted">{e.troopWords.how}</p>}</div>}
      {e.builtin && !x.words && !e.troopWords && (
        <div className="card words-missing">
          <p className="small">The words to this one may still be under copyright, so they aren't printed here.{e.pendingWords ? ' Words have been suggested and are waiting for a leader.' : ''}</p>
          {can.suggest && !e.pendingWords && <button className="btn small secondary" onClick={onAdd}><Icon name="plus" size={15} />{can.add ? 'Add the words our troop sings' : 'Suggest our troop\'s words'}</button>}
        </div>
      )}
      {x.source && <p className="small muted">{x.source}. Public domain.</p>}
    </>
  );
}

function SkitBody({ e }) {
  const x = e.data;
  const lines = e.builtin ? x.script : parseScript(x.text);
  return (
    <>
      <div className="fd-facts">{x.cast && <span><b>{x.cast}</b>scouts</span>}{x.time && <span><b>{x.time}</b>long</span>}{x.props && <span><b>Props</b>{x.props}</span>}{x.laughs && <span><b>{'😂'.repeat(x.laughs)}</b>laughs</span>}</div>
      <div className="card script">{lines.map((l, i) => <Line key={i} l={l} />)}</div>
      {(x.tip || x.how) && <div className="card fire-how"><b>Tip</b><p>{x.tip || x.how}</p></div>}
    </>
  );
}

function GameBody({ e }) {
  const x = e.data;
  if (!e.builtin) return <div className="card"><p className="pre">{x.text}</p>{x.how && <p className="small muted">{x.how}</p>}</div>;
  return (
    <>
      <div className="fd-facts"><span><b>{x.players}</b>players</span><span><b>{x.time}</b>time</span><span><b>{x.where}</b>where</span></div>
      {x.play && <a className="btn big accent mt" href="#/campfire/kim"><Icon name="play" size={18} />Play it on this phone</a>}
      <div className="card fire-how"><b>You need</b><p>{x.need}</p></div>
      <div className="card fire-how"><b>How to play</b><p>{x.how}</p></div>
      {x.vary && <div className="card fire-how"><b>Try it another way</b><p>{x.vary}</p></div>}
      {x.safety && <div className="card fire-how safety"><b>Safety</b><p>{x.safety}</p></div>}
      <p className="small muted">Skills: {x.skills}</p>
    </>
  );
}

// ---------------------------------------------------------------- adding to the book
const HINTS = {
  song: 'Type the words. Put a blank line between verses.',
  skit: 'One line each. "Name: what they say" for a speaking part, and start stage directions with "*" or put them in (brackets).',
  runon: 'Same as a skit: "Name: what they say", with "*" for what happens.',
  cheer: 'How to do it, in a sentence or two.',
  minute: 'The short talk, about a minute long.',
  game: 'How to play, what you need, and any safety rules.',
  ceremony: 'One step per line. "Caller: Troop, attention." for what someone says, and start actions with "*".',
};
export function AddForm({ kind: k0, can, refSong, existing, onDone, kinds }) {
  const [kind, setKind] = useState(existing?.kind || k0);
  const [f, setF] = useState({ title: existing?.title || refSong?.title || '', text: existing?.text || '', how: existing?.how || '', cast: existing?.cast || '', time: existing?.time || '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const pickKinds = kinds || ['song', 'skit', 'runon', 'cheer', 'minute', 'game'];
  async function save(ev) {
    ev.preventDefault(); setMsg(''); setBusy(true);
    try {
      const body = { kind, ...f, ref: refSong?.id || '' };
      if (existing?.id && existing.by !== undefined) await api(`fire/items/${existing.id}`, { method: 'PUT', body });
      else await api('fire/items', { method: 'POST', body });
      onDone();
    } catch (er) { setMsg(er.message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="fire-form">
      {!can.add && !existing && <p className="small muted">A leader will look at your suggestion before the troop sees it.</p>}
      {!refSong && !existing && pickKinds.length > 1 && <div className="field"><span>What is it?</span><div className="el-chips">{pickKinds.map(x => <button type="button" key={x} className={`chip sm ${kind === x ? 'on' : ''}`} onClick={() => setKind(x)}>{KINDS[x].emoji} {KINDS[x].one}</button>)}</div></div>}
      {!refSong && <label className="field"><span>Name</span><input value={f.title} onChange={e => set('title', e.target.value)} maxLength={100} required /></label>}
      {kind === 'skit' && <div className="row2"><label className="field"><span>How many scouts</span><input value={f.cast} onChange={e => set('cast', e.target.value)} placeholder="4–6" maxLength={20} /></label><label className="field"><span>How long</span><input value={f.time} onChange={e => set('time', e.target.value)} placeholder="3 min" maxLength={20} /></label></div>}
      <label className="field"><span>{kind === 'song' ? 'Words' : kind === 'skit' || kind === 'runon' ? 'Script' : kind === 'ceremony' ? 'Steps' : 'How it goes'}</span><textarea rows={kind === 'cheer' ? 3 : 10} value={f.text} onChange={e => set('text', e.target.value)} maxLength={8000} /><small className="muted">{HINTS[kind]}</small></label>
      {kind === 'song' && <label className="field"><span>How to lead it (optional)</span><textarea rows={2} value={f.how} onChange={e => set('how', e.target.value)} maxLength={1200} placeholder="Repeat after me, actions, round…" /></label>}
      {kind === 'skit' && <label className="field"><span>Tip or props (optional)</span><input value={f.how} onChange={e => set('how', e.target.value)} maxLength={1200} /></label>}
      {kind === 'ceremony' && <label className="field"><span>When to use it (optional)</span><input value={f.how} onChange={e => set('how', e.target.value)} maxLength={1200} /></label>}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save' : can.add ? 'Add to the book' : 'Send suggestion'}</button>
      <p className="small muted">Keep it kind: nothing that makes fun of a person or a group.</p>
    </form>
  );
}

// ---------------------------------------------------------------- campfire plans
function Plans({ B }) {
  const list = B.plans || [];
  const t = today();
  return (
    <>
      <p className="small muted">A good campfire follows the fire: loud and lively when it's new, skits and silly songs at its peak, quiet songs and a Scoutmaster's Minute as it burns down.</p>
      {B.can.plan && <a className="btn big mt" href="#/campfire/plan/new"><Icon name="plus" size={18} />Plan a campfire</a>}
      {list.length === 0 ? <Empty icon="info" title="No campfire plans yet">{B.can.plan ? 'Plan one and Basecamp can fill the lineup for you.' : 'Your PLC and leaders plan campfires here.'}</Empty> : (
        <ul className="fire-list mt">{list.map(p => (
          <li key={p.id}><a href={`#/campfire/plan/${p.id}`}><span className="fl-emoji" aria-hidden="true">{p.date && p.date < t ? '🪵' : '🔥'}</span><span className="grow"><b>{p.title}</b><span className="small muted fl-sub">{niceDate(p.date)} · {p.count} acts · by {p.byName}</span></span><Icon name="chevronR" size={18} /></a></li>
        ))}</ul>
      )}
    </>
  );
}

const lookup = (book, ref) => { const [kind, id] = (ref || '').split(':'); return book.find(e => e.kind === kind && e.id === id); };

function Plan({ id }) {
  const B = useBook();
  const p = useApi(`fire/plans/${id}`);
  if (p.error) return <div className="content"><PageHead backTo="campfire?tab=plans" title="Campfire" /><Empty icon="info" title="Can't open this plan">{p.error.message || String(p.error)}</Empty></div>;
  if (!p.data) return <div className="content"><PageHead backTo="campfire?tab=plans" title="Campfire" /><p className="muted">Loading…</p></div>;
  const plan = p.data.plan;
  let lastSpot = '';
  return (
    <div className="content fire">
      <PageHead backTo="campfire?tab=plans" eyebrow={`🔥 ${niceDate(plan.date)}`} title={plan.title} sub={`${plan.items.length} acts · planned by ${plan.byName}`}>
        {p.data.canEdit && <a className="btn small secondary head-btn" href={`#/campfire/plan/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      <a className="btn big accent" href={`#/campfire/plan/${id}/emcee`}><Icon name="play" size={18} />Emcee mode</a>
      <p className="small muted center">Shows one act at a time, picks a cheer after each one, and keeps your screen on.</p>
      <ol className="lineup">
        {plan.items.map((it, i) => {
          const e = lookup(B.book, it.ref);
          const head = it.note && SPOTS[it.note] && it.note !== lastSpot ? SPOTS[it.note] : '';
          if (it.note) lastSpot = it.note;
          return (
            <li key={i}>
              {head && <p className="lu-spot">{head}</p>}
              <div className="lu-row"><span className="lu-n">{i + 1}</span><span className="fl-emoji" aria-hidden="true">{KINDS[it.kind]?.emoji || '📌'}</span>
                <span className="grow">{e ? <a href={`#/campfire/${e.kind}/${e.id}`}><b>{it.title}</b></a> : <b>{it.title}</b>}<span className="small muted">{[KINDS[it.kind]?.one || 'Other', it.who].filter(Boolean).join(' · ')}</span></span></div>
            </li>
          );
        })}
      </ol>
      {p.data.canEdit && <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this campfire plan?')) { await api(`fire/plans/${id}`, { method: 'DELETE' }); go('campfire?tab=plans'); } }}><Icon name="trash" size={14} />Delete plan</button></p>}
    </div>
  );
}

function fillPlan(book, existing) {
  const used = new Set(existing.map(x => x.ref));
  const out = [];
  const pool = (kind, style) => book.filter(e => e.kind === kind && !e.hidden && !e.pending && !used.has(`${e.kind}:${e.id}`) && (!style || (style === 'close' ? e.data.spot === 'close' : e.data.style === style)));
  for (const [spot, , , slots] of PROGRAM_SHAPE) for (const slot of slots) {
    const [kind, style] = slot.split(':');
    const cands = pool(kind, style);
    const favs = cands.filter(e => e.fav);
    const e = pick(favs.length && Math.random() < 0.6 ? favs : cands);
    if (!e) continue;
    used.add(`${e.kind}:${e.id}`);
    out.push({ ref: `${e.kind}:${e.id}`, kind: e.kind, title: e.title, who: '', note: spot });
  }
  return out;
}

function PlanEditor({ id }) {
  const B = useBook();
  const [f, setF] = useState(id ? null : { title: 'Campfire', date: today(), items: [] });
  const [picking, setPicking] = useState(false);
  const [other, setOther] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (id) api(`fire/plans/${id}`).then(d => setF(d.plan)).catch(e => setMsg(e.message)); }, [id]);
  if (!f) return <div className="content"><PageHead backTo="campfire?tab=plans" title="Campfire plan" /><p className="muted">{msg || 'Loading…'}</p></div>;
  const setItems = fn => setF(x => ({ ...x, items: fn(x.items) }));
  const move = (i, d) => setItems(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  async function save() {
    setMsg('');
    try {
      const r = id ? await api(`fire/plans/${id}`, { method: 'PUT', body: f }) : await api('fire/plans', { method: 'POST', body: f });
      go(`campfire/plan/${r.plan.id}`, { replace: true });
    } catch (e) { setMsg(e.message); }
  }
  return (
    <div className="content fire">
      <PageHead backTo={id ? `campfire/plan/${id}` : 'campfire?tab=plans'} title={id ? 'Edit campfire' : 'Plan a campfire'} />
      {!B.can.plan && <div className="note-status draft"><Icon name="lock" size={18} /><span>Leaders and the Patrol Leaders' Council plan campfires.</span></div>}
      <div className="card">
        <label className="field"><span>Name</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={100} placeholder="Saturday night campfire" /></label>
        <label className="field"><span>Date</span><input type="date" value={f.date || ''} onChange={e => setF({ ...f, date: e.target.value })} /></label>
      </div>
      <Section title={`Lineup (${f.items.length})`} action={<button className="link-btn small" onClick={() => setItems(l => [...l, ...fillPlan(B.book, l)])}><Icon name="sparkle" size={15} />{f.items.length ? 'Add more for me' : 'Fill it for me'}</button>}>
        {f.items.length === 0 && <p className="small muted">Tap "Fill it for me" for a ready-made lineup that follows the fire (troop favorites first), then swap things around. Or add acts one at a time.</p>}
        <ol className="lineup edit">
          {f.items.map((it, i) => (
            <li key={`${it.ref}-${i}`} className="lu-row">
              <span className="lu-n">{i + 1}</span><span className="fl-emoji" aria-hidden="true">{KINDS[it.kind]?.emoji || '📌'}</span>
              <span className="grow"><b>{it.title}</b>
                <input className="lu-who" value={it.who} onChange={e => setItems(l => l.map((x, j) => (j === i ? { ...x, who: e.target.value } : x)))} placeholder="Who?" aria-label={`Who does ${it.title}`} maxLength={80} /></span>
              <span className="lu-btns">
                <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={18} /></button>
                <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === f.items.length - 1} aria-label="Move down"><Icon name="down" size={18} /></button>
                <button className="icon-btn" onClick={() => setItems(l => l.filter((_, j) => j !== i))} aria-label={`Remove ${it.title}`}><Icon name="x" size={18} /></button>
              </span>
            </li>
          ))}
        </ol>
        <div className="lu-add">
          <button className="btn secondary small" onClick={() => setPicking(true)}><Icon name="plus" size={15} />From the book</button>
          <form className="row-input" onSubmit={e => { e.preventDefault(); if (other.trim()) { setItems(l => [...l, { ref: '', kind: 'note', title: other.trim(), who: '', note: '' }]); setOther(''); } }}>
            <input value={other} onChange={e => setOther(e.target.value)} placeholder="Something else (welcome, awards…)" aria-label="Add something else" maxLength={100} />
            <button className="btn small secondary" disabled={!other.trim()}>Add</button>
          </form>
        </div>
      </Section>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn big" onClick={save} disabled={!B.can.plan}>Save campfire</button>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Add from the book">
        {picking && <Picker book={B.book} used={new Set(f.items.map(x => x.ref))} onPick={e => setItems(l => [...l, { ref: `${e.kind}:${e.id}`, kind: e.kind, title: e.title, who: '', note: '' }])} />}
      </Sheet>
    </div>
  );
}

function Picker({ book, used, onPick }) {
  const [k, setK] = useState('skit');
  const [q, setQ] = useState('');
  const [added, setAdded] = useState(() => new Set());
  const list = book.filter(e => !e.hidden && !e.pending && e.kind !== 'ceremony' && (q ? e.title.toLowerCase().includes(q.toLowerCase()) : e.kind === k)).sort((x, y) => (y.fav - x.fav) || x.title.localeCompare(y.title));
  return (
    <div>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search the book" /></div>
      {!q && <div className="el-chips">{['song', 'skit', 'runon', 'cheer', 'minute', 'game'].map(x => <button key={x} className={`chip sm ${k === x ? 'on' : ''}`} onClick={() => setK(x)}>{KINDS[x].emoji} {KINDS[x].label}</button>)}</div>}
      <ul className="pick-list">{list.map(e => { const ref = `${e.kind}:${e.id}`; const on = used.has(ref) || added.has(ref); return (
        <li key={ref}><button disabled={on} onClick={() => { onPick(e); setAdded(s => new Set(s).add(ref)); }}><span aria-hidden="true">{emojiOf(e)}</span><span className="grow"><b>{e.title}</b>{e.fav && <span className="fav-star">★</span>}<span className="small muted">{subOf(e)}</span></span>{on ? <Icon name="check" size={18} /> : <Icon name="plus" size={18} />}</button></li>
      ); })}</ul>
    </div>
  );
}

function AddToPlan({ e, plans, onDone }) {
  const [msg, setMsg] = useState('');
  const upcoming = (plans || []).filter(p => !p.date || p.date >= today());
  const add = async pid => {
    try {
      const d = await api(`fire/plans/${pid}`);
      await api(`fire/plans/${pid}`, { method: 'PUT', body: { items: [...d.plan.items, { ref: `${e.kind}:${e.id}`, kind: e.kind, title: e.title, who: '', note: '' }] } });
      setMsg(`Added to ${d.plan.title}.`); setTimeout(onDone, 900);
    } catch (er) { setMsg(er.message); }
  };
  return (
    <div>
      {upcoming.length ? <ul className="pick-list">{upcoming.map(p => <li key={p.id}><button onClick={() => add(p.id)}><span aria-hidden="true">🔥</span><span className="grow"><b>{p.title}</b><span className="small muted">{niceDate(p.date)} · {p.count} acts</span></span><Icon name="plus" size={18} /></button></li>)}</ul> : <p className="small muted">No upcoming campfires yet.</p>}
      <a className="btn secondary small mt" href="#/campfire/plan/new">Plan a new campfire</a>
      {msg && <p className="form-msg good" role="status">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- emcee mode
export function useWakeLock() {
  useEffect(() => {
    let lock = null, stop = false;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed or not supported */ } if (stop) lock?.release?.(); };
    get();
    const vis = () => { if (document.visibilityState === 'visible') get(); };
    document.addEventListener('visibilitychange', vis);
    document.body.classList.add('no-scroll');
    return () => { stop = true; lock?.release?.(); document.removeEventListener('visibilitychange', vis); document.body.classList.remove('no-scroll'); };
  }, []);
}

function Emcee({ id }) {
  const B = useBook();
  const p = useApi(`fire/plans/${id}`);
  const [i, setI] = useState(0);
  const [cheer, setCheer] = useState(() => pick(CHEERS));
  useWakeLock();
  const plan = p.data?.plan;
  const items = plan?.items || [];
  const it = items[i];
  const e = it && lookup(B.book, it.ref);
  const next = items[i + 1];
  const step = d => { setI(x => Math.min(items.length, Math.max(0, x + d))); setCheer(pick(B.book.filter(c => c.kind === 'cheer' && !c.hidden).map(c => c.data)) || pick(CHEERS)); };
  useEffect(() => { const k = ev => { if (ev.key === 'ArrowRight' || ev.key === ' ') step(1); if (ev.key === 'ArrowLeft') step(-1); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
  const exit = () => go(`campfire/plan/${id}`, { replace: true });
  const done = plan && i >= items.length;
  return (
    <div className="emcee" role="dialog" aria-label="Emcee mode">
      <div className="em-top"><button className="icon-btn on-dark" onClick={exit} aria-label="Leave emcee mode"><Icon name="x" /></button><span className="grow em-plan">{plan?.title || 'Campfire'}</span>{plan && <span className="em-count">{Math.min(i + 1, items.length)} / {items.length}</span>}</div>
      {plan && <div className="em-bar"><i style={{ width: `${(Math.min(i, items.length) / Math.max(1, items.length)) * 100}%` }} /></div>}
      <div className="em-body">
        {!plan ? <p>Loading…</p> : done ? (
          <div className="em-done"><span className="em-big-emoji" aria-hidden="true">🌙</span><h2>That's the campfire!</h2><p>Leave quietly and let the fire burn down safely. Drown, stir, and feel it before you go.</p><button className="btn accent" onClick={exit}>Done</button></div>
        ) : (
          <>
            {it.note && SPOTS[it.note] && <p className="em-spot">{SPOTS[it.note]}</p>}
            <p className="em-kind">{KINDS[it.kind]?.emoji || '📌'} {KINDS[it.kind]?.one || 'Up now'}</p>
            <h2 className="em-title">{it.title}</h2>
            {it.who && <p className="em-who">{it.who}</p>}
            {e && <EmceeNotes e={e} />}
            {['skit', 'runon', 'song'].includes(it.kind) && <div className="em-cheer"><span className="grow"><b>Then lead a cheer: {cheer.emoji} {cheer.title}</b><span>{cheer.how}</span></span><button className="icon-btn on-dark" onClick={() => setCheer(pick(CHEERS))} aria-label="Pick another cheer"><Icon name="shuffle" size={18} /></button></div>}
          </>
        )}
      </div>
      <div className="em-foot">
        <button className="btn on-dark-btn" onClick={() => step(-1)} disabled={i === 0}><Icon name="chevronL" size={18} />Back</button>
        <span className="grow em-next">{next ? <>Up next: <b>{next.title}</b>{next.who ? ` · ${next.who}` : ''}</> : !done && plan ? 'Last one!' : ''}</span>
        {!done && <button className="btn accent" onClick={() => step(1)}>Next<Icon name="chevronR" size={18} /></button>}
      </div>
    </div>
  );
}

function EmceeNotes({ e }) {
  const x = e.data;
  if (e.kind === 'song') {
    const words = x.words || (e.troopWords ? [['', e.troopWords.text]] : !e.builtin ? [['', x.text]] : null);
    return <div className="em-notes">{x.how && <p className="em-how">{x.how}</p>}{words && words.map(([l, t], j) => <p key={j} className="em-words">{l && <span className="sw-label">{l}</span>}{t}</p>)}</div>;
  }
  if (e.kind === 'skit') return <div className="em-notes"><p className="em-how">{x.about || 'A skit from our troop.'}</p></div>;
  if (e.kind === 'runon') return <div className="em-notes">{(e.builtin ? x.lines : parseScript(x.text)).map((l, j) => <p key={j} className="em-words">{l[0] !== '*' && <b>{l[0]}: </b>}{l[1]}</p>)}</div>;
  if (e.kind === 'cheer') return <div className="em-notes"><p className="em-how">{x.how || x.text}</p></div>;
  if (e.kind === 'minute') return <div className="em-notes">{(x.text || '').split('\n').filter(Boolean).map((t, j) => <p key={j} className="em-words">{t}</p>)}</div>;
  if (e.kind === 'game') return <div className="em-notes"><p className="em-how">{x.how || x.text}</p></div>;
  return null;
}

// ---------------------------------------------------------------- Kim's Game
const LEVELS = { easy: { n: 8, secs: 45, label: 'Tenderfoot', sub: '8 items · 45 seconds' }, scout: { n: 12, secs: 40, label: 'First Class', sub: '12 items · 40 seconds' }, eagle: { n: 16, secs: 30, label: 'Eagle', sub: '16 items · 30 seconds' } };
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function KimsGame() {
  const [best, setBest] = useLocal('kim-best', {});
  const [g, setG] = useState(null);   // { level, shown, choices, picked, stage, left }
  useEffect(() => {
    if (g?.stage !== 'look') return undefined;
    const t = setInterval(() => setG(x => (x.left <= 1 ? { ...x, stage: 'recall', left: 0 } : { ...x, left: x.left - 1 })), 1000);
    return () => clearInterval(t);
  }, [g?.stage]);
  const start = level => {
    const L = LEVELS[level];
    const all = shuffle(KIM_ITEMS);
    const shown = all.slice(0, L.n);
    setG({ level, shown, choices: shuffle([...shown, ...all.slice(L.n, L.n * 2)]), picked: new Set(), stage: 'look', left: L.secs });
  };
  if (!g) return (
    <div className="content fire">
      <PageHead backTo="campfire?tab=games" eyebrow="👀 Patrol game" title="Kim's Game" sub="Study the camp gear before time runs out, then pick out everything you saw." />
      <div className="kim-levels">{Object.entries(LEVELS).map(([k, L]) => <button key={k} className="card kim-level" onClick={() => start(k)}><b>{L.label}</b><span className="small muted">{L.sub}</span>{best[k] !== undefined && <span className="small good-text">Best: {best[k]} / {L.n}</span>}</button>)}</div>
      <p className="small muted">Play together: one phone, the whole patrol looking, and no talking until the time is up.</p>
    </div>
  );
  const L = LEVELS[g.level];
  if (g.stage === 'look') return (
    <div className="content fire kim">
      <div className="kim-head"><b>Remember these!</b><span className={`kim-timer ${g.left <= 5 ? 'hot' : ''}`}>{g.left}s</span></div>
      <div className="kim-grid">{g.shown.map(x => <span key={x} className="kim-cell">{x}</span>)}</div>
      <button className="btn secondary" onClick={() => setG({ ...g, stage: 'recall', left: 0 })}>I'm ready</button>
    </div>
  );
  if (g.stage === 'recall') {
    const toggle = x => setG(s => { const p = new Set(s.picked); if (p.has(x)) p.delete(x); else p.add(x); return { ...s, picked: p }; });
    return (
      <div className="content fire kim">
        <div className="kim-head"><b>Which ones did you see?</b><span className="kim-timer">{g.picked.size} / {L.n}</span></div>
        <div className="kim-grid pick">{g.choices.map(x => <button key={x} className={`kim-cell ${g.picked.has(x) ? 'on' : ''}`} aria-pressed={g.picked.has(x)} onClick={() => toggle(x)}>{x}</button>)}</div>
        <button className="btn big" onClick={() => {
          const right = [...g.picked].filter(x => g.shown.includes(x)).length, wrong = g.picked.size - right;
          const score = Math.max(0, right - wrong);
          if (best[g.level] === undefined || score > best[g.level]) setBest({ ...best, [g.level]: score });
          setG({ ...g, stage: 'done', score, right, wrong });
        }}>Check my answers</button>
      </div>
    );
  }
  const perfect = g.score === L.n;
  return (
    <div className="content fire kim">
      {perfect && <Confetti />}
      <div className="kim-result"><span className="kim-score">{g.score}<small>/{L.n}</small></span><b>{perfect ? 'Perfect! Eagle eyes.' : g.score >= L.n * 0.75 ? 'Sharp! Nearly all of them.' : g.score >= L.n / 2 ? 'Good start. Try again?' : 'Tricky one. Go again!'}</b>
        <span className="small muted">{g.right} right{g.wrong ? `, ${g.wrong} that ${g.wrong > 1 ? 'weren\'t' : 'wasn\'t'} there (each takes a point off)` : ''}</span></div>
      <div className="kim-grid">{g.choices.map(x => { const saw = g.shown.includes(x), pk = g.picked.has(x); return saw || pk ? <span key={x} className={`kim-cell ${saw && pk ? 'right' : saw ? 'missed' : 'wrong'}`} title={saw && pk ? 'You got it' : saw ? 'Missed' : 'Wasn\'t there'}>{x}</span> : null; })}</div>
      <p className="small muted center"><span className="kim-key right" /> got it <span className="kim-key missed" /> missed <span className="kim-key wrong" /> wasn't there</p>
      <div className="btn-row"><button className="btn" onClick={() => start(g.level)}>Play again</button><button className="btn secondary" onClick={() => setG(null)}>Change level</button></div>
    </div>
  );
}
