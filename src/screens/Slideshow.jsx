import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Mark } from '../components/ui.jsx';
import { api, photoUrl } from '../lib/api.js';
import { troop } from '../lib/config.js';
import { back } from '../lib/router.js';

// Full-screen slideshow — put it on the projector at a Court of Honor.
// Picks up newly approved photos every two minutes.
const SECONDS = 7;

export default function Slideshow({ route }) {
  const [album, setAlbum] = useState(route.query.album || 'all');
  const [photos, setPhotos] = useState(null);
  const [albums, setAlbums] = useState(troop.albums);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [chrome, setChrome] = useState(true);
  const hideT = useRef(null);

  useEffect(() => {
    let stop = false;
    const load = () => Promise.all([api('photos'), api('albums')]).then(([p, a]) => {
      if (stop) return;
      setPhotos(p.photos.slice().reverse()); setAlbums(a.albums);
    }).catch(() => !stop && setPhotos(x => x || []));
    load();
    const id = setInterval(load, 120000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const list = (photos || []).filter(p => album === 'all' || p.album === album);
  const n = list.length;
  const cur = n ? list[i % n] : null;
  const a = cur && albums.find(x => x.id === cur.album);

  useEffect(() => { setI(0); }, [album]);
  useEffect(() => {
    if (!playing || n < 2) return;
    const id = setTimeout(() => setI(x => (x + 1) % n), SECONDS * 1000);
    return () => clearTimeout(id);
  }, [i, playing, n]);
  useEffect(() => { if (n) { const img = new Image(); img.src = photoUrl(list[(i + 1) % n].id); } }, [i, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const poke = () => { setChrome(true); clearTimeout(hideT.current); hideT.current = setTimeout(() => setChrome(false), 3500); };
  useEffect(() => {
    poke();
    const key = e => {
      poke();
      if (e.key === 'ArrowRight') setI(x => x + 1);
      if (e.key === 'ArrowLeft') setI(x => (x - 1 + Math.max(n, 1)) % Math.max(n, 1));
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'Escape' && !document.fullscreenElement) back('home');
    };
    addEventListener('keydown', key);
    return () => { removeEventListener('keydown', key); clearTimeout(hideT.current); };
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});

  return (
    <div className={`show ${chrome ? '' : 'calm'}`} onMouseMove={poke} onClick={poke}>
      {cur ? (
        <div className="show-stage" key={cur.id}>
          <img className="show-bg" src={photoUrl(cur.id, true)} alt="" aria-hidden="true" />
          <img className={`show-img kb${i % 4}`} src={photoUrl(cur.id)} alt={cur.caption || 'Troop photo'} />
        </div>
      ) : (
        <div className="show-empty"><Mark size={140} dark /><p>{photos === null ? 'Loading photos…' : 'No photos in this album yet.'}</p></div>
      )}

      <div className="show-brand"><Mark size={54} dark /><span><b>{troop.unit}</b><br />{troop.place}</span></div>
      {cur && (cur.caption || a) && (
        <div className="show-cap">
          {cur.caption && <p className="cap">{cur.caption}</p>}
          <p className="meta">{a && `${a.emoji} ${a.title}`}{cur.patrol && ` · ${cur.patrol}`}</p>
        </div>
      )}
      {n > 1 && <div className="show-progress" aria-hidden="true"><span key={`${i}-${playing}`} className={playing ? 'run' : ''} style={{ animationDuration: `${SECONDS}s` }} /></div>}

      <div className="show-controls" onClick={e => e.stopPropagation()}>
        <button className="icon-btn on-dark" onClick={() => back('home')} aria-label="Exit slideshow"><Icon name="x" /></button>
        <select value={album} onChange={e => setAlbum(e.target.value)} aria-label="Album">
          <option value="all">All photos</option>
          {albums.map(x => <option key={x.id} value={x.id}>{x.emoji} {x.title}</option>)}
        </select>
        <span className="grow" />
        <button className="icon-btn on-dark" onClick={() => setI(x => (x - 1 + Math.max(n, 1)) % Math.max(n, 1))} aria-label="Previous"><Icon name="chevronL" /></button>
        <button className="icon-btn on-dark" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} /></button>
        <button className="icon-btn on-dark" onClick={() => setI(x => x + 1)} aria-label="Next"><Icon name="chevronR" /></button>
        {document.documentElement.requestFullscreen && <button className="icon-btn on-dark" onClick={full} aria-label="Full screen"><Icon name="external" /></button>}
      </div>
    </div>
  );
}
