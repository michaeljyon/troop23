import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet } from '../components/ui.jsx';
import { api, useAccount, useApi } from '../lib/api.js';
import { go } from '../lib/router.js';
import { Confetti } from '../components/Confetti.jsx';
import { troop } from '../lib/config.js';

// Troop elections: leaders set the ballot, scouts tap one name per position,
// and a TV screen shows turnout and live results (or saves them for a big reveal).

// Scouts BSA youth positions of responsibility, named the way the troop names them (TroopWebHost),
// plus any other youth position the troop has added. Patrol positions get one race per patrol.
const PATROL_POS = ['Patrol Leader', 'Assistant Patrol Leader', 'Patrol Quartermaster'];
const TROOP_POS = ['Senior Patrol Leader', 'Assistant Senior Patrol Leader', 'Troop Guide', 'Quartermaster', 'Assistant Quartermaster', 'Scribe', 'Historian', 'Librarian', 'Instructor', "Chaplain's Aide", 'Den Chief', 'Junior Assistant Scoutmaster', 'Order of the Arrow Representative', 'Outdoor Ethics Guide', 'Bugler', 'Scout Webmaster'];
const SKIP = /^(SPL - Elect|Quartermaster \(PLC\))$/i;
const PRESETS = [...new Set([...TROOP_POS, ...((troop.positions?.youth) || []).filter(t => !SKIP.test(t) && !PATROL_POS.includes(t))])];
const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const HUES = ['#1D5FBF', '#2E9E5B', '#C8362F', '#9B4DCA', '#E8833A', '#0F8B8D', '#B5470B', '#3B6E2A'];
const hue = id => HUES[[...id].reduce((t, c) => t + c.charCodeAt(0), 0) % HUES.length];
const Avatar = ({ c, size = 44 }) => <span className="el-av" style={{ width: size, height: size, background: hue(c.id), fontSize: size * 0.4 }}>{initials(c.name)}</span>;

export default function Elections({ route }) {
  const [id, sub] = route.args;
  if (id && sub === 'screen') return <Screen id={id} />;
  if (id) return <Election id={id} />;
  return <Hub />;
}

// ------------------------------------------------------------------ list
function Hub() {
  const acct = useAccount();
  const d = useApi(acct ? 'elect' : null);
  const [edit, setEdit] = useState(null);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Troop elections" /><Empty icon="lock" title="Sign in with your personal code">Each scout gets one vote, so voting needs your own code. Ask a leader for it.</Empty></div>;
  const list = d.data?.elections || [];
  const open = list.filter(e => e.status === 'open'), drafts = list.filter(e => e.status === 'draft'), closed = list.filter(e => e.status === 'closed');
  return (
    <div className="content elect">
      <PageHead backTo="more" title="Troop elections" sub="Scouts lead the troop. Vote for the people you want leading it.">
        {d.data?.isLeader && <button className="btn small head-btn" onClick={() => setEdit({})}><Icon name="plus" size={16} />New</button>}
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <Empty icon="users" title="No elections yet">{d.data.isLeader ? 'Tap New to set up the ballot: positions and who\'s running.' : 'When leaders open an election, it shows up here and on Home.'}</Empty>
      ) : (
        <>
          {open.map(e => <OpenCard key={e.id} e={e} />)}
          {drafts.length > 0 && (
            <Section title="Getting ready">
              <ul className="el-list">{drafts.map(e => (
                <li key={e.id}><a href={`#/vote/${e.id}`}><span className="el-ico">📝</span><span className="grow"><b>{e.title}</b><span className="small muted">{e.positions.length} position{e.positions.length > 1 ? 's' : ''} · not open yet</span></span><Icon name="chevronR" size={18} /></a></li>
              ))}</ul>
            </Section>
          )}
          {closed.length > 0 && (
            <Section title="Results">
              <ul className="el-list">{closed.map(e => (
                <li key={e.id}><a href={`#/vote/${e.id}`}><span className="el-ico">🏅</span><span className="grow"><b>{e.title}</b>
                  <span className="small muted">{e.positions.map(p => { const w = p.candidates.filter(c => c.leading); return `${p.title}${p.patrol ? ` (${p.patrol})` : ''}: ${w.length ? w.map(c => c.name.split(' ')[0]).join(' & ') : '—'}`; }).slice(0, 3).join(' · ')}{e.positions.length > 3 ? ' …' : ''}</span></span><Icon name="chevronR" size={18} /></a></li>
              ))}</ul>
            </Section>
          )}
        </>
      )}
      {d.data?.isLeader && <Editor open={!!edit} e={edit} scouts={d.data.scouts} onClose={() => setEdit(null)} onSaved={el => { setEdit(null); go(`vote/${el.id}`); }} />}
    </div>
  );
}

