import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section, Empty, Sheet } from '../components/ui.jsx';
import TagPicker from '../components/TagPicker.jsx';
import { api, leaderPhotoUrl, setLeaderPass, leaderPass, useCol, saveDoc, deleteDoc, useAccount, usePatrols } from '../lib/api.js';
import { Members, Reports, Groups } from './LeaderMembers.jsx';
import { troop, level, rid } from '../lib/config.js';
import { useMe } from '../lib/store.js';

// Leader tools (#/leaders): photo review against family permission, the
// permission roster, bulletin posts, patrols & albums, and records.
// Signing in here also turns on leader mode across the app (add/edit
// outings, delete gear and recipes).
const TABS = [['members', 'Members', 'users'], ['groups', 'Groups', 'message'], ['reports', 'Chat reports', 'alert'], ['review', 'Photos', 'image'], ['roster', 'Permission', 'shield'], ['bulletin', 'Bulletin', 'megaphone'], ['settings', 'Settings', 'settings'], ['data', 'Records', 'download']];

const FLAG = {
  blocked: { cls: 'bad', icon: 'eyeOff', title: 'Has a "No photos" scout', body: 'Hide or delete this photo.' },
  untagged: { cls: 'warn', icon: 'alert', title: 'No scouts tagged', body: 'Check faces against the No-photos list, then tag who\'s in it.' },
  troop: { cls: 'info', icon: 'lock', title: 'Troop only', body: 'OK for the private gallery. Not for public pages.' },
  public: { cls: 'good', icon: 'globe', title: 'Public OK', body: 'Every tagged scout has public permission.' },
};

