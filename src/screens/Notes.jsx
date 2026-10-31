import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Seg, Pill } from '../components/ui.jsx';
import { api, useAccount, useApi, sessionToken, leaderPass } from '../lib/api.js';
import { go } from '../lib/router.js';
import { RichText, applyFormat } from '../lib/richtext.jsx';
import { shrinkImage, guessType, asDataURL, fileIcon, PicViewer } from './Messages.jsx';

// Meeting notes: PLC notes (scouts and leaders) and committee minutes (leaders only),
// each with photos and files (agendas, treasurer's reports, whiteboard pictures…).

const BOOKS = { plc: { label: 'PLC notes', short: 'PLC', title: 'PLC meeting', emoji: '🧭' }, committee: { label: 'Committee minutes', short: 'Committee', title: 'Committee meeting', emoji: '📋' } };
const TEMPLATES = {
  plc: '**Patrol reports**\n- \n\n**Upcoming outings**\n- \n\n**Planning and decisions**\n- \n\n**Action items**\n- Who: what, by when\n\n**Next meeting:** ',
  committee: '**Call to order:** \n\n**Approval of last minutes:** \n\n**Treasurer\'s report**\n- \n\n**Advancement**\n- \n\n**Outings and program**\n- \n\n**Fundraising**\n- \n\n**Old business**\n- \n\n**New business**\n- \n\n**Action items**\n- Who: what, by when\n\n**Adjourned:** ',
};
const nice = d => new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const fileUrl = (book, id, f, dl) => `/api/notes/${book}/${id}/files/${f.id}?${sessionToken() ? `s=${sessionToken()}` : `lk=${encodeURIComponent(leaderPass())}`}${dl ? '&dl=1' : ''}`;
const size = b => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Notes({ route }) {
  const [book, id] = route.args;
  if (book && id === 'new') return <Editor book={book} />;
  if (book && id && route.args[2] === 'edit') return <Editor book={book} id={id} />;
  if (book && id) return <Note book={book} id={id} />;
  return <Hub book={route.query.book} />;
}

function Hub({ book: want }) {
  const acct = useAccount();
  const acc = useApi(acct ? 'notes' : null);
  const a = acc.data?.access;
  const books = a ? Object.keys(BOOKS).filter(b => a[b].read) : [];
  const book = books.includes(want) ? want : books[0];
  const list = useApi(book ? `notes/${book}` : null);
  const [q, setQ] = useState('');
  if (!acct) return <div className="content"><PageHead backTo="more" title="Meeting notes" /><Empty icon="lock" title="Sign in with your personal code">PLC notes are for scouts and leaders, so they need your own code.</Empty></div>;
  if (a && !books.length) return <div className="content"><PageHead backTo="more" title="Meeting notes" /><Empty icon="lock" title="Meeting notes are for scouts and leaders">Ask a leader if you need something from a meeting.</Empty></div>;
  const notes = (list.data?.notes || []).filter(n => !q || `${n.title} ${n.excerpt} ${n.date}`.toLowerCase().includes(q.toLowerCase()));
  const years = [...new Set(notes.map(n => n.date.slice(0, 4)))];
  return (
    <div className="content notes">
      <PageHead backTo="more" title="Meeting notes" sub={book === 'committee' ? 'Committee minutes. Only leaders can see these.' : 'What the Patrol Leaders\' Council planned and decided.'}>
        {list.data?.canWrite && <a className="btn small head-btn" href={`#/notes/${book}/new`}><Icon name="plus" size={16} />New</a>}
      </PageHead>
      {books.length > 1 && <Seg value={book} onChange={b => go(`notes?book=${b}`, { replace: true })} label="Notebook" options={books.map(b => [b, BOOKS[b].label])} />}
      {book && (
        <>
          <div className="search-row mt"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${BOOKS[book].label}`} aria-label="Search notes" /></div>
          {!list.data ? <p className="muted mt">Loading…</p> : notes.length === 0 ? (
            <Empty icon="file" title={q ? 'Nothing matches' : `No ${BOOKS[book].label.toLowerCase()} yet`}>{q ? 'Try another word.' : list.data.canWrite ? 'Tap New after your next meeting. You can start from a template and add photos or files.' : 'Notes show up here after each meeting.'}</Empty>
          ) : years.map(y => (
            <Section key={y} title={y}>
              <ul className="note-list">{notes.filter(n => n.date.startsWith(y)).map(n => (
                <li key={n.id}><a href={`#/notes/${book}/${n.id}`}>
                  <span className="note-date"><b>{new Date(`${n.date}T12:00:00`).toLocaleDateString([], { month: 'short' })}</b>{+n.date.slice(8)}</span>
                  <span className="grow"><span className="note-title"><b>{n.title}</b>{book === 'committee' && (n.status === 'approved' ? <Pill tone="good">Approved</Pill> : <Pill tone="warn">Draft</Pill>)}</span>
                    <span className="small muted note-ex">{n.excerpt || 'No notes written yet.'}</span>
                    {(n.photos > 0 || n.files > 0) && <span className="note-att">{n.photos > 0 && <span>📷 {n.photos}</span>}{n.files > 0 && <span>📎 {n.files}</span>}</span>}</span>
                  <Icon name="chevronR" size={18} />
                </a></li>
              ))}</ul>
            </Section>
          ))}
        </>
      )}
    </div>
  );
}

