import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useAccount } from '../lib/api.js';
import { go } from '../lib/router.js';

// Troop messaging built for Safeguarding Youth digital rules:
// the Scoutmaster and Committee Chair are part of every conversation,
// nobody can delete what they sent, and anyone can report a message.
export default function Messages() {
  const acct = useAccount();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [composing, setComposing] = useState(false);
  const load = () => api('threads').then(d => { setData(d); setError(null); }).catch(setError);
  useEffect(() => {
    if (!acct) return;
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    return () => clearInterval(id);
  }, [acct?.member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!acct) return (
    <div className="content"><PageHead title="Chat" />
      <Empty icon="message" title="Chat needs your personal code">Messages are tied to real troop members so two leaders can be included in every conversation. Ask a leader for your personal code or sign-in link, then sign in under More.</Empty>
    </div>
  );

  const boards = (data?.threads || []).filter(t => t.kind === 'board' || t.kind === 'patrol');
  const groups = (data?.threads || []).filter(t => t.kind === 'group');
  const ask = async g => {
    try { const r = await api('threads', { method: 'POST', body: { group: g.id } }); go(`thread/${r.thread.id}`); }
    catch (e) { alert(e.message); }
  };
  const dms = (data?.threads || []).filter(t => t.kind === 'dm');
  return (
    <div className="content">
      <PageHead title="Chat" sub="Patrol boards and messages for Troop 23.">
        <button className="btn small head-btn" onClick={() => setComposing(true)} disabled={!data}><Icon name="edit" size={16} />New</button>
      </PageHead>
      <TwoDeepBanner names={data?.guardians} />
      {error ? <Empty icon="alert" title="Chat isn't ready">{error.message}</Empty> : !data ? <p className="muted">Loading…</p> : (
        <>
          <h2 className="section-title sm">Boards</h2>
          <ul className="threads">{boards.map(t => <ThreadRow key={t.id} t={t} />)}</ul>
          {groups.length > 0 && <>
            <h2 className="section-title sm">Your groups</h2>
            <ul className="threads">{groups.map(t => <ThreadRow key={t.id} t={t} />)}</ul>
          </>}
          {data.ask?.length > 0 && acct.member.role === 'scout' && <>
            <h2 className="section-title sm">Ask a leader</h2>
            <ul className="threads ask-list">{data.ask.map(g => (
              <li key={g.id}><button className="thread-row" onClick={() => ask(g)}>
                <span className="thread-emoji" aria-hidden="true">{g.emoji}</span>
                <span className="grow"><span className="thread-title">{g.name}</span><span className="thread-last wrap">{g.description || `Goes to ${g.count} leaders`}</span></span>
                <Icon name="chevronR" size={18} />
              </button></li>
            ))}</ul>
          </>}
          <h2 className="section-title sm">Messages</h2>
          {dms.length === 0 ? <p className="muted small">No conversations yet. Tap New to message a patrol mate, a leader or a group.</p> : <ul className="threads">{dms.map(t => <ThreadRow key={t.id} t={t} />)}</ul>}
        </>
      )}
      <details className="card rules-card">
        <summary><Icon name="shield" size={18} /> How chat keeps everyone safe</summary>
        <ul>
          <li>The Scoutmaster and Committee Chair are added to every conversation. There are no private one-on-one chats between adults and scouts, or anyone else.</li>
          <li>Messages are kept. You can't delete what you send, so think before you post.</li>
          <li>Live the Scout Law: be kind, helpful and courteous.</li>
          <li>Don't share phone numbers, addresses, passwords or photos of other people here.</li>
          <li>See something wrong? Tap the ⋯ on the message and report it. Leaders will look at it.</li>
        </ul>
      </details>
      <NewConversation open={composing} me={acct.member} onClose={() => setComposing(false)} onStarted={id => { setComposing(false); go(`thread/${id}`); }} />
    </div>
  );
}

function TwoDeepBanner({ names }) {
  return (
    <div className="twodeep">
      <Icon name="shield" size={20} />
      <span><b>Two-deep in every chat.</b> {names?.length ? `${names[0]} (Scoutmaster) and ${names[1]} (Committee Chair) see all messages.` : 'The Scoutmaster and Committee Chair see all messages.'}</span>
    </div>
  );
}

function ThreadRow({ t }) {
  return (
    <li>
      <a className={`thread-row ${t.unread ? 'unread' : ''}`} href={`#/thread/${t.id}`}>
        <span className="thread-emoji" aria-hidden="true">{t.kind === 'dm' ? (t.title || '?').slice(0, 1) : t.emoji}</span>
        <span className="grow">
          <span className="thread-title">{t.title}</span>
          <span className="thread-last">{t.last ? `${t.last.byName}: ${t.last.text}` : t.kind === 'dm' ? 'No messages yet' : `${t.count} members`}</span>
        </span>
        <span className="thread-meta">{t.last && <span>{when(t.last.at)}</span>}{t.unread && <span className="dot-new" aria-label="Unread" />}</span>
      </a>
    </li>
  );
}

function NewConversation({ open, me, onClose, onStarted }) {
  const [members, setMembers] = useState(null);
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('patrol');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open && !members) api('members').then(d => setMembers(d.members)).catch(e => setMsg(e.message)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => (members || []).filter(m => m.id !== me.id)
    .filter(m => (q ? m.name.toLowerCase().includes(q.toLowerCase()) : filter === 'patrol' ? (me.patrol ? m.patrol === me.patrol : m.leader) : filter === 'scouts' ? m.role === 'scout' : filter === 'leaders' ? m.leader : true)), [members, q, filter, me]);
  async function start() {
    setMsg('');
    try { const r = await api('threads', { method: 'POST', body: { to: sel } }); setSel([]); onStarted(r.thread.id); }
    catch (e) { setMsg(e.message); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="New message">
      <p className="small muted">Pick one or more people. The Scoutmaster and Committee Chair are added automatically.</p>
      <input className="tag-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search names" aria-label="Search names" />
      {!q && <div className="chip-scroll">{[['patrol', me.patrol ? 'My patrol' : 'Leaders'], ['scouts', 'Scouts'], ['leaders', 'Leaders'], ['all', 'Everyone']].map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>}
      {!members ? <p className="muted">Loading…</p> : (
        <ul className="pick-list">{list.map(m => (
          <li key={m.id}><label className={sel.includes(m.id) ? 'on' : ''}><input type="checkbox" checked={sel.includes(m.id)} onChange={e => setSel(e.target.checked ? [...sel, m.id] : sel.filter(x => x !== m.id))} />
            <span className="grow"><b>{m.name}</b><span className="small muted">{m.role === 'scout' ? `Scout${m.patrol ? ` · ${m.patrol}` : ''}` : m.positions[0] || (m.leader ? 'Leader' : 'Parent')}</span></span></label></li>
        ))}</ul>
      )}
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      <div className="sheet-foot"><button className="btn big" disabled={!sel.length} onClick={start}>Start conversation{sel.length > 1 ? ` with ${sel.length}` : ''}</button></div>
    </Sheet>
  );
}

export function Thread({ route }) {
  const id = route.args[0];
  const acct = useAccount();
  const [t, setT] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [showPeople, setShowPeople] = useState(false);
  const lastAt = useRef(0);
  const endRef = useRef(null);

  const load = async (initial) => {
    try {
      const d = await api(`threads/${id}${initial ? '' : `?since=${lastAt.current}`}`);
      setT(d.thread); setPeople(d.people);
      if (d.messages.length) {
        lastAt.current = Math.max(lastAt.current, ...d.messages.map(m => m.at));
        setMsgs(prev => { const ids = new Set(prev.map(m => m.id)); return initial ? d.messages : [...prev, ...d.messages.filter(m => !ids.has(m.id))]; });
        dispatchEvent(new Event('threads-read'));
      }
    } catch (e) { setError(e); }
  };
  useEffect(() => {
    if (!acct) return;
    lastAt.current = 0; setMsgs([]); load(true);
    const iv = setInterval(() => document.visibilityState === 'visible' && load(false), 5000);
    return () => clearInterval(iv);
  }, [id, acct?.member?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api(`threads/${id}/msgs`, { method: 'POST', body: { text } }); setText(''); await load(false); }
    catch (err) { alert(err.message); } finally { setBusy(false); }
  }

  if (!acct) return <div className="content"><PageHead backTo="messages" /><Empty icon="message" title="Sign in with your personal code to use chat" /></div>;
  if (error) return <div className="content"><PageHead backTo="messages" /><Empty icon="alert" title="Can't open this conversation">{error.message}</Empty></div>;
  const guardians = people.filter(p => p.guardian);
  const me = acct.member.id;
  return (
    <div className="content thread-page">
      <PageHead backTo="messages" title={t ? <>{t.kind === 'dm' ? '' : `${t.emoji} `}{t.title}</> : '…'}>
        <button className="link-btn head-btn" onClick={() => setShowPeople(true)}><Icon name="users" size={16} />{people.length}</button>
      </PageHead>
      {t && !t.adultsOnly && (
        <div className="twodeep slim"><Icon name="shield" size={16} /><span>{guardians.map(g => g.name).join(' and ')} {guardians.length === 1 ? 'is' : 'are'} in this conversation.</span></div>
      )}
      <ol className="msgs">
        {msgs.length === 0 && t && <li className="muted small center pad-top">No messages yet. Say hi!</li>}
        {msgs.map((m, i) => {
          const mine = m.by === me;
          const showName = !mine && (i === 0 || msgs[i - 1].by !== m.by);
          return (
            <li key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
              {showName && <span className="msg-by">{m.byName}{people.find(p => p.id === m.by)?.guardian && <Pill tone="info">Leader</Pill>}</span>}
              <div className="msg-row">
                <div className={`bubble ${m.hidden || m.hiddenNote ? 'removed' : ''}`}>{m.hiddenNote ? 'Removed by a leader' : <>{m.hidden && <span className="removed-tag">Hidden from others · </span>}{m.text}</>}</div>
                {!mine && !m.hiddenNote && <button className="icon-btn sm msg-more" onClick={() => setReport(m)} aria-label="Report this message"><Icon name="more" size={18} /></button>}
              </div>
              <span className="msg-time">{when(m.at, true)}</span>
            </li>
          );
        })}
        <li ref={endRef} />
      </ol>
      <form className="composer" onSubmit={send}>
        <textarea rows={1} value={text} onChange={e => setText(e.target.value)} placeholder="Message" aria-label="Message" maxLength={2000}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(e); } }} />
        <button className="btn" disabled={busy || !text.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
      <Sheet open={showPeople} onClose={() => setShowPeople(false)} title="In this conversation">
        <ul className="pick-list">{people.map(p => <li key={p.id} className="person-row"><span className="grow"><b>{p.name}</b><span className="small muted">{p.role === 'scout' ? `Scout${p.patrol ? ` · ${p.patrol}` : ''}` : p.positions[0] || 'Adult'}</span></span>{p.guardian && <Pill tone="info">Two-deep</Pill>}</li>)}</ul>
      </Sheet>
      <ReportSheet m={report} threadId={id} onClose={() => setReport(null)} />
    </div>
  );
}

function ReportSheet({ m, threadId, onClose }) {
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { setReason(''); setDone(false); }, [m]);
  async function send() { await api(`threads/${threadId}/msgs/${m.id}/report`, { method: 'POST', body: { reason } }); setDone(true); }
  return (
    <Sheet open={!!m} onClose={onClose} title="Report this message">
      {m && (done ? <><p>Thanks. Leaders will review it. If someone is in danger, tell a leader or a parent right away.</p><button className="btn" onClick={onClose}>Close</button></> : <>
        <blockquote className="quote">{m.text}</blockquote>
        <div className="chip-wrap">{['Unkind or bullying', 'Inappropriate', 'Personal info shared', 'Something else'].map(r => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
        <div className="btn-row"><button className="btn" onClick={send}>Send report</button></div>
        <p className="small muted">The person who sent it won't see who reported it.</p>
      </>)}
    </Sheet>
  );
}

function when(t, withTime) {
  const d = new Date(t), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
