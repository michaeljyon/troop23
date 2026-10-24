import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty } from '../components/ui.jsx';
import { useApi, photoUrl, usePatrols } from '../lib/api.js';
import { troop } from '../lib/config.js';
import { go } from '../lib/router.js';

export default function Gallery({ route }) {
  const albumId = route.query.album || 'all';
  const [den, setDen] = useState('');
  const patrols = usePatrols() || troop.patrols;
  const photos = useApi('photos');
  const albums = useApi('albums');
  const list = albums.data?.albums || troop.albums;
  const all = photos.data?.photos || [];
  const shown = all.filter(p => (albumId === 'all' || p.album === albumId) && (!den || p.patrol === den));
  const openId = route.query.photo;
  const idx = openId ? shown.findIndex(p => p.id === openId) : -1;
  const album = list.find(a => a.id === albumId);
  const setQuery = q => go(`gallery?${new URLSearchParams(Object.fromEntries(Object.entries(q).filter(([, v]) => v && v !== 'all')))}`);

  return (
    <div className="content">
      <PageHead title={album ? <><span aria-hidden="true">{album.emoji}</span> {album.title}</> : 'Troop gallery'} sub={`${shown.length} photo${shown.length === 1 ? '' : 's'}${den ? ` · ${den}` : ''}`}>
        {shown.length > 0 && <a className="btn small secondary head-btn" href={`#/slideshow${albumId !== 'all' ? `?album=${albumId}` : ''}`}><Icon name="play" size={16} />Slideshow</a>}
      </PageHead>

      <div className="chip-scroll filters">
        <button className={`chip ${albumId === 'all' ? 'on' : ''}`} onClick={() => setQuery({})}>All photos</button>
        {list.filter(a => a.count || a.id === albumId).map(a => (
          <button key={a.id} className={`chip ${albumId === a.id ? 'on' : ''}`} onClick={() => setQuery({ album: a.id })}><span aria-hidden="true">{a.emoji}</span> {a.title}{a.count ? <span className="chip-sub">{a.count}</span> : null}</button>
        ))}
      </div>
      <label className="den-filter"><Icon name="people" size={18} /><span className="sr">Patrol</span>
        <select value={den} onChange={e => setDen(e.target.value)} aria-label="Filter by patrol">
          <option value="">Every patrol</option>
          {patrols.map(d => <option key={d}>{d}</option>)}
        </select>
      </label>

      {photos.loading && !photos.data ? <p className="muted">Loading photos…</p>
        : photos.error && !photos.data ? <Empty icon="alert" title="Couldn't load photos">{photos.error.message}</Empty>
        : shown.length === 0 ? <Empty icon="image" title="Nothing here yet" action={<a className="btn small" href="#/snap">Share a photo</a>}>{albumId !== 'all' || den ? 'Try another album or patrol.' : 'Approved photos show up here.'}</Empty>
        : (
          <ul className="gallery">
            {shown.map(p => (
              <li key={p.id}><button onClick={() => setQuery({ album: albumId, photo: p.id })} aria-label={`Open photo${p.caption ? `: ${p.caption}` : ''}, shared by ${p.name}`}><img src={photoUrl(p.id, true)} alt="" loading="lazy" /></button></li>
            ))}
          </ul>
        )}

      {idx >= 0 && <Lightbox photos={shown} index={idx} albums={list} onClose={() => setQuery({ album: albumId })} onGo={i => setQuery({ album: albumId, photo: shown[i].id })} />}
    </div>
  );
}

function Lightbox({ photos, index, albums, onClose, onGo }) {
  const p = photos[index];
  const touch = useRef(null);
  const [saving, setSaving] = useState(false);
  const prev = () => index > 0 && onGo(index - 1);
  const next = () => index < photos.length - 1 && onGo(index + 1);
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); };
    addEventListener('keydown', key); document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', key); document.body.classList.remove('no-scroll'); };
  });
  const a = albums.find(x => x.id === p.album);

  async function save() {
    setSaving(true);
    try {
      const blob = await (await fetch(photoUrl(p.id))).blob();
      const file = new File([blob], `troop23-${p.id}.jpg`, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = file.name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    } catch { /* cancelled */ } finally { setSaving(false); }
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo"
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) (dx > 0 ? prev : next)(); }}>
      <div className="lb-top">
        <span className="lb-count">{index + 1} / {photos.length}</span>
        <button className="icon-btn on-dark" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="lb-stage">
        <img key={p.id} src={photoUrl(p.id)} alt={p.caption || 'Troop photo'} />
        {index > 0 && <button className="lb-nav left" onClick={prev} aria-label="Previous photo"><Icon name="chevronL" size={28} /></button>}
        {index < photos.length - 1 && <button className="lb-nav right" onClick={next} aria-label="Next photo"><Icon name="chevronR" size={28} /></button>}
      </div>
      <div className="lb-info">
        {p.caption && <p className="lb-caption">{p.caption}</p>}
        <p className="lb-meta">{a && <>{a.emoji} {a.title} · </>}{p.patrol && <>{p.patrol} · </>}by {p.name} · {new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
        <button className="btn small on-dark-btn" onClick={save} disabled={saving}><Icon name="download" size={16} />{saving ? 'Saving…' : 'Save photo'}</button>
      </div>
    </div>
  );
}
