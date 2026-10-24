import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Section, Empty, Sheet, Pill, Seg } from '../components/ui.jsx';
import { api, usePatrols } from '../lib/api.js';
import { troop } from '../lib/config.js';

// Leader tools → Members: personal codes and invite links, leader role,
// parent ↔ scout links, and the two leaders copied on every conversation.
const inviteUrl = code => `${location.origin}/#/join/${code}`;
const inviteText = m => `Hi ${m.first}! Here's your sign-in for ${troop.appName}, Troop 23's app for outings, sign-ups, meals, gear, photos and troop chat.\n\nTap: ${inviteUrl(m.code)}\nOr open ${location.origin} and enter your code: ${m.code}\n\nKeep this code to yourself. It's your personal sign-in.`;

export function Members({ pass }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const load = () => api('leader/members', { leader: pass }).then(d => { setData(d); setError(null); }).catch(setError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const members = data?.members || [];
  const F = { all: () => true, scouts: m => m.role === 'scout', adults: m => m.role === 'adult', leaders: m => m.leader, waiting: m => !m.lastSignIn };
  const list = members.filter(m => m.active !== false).filter(F[filter]).filter(m => !q || `${m.name} ${m.patrol} ${(m.positions || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
  const signedIn = members.filter(m => m.lastSignIn).length;
  function downloadInvites() {
    const rows = [['Name', 'Role', 'Patrol', 'Code', 'Sign-in link'], ...list.map(m => [m.name, m.role, m.patrol || '', m.code, inviteUrl(m.code)])];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');
    const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = u; a.download = `troop23-invites-${filter}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  if (error) return <Empty icon="alert" title="Couldn't load members">{error.message}</Empty>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <Guardians data={data} pass={pass} onSaved={load} />
      <div className="stat-row three">
        <div className="stat"><b>{members.filter(m => m.role === 'scout' && m.active !== false).length}</b><span>scouts</span></div>
        <div className="stat"><b>{members.filter(m => m.role === 'adult' && m.active !== false).length}</b><span>adults</span></div>
        <div className="stat"><b>{signedIn}</b><span>signed in</span></div>
      </div>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names, patrols, positions" aria-label="Search members" /></div>
      <div className="chip-scroll">{[['all', 'Everyone'], ['scouts', 'Scouts'], ['adults', 'Adults'], ['leaders', 'Leaders'], ['waiting', 'Not signed in yet']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}<span className="chip-sub">{members.filter(m => m.active !== false).filter(F[k]).length}</span></button>)}</div>
      <div className="btn-row tight"><button className="btn small secondary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add member</button><button className="btn small secondary" onClick={downloadInvites}><Icon name="download" size={16} />Invite list (CSV)</button><button className="btn small secondary" onClick={() => setLinking(true)}><Icon name="users" size={16} />Link families</button></div>
      <ul className="gear-list mt">
        {list.map(m => (
          <li key={m.id}><button className="gear-row" onClick={() => setOpen(m.id)}>
            <span className="grow"><b>{m.name}</b>{m.leader && <span className="tag">Leader</span>}
              <span className="small muted">{m.role === 'scout' ? `Scout${m.patrol ? ` · ${m.patrol}` : ''}${m.rank ? ` · ${m.rank}` : ''}` : (m.positions || []).join(', ') || 'Parent'}{m.role === 'adult' && m.scouts?.length ? ` · linked to ${m.scouts.length} scout${m.scouts.length > 1 ? 's' : ''}` : ''}</span>
            </span>
            {m.lastSignIn ? <Pill tone="good">Signed in</Pill> : <Pill>Invite</Pill>}
          </button></li>
        ))}
      </ul>
      <MemberSheet m={members.find(x => x.id === open)} members={members} pass={pass} onClose={() => setOpen(null)} onChange={load} />
      <Sheet open={linking} onClose={() => setLinking(false)} title="Link families" wide>{linking && <LinkFamilies members={members} pass={pass} onDone={() => { setLinking(false); load(); }} />}</Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add member">{adding && <AddMember pass={pass} onSaved={() => { setAdding(false); load(); }} />}</Sheet>
    </>
  );
}

