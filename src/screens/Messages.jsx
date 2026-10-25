import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet, Pill } from '../components/ui.jsx';
import { api, useAccount, sessionToken } from '../lib/api.js';
import { RichText, applyFormat } from '../lib/richtext.jsx';
import { SafeHtml } from '../lib/safehtml.jsx';
import LetterEditor from '../components/LetterEditor.jsx';
import { go } from '../lib/router.js';
import { NotifyNudge } from '../components/Notify.jsx';

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

  const replyList = (data?.threads || []).filter(t => t.needsReply);
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
      <NotifyNudge />
      <TwoDeepBanner names={data?.guardians} />
      {error ? <Empty icon="alert" title="Chat isn't ready">{error.message}</Empty> : !data ? <p className="muted">Loading…</p> : (
        <>
          {replyList.length > 0 && <>
            <h2 className="section-title sm reply-title"><Icon name="message" size={16} />Waiting on your reply</h2>
            <ul className="threads reply-threads">{replyList.map(t => <ThreadRow key={`r-${t.id}`} t={t} />)}</ul>
          </>}
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
      <a className={`thread-row ${t.unread ? 'unread' : ''} ${t.needsReply ? 'needs' : ''}`} href={`#/thread/${t.id}`}>
        <span className="thread-emoji" aria-hidden="true">{t.kind === 'dm' ? (t.title || '?').slice(0, 1) : t.emoji}</span>
        <span className="grow">
          <span className="thread-title">{t.title}{t.needsReply && <span className="reply-tag">Reply</span>}</span>
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
  const [files, setFiles] = useState([]);           // { key, name, kind, size, preview, data, type, w, h, status }
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const [report, setReport] = useState(null);
  const [showPeople, setShowPeople] = useState(false);
  const [coaching, setCoaching] = useState(false);   // false | { draft, apply }
  const [letter, setLetter] = useState(false);
  const [viewer, setViewer] = useState(null);       // { list, i }
  const [tools, setTools] = useState(false);
  const [aiOn, setAiOn] = useState(true);
  const taRef = useRef(null);
  const formRef = useRef(null);
  useEffect(() => {   // iPhone keyboard: keep the composer just above it
    const vv = window.visualViewport; if (!vv) return undefined;
    const fit = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${kb}px`);
    };
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); document.documentElement.style.setProperty('--kb', '0px'); };
  }, []);
  useEffect(() => {   // keep the last messages visible above the (growing) composer
    const el = formRef.current; if (!el || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--compose-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  });
  const photoRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => { api('settings').then(s => setAiOn(s.aiHelper !== false)).catch(() => {}); }, []);
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = 'auto';
    const max = Math.round(window.innerHeight * 0.45);
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden';
  }, [text]);
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

  async function addFiles(list, photos) {
    setSendErr('');
    const room = 10 - files.length;
    for (const f of [...list].slice(0, room)) {
      const key = `${Date.now()}-${Math.random()}`;
      try {
        const isImg = f.type.startsWith('image/') && !/gif/.test(f.type);
        const item = isImg ? await shrinkImage(f) : { name: f.name, type: f.type || guessType(f.name), size: f.size, kind: f.type.startsWith('image/') ? 'image' : 'file', data: await asDataURL(f) };
        if (item.size > ATT_MAX) { setSendErr(`${f.name} is too big (${fmtSize(item.size)}). Files can be up to 4 MB.`); continue; }
        setFiles(x => [...x, { ...item, key, preview: item.kind === 'image' ? item.data : null }]);
      } catch { setSendErr(`Couldn't read ${f.name}.`); }
    }
    if (list.length > room) setSendErr('Up to 10 attachments per message.');
    if (photos) photoRef.current.value = ''; else fileRef.current.value = '';
  }

  async function send(e, rich) {
    e?.preventDefault();
    const body = rich || { text };
    if (!(body.text || '').trim() && !files.length) return;
    setBusy(true); setSendErr('');
    try {
      const ids = [];
      for (const f of files) {
        setFiles(x => x.map(y => (y.key === f.key ? { ...y, status: 'up' } : y)));
        const r = await api(`threads/${id}/att`, { method: 'POST', body: { name: f.name, type: f.type, data: f.data, w: f.w, h: f.h } });
        ids.push(r.attachment.id);
        setFiles(x => x.map(y => (y.key === f.key ? { ...y, status: 'done' } : y)));
      }
      await api(`threads/${id}/msgs`, { method: 'POST', body: { ...body, attachments: ids } });
      if (rich) setLetter(false); else setText('');
      setFiles([]); await load(false); dispatchEvent(new Event('threads-read'));
    } catch (err) { setSendErr(err.message); setFiles(x => x.map(y => ({ ...y, status: undefined }))); } finally { setBusy(false); }
  }

  function fmt(kind) {
    const el = taRef.current; if (!el) return;
    const r = applyFormat(el, text, kind); if (!r) return;
    setText(r.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  }

  if (!acct) return <div className="content"><PageHead backTo="messages" /><Empty icon="message" title="Sign in with your personal code to use chat" /></div>;
  if (error) return <div className="content"><PageHead backTo="messages" /><Empty icon="alert" title="Can't open this conversation">{error.message}</Empty></div>;
  const guardians = people.filter(p => p.guardian);
  const me = acct.member.id;
  const attUrl = (a, dl) => `/api/threads/${id}/att/${a.id}?s=${sessionToken()}${dl ? '&dl=1' : ''}`;
  const last = [...msgs].reverse().find(m => !m.hiddenNote);
  return (
    <div className="chat-full">
      <header className="chat-top">
        <button className="icon-btn" onClick={() => go('messages')} aria-label="Back to Chat"><Icon name="chevronL" size={24} /></button>
        <span className="chat-top-title"><b>{t ? <>{t.kind === 'dm' ? '' : `${t.emoji} `}{t.title}</> : '…'}</b>
          {t && <span>{t.adultsOnly ? 'Adults only' : `Two-deep: ${guardians.map(g => g.name.split(' ')[0]).join(' & ')} included`}</span>}</span>
        <button className="link-btn chat-people" onClick={() => setShowPeople(true)} aria-label={`${people.length} people in this conversation`}><Icon name="users" size={18} />{people.length}</button>
      </header>
      <ol className="msgs">
        {msgs.length === 0 && t && <li className="muted small center pad-top">No messages yet. Say hi!</li>}
        {msgs.map((m, i) => {
          const mine = m.by === me;
          const showName = !mine && (i === 0 || msgs[i - 1].by !== m.by);
          const day = new Date(m.at).toDateString() !== (i ? new Date(msgs[i - 1].at).toDateString() : '');
          const imgs = (m.attachments || []).filter(a => a.kind === 'image'), docs = (m.attachments || []).filter(a => a.kind !== 'image');
          return (
            <li key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
              {day && <span className="msg-day">{new Date(m.at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>}
              {showName && <span className="msg-by">{m.byName}{people.find(p => p.id === m.by)?.guardian && <Pill tone="info">Leader</Pill>}</span>}
              <div className="msg-row">
                <div className={`bubble ${m.hidden || m.hiddenNote ? 'removed' : ''} ${imgs.length && !m.text ? 'pics-only' : ''} ${m.html || m.subject ? 'letter-bubble' : ''}`}>
                  {m.hiddenNote ? 'Removed by a leader' : <>
                    {m.hidden && <span className="removed-tag">Hidden from others · </span>}
                    {m.subject && <p className="letter-subj">{m.subject}</p>}
                    {imgs.length > 0 && <div className={`msg-pics n${Math.min(imgs.length, 4)}`}>{imgs.slice(0, 4).map((a, k) => (
                      <button key={a.id} onClick={() => setViewer({ list: imgs, i: k })} aria-label={`Open photo ${k + 1} of ${imgs.length}`}>
                        <img src={attUrl(a)} alt="" loading="lazy" />{k === 3 && imgs.length > 4 && <span className="more-pics">+{imgs.length - 4}</span>}
                      </button>))}</div>}
                    {docs.length > 0 && <div className="msg-files">{docs.map(a => (
                      <a key={a.id} className="file-chip" href={attUrl(a, true)} download={a.name}><Icon name={fileIcon(a.name)} size={18} /><span className="grow"><b>{a.name}</b><span>{fmtSize(a.size)}</span></span><Icon name="download" size={16} /></a>
                    ))}</div>}
                    {m.html ? <SafeHtml html={m.html} /> : m.text && <RichText text={m.text} />}
                  </>}
                </div>
                {!mine && !m.hiddenNote && <button className="icon-btn sm msg-more" onClick={() => setReport(m)} aria-label="Report this message"><Icon name="more" size={18} /></button>}
              </div>
              <span className="msg-time">{when(m.at, true)}</span>
            </li>
          );
        })}
        <li ref={endRef} />
      </ol>
      {last && last.by !== me && !text && !files.length && (
        <div className="reply-nudge"><Icon name="message" size={16} /><span className="grow"><b>{last.byName.split(' ')[0]}</b> is waiting on your reply.</span>{aiOn && <button className="link-btn small" onClick={() => setCoaching({ draft: text, apply: v => setText(v) })}><Icon name="sparkle" size={15} />Help me reply</button>}</div>
      )}
      <form ref={formRef} className="composer2" onSubmit={send}>
        {files.length > 0 && (
          <div className="att-tray">{files.map(f => (
            <div key={f.key} className={`att-item ${f.status || ''}`}>
              {f.preview ? <img src={f.preview} alt="" /> : <span className="att-doc"><Icon name={fileIcon(f.name)} size={20} /><span>{f.name}</span></span>}
              {!busy && <button type="button" className="att-x" onClick={() => setFiles(x => x.filter(y => y.key !== f.key))} aria-label={`Remove ${f.name}`}><Icon name="x" size={12} /></button>}
            </div>
          ))}</div>
        )}
        {tools && (
          <div className="fmt-bar" role="toolbar" aria-label="Formatting">
            <button type="button" onClick={() => fmt('bold')} aria-label="Bold"><b>B</b></button>
            <button type="button" onClick={() => fmt('italic')} aria-label="Italic"><i>I</i></button>
            <button type="button" onClick={() => fmt('strike')} aria-label="Strikethrough"><s>S</s></button>
            <button type="button" onClick={() => fmt('ul')} aria-label="Bulleted list"><Icon name="checklist" size={18} /></button>
            <button type="button" onClick={() => fmt('ol')} aria-label="Numbered list">1.</button>
            <button type="button" onClick={() => fmt('link')} aria-label="Add a link"><Icon name="external" size={17} /></button>
          </div>
        )}
        <div className="compose-tools">
          <button type="button" className={`icon-btn sm ${tools ? 'on' : ''}`} onClick={() => setTools(v => !v)} aria-label="Formatting" aria-pressed={tools}><span className="aa">Aa</span></button>
          <button type="button" className="icon-btn sm photo-btn" onClick={() => photoRef.current.click()} aria-label="Add photos"><Icon name="image" size={19} /><span className="tool-l">Photos</span></button>
          <button type="button" className="icon-btn sm file-btn" onClick={() => fileRef.current.click()} aria-label="Attach files"><Icon name="paperclip" size={19} /><span className="tool-l">Files</span></button>
          {t?.kind === 'dm' && <button type="button" className="icon-btn sm letter-btn" onClick={() => setLetter(true)} aria-label="Write a full message"><Icon name="edit" size={18} /><span className="tool-l">Full message</span></button>}
          {aiOn && <button type="button" className="icon-btn sm coach-btn" onClick={() => setCoaching({ draft: text, apply: v => setText(v) })} aria-label="Writing helper: check or improve my message"><Icon name="sparkle" size={19} /><span className="tool-l">Help me write</span></button>}
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={e => addFiles(e.target.files, true)} />
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,image/*" multiple hidden onChange={e => addFiles(e.target.files, false)} />
        </div>
        <div className="compose-row">
          <textarea ref={taRef} rows={t?.kind === 'dm' ? 3 : 1} className={t?.kind === 'dm' ? 'tall' : ''} value={text} onChange={e => setText(e.target.value)} placeholder="Message" aria-label="Message" maxLength={4000}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(e); } }} />
          <button className="btn send-btn" disabled={busy || (!text.trim() && !files.length)} aria-label="Send">{busy ? <span className="spinner sm" aria-hidden="true" /> : <Icon name="send" size={18} />}</button>
        </div>
        {sendErr && <p className="form-msg compose-err" role="alert">{sendErr}</p>}
      </form>
      <Sheet open={showPeople} onClose={() => setShowPeople(false)} title="In this conversation">
        <ul className="pick-list">{people.map(p => <li key={p.id} className="person-row"><span className="grow"><b>{p.name}</b><span className="small muted">{p.role === 'scout' ? `Scout${p.patrol ? ` · ${p.patrol}` : ''}` : p.positions[0] || 'Adult'}</span></span>{p.guardian && <Pill tone="info">Two-deep</Pill>}</li>)}</ul>
      </Sheet>
      <ReportSheet m={report} threadId={id} onClose={() => setReport(null)} />
      {letter && (
        <LetterEditor title={t?.title || ''} initialText={text} busy={busy} error={sendErr}
          attachTray={files.length > 0 ? <div className="att-tray letter-tray">{files.map(f => (
            <div key={f.key} className={`att-item ${f.status || ''}`}>
              {f.preview ? <img src={f.preview} alt="" /> : <span className="att-doc"><Icon name={fileIcon(f.name)} size={20} /><span>{f.name}</span></span>}
              {!busy && <button type="button" className="att-x" onClick={() => setFiles(x => x.filter(y => y.key !== f.key))} aria-label={`Remove ${f.name}`}><Icon name="x" size={12} /></button>}
            </div>))}</div> : null}
          onAddPhotos={() => photoRef.current.click()} onAddFiles={() => fileRef.current.click()}
          onHelp={aiOn ? (draft, apply) => setCoaching({ draft, apply }) : null}
          onSend={payload => send(null, payload)} onClose={() => setLetter(false)} />
      )}
      {coaching && <CoachSheet threadId={id} draft={coaching.draft} onClose={() => setCoaching(false)} onUse={v => { coaching.apply(v); setCoaching(false); }} />}
      {viewer && <PicViewer list={viewer.list} start={viewer.i} url={a => attUrl(a)} dl={a => attUrl(a, true)} onClose={() => setViewer(null)} />}
    </div>
  );
}

const ATT_MAX = 4 * 1024 * 1024;
const fmtSize = n => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fileIcon = n => (/\.pdf$/i.test(n) ? 'file' : /\.(xlsx?|csv|ods)$/i.test(n) ? 'grid' : /\.(pptx?|odp)$/i.test(n) ? 'play' : 'file');
const guessType = n => ({ pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', rtf: 'application/rtf' }[(n.split('.').pop() || '').toLowerCase()] || 'application/octet-stream');
const asDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
// Photos are resized on the phone (and their location data dropped) before upload.
async function shrinkImage(f) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.82);
    return { name: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', kind: 'image', data, size: Math.round((data.length - 23) * 0.75), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

function PicViewer({ list, start, url, dl, onClose }) {
  const [i, setI] = useState(start);
  const touch = useRef(null);
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1)); if (e.key === 'ArrowRight') setI(x => Math.min(list.length - 1, x + 1)); };
    addEventListener('keydown', key); document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', key); document.body.classList.remove('no-scroll'); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const a = list[i];
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo"
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) setI(x => Math.min(list.length - 1, Math.max(0, x + (dx > 0 ? -1 : 1)))); }}>
      <div className="lb-top"><span className="lb-count">{i + 1} / {list.length}</span><span className="grow" /><a className="icon-btn on-dark" href={dl(a)} download={a.name} aria-label="Save photo"><Icon name="download" /></a><button className="icon-btn on-dark" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
      <div className="lb-stage">
        <img key={a.id} src={url(a)} alt="" />
        {i > 0 && <button className="lb-nav left" onClick={() => setI(i - 1)} aria-label="Previous photo"><Icon name="chevronL" size={28} /></button>}
        {i < list.length - 1 && <button className="lb-nav right" onClick={() => setI(i + 1)} aria-label="Next photo"><Icon name="chevronR" size={28} /></button>}
      </div>
    </div>
  );
}

// Writing helper: suggests a clearer, kinder, complete message and points out
// anything the other person asked about that the draft doesn't answer yet.
// It never sends anything. The member edits and presses Send.
function CoachSheet({ threadId, draft, onClose, onUse }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState('');
  useEffect(() => {
    api('ai/coach', { method: 'POST', body: { threadId, draft } })
      .then(d => { setR(d); setEdit(d.message || draft); })
      .catch(e => setErr(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open onClose={onClose} title={draft.trim() ? 'Check my message' : 'Help me reply'}>
      {err ? <p className="form-msg" role="alert">{err}</p> : !r ? (
        <div className="coach-wait"><span className="spinner" aria-hidden="true" /><p>Reading the conversation…</p></div>
      ) : (
        <div className="coach">
          {r.source === 'ai' ? (
            <>
              <label className="field"><span>Suggested message <i className="opt">edit anything</i></span>
                <textarea rows={5} value={edit} onChange={e => setEdit(e.target.value)} /></label>
              {/\[[^\]]+\]/.test(edit) && <p className="small coach-fill"><Icon name="edit" size={14} /> Fill in the parts in [brackets] before you send.</p>}
            </>
          ) : <p className="small muted">Here are a few things to check before you send.</p>}
          {r.missing?.length > 0 && (
            <div className="coach-box missing"><b>Did you answer…</b><ul>{r.missing.map(x => <li key={x}>{x}</li>)}</ul></div>
          )}
          {r.tips?.length > 0 && (
            <div className="coach-box tips"><b>Tips</b><ul>{r.tips.map(x => <li key={x}>{x}</li>)}</ul></div>
          )}
          {r.source === 'ai' && !r.missing?.length && !r.tips?.length && <p className="small good-text"><Icon name="check" size={14} /> Looks complete.</p>}
          <div className="btn-row">
            {r.source === 'ai' && <button className="btn" disabled={!edit.trim()} onClick={() => onUse(edit)}><Icon name="check" size={16} />Use this</button>}
            <button className="btn secondary" onClick={onClose}>{draft.trim() ? 'Keep mine' : 'Close'}</button>
          </div>
          <p className="tiny muted">{r.source === 'ai' ? 'Suggestions come from an AI helper and can be wrong. Read it over: you\'re the one sending it. Your leaders still see every message.' : 'The smart helper isn\'t available right now, so these are built-in writing tips.'}</p>
        </div>
      )}
    </Sheet>
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