function Note({ book, id }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState(null);
  const load = () => api(`notes/${book}/${id}`).then(setD).catch(e => setError(e.message));
  useEffect(() => { load(); }, [book, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <div className="content"><PageHead backTo="notes" title="Meeting notes" /><Empty icon="lock" title="Can't open these notes">{error}</Empty></div>;
  if (!d) return <div className="content"><PageHead backTo="notes" title="Meeting notes" /><p className="muted">Loading…</p></div>;
  const n = d.note;
  const pics = n.files.filter(f => f.kind === 'image'), docs = n.files.filter(f => f.kind !== 'image');
  const approve = async ok => { try { const r = await api(`notes/${book}/${id}/approve`, { method: 'POST', body: { approved: ok } }); setD(x => ({ ...x, note: r.note })); } catch (e) { alert(e.message); } };
  return (
    <div className="content notes">
      <PageHead backTo={`notes?book=${book}`} eyebrow={`${BOOKS[book].emoji} ${BOOKS[book].label}`} title={n.title} sub={nice(n.date)}>
        {d.canEdit && n.status !== 'approved' && <a className="btn small secondary head-btn" href={`#/notes/${book}/${id}/edit`}><Icon name="edit" size={15} />Edit</a>}
      </PageHead>
      {book === 'committee' && (
        <div className={`note-status ${n.status}`}>
          {n.status === 'approved' ? <><Icon name="check" size={18} /><span className="grow"><b>Approved</b> {n.approvedOn ? `on ${nice(n.approvedOn)}` : ''} · marked by {n.approvedBy}</span>{d.canApprove && <button className="link-btn small" onClick={() => confirm('Mark these minutes as a draft so they can be changed?') && approve(false)}>Mark as draft</button>}</>
            : <><Icon name="edit" size={18} /><span className="grow"><b>Draft</b> · waiting for the committee to approve</span>{d.canApprove && <button className="btn small" onClick={() => approve(true)}>Mark approved</button>}</>}
        </div>
      )}
      {n.attendees && <p className="note-who"><b>Present:</b> {n.attendees}</p>}
      <div className="note-body card">{n.body ? <RichText text={n.body} /> : <p className="muted">No notes written yet.</p>}</div>
      {pics.length > 0 && (
        <Section title={`Photos · ${pics.length}`}>
          <div className="note-pics">{pics.map((f, i) => <button key={f.id} type="button" onClick={() => setViewer(i)} aria-label={`Open ${f.name}`}><img src={fileUrl(book, id, f)} alt={f.name} loading="lazy" /></button>)}</div>
        </Section>
      )}
      {docs.length > 0 && (
        <Section title={`Files · ${docs.length}`}>
          <ul className="note-files">{docs.map(f => <li key={f.id}><a href={fileUrl(book, id, f, true)} download={f.name}><Icon name={fileIcon(f.name)} size={20} /><span className="grow"><b>{f.name}</b><span className="small muted">{size(f.size)} · added by {f.by}</span></span><Icon name="download" size={18} /></a></li>)}</ul>
        </Section>
      )}
      <p className="small muted">Written by {n.byName}{n.updatedBy && n.updated > n.created + 60000 ? ` · last changed by ${n.updatedBy}` : ''}.</p>
      {d.canEdit && (n.status !== 'approved') && <div className="btn-row"><button className="link-btn small" onClick={async () => { if (confirm('Delete these notes and their files?')) { await api(`notes/${book}/${id}`, { method: 'DELETE' }); go(`notes?book=${book}`, { replace: true }); } }}><Icon name="trash" size={15} />Delete notes</button></div>}
      {viewer != null && <PicViewer list={pics} start={viewer} url={f => fileUrl(book, id, f)} dl={f => fileUrl(book, id, f, true)} onClose={() => setViewer(null)} />}
    </div>
  );
}

function Editor({ book, id }) {
  const [f, setF] = useState(null);
  const [files, setFiles] = useState([]);       // already saved
  const [pending, setPending] = useState([]);   // picked, not uploaded yet
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ta = useRef(null), photoRef = useRef(null), fileRef = useRef(null);
  useEffect(() => {
    if (!id) { setF({ title: BOOKS[book].title, date: today(), attendees: '', body: '' }); return; }
    api(`notes/${book}/${id}`).then(d => { setF({ title: d.note.title, date: d.note.date, attendees: d.note.attendees, body: d.note.body }); setFiles(d.note.files); }).catch(e => setMsg(e.message));
  }, [book, id]);
  if (!BOOKS[book]) return null;
  if (!f) return <div className="content"><PageHead backTo="notes" title="Meeting notes" />{msg ? <p className="form-msg">{msg}</p> : <p className="muted">Loading…</p>}</div>;
  const fmt = kind => { const el = ta.current; if (!el) return; const r = applyFormat(el, f.body, kind); setF({ ...f, body: r.value }); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); }); };
  async function pick(list) {
    const out = [];
    for (const file of [...list].slice(0, 30)) {
      const isImg = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);
      try { out.push({ key: `${file.name}-${file.size}-${Math.random()}`, ...(isImg ? await shrinkImage(file) : { name: file.name, type: file.type || guessType(file.name), size: file.size, kind: 'file', data: await asDataURL(file) }) }); } catch { setMsg(`Couldn't read ${file.name}.`); }
    }
    setPending(p => [...p, ...out]);
    if (photoRef.current) photoRef.current.value = ''; if (fileRef.current) fileRef.current.value = '';
  }
  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = id ? await api(`notes/${book}/${id}`, { method: 'PUT', body: f }) : await api(`notes/${book}`, { method: 'POST', body: f });
      const nid = r.note.id;
      for (const p of pending) {
        setPending(x => x.map(y => (y.key === p.key ? { ...y, status: 'up' } : y)));
        await api(`notes/${book}/${nid}/files`, { method: 'POST', body: { name: p.name, type: p.type, data: p.data, w: p.w, h: p.h } });
        setPending(x => x.filter(y => y.key !== p.key));
      }
      go(`notes/${book}/${nid}`, { replace: true });
    } catch (e) { setMsg(e.message); setBusy(false); }
  }
  const removeSaved = async file => { if (!confirm(`Remove ${file.name}?`)) return; try { const r = await api(`notes/${book}/${id}/files/${file.id}`, { method: 'DELETE' }); setFiles(r.note.files); } catch (e) { setMsg(e.message); } };
  return (
    <div className="content notes">
      <PageHead backTo={id ? `notes/${book}/${id}` : `notes?book=${book}`} eyebrow={BOOKS[book].label} title={id ? 'Edit notes' : 'New notes'} />
      <div className="card">
        <div className="row2">
          <label className="field"><span>Meeting</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
          <label className="field"><span>Date</span><input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
        </div>
        <label className="field"><span>Who was there <i className="opt">optional</i></span><input value={f.attendees} onChange={e => setF({ ...f, attendees: e.target.value })} placeholder={book === 'plc' ? 'SPL, ASPL, patrol leaders…' : 'Committee members present'} /></label>
        <div className="field">
          <div className="note-label-row"><span className="field-label">Notes</span>{!f.body.trim() && <button type="button" className="link-btn small" onClick={() => setF({ ...f, body: TEMPLATES[book] })}><Icon name="list" size={15} />Start from the {BOOKS[book].short} template</button>}</div>
          <div className="fmt-bar" role="toolbar" aria-label="Formatting">
            <button type="button" onClick={() => fmt('bold')} aria-label="Bold"><b>B</b></button>
            <button type="button" onClick={() => fmt('italic')} aria-label="Italic"><i>I</i></button>
            <button type="button" onClick={() => fmt('ul')} aria-label="Bulleted list"><Icon name="checklist" size={18} /></button>
            <button type="button" onClick={() => fmt('ol')} aria-label="Numbered list">1.</button>
            <button type="button" onClick={() => fmt('link')} aria-label="Add a link"><Icon name="external" size={17} /></button>
          </div>
          <textarea ref={ta} className="note-ta" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} placeholder="What was discussed and decided…" />
        </div>
        <p className="field-label">Photos and files</p>
        <div className="note-tray">
          {files.map(x => <div key={x.id} className="att-item">{x.kind === 'image' ? <img src={fileUrl(book, id, x)} alt="" /> : <span className="att-doc"><Icon name={fileIcon(x.name)} size={20} /><span>{x.name}</span></span>}<button type="button" className="att-x" onClick={() => removeSaved(x)} aria-label={`Remove ${x.name}`}><Icon name="x" size={12} /></button></div>)}
          {pending.map(x => <div key={x.key} className={`att-item ${x.status || ''}`}>{x.kind === 'image' ? <img src={x.data} alt="" /> : <span className="att-doc"><Icon name={fileIcon(x.name)} size={20} /><span>{x.name}</span></span>}{!busy && <button type="button" className="att-x" onClick={() => setPending(p => p.filter(y => y.key !== x.key))} aria-label={`Remove ${x.name}`}><Icon name="x" size={12} /></button>}</div>)}
        </div>
        <div className="btn-row tight">
          <button type="button" className="btn small secondary" onClick={() => photoRef.current?.click()}><Icon name="camera" size={16} />Add photos</button>
          <button type="button" className="btn small secondary" onClick={() => fileRef.current?.click()}><Icon name="paperclip" size={16} />Add files</button>
        </div>
        <p className="small muted">Whiteboard pictures, agendas, budgets, sign-up sheets. Photos, PDF, Word, Excel, PowerPoint and text files up to 4 MB each.</p>
        <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={e => pick(e.target.files)} />
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,image/*" multiple hidden onChange={e => pick(e.target.files)} />
      </div>
      {f.body.trim() && <Section title="Preview"><div className="note-body card"><RichText text={f.body} /></div></Section>}
      {book === 'committee' && <p className="small muted">New minutes are saved as a Draft. After the committee approves them, a leader taps Mark approved.</p>}
      {msg && <p className="form-msg">{msg}</p>}
      <div className="play-next"><button className="btn big accent" onClick={save} disabled={busy || !f.title.trim()}>{busy ? (pending.length ? `Uploading ${pending.length} file${pending.length > 1 ? 's' : ''}…` : 'Saving…') : 'Save notes'}</button></div>
    </div>
  );
}