function Guardians({ data, pass, onSaved }) {
  const adults = data.members.filter(m => m.role === 'adult' && m.active !== false).sort((a, b) => a.last.localeCompare(b.last));
  const [sm, setSm] = useState(data.guardians?.scoutmaster || '');
  const [cc, setCc] = useState(data.guardians?.chair || '');
  const [msg, setMsg] = useState(null);
  const set = !!(data.guardians?.scoutmaster && data.guardians?.chair);
  async function save() {
    setMsg(null);
    try { await api('leader/guardians', { method: 'POST', body: { scoutmaster: sm, chair: cc }, leader: pass }); setMsg({ text: 'Saved. Both are now part of every conversation.' }); onSaved(); }
    catch (e) { setMsg({ bad: true, text: e.message }); }
  }
  return (
    <Section title="Two-deep for chat">
      <div className={`card ${set ? '' : 'warn-card'}`}>
        <p className="small">These two adults are automatically added to every conversation in Chat, so no scout is ever in a one-on-one online conversation. {set ? '' : <b>Chat stays off until both are set.</b>}</p>
        <div className="two-col">
          <label className="field"><span>Scoutmaster</span><select value={sm} onChange={e => setSm(e.target.value)}><option value="">Choose…</option>{adults.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label className="field"><span>Committee Chair</span><select value={cc} onChange={e => setCc(e.target.value)}><option value="">Choose…</option>{adults.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        </div>
        {(sm !== (data.guardians?.scoutmaster || '') || cc !== (data.guardians?.chair || '')) && <button className="btn small" onClick={save}>Save</button>}
        {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`}>{msg.text}</p>}
      </div>
    </Section>
  );
}

function MemberSheet({ m, members, pass, onClose, onChange }) {
  return <Sheet open={!!m} onClose={onClose} title={m?.name || ''}>{m && <MemberDetail key={m.id} m={m} members={members} pass={pass} onChange={onChange} />}</Sheet>;
}

function MemberDetail({ m, members, pass, onChange }) {
  const patrols = usePatrols() || troop.patrols;
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const scouts = members.filter(x => x.role === 'scout' && x.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const suggested = scouts.filter(x => x.last.toLowerCase() === m.last.toLowerCase() && !(m.scouts || []).includes(x.id));
  const [showAll, setShowAll] = useState(false);
  async function upd(body, sub = '') {
    setMsg('');
    try { await api(`leader/members/${m.id}${sub ? `/${sub}` : ''}`, { method: 'POST', body, leader: pass }); onChange(); }
    catch (e) { setMsg(e.message); }
  }
  async function share() {
    const text = inviteText(m);
    if (navigator.share) { try { await navigator.share({ title: 'Troop 23 Basecamp sign-in', text }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  return (
    <div>
      <div className="invite card soft">
        <p className="small muted">Personal sign-in code</p>
        <p className="big-code">{m.code}</p>
        <div className="btn-row tight">
          <button className="btn small" onClick={share}><Icon name="share" size={16} />{copied ? 'Copied!' : 'Send invite'}</button>
          <button className="btn small secondary" onClick={() => { navigator.clipboard?.writeText(inviteUrl(m.code)); setCopied(true); setTimeout(() => setCopied(false), 2500); }}><Icon name="copy" size={16} />Copy link</button>
        </div>
        <p className="small muted">{m.lastSignIn ? `Last signed in ${new Date(m.lastSignIn).toLocaleDateString([], { month: 'short', day: 'numeric' })}.` : 'Hasn\'t signed in yet.'} Text or email the invite. Opening the link signs them in on that phone.</p>
        <div className="btn-row tight">
          <button className="link-btn small" onClick={() => confirm(`Make a new code for ${m.first}? The old code stops working, but phones already signed in stay signed in.`) && upd({}, 'code')}><Icon name="refresh" size={14} />New code</button>
          <button className="link-btn small danger" onClick={() => confirm(`Sign ${m.first} out on every device?`) && upd({}, 'signout')}><Icon name="logout" size={14} />Sign out everywhere</button>
        </div>
      </div>

      {m.role === 'scout' ? (
        <label className="field"><span>Patrol</span><select value={m.patrol || ''} onChange={e => upd({ patrol: e.target.value })}><option value="">None</option>{patrols.filter(p => !/adult/i.test(p)).map(p => <option key={p}>{p}</option>)}</select></label>
      ) : (
        <>
          <label className="check"><input type="checkbox" checked={!!m.leader} onChange={e => upd({ leader: e.target.checked })} /> Leader (leader tools, photo review, managing members)</label>
          <div className="field"><span>Linked scouts <i className="opt">their parent or guardian</i></span>
            <p className="small muted">Linked parents can sign their scouts up for outings and see their advancement.</p>
            {suggested.length > 0 && <div className="chip-wrap mb">{suggested.map(x => <button key={x.id} className="chip" onClick={() => upd({ scouts: [...(m.scouts || []), x.id] })}><Icon name="plus" size={14} />{x.name} <span className="chip-sub">same last name</span></button>)}</div>}
            <div className="chip-wrap">
              {(m.scouts || []).map(id => scouts.find(x => x.id === id)).filter(Boolean).map(x => <button key={x.id} className="chip on" onClick={() => upd({ scouts: m.scouts.filter(y => y !== x.id) })}><Icon name="check" size={14} />{x.name}</button>)}
            </div>
            {showAll ? <div className="chip-wrap mt">{scouts.filter(x => !(m.scouts || []).includes(x.id)).map(x => <button key={x.id} className="chip sm" onClick={() => upd({ scouts: [...(m.scouts || []), x.id] })}>{x.name}</button>)}</div> : <button className="link-btn small" onClick={() => setShowAll(true)}><Icon name="plus" size={14} />Link another scout</button>}
          </div>
        </>
      )}
      {(m.positions || []).length > 0 && <p className="small muted">Positions: {m.positions.join(', ')}</p>}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="btn-row"><button className="link-btn small danger" onClick={() => confirm(`Remove ${m.name} from Basecamp? They'll be signed out.`) && upd({ active: false }, 'signout')}><Icon name="trash" size={14} />Remove member</button></div>
    </div>
  );
}

function AddMember({ pass, onSaved }) {
  const [f, setF] = useState({ first: '', last: '', role: 'scout' });
  const [msg, setMsg] = useState('');
  async function save(e) {
    e.preventDefault(); setMsg('');
    try { await api('leader/members', { method: 'POST', body: f, leader: pass }); onSaved(); } catch (err) { setMsg(err.message); }
  }
  return (
    <form onSubmit={save}>
      <div className="two-col">
        <label className="field"><span>First name</span><input value={f.first} onChange={e => setF({ ...f, first: e.target.value })} required /></label>
        <label className="field"><span>Last name</span><input value={f.last} onChange={e => setF({ ...f, last: e.target.value })} required /></label>
      </div>
      <div className="field"><span>Role</span><Seg value={f.role} onChange={role => setF({ ...f, role })} options={[['scout', 'Scout'], ['adult', 'Adult']]} label="Role" /></div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <button className="btn">Add and make a code</button>
    </form>
  );
}

export function Reports({ pass }) {
  const [data, setData] = useState(null);
  const load = () => api('leader/reports', { leader: pass }).then(setData).catch(() => setData({ reports: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(r, action) { await api(`leader/reports/${r.threadId}__${r.msgId}`, { method: 'POST', body: { action }, leader: pass }); load(); }
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <Section title="Reported messages">
      {data.reports.length === 0 ? <Empty icon="check" title="Nothing reported">When someone reports a chat message, it shows up here.</Empty> : (
        <ul className="review-list">{data.reports.map(r => (
          <li key={r.threadId + r.msgId} className="card">
            <p className="small muted">{r.threadTitle} · {new Date(r.message.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <blockquote className="quote">{r.message.text}</blockquote>
            <p className="small"><b>{r.message.byName}</b> · reported {r.message.reports.length}× ({r.message.reports.map(x => x.reason || 'no reason').join('; ')})</p>
            <div className="btn-row tight"><button className="btn small" onClick={() => act(r, 'hide')}><Icon name="eyeOff" size={16} />Hide message</button><button className="btn small secondary" onClick={() => act(r, 'keep')}>Keep it</button></div>
          </li>
        ))}</ul>
      )}
    </Section>
  );
}

// Leader tools → Groups: the troop's e-mail groups from TroopWebHost, as chat groups.
// "Board" groups get their own board in Chat for their members. "Ask" groups are
// for scouts to request something (board of review, Scoutmaster conference):
// the scout's request opens a conversation with the group plus the two-deep leaders.
export function Groups({ pass }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api('leader/members', { leader: pass }).then(setData).catch(() => setData({ members: [], groups: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p className="muted">Loading…</p>;
  const nameOf = id => data.members.find(m => m.id === id)?.name;
  const groups = [...(data.groups || [])].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'contact' ? -1 : 1));
  const current = open === 'new' ? { name: '', kind: 'board', members: [], description: '', emoji: '' } : groups.find(g => g.id === open);
  return (
    <>
      <p className="small muted mt">Your TroopWebHost e-mail groups, as Chat groups. Patrol groups use the patrol boards. The Scoutmaster and Committee Chair are part of every group conversation, except an all-adult group.</p>
      <div className="btn-row tight"><button className="btn small secondary" onClick={() => setOpen('new')}><Icon name="plus" size={16} />New group</button></div>
      {['contact', 'board'].map(kind => (
        <Section key={kind} title={kind === 'contact' ? 'Scouts ask a leader' : 'Group boards'}>
          <ul className="gear-list">{groups.filter(g => g.kind === kind).map(g => (
            <li key={g.id}><button className="gear-row group-row" onClick={() => setOpen(g.id)}>
              <span className="thread-emoji sm" aria-hidden="true">{g.emoji || '👥'}</span>
              <span className="grow"><b>{g.name}</b><span className="small muted">{g.members.length ? g.members.map(nameOf).filter(Boolean).slice(0, 4).join(', ') + (g.members.length > 4 ? ` +${g.members.length - 4} more` : '') : 'No members yet'}</span></span>
              <Pill tone={g.members.length ? 'good' : ''}>{g.members.length}</Pill>
            </button></li>
          ))}</ul>
        </Section>
      ))}
      <Sheet open={!!current} onClose={() => setOpen(null)} title={current?.id ? current.name : 'New group'} wide>
        {current && <GroupForm key={current.id || 'new'} g={current} members={data.members} pass={pass} onSaved={() => { setOpen(null); load(); }} />}
      </Sheet>
    </>
  );
}

function GroupForm({ g, members, pass, onSaved }) {
  const [f, setF] = useState({ name: g.name, kind: g.kind, description: g.description || '', emoji: g.emoji || '' });
  const [sel, setSel] = useState(g.members);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('in');
  const [msg, setMsg] = useState('');
  const people = members.filter(m => m.active !== false).sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
  const shown = people.filter(m => (who === 'in' ? sel.includes(m.id) : who === 'adults' ? m.role === 'adult' : who === 'scouts' ? m.role === 'scout' : true)).filter(m => !q || `${m.name} ${m.patrol} ${(m.positions || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  async function save() {
    setMsg('');
    try { await api(`leader/groups${g.id ? `/${g.id}` : ''}`, { method: 'POST', body: { ...f, members: sel }, leader: pass }); onSaved(); }
    catch (e) { setMsg(e.message); }
  }
  async function remove() {
    if (!confirm(`Delete the group ${g.name}? Past messages stay in the records.`)) return;
    await api(`leader/groups/${g.id}`, { method: 'DELETE', leader: pass }); onSaved();
  }
  return (
    <div>
      <div className="two-col">
        <label className="field"><span>Name</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span>Icon <i className="opt">emoji</i></span><input value={f.emoji} onChange={e => setF({ ...f, emoji: e.target.value })} maxLength={4} /></label>
      </div>
      <div className="field"><span>How it works</span><Seg value={f.kind} onChange={kind => setF({ ...f, kind })} options={[['board', 'Group board'], ['contact', 'Scouts ask']]} label="Group type" /></div>
      <p className="small muted">{f.kind === 'board' ? 'Members get a shared board in Chat.' : 'Scouts see this under "Ask a leader". Tapping it starts a conversation with these people and the two-deep leaders.'}</p>
      <label className="field"><span>Description <i className="opt">optional</i></span><input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
      <div className="field"><span>Members ({sel.length})</span></div>
      <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search names, patrols, positions" aria-label="Search people" /></div>
      <div className="chip-scroll">{[['in', 'In group'], ['all', 'Everyone'], ['adults', 'Adults'], ['scouts', 'Scouts']].map(([k, l]) => <button key={k} className={`chip ${who === k ? 'on' : ''}`} onClick={() => setWho(k)}>{l}</button>)}</div>
      <div className="pick-list group-pick">
        {shown.map(m => (
          <label key={m.id}><input type="checkbox" checked={sel.includes(m.id)} onChange={e => setSel(e.target.checked ? [...sel, m.id] : sel.filter(x => x !== m.id))} />
            <span className="grow">{m.name}<span className="small muted"> · {m.role === 'scout' ? m.patrol || 'Scout' : (m.positions || [])[0] || 'Adult'}</span></span></label>
        ))}
        {shown.length === 0 && <p className="small muted">{who === 'in' ? 'Nobody yet. Tap Everyone to add people.' : 'No matches.'}</p>}
      </div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="btn-row"><button className="btn" onClick={save}>Save group</button>{g.id && <button className="link-btn small danger" onClick={remove}><Icon name="trash" size={14} />Delete</button>}</div>
    </div>
  );
}

// Bulk parent ↔ scout linking. TroopWebHost doesn't say who belongs to whom,
// so suggest adults and scouts who share a last name and let a leader confirm.
function LinkFamilies({ members, pass, onDone }) {
  const active = members.filter(m => m.active !== false);
  const scouts = active.filter(m => m.role === 'scout');
  const fams = active.filter(m => m.role === 'adult').map(a => ({
    adult: a, linked: (a.scouts || []).map(id => scouts.find(x => x.id === id)).filter(Boolean),
    sugg: scouts.filter(x => x.last.toLowerCase() === a.last.toLowerCase() && !(a.scouts || []).includes(x.id)),
  })).filter(f => f.sugg.length).sort((x, y) => x.adult.last.localeCompare(y.adult.last) || x.adult.first.localeCompare(y.adult.first));
  const [on, setOn] = useState(() => new Set(fams.flatMap(f => f.sugg.map(x => `${f.adult.id}|${x.id}`))));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const unlinkedAdults = active.filter(m => m.role === 'adult' && !(m.scouts || []).length).length;
  const unlinkedScouts = scouts.filter(x => !active.some(a => (a.scouts || []).includes(x.id))).length;
  const flip = k => setOn(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  async function save() {
    setBusy(true); setMsg('');
    try {
      for (const f of fams) {
        const add = f.sugg.filter(x => on.has(`${f.adult.id}|${x.id}`)).map(x => x.id);
        if (add.length) await api(`leader/members/${f.adult.id}`, { method: 'POST', body: { scouts: [...(f.adult.scouts || []), ...add] }, leader: pass });
      }
      onDone();
    } catch (e) { setMsg(e.message); setBusy(false); }
  }
  if (!fams.length) return <Empty icon="check" title="No suggestions left">{unlinkedScouts ? `${unlinkedScouts} scouts still have no parent linked. Link them from each adult's page in Members.` : 'Every scout has a parent linked.'}</Empty>;
  return (
    <div>
      <p className="small">These adults and scouts share a last name. Check the ones that are really parent and child, then save. Families with different last names can be linked from each adult's page in Members.</p>
      <p className="small muted">{unlinkedScouts} scouts and {unlinkedAdults} adults aren't linked yet.</p>
      <ul className="fam-list">
        {fams.map(f => (
          <li key={f.adult.id} className="card">
            <p className="fam-adult"><b>{f.adult.name}</b>{f.linked.length > 0 && <span className="small muted"> · already linked to {f.linked.map(x => x.first).join(', ')}</span>}</p>
            <div className="chip-wrap">
              {f.sugg.map(x => { const k = `${f.adult.id}|${x.id}`; return (
                <button key={k} className={`chip ${on.has(k) ? 'on' : ''}`} aria-pressed={on.has(k)} onClick={() => flip(k)}>
                  <Icon name={on.has(k) ? 'check' : 'plus'} size={14} />{x.first}{x.patrol ? <span className="chip-sub">{x.patrol}</span> : null}
                </button>
              ); })}
            </div>
          </li>
        ))}
      </ul>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="sheet-foot"><button className="btn" onClick={save} disabled={busy || !on.size}>{busy ? 'Linking…' : `Link ${on.size} parent–scout pair${on.size === 1 ? '' : 's'}`}</button></div>
    </div>
  );
}