function OpenCard({ e }) {
  return (
    <div className="el-open">
      <span className="el-live"><i />Voting is open</span>
      <h2>{e.title}</h2>
      <p>{e.positions.length} position{e.positions.length > 1 ? 's' : ''} · {e.turnout.voted} of {e.turnout.of} scouts have voted</p>
      <div className="el-turn"><i style={{ width: `${e.turnout.of ? (e.turnout.voted / e.turnout.of) * 100 : 0}%` }} /></div>
      <div className="btn-row">
        {e.canVote ? <a className="btn big accent" href={`#/vote/${e.id}`}>🗳️ Vote now</a>
          : <a className="btn big on-dark-btn" href={`#/vote/${e.id}`}>{e.iVoted ? '✓ You voted · see results' : e.isLeader ? 'Run the election' : 'See the election'}</a>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ one election
function Election({ id }) {
  const acct = useAccount();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const scouts = useApi(acct?.member?.leader ? 'elect' : null);
  const load = () => api(`elect/${id}`).then(r => { setD(r.election); setError(''); }).catch(e => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error && !d) return <div className="content"><PageHead backTo="vote" title="Troop elections" /><Empty icon="alert" title="Can't open this election">{error}</Empty></div>;
  if (!d) return <div className="content"><PageHead backTo="vote" title="Troop elections" /><p className="muted">Loading…</p></div>;
  if (kiosk && d.isLeader && d.status === 'open') return <Kiosk e={d} reload={load} onExit={() => { setKiosk(false); load(); }} />;
  if (d.canVote) return <Ballot e={d} onDone={load} />;
  const act = async (a, body = {}) => { try { const r = await api(`elect/${id}/${a}`, { method: 'POST', body }); setD(r.election); } catch (e) { alert(e.message); } };
  return (
    <div className="content elect">
      {d.status === 'closed' && d.positions.some(p => p.cast) && <Confetti />}
      <PageHead backTo="vote" eyebrow={d.status === 'open' ? 'Voting is open' : d.status === 'closed' ? 'Final results' : 'Not open yet'} title={d.title} />
      {d.iVoted && d.status === 'open' && <div className="voted-sticker"><span>🗳️</span><b>I voted!</b><span className="small">Thanks for helping lead the troop. Results show {d.live ? 'below as votes come in' : 'when leaders close voting'}.</span></div>}
      {d.isLeader && (
        <div className="el-admin">
          <div className="el-admin-row">
            {d.status === 'draft' && <><button className="btn accent" onClick={() => act('open')}><Icon name="play" size={18} />Open voting</button><button className="btn secondary" onClick={() => setEdit(true)}><Icon name="edit" size={16} />Edit ballot</button></>}
            {d.status === 'open' && <button className="btn accent" onClick={() => setKiosk(true)}><Icon name="phone" size={16} />Vote on this phone</button>}
            {d.status === 'open' && <button className="btn" onClick={() => confirm('Close voting? Scouts won\'t be able to vote after this.') && act('close')}><Icon name="lock" size={16} />Close voting</button>}
            {d.status === 'closed' && <button className="btn secondary" onClick={() => act('reopen')}><Icon name="refresh" size={16} />Reopen voting</button>}
            <a className="btn secondary" href={`#/vote/${id}/screen`}><Icon name="expand" size={16} />TV screen</a>
          </div>
          <label className="switch-row"><span className="grow"><b>Show live results on the TV</b><span className="small muted">Off: the screen shows turnout only, and results appear when you close voting.</span></span>
            <input type="checkbox" role="switch" checked={d.live} onChange={e => act('live', { live: e.target.checked })} /></label>
        </div>
      )}
      <Turnout t={d.turnout} />
      {d.positions.map(p => <Results key={p.id} p={p} show={d.showCounts} />)}
      {!d.showCounts && <p className="small muted center">Results show when leaders close voting.</p>}
      {d.isLeader && d.status !== 'open' && <div className="btn-row"><button className="link-btn small" onClick={async () => { if (confirm('Delete this election and all its votes?')) { await api(`elect/${id}`, { method: 'DELETE' }); go('vote', { replace: true }); } }}><Icon name="trash" size={15} />Delete election</button></div>}
      {d.isLeader && <Editor open={edit} e={edit ? d : null} scouts={scouts.data?.scouts || []} onClose={() => setEdit(false)} onSaved={el => { setEdit(false); setD(el); load(); }} />}
    </div>
  );
}

function Turnout({ t, big }) {
  const pct = t.of ? Math.round((t.voted / t.of) * 100) : 0;
  return (
    <div className={`el-turnout ${big ? 'big' : ''}`}>
      <div className="grow"><b>{t.voted}</b> of {t.of} scouts have voted</div>
      <div className="el-turn"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Results({ p, show, tv }) {
  const max = Math.max(1, ...p.candidates.map(c => c.votes || 0));
  const sorted = show ? [...p.candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0)) : p.candidates;
  return (
    <div className={`el-pos ${tv ? 'tv' : ''}`}>
      <div className="el-pos-head"><b>{p.title}</b>{p.patrol && <span className="el-patrol">{p.patrol}</span>}<span className="el-cast">{p.cast} vote{p.cast === 1 ? '' : 's'}</span></div>
      <ul>{sorted.map(c => (
        <li key={c.id} className={c.leading ? 'lead' : ''}>
          <Avatar c={c} size={tv ? 52 : 40} />
          <span className="grow"><span className="el-name">{c.name}{c.leading && ' 👑'}</span>
            {show && <span className="el-bar"><i style={{ width: `${((c.votes || 0) / max) * 100}%`, background: hue(c.id) }} /></span>}</span>
          {show && <b className="el-votes">{c.votes}</b>}
        </li>
      ))}</ul>
    </div>
  );
}

// ------------------------------------------------------------------ voting
function Ballot({ e, onDone, forScout, onCancel }) {
  const pos = forScout ? e.positions.filter(p => !p.patrol || p.patrol === forScout.patrol) : e.positions.filter(p => p.canVote);
  const [pick, setPick] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const n = Object.keys(pick).length;
  async function cast() {
    setBusy(true); setMsg('');
    try { await api(`elect/${e.id}/vote`, { method: 'POST', body: { votes: pick, ...(forScout ? { for: forScout.id } : {}) } }); setConfirming(false); setDone(true); try { navigator.vibrate?.([30, 40, 60]); } catch { /* no vibration */ } } catch (er) { setMsg(er.message); } finally { setBusy(false); }
  }
  if (done && forScout) return (
    <div className="content elect">
      <Confetti />
      <div className="voted-big"><span className="vb-sticker">🗳️<b>I VOTED</b></span><h1>Thanks, {forScout.first || forScout.name.split(' ')[0]}!</h1><p>Your vote is in and it's secret. Please hand the phone back to your leader.</p>
        <button className="btn big" onClick={onDone}>Leader: next voter</button></div>
    </div>
  );
  if (done) return (
    <div className="content elect">
      <Confetti />
      <div className="voted-big"><span className="vb-sticker">🗳️<b>I VOTED</b></span><h1>Thanks for voting!</h1><p>Your ballot is secret. Results show {e.live ? 'on the TV as votes come in' : 'when leaders close voting'}.</p>
        <button className="btn big" onClick={onDone}>See the election</button></div>
    </div>
  );
  return (
    <div className="content elect ballot">
      {forScout ? (
        <div className="kiosk-head"><span className="kiosk-tag">Voting on a leader's phone</span><h1>{forScout.name}'s ballot</h1><p className="muted">Tap one person for each position. Your vote is secret — your leader won't see it.</p>
          <button type="button" className="link-btn small" onClick={onCancel}>Not {forScout.first || forScout.name.split(' ')[0]}? Go back</button></div>
      ) : <PageHead backTo="vote" eyebrow="Your ballot" title={e.title} sub="Tap one person for each position. Your vote is secret." />}
      {pos.map((p, i) => (
        <section key={p.id} className="bal-pos">
          <div className="bal-head"><span className="bal-n">{i + 1}</span><b>{p.title}</b>{p.patrol && <span className="el-patrol">{p.patrol}</span>}{pick[p.id] && <span className="bal-ok">✓</span>}</div>
          <div className="bal-cands">{p.candidates.map(c => (
            <button key={c.id} type="button" className={`bal-cand ${pick[p.id] === c.id ? 'on' : ''} ${pick[p.id] && pick[p.id] !== c.id ? 'dim' : ''}`} aria-pressed={pick[p.id] === c.id}
              onClick={() => setPick(x => { const y = { ...x }; if (y[p.id] === c.id) delete y[p.id]; else y[p.id] = c.id; return y; })}>
              <Avatar c={c} size={52} /><span>{c.name}</span>{pick[p.id] === c.id && <i className="bal-check">✓</i>}
            </button>
          ))}</div>
        </section>
      ))}
      <div className="play-next"><button className="btn big accent" disabled={!n} onClick={() => setConfirming(true)}>{n === pos.length ? 'Review my ballot' : `Review my ballot · ${n} of ${pos.length} picked`} <Icon name="chevronR" size={18} /></button></div>
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Ready to vote?">
        <ul className="bal-review">{pos.map(p => { const c = p.candidates.find(x => x.id === pick[p.id]); return <li key={p.id}><span className="grow">{p.title}{p.patrol && <span className="small muted"> · {p.patrol}</span>}</span><b>{c ? c.name : <span className="muted">No vote</span>}</b></li>; })}</ul>
        <p className="small muted">You can't change your vote after you cast it.</p>
        {msg && <p className="form-msg">{msg}</p>}
        <div className="sheet-foot"><button className="btn big accent" onClick={cast} disabled={busy}>{busy ? 'Casting…' : '🗳️ Cast my vote'}</button></div>
      </Sheet>
    </div>
  );
}


// ------------------------------------------------------------------ leader's phone, passed around
// For scouts without a phone: the leader picks the scout, hands the phone over, and gets it back.
function Kiosk({ e, reload, onExit }) {
  const [who, setWho] = useState(null);
  const [q, setQ] = useState('');
  const list = (e.voters || []).filter(v => !q || v.name.toLowerCase().includes(q.toLowerCase()));
  const left = (e.voters || []).filter(v => !v.voted).length;
  if (who) return <Ballot e={e} forScout={who} onCancel={() => setWho(null)} onDone={() => { setWho(null); setQ(''); reload(); }} />;
  return (
    <div className="content elect">
      <div className="kiosk-head"><span className="kiosk-tag">Leader · voting on this phone</span><h1>Who's voting?</h1>
        <p className="muted">Pick the scout, then hand them the phone. Each scout can vote once, on any phone. {left} still to vote.</p></div>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Find a scout" aria-label="Find a scout" /></div>
      <ul className="kiosk-list">{list.map(v => (
        <li key={v.id}><button type="button" disabled={v.voted} onClick={() => setWho(v)}>
          <span className="el-av" style={{ width: 40, height: 40, background: v.voted ? '#A8A8A0' : hue(v.id), fontSize: 16 }}>{initials(v.name)}</span>
          <span className="grow"><b>{v.name}</b><span className="small muted">{v.patrol || 'No patrol'}</span></span>
          {v.voted ? <span className="roll-tag here">Voted ✓</span> : <span className="kiosk-go">Vote <Icon name="chevronR" size={16} /></span>}
        </button></li>
      ))}</ul>
      <div className="btn-row"><button className="btn secondary" onClick={onExit}>Done taking votes</button></div>
    </div>
  );
}

// ------------------------------------------------------------------ TV screen
function Screen({ id }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const prev = useRef('');
  const link = `${location.origin}/#/vote/${id}`;
  useEffect(() => {
    const load = () => api(`elect/${id}`).then(r => { setD(r.election); setError(''); }).catch(e => setError(e.message));
    load(); const t = setInterval(load, 2000);
    import('qrcode').then(m => m.toDataURL(link, { margin: 1, width: 360, color: { dark: '#12301F', light: '#FFFFFF' } })).then(setQr).catch(() => {});
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const justClosed = d?.status === 'closed' && prev.current === 'open';
  useEffect(() => { if (d) prev.current = d.status; }, [d?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="el-tv"><div className="el-tv-msg">{error || 'Loading…'}</div></div>;
  const winners = d.status === 'closed' ? d.positions.map(p => ({ p, w: p.candidates.filter(c => c.leading) })) : [];
  return (
    <div className="el-tv">
      {(justClosed || d.status === 'closed') && d.positions.some(p => p.cast) && <Confetti />}
      <header className="el-tv-top">
        <button className="icon-btn on-dark" onClick={() => go(`vote/${id}`)} aria-label="Leave screen"><Icon name="chevronL" /></button>
        <div className="grow"><p className="g-k">Troop 23 elections</p><h1>{d.title}</h1></div>
        <span className={`el-tv-status s-${d.status}`}>{d.status === 'open' ? <><i />Voting open</> : d.status === 'closed' ? 'Final results' : 'Not open yet'}</span>
      </header>
      <div className="el-tv-body">
        <aside className="el-tv-side">
          {d.status !== 'closed' && <div className="el-qr">{qr ? <img src={qr} alt="Scan to vote" /> : <div className="el-qr-ph" />}<b>Scan to vote</b><span>or open Basecamp → More → Troop elections</span></div>}
          <div className="el-tv-turn"><span className="big">{d.turnout.voted}<small>/{d.turnout.of}</small></span><span>scouts have voted</span><div className="el-turn"><i style={{ width: `${d.turnout.of ? (d.turnout.voted / d.turnout.of) * 100 : 0}%` }} /></div></div>
        </aside>
        <main className="el-tv-main">
          {d.status === 'closed' ? (
            <div className="el-winners">{winners.map(({ p, w }) => (
              <div key={p.id} className="el-win"><span className="g-k">{p.title}{p.patrol ? ` · ${p.patrol}` : ''}</span>
                {w.length ? w.map(c => <div key={c.id} className="el-win-name"><Avatar c={c} size={64} /><b>{c.name}</b></div>) : <b className="muted">No votes</b>}
                {w.length > 1 && <span className="el-tie">Tie! Leaders will decide.</span>}
              </div>
            ))}</div>
          ) : d.showCounts && d.live ? (
            <div className="el-tv-grid">{d.positions.map(p => <Results key={p.id} p={p} show tv />)}</div>
          ) : (
            <div className="el-tv-grid">{d.positions.map(p => (
              <div key={p.id} className="el-pos tv secret"><div className="el-pos-head"><b>{p.title}</b>{p.patrol && <span className="el-patrol">{p.patrol}</span>}</div>
                <div className="el-ballots">{Array.from({ length: Math.min(p.cast, 40) }).map((_, k) => <span key={k}>🗳️</span>)}</div>
                <span className="el-cast">{p.cast} vote{p.cast === 1 ? '' : 's'} in · results at the end!</span></div>
            ))}</div>
          )}
        </main>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ set up the ballot
function Editor({ open, e, scouts, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [positions, setPositions] = useState([]);
  const [live, setLive] = useState(true);
  const [picking, setPicking] = useState(null);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const patrols = useMemo(() => [...new Set(scouts.map(s => s.patrol).filter(Boolean))].sort(), [scouts]);
  useEffect(() => {
    if (!open) return;
    const season = new Date().getMonth() < 6 ? 'Spring' : 'Fall';
    setTitle(e?.title || `${season} ${new Date().getFullYear()} troop elections`);
    setPositions(e?.positions?.map(p => ({ id: p.id, title: p.title, patrol: p.patrol, candidates: p.candidates.map(c => c.id) })) || [{ id: '', title: 'Senior Patrol Leader', patrol: '', candidates: [] }]);
    setLive(e?.live ?? true); setMsg('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const has = (t, p = '') => positions.some(x => x.title === t && (x.patrol || '') === p);
  const add = (t, p = '') => !has(t, p) && setPositions(ps => [...ps, { id: '', title: t, patrol: p, candidates: [] }]);
  const name = id => scouts.find(s => s.id === id)?.name || '?';
  const savedId = useRef('');
  async function save(andOpen) {
    setBusy(true); setMsg('');
    try {
      const body = { title, live, positions };
      const sid = e?.id || savedId.current;
      const r = sid ? await api(`elect/${sid}`, { method: 'PUT', body }) : await api('elect', { method: 'POST', body });
      let el = r.election; savedId.current = el.id;
      if (andOpen) {
        try { el = (await api(`elect/${el.id}/open`, { method: 'POST', body: {} })).election; } catch (er) { setMsg(`Saved, but not opened yet: ${er.message}`); return; }
      }
      onSaved(el);
    } catch (er) { setMsg(er.message); } finally { setBusy(false); }
  }
  const P = picking != null ? positions[picking] : null;
  const pool = P ? scouts.filter(s => (!P.patrol || s.patrol === P.patrol) && (!q || s.name.toLowerCase().includes(q.toLowerCase()))) : [];
  return (
    <Sheet open={open} onClose={onClose} title={e?.id ? 'Edit ballot' : 'New election'} wide>
      {P ? (
        <div className="el-pick">
          <button className="link-btn small" onClick={() => { setPicking(null); setQ(''); }}><Icon name="chevronL" size={15} />Back to the ballot</button>
          <h3>Who's running for {P.title}{P.patrol ? ` (${P.patrol})` : ''}?</h3>
          <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Search scouts" aria-label="Search scouts" /></div>
          <ul className="pick-list">{pool.map(s => (
            <li key={s.id}><label className="check"><input type="checkbox" checked={P.candidates.includes(s.id)} onChange={ev => setPositions(ps => ps.map((x, k) => (k === picking ? { ...x, candidates: ev.target.checked ? [...x.candidates, s.id] : x.candidates.filter(c => c !== s.id) } : x)))} />
              <span>{s.name}<span className="small muted"> · {s.patrol || 'No patrol'}{s.positions.length ? ` · ${s.positions.join(', ')}` : ''}</span></span></label></li>
          ))}</ul>
          <div className="sheet-foot"><button className="btn big" onClick={() => { setPicking(null); setQ(''); }}>Done · {P.candidates.length} running</button></div>
        </div>
      ) : (
        <>
          <label className="field"><span>Election name</span><input value={title} onChange={ev => setTitle(ev.target.value)} /></label>
          <p className="field-label">Positions on the ballot</p>
          <ul className="el-edit">{positions.map((p, i) => (
            <li key={`${p.title}-${p.patrol}-${i}`}>
              <div className="grow"><b>{p.title}</b>{p.patrol && <span className="el-patrol">{p.patrol}</span>}
                <div className="el-chips">{p.candidates.map(c => <span key={c} className="chip sm on">{name(c)}</span>)}
                  <button type="button" className="chip sm" onClick={() => setPicking(i)}><Icon name="plus" size={14} />{p.candidates.length ? 'Change' : 'Add candidates'}</button></div></div>
              <button type="button" className="icon-btn sm" onClick={() => setPositions(ps => ps.filter((_, k) => k !== i))} aria-label={`Remove ${p.title}`}><Icon name="x" size={16} /></button>
            </li>
          ))}</ul>
          <div className="el-add-head"><p className="field-label">Troop positions</p>{PRESETS.some(t => !has(t)) && <button type="button" className="link-btn small" onClick={() => PRESETS.forEach(t => add(t))}>Add all</button>}</div>
          <div className="el-presets">
            {PRESETS.filter(t => !has(t)).map(t => <button key={t} type="button" className="chip sm" onClick={() => add(t)}>+ {t}</button>)}
            {PRESETS.every(t => has(t)) && <span className="small muted">All troop positions are on the ballot.</span>}
          </div>
          {patrols.length > 0 && (
            <>
              <div className="el-add-head"><p className="field-label">Patrol positions <span className="small muted">· one race per patrol; only that patrol votes</span></p></div>
              <div className="el-presets">
                {PATROL_POS.filter(t => patrols.some(p => !has(t, p))).map(t => <button key={t} type="button" className="chip sm" onClick={() => patrols.forEach(p => add(t, p))}>+ {t} ({patrols.length} patrols)</button>)}
                {PATROL_POS.every(t => patrols.every(p => has(t, p))) && <span className="small muted">All patrol positions are on the ballot.</span>}
              </div>
            </>
          )}
          <form className="row-input" onSubmit={ev => { ev.preventDefault(); if (custom.trim()) { add(custom.trim()); setCustom(''); } }}><input value={custom} onChange={ev => setCustom(ev.target.value)} placeholder="Another position…" aria-label="Another position" /><button className="btn small secondary" disabled={!custom.trim()}>Add</button></form>
          <label className="switch-row"><span className="grow"><b>Show live results on the TV</b><span className="small muted">Turn off to show only turnout until you close voting.</span></span><input type="checkbox" role="switch" checked={live} onChange={ev => setLive(ev.target.checked)} /></label>
          {msg && <p className="form-msg">{msg}</p>}
          <div className="sheet-foot two"><button className="btn big secondary" disabled={busy} onClick={() => save(false)}>Save</button><button className="btn big accent" disabled={busy} onClick={() => save(true)}>Save & open voting</button></div>
        </>
      )}
    </Sheet>
  );
}
