import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Pill } from '../components/ui.jsx';
import { api, useCol, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';

// Merit badge counselors: find who counsels a badge and message troop
// counselors (the Scoutmaster and Committee Chair are always included).
export default function Counselors() {
  const list = useCol('counselors');
  const acct = useAccount();
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const active = list.items.filter(c => c.active !== false);
  const byBadge = new Map();
  for (const c of active) for (const b of c.badges || []) { if (!byBadge.has(b)) byBadge.set(b, []); byBadge.get(b).push(c); }
  const ql = q.trim().toLowerCase();
  const badges = [...byBadge.keys()].sort().filter(b => !ql || b.toLowerCase().includes(ql) || byBadge.get(b).some(c => c.name.toLowerCase().includes(ql)));
  async function message(c) {
    setMsg('');
    try { const r = await api('threads', { method: 'POST', body: { to: [c.memberId] } }); go(`thread/${r.thread.id}`); }
    catch (e) { setMsg(e.message); }
  }
  return (
    <div className="content">
      <PageHead backTo="advancement" title="Merit badge counselors" sub={`${byBadge.size} badges · ${active.length} counselors`} />
      <div className="card tip"><Icon name="info" size={20} /><span>Talk with the Scoutmaster before starting a badge, then reach out to a counselor. Messages here always include the Scoutmaster and Committee Chair.</span></div>
      <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a badge or counselor" aria-label="Search merit badges" /></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      {list.loading && !list.data ? <p className="muted">Loading…</p> : badges.length === 0 ? (
        <Empty icon="trophy" title={q ? 'No counselor listed for that' : 'No counselors listed yet'}>{q ? 'Ask the Scoutmaster. They can find a district counselor.' : 'Leaders add counselors in Leader tools → Troop setup.'}</Empty>
      ) : (
        <ul className="mbc-list">
          {badges.map(b => (
            <li key={b} className="card">
              <p className="mbc-badge"><Icon name="trophy" size={16} /><b>{b}</b></p>
              <ul>
                {byBadge.get(b).map(c => (
                  <li key={c.id}>
                    <span className="grow">{c.name}{!c.memberId && <Pill>Outside</Pill>}{c.notes && <span className="small muted"> · {c.notes}</span>}</span>
                    {c.memberId && acct && c.memberId !== acct.member.id ? <button className="btn small secondary" onClick={() => message(c)}><Icon name="message" size={15} />Message</button>
                      : !c.memberId ? <span className="small muted">Ask the Scoutmaster</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
