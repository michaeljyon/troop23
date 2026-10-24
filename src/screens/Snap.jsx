import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Section } from '../components/ui.jsx';
import TagPicker from '../components/TagPicker.jsx';
import { troop, t } from '../lib/config.js';
import { useLocal, useMe } from '../lib/store.js';
import { api, useApi, usePatrols } from '../lib/api.js';
import { resizeImage } from '../lib/image.js';

// Share photos — the Pack 6 / Statewide Synergy photo flow. Every outing is
// an album; tag scouts so leaders can check each family's permission.
export default function Snap({ route }) {
  const [me] = useMe();
  const [agreed, setAgreed] = useLocal('share-rules', false);
  const [mine, setMine] = useLocal('my-photos', []);
  const [album, setAlbum] = useState(route.query.album || '');
  const [patrol, setPatrol] = useState(me.patrol || '');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState('');
  const [showRules] = useState(!agreed);
  const [msg, setMsg] = useState(null);
  const take = useRef(null), pick = useRef(null);
  const albums = useApi('albums');
  const roster = useApi('roster');
  const gallery = useApi('photos');
  const patrols = usePatrols() || troop.patrols;
  const list = albums.data?.albums || troop.albums;
  const near = d => Math.abs(new Date(`${d}T12:00`) - Date.now());
  const outingAlbums = list.filter(a => a.outing && a.date && new Date(`${a.date}T12:00`) <= Date.now() + 86400000 * 3).sort((x, y) => near(x.date) - near(y.date)).slice(0, 8);
  const otherAlbums = list.filter(a => !a.outing);

  useEffect(() => { if (!album && list.length) setAlbum((outingAlbums[0] || list[0]).id); }, [albums.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const live = new Set((gallery.data?.photos || []).map(p => p.id));
    if (live.size) setMine(m => m.map(p => (p.status === 'pending' && live.has(p.id) ? { ...p, status: 'approved' } : p)));
  }, [gallery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFiles(files) {
    if (!files?.length) return;
    const all = [...files].slice(0, troop.photos.maxPerUpload);
    setMsg(null); let sent = 0;
    for (const [i, file] of all.entries()) {
      setBusy(all.length > 1 ? `Sending ${i + 1} of ${all.length}…` : 'Sending…');
      const thumb = await resizeImage(file, 480, 0.72).catch(() => '');
      try {
        const image = await resizeImage(file);
        const r = await api('photos', { method: 'POST', body: { image, thumb, name: me.name, role: me.role, album, patrol, scouts: tags, caption, release: true } });
        setMine(m => [{ id: r.id, status: r.status, thumb, caption, at: Date.now() }, ...m].slice(0, 60)); sent++;
      } catch (e) {
        setMine(m => [{ id: `local-${Date.now()}-${i}`, status: 'failed', thumb, caption, at: Date.now() }, ...m].slice(0, 60));
        setMsg({ bad: true, text: e.status ? e.message : 'A photo couldn\'t send (weak signal?). Try again when you have service.' });
      }
    }
    setBusy('');
    if (sent) { setCaption(''); setTags([]); setMsg(m => m || { text: `${sent} photo${sent > 1 ? 's' : ''} sent! A leader will approve ${sent > 1 ? 'them' : 'it'} soon.` }); }
  }

  return (
    <div className="content">
      <PageHead title="Snap & share" sub={`Share the adventure with ${troop.unit}. Leaders check every photo before the troop sees it.`} />

      {showRules && (
        <Section title={agreed ? 'Sharing rules ✓' : 'Sharing rules'} className={`setup ${agreed ? 'done' : ''}`}>
          <div className="card">
            <ul className="rules-list">{troop.shareRules.map((r, i) => <li key={i}>{t(r)}</li>)}</ul>
            <label className="check"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /> I agree to these rules for every photo I share.</label>
          </div>
        </Section>
      )}

      <Section title="Which album?">
        <div className="chip-scroll" role="radiogroup" aria-label="Album">
          {[...outingAlbums, ...otherAlbums].map(a => <button key={a.id} role="radio" aria-checked={album === a.id} className={`chip big ${album === a.id ? 'on' : ''}`} onClick={() => setAlbum(a.id)}><span aria-hidden="true">{a.emoji}</span> {a.title}</button>)}
        </div>
      </Section>

      <Section title="Details" action={<span className="small muted">Optional</span>}>
        <div className="card">
          <label className="field"><span>Patrol</span>
            <select value={patrol} onChange={e => setPatrol(e.target.value)}><option value="">Whole troop / mixed</option>{patrols.map(p => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="field"><span>Caption</span><input value={caption} onChange={e => setCaption(e.target.value)} maxLength={200} placeholder="What's happening? (no last names)" /></label>
          <div className="missions">{troop.missions.map(m => <button key={m} type="button" className="mission" onClick={() => setCaption(m)}>{m}</button>)}</div>
          <TagPicker scouts={roster.data?.scouts || []} patrol={patrol} tags={tags} setTags={setTags} />
        </div>
      </Section>

      <div className="snap-bar">
        <button className="btn accent big" disabled={!agreed || !!busy} onClick={() => take.current.click()}><Icon name="camera" size={22} />{busy || 'Take a photo'}</button>
        <button className="btn secondary big" disabled={!agreed || !!busy} onClick={() => pick.current.click()}><Icon name="image" size={20} />Choose from my phone</button>
        {!agreed && <p className="small muted center">Agree to the sharing rules above to start.</p>}
        {msg && <p className={`form-msg ${msg.bad ? '' : 'good'}`} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p>}
        <p className="small muted center"><Icon name="lock" size={14} /> Location data is removed from every photo before it's sent.</p>
        <input ref={take} type="file" accept="image/*" capture="environment" hidden onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
        <input ref={pick} type="file" accept="image/*" multiple hidden onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {mine.length > 0 && (
        <Section title="Photos you've shared">
          <ul className="mine">
            {mine.map(p => (
              <li key={p.id}>
                {p.thumb && <img src={p.thumb} alt={p.caption || 'Your photo'} />}
                <span className={`status ${p.status}`}>{p.status === 'approved' ? '✓ In the gallery' : p.status === 'pending' ? 'Waiting for a leader' : 'Didn\'t send'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
