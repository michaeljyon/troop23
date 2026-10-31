import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useApi, useAccount, sessionToken, leaderPass } from '../lib/api.js';
import { go } from '../lib/router.js';
import { shrinkImage } from './Messages.jsx';
import { useWakeLock } from './Campfire.jsx';
import { GAMES, MINUTES } from '../../troop/campfire.js';
import { CEREMONIES } from '../../troop/ceremonies.js';
import { KNOTS } from '../../troop/knots.js';

// Running the troop: the PLC meeting planner, quick polls, QR meeting check-in, year in review,
// the Eagle wall, and lost and found.

const dl = p => `/api/${p}${p.includes('?') ? '&' : '?'}${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}`;
const nice = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function Troop({ route }) {
  const n = route.name, [a, b] = route.args;
  if (n === 'meetings') return a ? <Meeting id={a} edit={b === 'edit' || a === 'new'} /> : <Meetings />;
  if (n === 'polls') return <Polls />;
  if (n === 'checkin') return a === 'tv' ? <CheckinTV /> : a ? <ScanIn code={a} /> : <Checkin />;
  if (n === 'year') return <Year y={a} />;
  if (n === 'eagles') return <EagleWall />;
  if (n === 'lost') return <Lost />;
  return null;
}

// ---------------------------------------------------------------- PLC meeting planner
const PARTS = [
  ['pre', 'Preopening', 15, 'A game as scouts arrive', GAMES.map(g => [`game:${g.id}`, g.title])],
  ['open', 'Opening', 5, 'Flag ceremony, Oath and Law', CEREMONIES.filter(c => c.group === 'flag' && /open/.test(c.id)).map(c => [`cer:${c.id}`, c.title])],
  ['skills', 'Skills instruction', 20, 'Teach a skill', KNOTS.map(k => [`knot:${k.id}`, k.name])],
  ['patrol', 'Patrol meetings', 15, 'Patrols plan and do business', []],
  ['game', 'Interpatrol activity', 15, 'A challenge between patrols', GAMES.map(g => [`game:${g.id}`, g.title])],
  ['close', 'Closing', 5, 'Scoutmaster\'s Minute and ceremony', [...MINUTES.map(m => [`min:${m.id}`, `Minute: ${m.title}`]), ...CEREMONIES.filter(c => /close/.test(c.id)).map(c => [`cer:${c.id}`, c.title])]],
  ['after', 'After the meeting', 10, 'PLC reviews and cleans up', []],
];
const refLink = r => { const [k, id] = (r || '').split(':'); return { game: `#/campfire/game/${id}`, cer: `#/ceremonies/${id}`, knot: `#/knots/${id}`, min: `#/campfire/minute/${id}` }[k]; };

function Meetings() {
  const acct = useAccount();
  const d = useApi(acct ? 'meet' : null);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Meeting plans" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  const t = todayISO();
  const list = d.data?.meetings || [];
  const next = list.filter(m => m.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <div className="content meetings">
      <PageHead backTo="more" title="Meeting plans" sub="The PLC's plan for each troop meeting, in the seven-part format.">
        {d.data?.canEdit && <a className="btn small head-btn" href="#/meetings/new"><Icon name="plus" size={16} />Plan one</a>}
      </PageHead>
      {next && <a className="alert-card" href={`#/meetings/${next.id}`}><span className="alert-ico" aria-hidden="true">📋</span><span className="grow"><b>Next: {next.title} · {nice(next.date)}</b><span>{next.theme || PARTS.map(([k]) => next.parts[k]?.text).filter(Boolean).slice(0, 3).join(' · ')}</span></span><Icon name="chevronR" /></a>}
      {!d.data ? <p className="muted">Loading…</p> : list.length === 0 ? <Empty icon="calendar" title="No meeting plans yet">{d.data.canEdit ? 'Plan the next meeting. Basecamp suggests games, ceremonies, knots and Scoutmaster\'s Minutes for each part.' : 'Your PLC will post plans here.'}</Empty> : (
        <ul className="fire-list mt">{list.map(m => <li key={m.id}><a href={`#/meetings/${m.id}`}><span className="fl-emoji" aria-hidden="true">{m.date >= t ? '📋' : '✔️'}</span><span className="grow"><b>{m.title}</b><span className="small muted fl-sub">{nice(m.date)}{m.theme ? ` · ${m.theme}` : ''}</span></span><Icon name="chevronR" size={18} /></a></li>)}</ul>
      )}
    </div>
  );
}

