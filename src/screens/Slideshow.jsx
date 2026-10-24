import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Mark } from '../components/ui.jsx';
import { api, photoUrl, usePatrols, useSynced } from '../lib/api.js';
import { troop } from '../lib/config.js';
import { back } from '../lib/router.js';
import { filterPhotos, SlideshowBuilder } from './Gallery.jsx';

// Full-screen slideshow for Courts of Honor and banquets.
// #/slideshow?albums=a,b&year=2024&type=campout&patrol=X&fav=1&order=oldest|newest|shuffle&speed=7&cap=0&cards=0
// #/slideshow?pick=1 plays the photos picked in the gallery.
// Picks up newly approved photos every two minutes.
const CARD_SECONDS = 4;
const fmt = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
function shuffled(a, seed) {
  const x = a.slice(); let s = seed;
  for (let i = x.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

export default function Slideshow({ route }) {
  const q = route.query;
  const opts = {
    albums: q.albums ? q.albums.split(',').filter(Boolean) : (q.album && q.album !== 'all' ? [q.album] : []),
    year: q.year || '', type: q.type || '', patrol: q.patrol || '', fav: q.fav === '1',
    order: q.order || (q.albums || q.album ? 'oldest' : 'newest'), speed: Math.min(30, Math.max(3, +q.speed || 7)),
    captions: q.cap !== '0', cards: q.cards !== '0', pick: q.pick === '1',
  };
  const [photos, setPhotos] = useState(null);
  const [albums, setAlbums] = useState(troop.albums);
  const [favs] = useSynced('fav-photos', []);
  const patrols = usePatrols() || troop.patrols;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 233280));
  const hideT = useRef(null);

  useEffect(() => {
    let stop = false;
    const load = () => Promise.all([api('photos'), api('albums')]).then(([p, a]) => {
      if (stop) return;
      setPhotos(p.photos); setAlbums(a.albums);
    }).catch(() => !stop && setPhotos(x => x || []));
    load();
    const id = setInterval(load, 120000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const byAlbum = useMemo(() => new Map(albums.map(a => [a.id, a])), [albums]);
  // the running order: optional title card before each event's photos
  const seq = useMemo(() => {
    let list = photos || [];
    if (opts.pick) { let ids = []; try { ids = JSON.parse(sessionStorage.getItem('t23-show-ids') || '[]'); } catch { /* none */ } const s = new Set(ids); list = list.filter(p => s.has(p.id)); }
    else list = filterPhotos(list, byAlbum, opts, favs);
    const date = p => byAlbum.get(p.album)?.date || '';
    if (opts.order === 'shuffle') list = shuffled(list, seed);
    else {
      const dir = opts.order === 'oldest' ? 1 : -1;
      list = list.slice().sort((a, b) => dir * (date(a).localeCompare(date(b)) || a.at - b.at));
    }
    const out = [];
    let last = null;
    for (const p of list) {
      if (opts.cards && opts.order !== 'shuffle' && p.album !== last) {
        const a = byAlbum.get(p.album);
        if (a) out.push({ card: true, key: `card-${p.album}-${out.length}`, a, n: list.filter(x => x.album === p.album).length });
      }
      last = p.album;
      out.push({ key: p.id, p });
    }
    return out;
  }, [photos, byAlbum, q.albums, q.album, q.year, q.type, q.patrol, q.fav, q.order, q.cards, q.pick, favs, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = seq.length;
  const cur = n ? seq[i % n] : null;
  const photoCount = seq.filter(s => !s.card).length;
  const photoNo = cur && !cur.card ? seq.slice(0, (i % n) + 1).filter(s => !s.card).length : 0;
  const a = cur?.p && byAlbum.get(cur.p.album);
  const dur = cur?.card ? CARD_SECONDS : opts.speed;

  useEffect(() => { setI(0); }, [JSON.stringify(q)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing || n < 2 || panel) return;
    const id = setTimeout(() => setI(x => (x + 1) % n), dur * 1000);
    return () => clearTimeout(id);
  }, [i, playing, n, dur, panel]);
  useEffect(() => { for (const k of [1, 2]) { const s = n && seq[(i + k) % n]; if (s?.p) { const img = new Image(); img.src = photoUrl(s.p.id); } } }, [i, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const poke = () => { setChrome(true); clearTimeout(hideT.current); hideT.current = setTimeout(() => setChrome(false), 3500); };
  useEffect(() => {
    poke();
    const key = e => {
      if (panel) return;
      poke();
      if (e.key === 'ArrowRight') setI(x => x + 1);
      if (e.key === 'ArrowLeft') setI(x => (x - 1 + Math.max(n, 1)) % Math.max(n, 1));
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'Escape' && !document.fullscreenElement) back('gallery');
    };
    addEventListener('keydown', key);
    return () => { removeEventListener('keydown', key); clearTimeout(hideT.current); };
  }, [n, panel]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  const touch = useRef(null);
  const usedPatrols = patrols.filter(p => (photos || []).some(x => x.patrol === p));

  return (
    <div className={`show ${chrome ? '' : 'calm'}`} onMouseMove={poke} onClick={poke}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 60) setI(x => (dx > 0 ? (x - 1 + Math.max(n, 1)) % Math.max(n, 1) : x + 1)); }}>
      {cur?.card ? (
        <div className="show-stage show-card" key={cur.key}>
          {cur.a && <img className="show-bg" src={photoUrl(seq[(i + 1) % n]?.p?.id || '', true)} alt="" aria-hidden="true" />}
          <div className="card-inner">
            <span className="card-emoji" aria-hidden="true">{cur.a.emoji}</span>
            <h1>{cur.a.title}</h1>
            <p>{[fmt(cur.a.date), cur.a.location].filter(Boolean).join(' · ')}</p>
            <p className="card-n">{cur.n} photo{cur.n === 1 ? '' : 's'}</p>
          </div>
        </div>
      ) : cur ? (
        <div className="show-stage" key={cur.key}>
          <img className="show-bg" src={photoUrl(cur.p.id, true)} alt="" aria-hidden="true" />
          <img className={`show-img kb${i % 4}`} style={{ animationDuration: `${opts.speed + 2}s` }} src={photoUrl(cur.p.id)} alt={cur.p.caption || 'Troop photo'} />
        </div>
      ) : (
        <div className="show-empty"><Mark size={140} dark /><p>{photos === null ? 'Loading photos…' : 'No photos match this slideshow.'}</p>{photos !== null && <button className="btn accent" onClick={e => { e.stopPropagation(); setPanel(true); }}>Choose photos</button>}</div>
      )}

      <div className="show-brand">{troop.logoOnDark ? <img src={troop.logoOnDark} alt="" height="54" /> : <Mark size={54} dark />}<span><b>{troop.unit}</b><br />{troop.place}</span></div>
      {cur?.p && opts.captions && (cur.p.caption || a || cur.p.tags?.length > 0) && (
        <div className="show-cap">
          {cur.p.caption && <p className="cap">{cur.p.caption}</p>}
          {cur.p.tags?.length > 0 && <p className="tags">{cur.p.tags.join(' · ')}</p>}
          <p className="meta">{a && `${a.emoji} ${a.title}`}{a?.date && ` · ${new Date(`${a.date}T12:00:00`).getFullYear()}`}{cur.p.patrol && ` · ${cur.p.patrol}`}</p>
        </div>
      )}
      {n > 1 && <div className="show-progress" aria-hidden="true"><span key={`${i}-${playing}-${panel}`} className={playing && !panel ? 'run' : ''} style={{ animationDuration: `${dur}s` }} /></div>}

      <div className="show-controls" onClick={e => e.stopPropagation()}>
        <button className="icon-btn on-dark" onClick={() => back('gallery')} aria-label="Exit slideshow"><Icon name="x" /></button>
        {photoCount > 0 && <span className="show-count">{photoNo || '–'} / {photoCount}</span>}
        <span className="grow" />
        <button className="icon-btn on-dark" onClick={() => setI(x => (x - 1 + Math.max(n, 1)) % Math.max(n, 1))} aria-label="Previous"><Icon name="chevronL" /></button>
        <button className="icon-btn on-dark" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} /></button>
        <button className="icon-btn on-dark" onClick={() => setI(x => x + 1)} aria-label="Next"><Icon name="chevronR" /></button>
        <button className="icon-btn on-dark" onClick={() => setPanel(true)} aria-label="Slideshow settings"><Icon name="settings" /></button>
        {document.documentElement.requestFullscreen && <button className="icon-btn on-dark" onClick={full} aria-label="Full screen"><Icon name="external" /></button>}
      </div>

      {panel && (
        <div className="show-panel" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) setPanel(false); }}>
          <div className="show-panel-card" role="dialog" aria-modal="true" aria-label="Slideshow settings">
            <div className="sheet-head"><h2>Slideshow</h2><button className="icon-btn" onClick={() => setPanel(false)} aria-label="Close"><Icon name="x" /></button></div>
            <SlideshowBuilder all={photos || []} albumList={albums} byAlbum={byAlbum} favs={favs} patrols={usedPatrols}
              initial={{ albums: opts.albums, year: opts.year, type: opts.type, patrol: opts.patrol, fav: opts.fav, order: opts.order, speed: opts.speed, captions: opts.captions, cards: opts.cards }}
              onStart={params => { setPanel(false); setPlaying(true); location.replace(`#/slideshow?${params}`); }} />
          </div>
        </div>
      )}
    </div>
  );
}
