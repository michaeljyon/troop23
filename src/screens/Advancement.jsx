import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Progress, Pill } from '../components/ui.jsx';
import { api, useAccount, useLeaderMode, usePatrols } from '../lib/api.js';
import { go } from '../lib/router.js';

// Trail to Eagle: each scout sees their own record, parents see their
// linked scouts, leaders see the whole troop.
const RANKS = ['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'];
const RANK_ABBR = { Scout: 'S', Tenderfoot: 'TF', 'Second Class': '2C', 'First Class': '1C', Star: '★', Life: '♥', Eagle: 'E' };

export default function Advancement({ route }) {
  const id = route.args[0];
  return id ? <ScoutRecord id={id} /> : <ScoutList />;
}

function ScoutList() {
  const acct = useAccount();
  const leader = useLeaderMode();
  const patrols = usePatrols() || [];
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [patrol, setPatrol] = useState('');
  useEffect(() => { api('adv').then(d => { setData(d); if (!leader && d.scouts.length === 1) go(`advancement/${d.scouts[0].id}`); }).catch(setError); }, [leader]);
  if (!acct && !leader) return <div className="content"><PageHead backTo="more" title="Advancement" /><Empty icon="trophy" title="Sign in with your personal code">Scouts see their own advancement, and parents see their scouts'. Ask a leader for your code.</Empty></div>;
  const list = (data?.scouts || []).filter(s => (!q || s.name.toLowerCase().includes(q.toLowerCase())) && (!patrol || s.patrol === patrol));
  const byRank = r => RANKS.indexOf(r);
  return (
    <div className="content">
      <PageHead backTo="more" title="Advancement" sub={leader ? 'The whole troop, from the latest TroopWebHost export.' : 'Your scouts\' trail to Eagle.'}><a className="btn small secondary head-btn" href="#/counselors"><Icon name="people" size={15} />Counselors</a></PageHead>
      {error ? <Empty icon="alert" title="Couldn't load">{error.message}</Empty> : !data ? <p className="muted">Loading…</p> : (
        <>
          {leader && (
            <>
              <div className="stat-row four">
                {['Scout', 'Tenderfoot', 'Second Class', 'First Class', 'Star', 'Life', 'Eagle'].filter(r => data.scouts.some(s => s.rank === r)).slice(-4).map(r => <div className="stat" key={r}><b>{data.scouts.filter(s => s.rank === r).length}</b><span>{r}</span></div>)}
              </div>
              <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a scout" aria-label="Find a scout" /></div>
              <div className="chip-scroll"><button className={`chip ${!patrol ? 'on' : ''}`} onClick={() => setPatrol('')}>All patrols</button>{patrols.filter(p => !/adult/i.test(p)).map(p => <button key={p} className={`chip ${patrol === p ? 'on' : ''}`} onClick={() => setPatrol(p)}>{p}</button>)}</div>
            </>
          )}
          {list.length === 0 ? <Empty icon="trophy" title="No scouts linked yet">{leader ? '' : 'Ask a leader to link your scout to your account.'}</Empty> : (
            <ul className="adv-list">
              {list.sort((a, b) => byRank(b.rank) - byRank(a.rank) || a.name.localeCompare(b.name)).map(s => (
                <li key={s.id}><a className="adv-row" href={`#/advancement/${s.id}`}>
                  <span className={`rank-chip r${Math.max(0, byRank(s.rank))}`}>{RANK_ABBR[s.rank] || '–'}</span>
                  <span className="grow"><b>{s.name}</b><span className="small muted">{s.rank || 'Joining'}{s.patrol ? ` · ${s.patrol}` : ''} · {s.badges} merit badges</span>
                    {s.next && s.next.total > 0 && <span className="adv-next"><Progress value={s.next.done} max={s.next.total} label={`Progress to ${s.next.rank}`} /><span>{s.next.rank} {s.next.done}/{s.next.total}</span></span>}
                  </span>
                  <Icon name="chevronR" size={18} />
                </a></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ScoutRecord({ id }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => { api(`adv/${id}`).then(setD).catch(setError); }, [id]);
  if (error) return <div className="content"><PageHead backTo="advancement" /><Empty icon="lock" title="Can't show this record">{error.message}</Empty></div>;
  if (!d) return <div className="content"><PageHead backTo="advancement" /><p className="muted">Loading…</p></div>;
  const { scout: s, record: r } = d;
  const rankIdx = RANKS.indexOf(s.rank);
  const earned = new Set((r?.badges || []).map(b => b.name));
  const inProg = new Map((r?.inProgress || []).map(b => [b.name, b]));
  const groups = r?.eagleGroups || [];
  const t = s.totals || r?.totals || {};
  const yearAct = (r?.activity || []);
  const yr = yearAct.reduce((a, x) => ({ nights: a.nights + x.nights, service: a.service + x.service, hiking: a.hiking + x.hiking }), { nights: 0, service: 0, hiking: 0 });
  return (
    <div className="content">
      <PageHead backTo="advancement"><a className="btn small secondary head-btn" href="#/counselors"><Icon name="people" size={15} />Counselors</a></PageHead>
      <section className="adv-hero">
        <span className={`rank-badge r${Math.max(0, rankIdx)}`}>{RANK_ABBR[s.rank] || '–'}</span>
        <div><p className="adv-kicker">{s.patrol || 'Troop 23'}{s.positions?.length ? ` · ${s.positions.join(', ')}` : ''}</p><h1>{s.name}</h1><p className="adv-rank">{s.rank ? `${s.rank} Scout` : 'Working on Scout rank'}{s.rankDate && ` · ${fmt(s.rankDate)}`}</p></div>
      </section>

      <div className="ladder" aria-label="Rank progress">
        {RANKS.map((rk, i) => {
          const got = (r?.ranks || []).find(x => x.rank === rk);
          return <div key={rk} className={`rung ${i <= rankIdx ? 'done' : ''} ${i === rankIdx + 1 ? 'next' : ''}`}><span className="rung-dot">{i <= rankIdx ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span><span className="rung-name">{rk}</span>{got?.earned && <span className="rung-date">{fmt(got.earned, true)}</span>}</div>;
        })}
      </div>

      {s.next && s.next.total > 0 && (
        <div className="card next-rank">
          <p><b>Next: {s.next.rank}</b><span>{s.next.done} of {s.next.total} requirements</span></p>
          <Progress value={s.next.done} max={s.next.total} label={`Progress to ${s.next.rank}`} />
        </div>
      )}

      <div className="stat-row four">
        <div className="stat"><b>{earned.size}</b><span>merit badges</span></div>
        <div className="stat"><b>{s.eagleReq}/{groups.length || 13}</b><span>Eagle-required</span></div>
        <div className="stat"><b>{t.nights ?? '–'}</b><span>nights camped</span></div>
        <div className="stat"><b>{t.service ?? '–'}</b><span>service hours</span></div>
      </div>

      {groups.length > 0 && (
        <Section title="Eagle-required badges">
          <ul className="eagle-grid">
            {groups.map(g => {
              const got = g.find(x => earned.has(x));
              const prog = !got && g.map(x => inProg.get(x)).find(Boolean);
              return <li key={g.join()} className={got ? 'got' : prog ? 'prog' : ''}><span className="eg-ico">{got ? <Icon name="check" size={16} strokeWidth={3} /> : prog ? `${Math.round(100 * prog.done / Math.max(1, prog.done + prog.left))}%` : ''}</span><span>{got || g.join(' or ')}</span></li>;
            })}
          </ul>
        </Section>
      )}

      {(r?.inProgress || []).length > 0 && (
        <Section title={`In progress · ${r.inProgress.length}`}>
          <ul className="prog-list">
            {r.inProgress.map(b => {
              const pct = Math.round(100 * b.done / Math.max(1, b.done + b.left));
              return <li key={b.name + b.started} className="card"><p className="pl-head"><b>{b.name}</b>{b.eagle && <Pill tone="warn">Eagle</Pill>}<span className="pl-pct">{pct}%</span></p><Progress value={b.done} max={b.done + b.left} label={`${b.name} progress`} /><p className="small muted">{b.left} requirement{b.left === 1 ? '' : 's'} left{b.counselor ? ` · Counselor: ${b.counselor}` : ''}{b.started ? ` · since ${fmt(b.started, true)}` : ''}</p></li>;
            })}
          </ul>
        </Section>
      )}

      {(r?.badges || []).length > 0 && (
        <Section title={`Merit badges earned · ${r.badges.length}`} action={r.badges.length > 12 && <button className="link-btn small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show all'}</button>}>
          <ul className="badge-list">{(all ? r.badges : r.badges.slice(0, 12)).map(b => <li key={b.name + b.earned}><span>{b.eagle && <span className="eagle-star" aria-label="Eagle-required">★</span>}{b.name}</span><span className="muted small">{fmt(b.earned, true)}</span></li>)}</ul>
        </Section>
      )}

      {yearAct.length > 0 && (
        <Section title="Activity since Aug 2025">
          <div className="stat-row three"><div className="stat"><b>{yr.nights}</b><span>nights</span></div><div className="stat"><b>{yr.service}</b><span>service hrs</span></div><div className="stat"><b>{yr.hiking}</b><span>hiking miles</span></div></div>
          <ul className="log">{yearAct.slice(0, 20).map((a, i) => <li key={i}><span className="log-when">{fmt(a.date, true)}</span><span className="grow">{a.event}{(a.nights || a.service || a.hiking) ? <span className="muted"> · {[a.nights && `${a.nights} night${a.nights > 1 ? 's' : ''}`, a.service && `${a.service} service hrs`, a.hiking && `${a.hiking} mi`].filter(Boolean).join(', ')}</span> : null}</span></li>)}</ul>
        </Section>
      )}
      <p className="small muted center pad-top">From the {r?.source || 'TroopWebHost export'}. Scoutbook and TroopWebHost remain the official records.</p>
    </div>
  );
}

function fmt(s, short) {
  if (!s) return '';
  const d = new Date(`${s}T12:00`);
  if (Number.isNaN(+d)) return s;
  return d.toLocaleDateString([], short ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