function Meeting({ id, edit }) {
  const d = useApi(id !== 'new' ? `meet/${id}` : null);
  const [f, setF] = useState(id === 'new' ? { title: 'Troop meeting', date: todayISO(), theme: '', parts: Object.fromEntries(PARTS.map(([k, , m]) => [k, { text: '', who: '', ref: '', mins: m }])) } : null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (d.data && !f) setF(d.data.meeting); }, [d.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = f || d.data?.meeting;
  if (!m) return <div className="content"><PageHead backTo="meetings" title="Meeting plan" /><p className="muted">{d.error?.message || 'Loading…'}</p></div>;
  const total = PARTS.reduce((t, [k]) => t + (Number(m.parts[k]?.mins) || 0), 0);
  if (!edit) return (
    <div className="content meetings">
      <PageHead backTo="meetings" eyebrow={`📋 ${nice(m.date)} · ${total} minutes`} title={m.title} sub={m.theme}>
        {d.data?.canEdit && <a className="btn small secondary head-btn" href={`#/meetings/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      <ol className="meet-plan">{PARTS.map(([k, label]) => { const p = m.parts[k] || {}; const link = refLink(p.ref); return (
        <li key={k} className="card"><span className="mp-min">{p.mins || 0}<small>min</small></span><span className="grow"><span className="small muted">{label}</span><b>{p.text || '—'}</b>{p.who && <span className="small">👤 {p.who}</span>}{link && <a className="small" href={link}>Open it →</a>}</span></li>
      ); })}</ol>
    </div>
  );
  const setP = (k, patch) => setF(x => ({ ...x, parts: { ...x.parts, [k]: { ...x.parts[k], ...patch } } }));
  const save = async () => { setMsg(''); try { const r = id === 'new' ? await api('meet', { method: 'POST', body: f }) : await api(`meet/${id}`, { method: 'PUT', body: f }); go(`meetings/${r.meeting.id}`, { replace: true }); } catch (e) { setMsg(e.message); } };
  return (
    <div className="content meetings">
      <PageHead backTo={id === 'new' ? 'meetings' : `meetings/${id}`} title={id === 'new' ? 'Plan a meeting' : 'Edit meeting'} sub={`${total} minutes planned`} />
      <div className="card"><label className="field"><span>Name</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={100} /></label>
        <div className="row2"><label className="field"><span>Date</span><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label><label className="field"><span>Theme (optional)</span><input value={f.theme} onChange={e => setF({ ...f, theme: e.target.value })} placeholder="First aid month" maxLength={100} /></label></div></div>
      {PARTS.map(([k, label, , hint, sugg]) => (
        <div key={k} className="card meet-part">
          <div className="mpart-head"><b>{label}</b><label className="mp-mins"><input type="number" min="0" max="120" value={f.parts[k].mins} onChange={e => setP(k, { mins: e.target.value })} aria-label={`${label} minutes`} /> min</label></div>
          <input value={f.parts[k].text} onChange={e => setP(k, { text: e.target.value, ref: '' })} placeholder={hint} aria-label={label} maxLength={600} />
          <input value={f.parts[k].who} onChange={e => setP(k, { who: e.target.value })} placeholder="Who leads it?" aria-label={`Who leads ${label}`} maxLength={80} />
          {sugg.length > 0 && <div className="chip-scroll">{sugg.slice(0, 18).map(([ref, t]) => <button key={ref} className={`chip sm ${f.parts[k].ref === ref ? 'on' : ''}`} onClick={() => setP(k, { text: t, ref })}>{t}</button>)}</div>}
        </div>
      ))}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="save-bar"><button className="btn big" onClick={save}>Save plan</button></div>
      {id !== 'new' && <p className="center"><button className="link-btn small danger" onClick={async () => { if (confirm('Delete this meeting plan?')) { await api(`meet/${id}`, { method: 'DELETE' }); go('meetings'); } }}><Icon name="trash" size={14} />Delete</button></p>}
    </div>
  );
}

// ---------------------------------------------------------------- polls
function Polls() {
  const acct = useAccount();
  const d = useApi(acct ? 'poll' : null);
  const [make, setMake] = useState(false);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Polls" /><Empty icon="lock" title="Sign in with your personal code to vote" /></div>;
  const vote = async (p, opts) => { try { await api(`poll/${p.id}/vote`, { method: 'POST', body: { opts } }); d.refresh(); } catch (e) { alert(e.message); } };
  return (
    <div className="content polls">
      <PageHead backTo="more" title="Polls" sub="Quick votes on campout spots, menus and plans.">
        {d.data?.canMake && <button className="btn small head-btn" onClick={() => setMake(true)}><Icon name="plus" size={16} />New poll</button>}
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : d.data.polls.length === 0 ? <Empty icon="users" title="No polls yet" /> : d.data.polls.map(p => <Poll key={p.id} p={p} vote={vote} refresh={d.refresh} canMake={d.data.canMake} />)}
      <Sheet open={make} onClose={() => setMake(false)} title="New poll">{make && <MakePoll onDone={() => { setMake(false); d.refresh(); }} />}</Sheet>
    </div>
  );
}
function Poll({ p, vote, refresh, canMake }) {
  const [sel, setSel] = useState([]);
  const show = p.counts && (p.mine || p.closed);
  const tot = Math.max(1, Object.values(p.counts || {}).reduce((t, v) => t + v, 0));
  const lead = show ? Math.max(...Object.values(p.counts)) : 0;
  return (
    <div className={`card poll ${p.closed ? 'closed' : ''}`}>
      <div className="poll-head"><b>{p.q}</b>{p.closed ? <Pill>Closed</Pill> : p.mine ? <Pill tone="good">You voted</Pill> : <Pill tone="warn">Open</Pill>}</div>
      <span className="small muted">{p.aud === 'all' ? 'Everyone' : p.aud === 'scouts' ? 'Scouts' : p.aud === 'adults' ? 'Adults' : 'Leaders'}{p.closes ? ` · closes ${nice(p.closes)}` : ''}{p.voters != null ? ` · ${p.voters} vote${p.voters === 1 ? '' : 's'}` : ''}{p.multi ? ' · pick any' : ''}</span>
      <ul className="poll-opts">{p.options.map(o => { const n = p.counts?.[o.id] || 0; const on = sel.includes(o.id) || p.mine?.includes(o.id); return (
        <li key={o.id}>{show ? (
          <div className={`po-bar ${n === lead && n > 0 ? 'lead' : ''} ${p.mine?.includes(o.id) ? 'mine' : ''}`}><i style={{ width: `${(n / tot) * 100}%` }} /><span>{o.text}{p.mine?.includes(o.id) ? ' ✓' : ''}</span><b>{n}</b></div>
        ) : <button className={`po-btn ${on ? 'on' : ''}`} disabled={p.closed} onClick={() => setSel(s => (p.multi ? (s.includes(o.id) ? s.filter(x => x !== o.id) : [...s, o.id]) : [o.id]))}>{on ? '●' : '○'} {o.text}</button>}</li>
      ); })}</ul>
      {!show && !p.closed && <button className="btn small" disabled={!sel.length} onClick={() => vote(p, sel)}>Vote</button>}
      {!show && p.voters != null && <span className="small muted">{p.voters} vote{p.voters === 1 ? '' : 's'} so far.</span>}
      {canMake && !p.closed && <button className="link-btn small" onClick={async () => { await api(`poll/${p.id}/close`, { method: 'POST', body: {} }).catch(e => alert(e.message)); refresh(); }}>Close poll</button>}
    </div>
  );
}
function MakePoll({ onDone }) {
  const [f, setF] = useState({ q: '', options: ['', ''], multi: false, aud: 'all', closes: '' });
  const [msg, setMsg] = useState('');
  return (
    <div>
      <label className="field"><span>Question</span><input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Where should the spring campout be?" maxLength={160} /></label>
      <div className="field"><span>Choices</span>{f.options.map((o, i) => <input key={i} className="mt" value={o} onChange={e => setF({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Choice ${i + 1}`} maxLength={80} />)}
        {f.options.length < 10 && <button className="link-btn small" onClick={() => setF({ ...f, options: [...f.options, ''] })}>+ Another choice</button>}</div>
      <div className="field"><span>Who votes</span><div className="el-chips">{[['all', 'Everyone'], ['scouts', 'Scouts'], ['adults', 'Adults'], ['leaders', 'Leaders']].map(([k, l]) => <button key={k} className={`chip sm ${f.aud === k ? 'on' : ''}`} onClick={() => setF({ ...f, aud: k })}>{l}</button>)}</div></div>
      <label className="check-row"><input type="checkbox" checked={f.multi} onChange={e => setF({ ...f, multi: e.target.checked })} /><span>People can pick more than one</span></label>
      <label className="field"><span>Closes (optional)</span><input type="date" value={f.closes} onChange={e => setF({ ...f, closes: e.target.value })} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" onClick={async () => { try { await api('poll', { method: 'POST', body: f }); onDone(); } catch (e) { setMsg(e.message); } }}>Post poll</button>
      <p className="small muted">Votes are private. People see results after they vote.</p>
    </div>
  );
}