export default function Leaders() {
  const acct = useAccount();
  const [pass, setPass] = useState(leaderPass());
  const [ok, setOk] = useState(!!acct?.member?.leader);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('members');
  useEffect(() => { if (acct?.member?.leader) setOk(true); }, [acct?.member?.leader]);

  async function login(p = pass) {
    setErr('');
    try { await api('leader/check', { method: 'POST', body: {}, leader: p }); setLeaderPass(p); setOk(true); }
    catch (e) { setOk(false); setErr(e.message); setLeaderPass(''); }
  }
  useEffect(() => { if (pass) login(pass); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ok) return (
    <div className="content"><PageHead backTo="more" title="Leader tools" sub={`For ${troop.unit} leaders. Leaders who sign in with their personal code get in automatically. Otherwise, enter the leader passcode.`} />
      <form className="card narrow" onSubmit={e => { e.preventDefault(); login(pass.trim()); }}>
        <label className="field"><span>Leader passcode</span><input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
        {err && <p className="form-msg" role="alert">{err}</p>}
        <button className="btn">Sign in</button>
      </form>
    </div>
  );

  return (
    <div className="content wide">
      <PageHead backTo="more" title="Leader tools">
        {!acct?.member?.leader && <button className="link-btn head-btn" onClick={() => { setLeaderPass(''); setOk(false); setPass(''); }}><Icon name="logout" size={16} /> Sign out</button>}
      </PageHead>
      <div className="tabs scroll" role="tablist">
        {TABS.map(([id, l, ic]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon name={ic} size={17} />{l}</button>)}
      </div>
      {tab === 'members' && <Members pass={pass} />}
      {tab === 'groups' && <Groups pass={pass} />}
      {tab === 'reports' && <Reports pass={pass} />}
      {tab === 'review' && <Review pass={pass} />}
      {tab === 'roster' && <Roster pass={pass} />}
      {tab === 'bulletin' && <Bulletin />}
      {tab === 'settings' && <Settings pass={pass} />}
      {tab === 'data' && <Records pass={pass} />}
    </div>
  );
}

function useLeader(path, pass) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api(path, { leader: pass }).then(d => { setData(d); setError(null); }).catch(setError);
  useEffect(() => { load(); }, [path, pass]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, load };
}

function Review({ pass }) {
  const photos = useLeader('leader/photos', pass);
  const stats = useLeader('leader/stats', pass);
  const roster = useLeader('leader/permissions', pass);
  const albums = useLeader('leader/albums', pass);
  const [filter, setFilter] = useState('pending');
  const [tagging, setTagging] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState('');
  const scouts = (roster.data?.families || []).flatMap(f => f.scouts.map(s => ({ id: s.id, name: `${s.first}${s.lastInitial ? ` ${s.lastInitial}.` : ''}`, patrol: s.patrol, level: s.level })));
  const list = (photos.data?.photos || []).filter(p => filter === 'all' || p.status === filter);
  const count = s => (photos.data?.photos || []).filter(p => p.status === s).length;
  const albumList = albums.data?.albums || troop.albums;

  async function update(id, body) {
    setMsg('');
    if (body.status === 'deleted' && !confirm('Delete this photo for good?')) return;
    try { await api(`leader/photos/${id}`, { method: 'POST', body, leader: pass }); photos.load(); stats.load(); }
    catch (e) { setMsg(e.message); }
  }

  const s = stats.data;
  return (
    <>
      {s && (
        <div className="stat-row four">
          <div className="stat"><b>{s.pending}</b><span>waiting</span></div>
          <div className="stat"><b>{s.approved}</b><span>in gallery</span></div>
          <div className="stat"><b>{s.scouts}</b><span>scouts with permission</span></div>
          <div className={`stat ${s.levels.none ? 'alert' : ''}`}><b>{s.levels.none}</b><span>no photos</span></div>
        </div>
      )}
      <div className="chip-scroll">
        {[['pending', `Waiting (${count('pending')})`], ['approved', `In gallery (${count('approved')})`], ['hidden', `Hidden (${count('hidden')})`], ['all', 'All']].map(([id, l]) => <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{l}</button>)}
      </div>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
      {photos.error ? <Empty icon="alert" title="Couldn't load photos">{photos.error.message}</Empty>
        : !photos.data ? <p className="muted">Loading…</p>
        : list.length === 0 ? <Empty icon="check" title={filter === 'pending' ? 'All caught up!' : 'Nothing here'}>{filter === 'pending' ? 'No photos waiting for review.' : ''}</Empty>
        : (
          <ul className="review-list">
            {list.map(p => {
              const f = FLAG[p.check.flag];
              const a = albumList.find(x => x.id === p.album);
              return (
                <li key={p.id} className="review card">
                  <button className="review-img" onClick={() => setView(p)} aria-label="View full size"><img src={leaderPhotoUrl(p.id, pass, true)} alt="" loading="lazy" /><span className={`st st-${p.status}`}>{p.status === 'pending' ? 'Waiting' : p.status === 'approved' ? 'In gallery' : 'Hidden'}</span></button>
                  <div className="review-body">
                    <div className={`flag ${f.cls}`}><Icon name={f.icon} size={18} /><span><b>{f.title}</b>{f.body}</span></div>
                    {p.check.tagged.length > 0 && (
                      <p className="tagged">{p.check.tagged.map(t => <span key={t.id} className={`lvl lvl-${t.level}`}>{t.name} · {level(t.level)?.short}</span>)}</p>
                    )}
                    <p className="small"><b>{p.name}</b> <span className="muted">({p.role})</span>{p.caption && <> · “{p.caption}”</>}</p>
                    <p className="small muted">{a ? `${a.emoji} ${a.title}` : p.album}{p.patrol && ` · ${p.patrol}`} · {new Date(p.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    <div className="btn-row tight">
                      {p.status !== 'approved' && <button className="btn small" disabled={p.check.flag === 'blocked'} onClick={() => update(p.id, { status: 'approved' })}><Icon name="check" size={16} />Approve</button>}
                      {p.status !== 'hidden' && <button className="btn small secondary" onClick={() => update(p.id, { status: 'hidden' })}><Icon name="eyeOff" size={16} />Hide</button>}
                      <button className="btn small secondary" onClick={() => setTagging({ ...p, tags: p.scouts || [] })}><Icon name="tag" size={16} />Tag</button>
                      <button className={`btn small ${p.public ? 'accent' : 'secondary'}`} disabled={!p.public && p.check.flag !== 'public'} onClick={() => update(p.id, { public: !p.public })} title="Mark OK for the troop's public pages"><Icon name="globe" size={16} />{p.public ? 'Public ✓' : 'OK for public'}</button>
                      <select className="mini-select" value={p.album} onChange={e => update(p.id, { album: e.target.value })} aria-label="Move to album">
                        {albumList.map(x => <option key={x.id} value={x.id}>{x.emoji} {x.title}</option>)}
                      </select>
                      <button className="link-btn small danger" onClick={() => update(p.id, { status: 'deleted' })}><Icon name="trash" size={15} />Delete</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      <Sheet open={!!tagging} onClose={() => setTagging(null)} title="Who's in this photo?">
        {tagging && <>
          <img className="tag-preview" src={leaderPhotoUrl(tagging.id, pass, true)} alt="" />
          <TagPicker scouts={scouts} patrol={tagging.patrol} tags={tagging.tags} setTags={tags => setTagging(t => ({ ...t, tags }))} label="Tag scouts" />
          <div className="btn-row"><button className="btn" onClick={async () => { await update(tagging.id, { scouts: tagging.tags }); setTagging(null); }}>Save tags</button></div>
        </>}
      </Sheet>
      <Sheet open={!!view} onClose={() => setView(null)} title={view?.caption || 'Photo'} wide>
        {view && <img className="full" src={leaderPhotoUrl(view.id, pass)} alt="" />}
      </Sheet>
    </>
  );
}

function Roster({ pass }) {
  const r = useLeader('leader/permissions', pass);
  const fams = r.data?.families || [];
  const scouts = fams.flatMap(f => f.scouts.map(s => ({ ...s, parent: f.parent.name })));
  const none = scouts.filter(s => s.level === 'none');
  async function remove(f) {
    if (!confirm(`Delete the permission record for ${f.parent.name}'s family? They'll need to fill it out again.`)) return;
    await api(`leader/permissions/${f.id}`, { method: 'DELETE', leader: pass }); r.load();
  }
  if (r.error) return <Empty icon="alert" title="Couldn't load">{r.error.message}</Empty>;
  if (!r.data) return <p className="muted">Loading…</p>;
  return (
    <>
      <div className="stat-row">
        {troop.consentLevels.map(l => <div key={l.id} className={`stat lvl-stat lvl-${l.id}`}><b>{scouts.filter(s => s.level === l.id).length}</b><span>{l.short}</span></div>)}
      </div>
      <Section title="No photos, please" className="nophoto">
        {none.length === 0 ? <p className="muted small">No scouts on this list.</p> : (
          <ul className="nophoto-list">{none.map(s => <li key={s.id}><Icon name="eyeOff" size={16} /><b>{s.first} {s.lastInitial && `${s.lastInitial}.`}</b><span className="muted">{s.patrol}</span></li>)}</ul>
        )}
        <p className="small muted">Check photos against this list at events, especially untagged ones.</p>
      </Section>
      <Section title={`Families (${fams.length})`}>
        {fams.length === 0 ? <Empty icon="shield" title="No permission forms yet">Share the app at your next troop meeting and ask families to tap Permission.</Empty> : (
          <ul className="fam-list">
            {fams.map(f => (
              <li key={f.id} className="card fam">
                <div className="fam-head">
                  <span><b>{f.parent.name}</b>{(f.parent.email || f.parent.phone) && <span className="small muted"><br />{[f.parent.email, f.parent.phone].filter(Boolean).join(' · ')}</span>}</span>
                  <button className="icon-btn" onClick={() => remove(f)} aria-label={`Delete ${f.parent.name}'s record`}><Icon name="trash" size={18} /></button>
                </div>
                <ul className="fam-scouts">{f.scouts.map(s => <li key={s.id}><span>{s.first} {s.lastInitial && `${s.lastInitial}.`} <span className="muted small">{s.patrol}</span></span><span className={`lvl lvl-${s.level}`}>{level(s.level)?.short}</span></li>)}</ul>
                <p className="small muted">Signed “{f.signature}” · {new Date(f.updated).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{f.history?.length > 1 ? ` · changed ${f.history.length - 1}×` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Bulletin() {
  const [me] = useMe();
  const posts = useCol('posts');
  const [f, setF] = useState({ title: '', body: '', link: '', pinned: false });
  const [msg, setMsg] = useState('');
  async function post(e) {
    e.preventDefault(); setMsg('');
    try { await saveDoc('posts', `b-${rid()}`, f, me.name); setF({ title: '', body: '', link: '', pinned: false }); posts.refresh(); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <>
      <Section title="Post to the bulletin">
        <form className="card" onSubmit={post}>
          <label className="field"><span>Headline</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Permission slips due Thursday" maxLength={120} required /></label>
          <label className="field"><span>Details <i className="opt">optional</i></span><textarea rows={3} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></label>
          <label className="field"><span>Link <i className="opt">optional</i></span><input type="url" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="https://" /></label>
          <label className="check"><input type="checkbox" checked={f.pinned} onChange={e => setF({ ...f, pinned: e.target.checked })} /> Pin to the top</label>
          {msg && <p className="form-msg" role="alert">{msg}</p>}
          <button className="btn"><Icon name="megaphone" size={18} />Post</button>
        </form>
      </Section>
      <Section title="On the bulletin">
        {posts.items.length === 0 ? <p className="muted">Nothing posted yet.</p> : (
          <ul className="posts">{posts.items.map(p => (
            <li key={p.id} className={`post ${p.pinned ? 'pinned' : ''}`}>
              <p className="post-title">{p.pinned && <Icon name="megaphone" size={16} />}{p.title}</p>
              {p.body && <p className="post-body">{p.body}</p>}
              <div className="btn-row tight">
                <button className="btn small secondary" onClick={async () => { await saveDoc('posts', p.id, { ...p, pinned: !p.pinned }, me.name); posts.refresh(); }}>{p.pinned ? 'Unpin' : 'Pin'}</button>
                <button className="link-btn small danger" onClick={async () => { if (confirm('Delete this post?')) { await deleteDoc('posts', p.id); posts.refresh(); } }}><Icon name="trash" size={15} />Delete</button>
              </div>
            </li>
          ))}</ul>
        )}
      </Section>
    </>
  );
}

function Settings({ pass }) {
  const s = useLeader('leader/settings', pass);
  const [patrols, setPatrols] = useState(null);
  const [albums, setAlbums] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (s.data) { setPatrols(s.data.patrols); setAlbums(s.data.albums); } }, [s.data]);
  async function save(body) {
    setMsg(null);
    try { const r = await api('leader/settings', { method: 'POST', body, leader: pass }); setPatrols(r.settings.patrols); setAlbums(r.settings.albums); setMsg({ text: 'Saved.' }); }
    catch (e) { setMsg({ bad: true, text: e.message }); }
  }
  if (!patrols) return <p className="muted">Loading…</p>;
  return (
    <>
      <Section title="Patrols">
        <div className="card">
          <p className="small muted">Used for sign-ups, meal plans, gear and photos. Renaming a patrol doesn't move old records.</p>
          {patrols.map((p, i) => (
            <div className="row-input" key={i}>
              <input value={p} onChange={e => setPatrols(patrols.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Patrol ${i + 1}`} />
              <button className="icon-btn sm" onClick={() => setPatrols(patrols.filter((_, j) => j !== i))} aria-label={`Remove ${p}`}><Icon name="x" size={16} /></button>
            </div>
          ))}
          <div className="btn-row">
            <button className="btn secondary small" onClick={() => setPatrols([...patrols, ''])}><Icon name="plus" size={16} />Add patrol</button>
            <button className="btn small" onClick={() => save({ patrols: patrols.map(p => p.trim()).filter(Boolean) })}>Save patrols</button>
          </div>
        </div>
      </Section>
      <Section title="Extra photo albums">
        <div className="card">
          <p className="small muted">Every outing is its own album automatically. Add albums for anything else.</p>
          {albums.map((a, i) => (
            <div className="row-input" key={a.id || i}>
              <input className="emoji-in" value={a.emoji} onChange={e => setAlbums(albums.map((x, j) => (j === i ? { ...x, emoji: e.target.value } : x)))} aria-label="Emoji" />
              <input value={a.title} onChange={e => setAlbums(albums.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Album name" />
              <button className="icon-btn sm" onClick={() => setAlbums(albums.filter((_, j) => j !== i))} aria-label="Remove album"><Icon name="x" size={16} /></button>
            </div>
          ))}
          <div className="btn-row">
            <button className="btn secondary small" onClick={() => setAlbums([...albums, { id: '', emoji: '📷', title: '' }])}><Icon name="plus" size={16} />Add album</button>
            <button className="btn small" onClick={() => save({ albums })}>Save albums</button>
          </div>
          <p className="small muted">Built in: {troop.albums.map(a => `${a.emoji} ${a.title}`).join(', ')}.</p>
        </div>
      </Section>
      {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`} role="status">{msg.text}</p>}
    </>
  );
}

function Records({ pass }) {
  const [msg, setMsg] = useState('');
  async function download(kind) {
    setMsg('');
    try {
      const res = await fetch(`/api/leader/export/${kind}`, { headers: { 'x-leader-passcode': pass } });
      if (!res.ok) throw new Error('Export failed.');
      const u = URL.createObjectURL(await res.blob());
      const l = document.createElement('a'); l.href = u; l.download = `${troop.id}-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; l.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) { setMsg(e.message); }
  }
  const items = [
    ['permissions', 'shield', 'Photo permission', 'Every scout\'s photo choice and who signed'],
    ['signups', 'users', 'Outing sign-ups', 'Who\'s going to each outing, by patrol'],
    ['gear', 'box', 'Gear inventory', 'Every item, condition and who has it now'],
    ['gear-log', 'list', 'Gear history', 'Every check-out and check-in'],
    ['spending', 'dollar', 'Food spending', 'Receipts by outing and patrol'],
    ['photos', 'image', 'Photo log', 'Who shared what, and the permission check'],
  ];
  return (
    <Section title="Download records">
      <p className="small muted">Spreadsheets (CSV) open in Excel, Numbers or Google Sheets.</p>
      <ul className="more-list">{items.map(([k, ic, l, sub]) => <li key={k}><button onClick={() => download(k)}><span className="more-ico"><Icon name={ic} size={22} /></span><span className="grow"><b>{l}</b><span>{sub}</span></span><Icon name="download" size={18} /></button></li>)}</ul>
      {msg && <p className="form-msg" role="alert">{msg}</p>}
    </Section>
  );
}