// ---------------------------------------------------------------- meeting check-in
function Checkin() {
  const d = useApi('attend');
  const t = todayISO();
  const s = useApi(d.data ? `attend/${t}` : null);
  const [title, setTitle] = useState('Troop meeting');
  if (d.error) return <div className="content"><PageHead backTo="more" title="Meeting check-in" /><Empty icon="lock" title="For leaders">{d.error.message}</Empty></div>;
  const open = async () => { await api('attend/open', { method: 'POST', body: { title } }); d.refresh(); s.refresh(); };
  const mark = async (memberId, on) => { await api(`attend/${t}/mark`, { method: 'POST', body: { memberId, on } }); s.refresh(); };
  const sess = s.data?.session;
  const here = sess ? sess.list : {};
  return (
    <div className="content checkin">
      <PageHead backTo="more" title="Meeting check-in" sub="Put the code on the TV. Scouts scan it with their phone camera to check in." />
      {!sess?.open ? (
        <div className="card"><label className="field"><span>Meeting</span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} /></label><button className="btn big accent" onClick={open}><Icon name="play" size={18} />Start check-in for today</button></div>
      ) : (
        <>
          <div className="btn-row"><a className="btn accent" href="#/checkin/tv"><Icon name="expand" size={16} />Show the code on a TV</a><button className="btn secondary" onClick={async () => { await api(`attend/${t}/close`, { method: 'POST', body: {} }); s.refresh(); d.refresh(); }}>Stop check-in</button></div>
          <p className="small">Or scouts can type this code on the check-in page: <b className="code-big">{s.data.fixed}</b></p>
        </>
      )}
      {sess && (
        <Section title={`${Object.keys(here).length} here today`}>
          <ul className="count-list">{(s.data.scouts || []).map(p => <li key={p.id}><button className={here[p.id] ? 'on' : ''} onClick={() => mark(p.id, !here[p.id])}><span>{here[p.id] ? '✓' : ''}</span>{p.name}{here[p.id]?.how === 'scan' && <small> 📱</small>}</button></li>)}</ul>
          <p className="small muted">📱 checked in on their phone. Tap a name to mark someone yourself.</p>
        </Section>
      )}
      <Section title="Past meetings" action={<a className="link-btn small" href={dl('attend/export.csv')} download><Icon name="download" size={15} />CSV</a>}>
        <ul className="fire-list">{(d.data?.sessions || []).map(x => <li key={x.date}><a href={`#/checkin`} onClick={e => e.preventDefault()}><span className="fl-emoji" aria-hidden="true">🗓️</span><span className="grow"><b>{x.title}</b><span className="small muted fl-sub">{nice(x.date)} · {x.count} checked in{x.open ? ' · open' : ''}</span></span></a></li>)}</ul>
      </Section>
    </div>
  );
}
function CheckinTV() {
  const t = todayISO();
  const s = useApi(`attend/${t}`);
  const [qr, setQr] = useState('');
  useWakeLock();
  useEffect(() => { const i = setInterval(() => s.refresh(), 20000); return () => clearInterval(i); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const code = s.data?.code;
  useEffect(() => { if (code) QRCode.toDataURL(`${location.origin}/#/checkin/${code}`, { margin: 1, width: 520, color: { dark: '#12301F', light: '#FFFFFF' } }).then(setQr); }, [code]);
  const n = Object.keys(s.data?.session?.list || {}).length;
  return (
    <div className="emcee checkin-tv" role="dialog" aria-label="Check-in code">
      <div className="em-top"><button className="icon-btn on-dark" onClick={() => go('checkin', { replace: true })} aria-label="Close"><Icon name="x" /></button><span className="grow em-plan">{s.data?.session?.title || 'Check in'}</span><span className="em-count">{n} here</span></div>
      <div className="em-body ctv">
        {code ? <><h2>Scan to check in</h2>{qr && <img src={qr} alt={`Check-in code ${code}`} className="ctv-qr" />}<p>Or open Basecamp → More → Check in, and type <b>{s.data.fixed}</b></p><p className="small">The code changes every minute.</p></> : <p>Check-in isn't open. Start it from the check-in page.</p>}
      </div>
    </div>
  );
}
function ScanIn({ code }) {
  const acct = useAccount();
  const [r, setR] = useState(null);
  const [typed, setTyped] = useState(code === 'go' ? '' : code);
  const send = async c => { try { setR(await api('attend/in', { method: 'POST', body: { code: c } })); } catch (e) { setR({ error: e.message }); } };
  useEffect(() => { if (acct && code !== 'go') send(code); }, [acct?.member?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="content checkin center">
      <PageHead backTo="home" title="Check in" />
      {!acct ? <Empty icon="lock" title="Sign in with your personal code first">Then scan the code again.</Empty> : r?.ok ? (
        <div className="card ci-ok"><span className="em-big-emoji" aria-hidden="true">✅</span><h2>You're checked in!</h2><p>{r.title} · {r.count} here so far</p></div>
      ) : (
        <div className="card"><p>{r?.error || 'Type the code on the screen.'}</p><form className="row-input" onSubmit={e => { e.preventDefault(); send(typed); }}><input value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} placeholder="CODE" aria-label="Check-in code" autoCapitalize="characters" maxLength={8} /><button className="btn small">Check in</button></form></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- year in review
function Year({ y }) {
  const year = /^\d{4}$/.test(y || '') ? y : String(new Date().getFullYear());
  const d = useApi(`year/${year}`);
  const s = d.data;
  const stat = (big, label, emoji) => <div className="yr-stat"><span aria-hidden="true">{emoji}</span><b>{big}</b><span>{label}</span></div>;
  return (
    <div className="content year">
      <PageHead backTo="more" title={`${year} in review`} sub="The troop's year, by the numbers." />
      <div className="el-chips">{[0, 1, 2, 3].map(i => { const yy = String(new Date().getFullYear() - i); return <button key={yy} className={`chip sm ${yy === year ? 'on' : ''}`} onClick={() => go(`year/${yy}`, { replace: true })}>{yy}</button>; })}</div>
      {!s ? <p className="muted">{d.error?.message || 'Loading…'}</p> : (
        <>
          <div className="yr-grid">
            {stat(s.outings, 'outings', '🏕️')}{stat(s.nights, 'nights camping', '⛺')}{stat(s.hikeMiles, 'miles hiked', '🥾')}{stat(s.badgeCount, 'merit badges', '🎖️')}
            {stat(Object.values(s.ranks).reduce((t, v) => t + v, 0), 'rank advancements', '⭐')}{stat(s.eagles, s.eagles === 1 ? 'new Eagle Scout' : 'new Eagle Scouts', '🦅')}{stat(s.service, 'service hours', '🤝')}{stat(s.photos, 'photos shared', '📸')}
          </div>
          {s.topBadges.length > 0 && <div className="card"><b>Most-earned merit badges</b><ol className="yr-list">{s.topBadges.map(([n, c]) => <li key={n}>{n} <span className="muted">· {c}</span></li>)}</ol></div>}
          {Object.keys(s.ranks).length > 0 && <div className="card"><b>Rank advancements</b><p>{Object.entries(s.ranks).map(([r, c]) => `${r}: ${c}`).join(' · ')}</p></div>}
          {s.champion && <div className="card"><b>🏆 Patrol points leader: {s.champion}</b></div>}
          <a className="btn big accent" href={`#/slideshow?year=${year}`}><Icon name="play" size={18} />Play the {year} slideshow</a>
          <p className="small muted">Great for the banquet. Camping nights count each overnight outing; miles count each recorded hike once.</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Eagle wall
function EagleWall() {
  const d = useApi('eagles');
  const [add, setAdd] = useState(false);
  const list = d.data?.eagles || [];
  const years = [...new Set(list.map(e => e.year))];
  return (
    <div className="content eagles">
      <PageHead backTo="more" title="Eagle Scouts" sub="Every Eagle Scout from our troop.">
        {d.data?.isLeader && <button className="btn small head-btn" onClick={() => setAdd(true)}><Icon name="plus" size={16} />Add</button>}
      </PageHead>
      <div className="eagle-hero"><span aria-hidden="true">🦅</span><b>{list.length}</b><span>Eagle Scout{list.length === 1 ? '' : 's'}</span></div>
      {!d.data ? <p className="muted">Loading…</p> : list.length === 0 ? <Empty icon="trophy" title="No Eagles listed yet">{d.data.isLeader ? 'Eagles from the advancement records show up on their own. Add alumni with Add.' : ''}</Empty> : years.map(y => (
        <Section key={y} title={y || 'Year unknown'}><ul className="eagle-list">{list.filter(e => e.year === y).map(e => <li key={e.id} className="card"><b>{e.name}</b>{e.project && <span className="small">{e.project}</span>}{e.manual && d.data.isLeader && <button className="link-btn small danger" onClick={async () => { if (confirm(`Remove ${e.name}?`)) { await api(`eagles/${e.id}`, { method: 'DELETE' }); d.refresh(); } }}>Remove</button>}</li>)}</ul></Section>
      ))}
      <Sheet open={add} onClose={() => setAdd(false)} title="Add an Eagle Scout">{add && <AddEagle onDone={() => { setAdd(false); d.refresh(); }} />}</Sheet>
    </div>
  );
}
function AddEagle({ onDone }) {
  const [f, setF] = useState({ name: '', year: '', project: '' });
  const [msg, setMsg] = useState('');
  return (
    <div>
      <label className="field"><span>Name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={80} /></label>
      <label className="field"><span>Year</span><input inputMode="numeric" value={f.year} onChange={e => setF({ ...f, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="1998" /></label>
      <label className="field"><span>Eagle project (optional)</span><input value={f.project} onChange={e => setF({ ...f, project: e.target.value })} maxLength={140} /></label>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" onClick={async () => { try { await api('eagles', { method: 'POST', body: f }); onDone(); } catch (e) { setMsg(e.message); } }}>Add</button>
    </div>
  );
}

// ---------------------------------------------------------------- lost and found
function Lost() {
  const acct = useAccount();
  const d = useApi(acct ? 'lost' : null);
  const [add, setAdd] = useState(false);
  if (!acct) return <div className="content"><PageHead backTo="more" title="Lost and found" /><Empty icon="lock" title="Sign in with your personal code" /></div>;
  const items = d.data?.items || [];
  const act = async (l, path, body, method = 'POST') => { await api(`lost/${l.id}${path}`, { method, body }); d.refresh(); };
  return (
    <div className="content lost">
      <PageHead backTo="more" title="Lost and found" sub="Left something at camp? Found something? Post it here.">
        <button className="btn small head-btn" onClick={() => setAdd(true)}><Icon name="plus" size={16} />Post</button>
      </PageHead>
      {!d.data ? <p className="muted">Loading…</p> : items.length === 0 ? <Empty icon="box" title="Nothing lost right now" /> : (
        <ul className="lost-grid">{items.map(l => (
          <li key={l.id} className={`card ${l.status}`}>
            {l.photo ? <img src={dl(`lost/${l.id}/photo`)} alt={l.title} loading="lazy" /> : <span className="lost-noimg" aria-hidden="true">🧦</span>}
            <b>{l.title}</b><span className="small muted">{l.where || 'Somewhere'} · {new Date(l.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            {l.status === 'claimed' ? <Pill tone="good">Back home</Pill> : (d.data.isLeader || l.by === d.data.me) ? <button className="btn small secondary" onClick={() => act(l, '/claim', {})}>Mark returned</button> : <span className="small muted">Yours? Tell {l.byName.split(' ')[0]} or a leader.</span>}
            {(d.data.isLeader || l.by === d.data.me) && <button className="link-btn small danger" onClick={() => confirm('Remove this post?') && act(l, '', undefined, 'DELETE')}>Remove</button>}
          </li>
        ))}</ul>
      )}
      <Sheet open={add} onClose={() => setAdd(false)} title="Post a lost or found item">{add && <AddLost onDone={() => { setAdd(false); d.refresh(); }} />}</Sheet>
    </div>
  );
}
function AddLost({ onDone }) {
  const [f, setF] = useState({ title: '', where: '', data: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div>
      <label className="field"><span>What is it?</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Blue water bottle with stickers" maxLength={80} /></label>
      <label className="field"><span>Where was it found or lost?</span><input value={f.where} onChange={e => setF({ ...f, where: e.target.value })} placeholder="Fall campout, by the dining fly" maxLength={120} /></label>
      <label className="field"><span>Photo (optional)</span><input type="file" accept="image/*" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); try { setF(x => ({ ...x, data: '' })); const s = await shrinkImage(file); setF(x => ({ ...x, data: s.data })); } finally { setBusy(false); } }} /></label>
      {f.data && <img src={f.data} alt="" className="lost-preview" />}
      <p className="small muted">Photograph the item, not people.</p>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn" disabled={busy || !f.title.trim()} onClick={async () => { try { await api('lost', { method: 'POST', body: f }); onDone(); } catch (e) { setMsg(e.message); } }}>Post</button>
    </div>
  );
}
