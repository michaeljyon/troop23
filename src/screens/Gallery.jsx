import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Empty, Sheet } from '../components/ui.jsx';
import { api, useApi, photoUrl, usePatrols, useSynced, useLeaderMode } from '../lib/api.js';
import TagPicker from '../components/TagPicker.jsx';
import { troop } from '../lib/config.js';
import { go } from '../lib/router.js';

// Troop photo gallery: browse by event or as one big wall, filter by year,
// outing type, patrol or a search (event, caption, who's tagged), keep
// favorites, pick photos, and build a slideshow from any of it.
const PAGE = 90;
const yearOf = ms => new Date(ms).getFullYear();
const fmtDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString([], opts) : '';
const typeOf = id => troop.outingTypes.find(t => t.id === id);

export function useGalleryData() {
  const photos = useApi('photos');
  const albums = useApi('albums');
  const albumList = albums.data?.albums || troop.albums;
  const byAlbum = useMemo(() => new Map(albumList.map(a => [a.id, a])), [albumList]);
  return { photos, albums, all: photos.data?.photos || [], albumList, byAlbum };
}

// Shared filter logic (gallery + slideshow)
export function filterPhotos(all, byAlbum, f, favs = []) {
  const q = (f.q || '').trim().toLowerCase();
  const ids = f.albums?.length ? new Set(f.albums) : null;
  const fav = new Set(favs);
  return all.filter(p => {
    const a = byAlbum.get(p.album);
    if (f.album && p.album !== f.album) return false;
    if (ids && !ids.has(p.album)) return false;
    if (f.year && String(yearOf(p.at)) !== String(f.year)) return false;
    if (f.type && a?.type !== f.type) return false;
    if (f.patrol && p.patrol !== f.patrol && !(p.tagPatrols || []).includes(f.patrol)) return false;
    if (f.scout && !(p.tagIds || []).includes(f.scout)) return false;
    if (f.fav && !fav.has(p.id)) return false;
    if (q && !`${p.caption} ${(p.tags || []).join(' ')} ${p.name} ${a?.title || ''} ${a?.location || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export default function Gallery({ route }) {
  const qy = route.query;
  const view = qy.album ? 'album' : qy.view || 'events';
  const f = { album: qy.album || '', year: qy.year || '', type: qy.type || '', patrol: qy.patrol || '', scout: qy.scout || '', q: qy.q || '', fav: qy.view === 'favs' };
  const { photos, all, albumList, byAlbum } = useGalleryData();
  const patrols = usePatrols() || troop.patrols;
  const [favs, setFavs] = useSynced('fav-photos', []);
  const [search, setSearch] = useState(f.q);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState([]);
  const [builder, setBuilder] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const setQuery = patch => {
    const next = { view: qy.view, album: qy.album, year: qy.year, type: qy.type, patrol: qy.patrol, scout: qy.scout, q: qy.q, ...patch };
    go(`gallery?${new URLSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)))}`);
  };
  useEffect(() => { const t = setTimeout(() => search !== f.q && setQuery({ q: search, photo: '' }), 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLimit(PAGE); }, [qy.album, qy.year, qy.type, qy.patrol, qy.scout, qy.q, qy.view]);
  useEffect(() => { if (!selecting) setSel([]); }, [selecting]);

  const shown = useMemo(() => filterPhotos(all, byAlbum, f, favs), [all, byAlbum, f.album, f.year, f.type, f.patrol, f.scout, f.q, f.fav, favs]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = [...new Set(all.map(p => yearOf(p.at)))].sort((a, b) => b - a);
  const types = [...new Set(all.map(p => byAlbum.get(p.album)?.type).filter(Boolean))];
  const usedPatrols = patrols.filter(p => all.some(x => x.patrol === p || (x.tagPatrols || []).includes(p)));
  const tagged = useMemo(() => { const m = new Map(); for (const p of all) (p.tagIds || []).forEach((id, i) => m.set(id, p.tags[i])); return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)); }, [all]);
  const untagged = all.filter(p => !(p.tagIds || []).length).length;
  // events with at least one photo matching the filters
  const events = useMemo(() => {
    const m = new Map();
    for (const p of shown) { const e = m.get(p.album) || { id: p.album, n: 0, cover: p.id, at: p.at }; e.n++; m.set(p.album, e); }
    return [...m.values()].map(e => ({ ...e, a: byAlbum.get(e.id) || { id: e.id, title: 'Other photos', emoji: '📷' } }))
      .sort((x, y) => (y.a.date || '').localeCompare(x.a.date || '') || y.at - x.at);
  }, [shown, byAlbum]);
  const album = f.album ? byAlbum.get(f.album) : null;
  const openId = qy.photo;
  const idx = openId ? shown.findIndex(p => p.id === openId) : -1;
  const toggleFav = id => setFavs(favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]);
  const filtersOn = !!(f.year || f.type || f.patrol || f.scout || f.q);

  function playSelection(ids) {
    try { sessionStorage.setItem('t23-show-ids', JSON.stringify(ids)); } catch { /* private mode */ }
    go('slideshow?pick=1');
  }

  return (
    <div className="content gallery-page">
      {view === 'album' && album ? (
        <>
          <PageHead backTo={`gallery${qy.view ? `?view=${qy.view}` : ''}`} title={<><span aria-hidden="true">{album.emoji}</span> {album.title}</>}
            sub={[album.outing && fmtDate(album.date), album.location, `${shown.length} photo${shown.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}>
            {shown.length > 0 && <a className="btn small head-btn" href={`#/slideshow?albums=${album.id}`}><Icon name="play" size={16} />Play</a>}
          </PageHead>
          {album.outing && <p className="small"><a className="link-btn small" href={`#/outing/${album.id}`}><Icon name="tent" size={14} />Outing details</a></p>}
        </>
      ) : (
        <PageHead title="Photo gallery" sub={`${all.length} photo${all.length === 1 ? '' : 's'} from ${new Set(all.map(p => p.album)).size} events`}>
          {all.length > 0 && <button className="btn small head-btn" onClick={() => setBuilder(true)}><Icon name="play" size={16} />Slideshow</button>}
        </PageHead>
      )}

      {view !== 'album' && (
        <div className="seg gal-seg" role="tablist">
          {[['events', 'Events', 'calendar'], ['photos', 'All photos', 'image'], ['favs', `Favorites${favs.length ? ` ${favs.length}` : ''}`, 'heart']].map(([k, l, ic]) => (
            <button key={k} role="tab" aria-selected={(qy.view || 'events') === k} className={(qy.view || 'events') === k ? 'on' : ''} onClick={() => setQuery({ view: k === 'events' ? '' : k, photo: '' })}><Icon name={ic} size={15} />{l}</button>
          ))}
        </div>
      )}

      <div className="gal-filters">
        <div className="search-row"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={view === 'album' ? 'Search captions and names' : 'Search events, places, captions, names'} aria-label="Search photos" />{search && <button className="icon-btn sm" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}</div>
        {view !== 'album' && years.length > 1 && (
          <div className="chip-scroll">
            <button className={`chip ${!f.year ? 'on' : ''}`} onClick={() => setQuery({ year: '' })}>All years</button>
            {years.map(y => <button key={y} className={`chip ${String(y) === f.year ? 'on' : ''}`} onClick={() => setQuery({ year: String(y) === f.year ? '' : String(y) })}>{y}<span className="chip-sub">{all.filter(p => yearOf(p.at) === y).length}</span></button>)}
          </div>
        )}
        {view !== 'album' && types.length > 1 && (
          <div className="chip-scroll">
            <button className={`chip sm ${!f.type ? 'on' : ''}`} onClick={() => setQuery({ type: '' })}>Every kind</button>
            {types.map(t => { const x = typeOf(t); return <button key={t} className={`chip sm ${t === f.type ? 'on' : ''}`} onClick={() => setQuery({ type: t === f.type ? '' : t })}><span aria-hidden="true">{x?.emoji}</span> {x?.label || t}</button>; })}
          </div>
        )}
        <div className="gal-row">
          {usedPatrols.length > 0 && (
            <label className="den-filter"><Icon name="people" size={18} />
              <select value={f.patrol} onChange={e => setQuery({ patrol: e.target.value })} aria-label="Filter by patrol">
                <option value="">Every patrol</option>
                {usedPatrols.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
          )}
          {tagged.length > 0 && (
            <label className="den-filter"><Icon name="tag" size={18} />
              <select value={f.scout} onChange={e => setQuery({ scout: e.target.value })} aria-label="Filter by scout">
                <option value="">Every scout</option>
                {tagged.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {filtersOn && <button className="link-btn small" onClick={() => { setSearch(''); setQuery({ year: '', type: '', patrol: '', scout: '', q: '' }); }}><Icon name="x" size={14} />Clear filters</button>}
          <span className="grow" />
          {(view !== 'events' || album) && shown.length > 0 && <button className={`chip sm ${selecting ? 'on' : ''}`} onClick={() => setSelecting(s => !s)}><Icon name="check" size={14} />{selecting ? 'Done' : 'Select'}</button>}
        </div>
      </div>

      {(f.patrol || f.scout) && untagged > 0 && <p className="small muted gal-note"><Icon name="info" size={14} /> Patrol and scout filters only find photos with scouts tagged. {untagged} photo{untagged === 1 ? ' isn\'t' : 's aren\'t'} tagged yet and still show under each event.</p>}
      {photos.loading && !photos.data ? <p className="muted">Loading photos…</p>
        : photos.error && !photos.data ? <Empty icon="alert" title="Couldn't load photos">{photos.error.message}</Empty>
        : shown.length === 0 ? (
          <Empty icon={f.fav ? 'heart' : 'image'} title={f.fav ? 'No favorites yet' : 'Nothing here'} action={!f.fav && !filtersOn ? <a className="btn small" href="#/snap">Share a photo</a> : null}>
            {f.fav ? 'Tap the heart on any photo to save it here.' : filtersOn ? 'Try a different year, patrol or search.' : 'Approved photos show up here.'}
          </Empty>
        )
        : view === 'events' ? <EventGrid events={events} onOpen={id => setQuery({ album: id, view: '' })} />
        : (
          <>
            <ul className={`gallery ${selecting ? 'selecting' : ''}`}>
              {shown.slice(0, limit).map(p => {
                const on = sel.includes(p.id);
                return (
                  <li key={p.id}>
                    <button className={on ? 'picked' : ''} onClick={() => (selecting ? setSel(on ? sel.filter(x => x !== p.id) : [...sel, p.id]) : setQuery({ photo: p.id }))} aria-pressed={selecting ? on : undefined} aria-label={selecting ? `${on ? 'Unselect' : 'Select'} photo` : `Open photo${p.caption ? `: ${p.caption}` : ''}`}>
                      <img src={photoUrl(p.id, true)} alt="" loading="lazy" />
                      {selecting && <span className="pick-dot" aria-hidden="true">{on && <Icon name="check" size={14} strokeWidth={3} />}</span>}
                      {!selecting && favs.includes(p.id) && <span className="fav-dot" aria-hidden="true"><Icon name="heart" size={13} /></span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {shown.length > limit && <MoreSentinel onMore={() => setLimit(l => l + PAGE)} left={shown.length - limit} />}
          </>
        )}

      {selecting && (
        <div className="select-bar">
          <span><b>{sel.length}</b> selected</span>
          <button className="link-btn small on-dark" onClick={() => setSel(sel.length === shown.length ? [] : shown.map(p => p.id))}>{sel.length === shown.length ? 'None' : 'All'}</button>
          <span className="grow" />
          <button className="btn small accent" disabled={!sel.length} onClick={() => playSelection(sel)}><Icon name="play" size={15} />Play</button>
          <button className="btn small on-dark-btn" disabled={!sel.length} onClick={() => { const add = sel.filter(id => !favs.includes(id)); setFavs([...favs, ...add]); setSelecting(false); }}><Icon name="heart" size={15} />Favorite</button>
          <ShareButton ids={sel} />
        </div>
      )}

      {idx >= 0 && <Lightbox photos={shown} index={idx} byAlbum={byAlbum} favs={favs} onFav={toggleFav} onClose={() => setQuery({ photo: '' })} onGo={i => setQuery({ photo: shown[i].id })} onPlay={() => go(`slideshow?albums=${shown[idx].album}`)} onTagged={() => photos.refresh()} patrols={patrols} />}
      <Sheet open={builder} onClose={() => setBuilder(false)} title="Build a slideshow" wide>
        {builder && <SlideshowBuilder all={all} albumList={albumList} byAlbum={byAlbum} favs={favs} patrols={usedPatrols} initial={{ year: f.year, type: f.type, patrol: f.patrol, albums: f.album ? [f.album] : [] }} onStart={params => go(`slideshow?${params}`)} />}
      </Sheet>
    </div>
  );
}

function EventGrid({ events, onOpen }) {
  const groups = [];
  for (const e of events) {
    const y = e.a.date ? e.a.date.slice(0, 4) : String(yearOf(e.at));
    let g = groups.find(x => x.y === y); if (!g) groups.push(g = { y, list: [] });
    g.list.push(e);
  }
  return groups.map(g => (
    <section key={g.y} className="ev-year">
      <h2 className="section-title sm">{g.y}<span className="muted"> · {g.list.reduce((a, e) => a + e.n, 0)} photos</span></h2>
      <ul className="ev-grid">
        {g.list.map(e => (
          <li key={e.id}><button className="ev-card" onClick={() => onOpen(e.id)}>
            <img src={photoUrl(e.cover, true)} alt="" loading="lazy" />
            <span className="ev-n">{e.n}</span>
            <span className="ev-text"><b><span aria-hidden="true">{e.a.emoji}</span> {e.a.title}</b>{e.a.date && <span>{fmtDate(e.a.date, { month: 'short', day: 'numeric' })}</span>}</span>
          </button></li>
        ))}
      </ul>
    </section>
  ));
}

function MoreSentinel({ onMore, left }) {
  const ref = useRef(null);
  useEffect(() => {
    const io = new IntersectionObserver(es => es[0].isIntersecting && onMore(), { rootMargin: '600px' });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [onMore]);
  return <div ref={ref} className="center pad-top"><button className="btn secondary small" onClick={onMore}>Show more ({left})</button></div>;
}

async function filesFor(ids) {
  return Promise.all(ids.slice(0, 20).map(async id => {
    const blob = await (await fetch(photoUrl(id))).blob();
    return new File([blob], `troop23-${id}.jpg`, { type: blob.type || 'image/jpeg' });
  }));
}
function ShareButton({ ids }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const files = await filesFor(ids);
      if (navigator.canShare?.({ files })) await navigator.share({ files });
      else for (const file of files) { const u = URL.createObjectURL(file); const l = document.createElement('a'); l.href = u; l.download = file.name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    } catch { /* cancelled */ } finally { setBusy(false); }
  }
  return <button className="btn small on-dark-btn" disabled={!ids.length || busy} onClick={run} title={ids.length > 20 ? 'Saves the first 20' : ''}><Icon name="download" size={15} />{busy ? 'Saving…' : 'Save'}</button>;
}

function Lightbox({ photos, index, byAlbum, favs, onFav, onClose, onGo, onPlay, onTagged, patrols }) {
  const p = photos[index];
  const leader = useLeaderMode();
  const [tagging, setTagging] = useState(false);
  const touch = useRef(null);
  const [saving, setSaving] = useState(false);
  const prev = () => index > 0 && onGo(index - 1);
  const next = () => index < photos.length - 1 && onGo(index + 1);
  useEffect(() => {
    const key = e => { if (tagging) return; if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); if (e.key === 'f') onFav(p.id); };
    addEventListener('keydown', key); document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', key); document.body.classList.remove('no-scroll'); };
  });
  useEffect(() => { [index - 1, index + 1].forEach(i => { if (photos[i]) { const im = new Image(); im.src = photoUrl(photos[i].id); } }); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = byAlbum.get(p.album);
  const fav = favs.includes(p.id);
  async function save() {
    setSaving(true);
    try {
      const [file] = await filesFor([p.id]);
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else { const u = URL.createObjectURL(file); const l = document.createElement('a'); l.href = u; l.download = file.name; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    } catch { /* cancelled */ } finally { setSaving(false); }
  }
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo"
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) (dx > 0 ? prev : next)(); }}>
      <div className="lb-top">
        <span className="lb-count">{index + 1} / {photos.length}</span>
        <span className="grow" />
        <button className={`icon-btn on-dark ${fav ? 'fav-on' : ''}`} onClick={() => onFav(p.id)} aria-pressed={fav} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}><Icon name="heart" /></button>
        {leader && <button className="icon-btn on-dark" onClick={() => setTagging(true)} aria-label="Tag scouts and patrol"><Icon name="tag" /></button>}
        <button className="icon-btn on-dark" onClick={onPlay} aria-label="Play this event as a slideshow"><Icon name="play" /></button>
        <button className="icon-btn on-dark" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="lb-stage">
        <img key={p.id} src={photoUrl(p.id)} alt={p.caption || 'Troop photo'} />
        {index > 0 && <button className="lb-nav left" onClick={prev} aria-label="Previous photo"><Icon name="chevronL" size={28} /></button>}
        {index < photos.length - 1 && <button className="lb-nav right" onClick={next} aria-label="Next photo"><Icon name="chevronR" size={28} /></button>}
      </div>
      <div className="lb-info">
        {p.caption && <p className="lb-caption">{p.caption}</p>}
        {p.tags?.length > 0 && <p className="lb-tags">{p.tags.map(t => <span key={t}>{t}</span>)}</p>}
        <p className="lb-meta">{a && <a href={`#/gallery?album=${a.id}`}>{a.emoji} {a.title}</a>}{a && ' · '}{p.patrol && <>{p.patrol} · </>}by {p.name} · {new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        <div className="btn-row tight">
          <button className="btn small on-dark-btn" onClick={save} disabled={saving}><Icon name="download" size={16} />{saving ? 'Saving…' : 'Save photo'}</button>
          {leader && !p.tagIds?.length && <button className="btn small on-dark-btn" onClick={() => setTagging(true)}><Icon name="tag" size={16} />Tag scouts</button>}
        </div>
      </div>
      {tagging && <TagSheet p={p} patrols={patrols} onClose={() => setTagging(false)} onSaved={() => { setTagging(false); onTagged(); }} />}
    </div>
  );
}

// Leaders tag who's in a photo (and its patrol) right from the gallery.
function TagSheet({ p, patrols, onClose, onSaved }) {
  const [roster, setRoster] = useState(null);
  const [tags, setTags] = useState(p.tagIds || []);
  const [patrol, setPatrol] = useState(p.patrol || '');
  const [msg, setMsg] = useState('');
  useEffect(() => { api('leader/permissions').then(d => setRoster(d.families.flatMap(f => f.scouts.map(s => ({ id: s.id, name: `${s.first}${s.lastInitial ? ` ${s.lastInitial}.` : ''}`, patrol: s.patrol, level: s.level }))))).catch(e => setMsg(e.message)); }, []);
  async function save() {
    setMsg('');
    try {
      const r = await api(`leader/photos/${p.id}`, { method: 'POST', body: { scouts: tags, patrol } });
      if (r.photo?.status === 'hidden') alert('A scout tagged here has "no photos" permission, so this photo was taken out of the gallery.');
      onSaved();
    } catch (e) { setMsg(e.message); }
  }
  return (
    <div className="lb-sheet" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lb-sheet-card" role="dialog" aria-modal="true" aria-label="Tag this photo">
        <div className="sheet-head"><h2>Who's in it?</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <img className="tag-preview" src={photoUrl(p.id, true)} alt="" />
        <label className="field"><span>Patrol</span><select value={patrol} onChange={e => setPatrol(e.target.value)}><option value="">None / whole troop</option>{patrols.filter(x => !/adult/i.test(x)).map(x => <option key={x}>{x}</option>)}</select></label>
        {roster ? <TagPicker scouts={roster} patrol={patrol} tags={tags} setTags={setTags} label="Scouts in this photo" /> : <p className="muted">Loading scouts…</p>}
        {msg && <p className="form-msg" role="alert">{msg}</p>}
        <div className="sheet-foot"><button className="btn" onClick={save}>Save tags</button></div>
      </div>
    </div>
  );
}

// Pick what goes in a slideshow. Used from the gallery and inside the slideshow.
export function SlideshowBuilder({ all, albumList, byAlbum, favs, patrols, initial = {}, onStart, dark }) {
  const [f, setF] = useState({ albums: [], year: '', type: '', patrol: '', fav: false, order: 'oldest', speed: 7, captions: true, cards: true, ...initial });
  const [q, setQ] = useState('');
  const set = patch => setF(x => ({ ...x, ...patch }));
  const base = filterPhotos(all, byAlbum, { ...f, albums: [] }, favs);
  const evs = [...new Set(base.map(p => p.album))].map(id => ({ id, a: byAlbum.get(id) || { title: 'Other photos', emoji: '📷' }, n: base.filter(p => p.album === id).length }))
    .sort((x, y) => (y.a.date || '').localeCompare(x.a.date || ''))
    .filter(e => !q || `${e.a.title} ${e.a.location || ''}`.toLowerCase().includes(q.toLowerCase()));
  const count = filterPhotos(all, byAlbum, f, favs).length;
  const years = [...new Set(all.map(p => yearOf(p.at)))].sort((a, b) => b - a);
  const pickAll = () => set({ albums: [...new Set([...f.albums, ...evs.map(e => e.id)])] });
  function start() {
    const p = new URLSearchParams();
    if (f.albums.length) p.set('albums', f.albums.join(','));
    for (const k of ['year', 'type', 'patrol']) if (f[k]) p.set(k, f[k]);
    if (f.fav) p.set('fav', '1');
    p.set('order', f.order); p.set('speed', f.speed);
    if (!f.captions) p.set('cap', '0');
    if (!f.cards) p.set('cards', '0');
    onStart(p.toString());
  }
  return (
    <div className={`builder ${dark ? 'dark' : ''}`}>
      <div className="field"><span>Years</span>
        <div className="chip-wrap">
          <button className={`chip sm ${!f.year ? 'on' : ''}`} onClick={() => set({ year: '' })}>All</button>
          {years.map(y => <button key={y} className={`chip sm ${String(y) === String(f.year) ? 'on' : ''}`} onClick={() => set({ year: String(y) === String(f.year) ? '' : String(y), albums: [] })}>{y}</button>)}
        </div>
      </div>
      <div className="two-col">
        <label className="field"><span>Kind of event</span><select value={f.type} onChange={e => set({ type: e.target.value, albums: [] })}><option value="">Every kind</option>{troop.outingTypes.filter(t => all.some(p => byAlbum.get(p.album)?.type === t.id)).map(t => <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}</select></label>
        <label className="field"><span>Patrol</span><select value={f.patrol} onChange={e => set({ patrol: e.target.value })}><option value="">Every patrol</option>{patrols.map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <div className="field"><span>Events <i className="opt">{f.albums.length ? `${f.albums.length} picked` : 'none picked = all of them'}</i></span>
        <div className="search-row"><Icon name="search" size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find an event" aria-label="Find an event" /></div>
        <div className="btn-row tight"><button className="link-btn small" onClick={pickAll}>Pick all {evs.length} shown</button>{f.albums.length > 0 && <button className="link-btn small" onClick={() => set({ albums: [] })}>Clear picks</button>}</div>
        <ul className="ev-pick">
          {evs.map(e => { const on = f.albums.includes(e.id); return (
            <li key={e.id}><label className={on ? 'on' : ''}>
              <input type="checkbox" checked={on} onChange={() => set({ albums: on ? f.albums.filter(x => x !== e.id) : [...f.albums, e.id] })} />
              <span className="grow"><b>{e.a.emoji} {e.a.title}</b><span className="small muted">{[fmtDate(e.a.date), `${e.n} photo${e.n === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span></span>
            </label></li>
          ); })}
        </ul>
      </div>
      <label className="switch-row"><span className="grow"><b>Favorites only</b><span className="small muted">Photos you've hearted ({favs.length})</span></span><input type="checkbox" role="switch" checked={f.fav} onChange={e => set({ fav: e.target.checked })} /></label>
      <div className="two-col">
        <label className="field"><span>Order</span><select value={f.order} onChange={e => set({ order: e.target.value })}><option value="oldest">Oldest first (tells the story)</option><option value="newest">Newest first</option><option value="shuffle">Shuffle</option></select></label>
        <label className="field"><span>Each photo</span><select value={f.speed} onChange={e => set({ speed: +e.target.value })}>{[4, 7, 10, 15].map(s => <option key={s} value={s}>{s} seconds</option>)}</select></label>
      </div>
      <label className="switch-row"><span className="grow"><b>Event title cards</b><span className="small muted">Show the event name before its photos</span></span><input type="checkbox" role="switch" checked={f.cards} onChange={e => set({ cards: e.target.checked })} /></label>
      <label className="switch-row"><span className="grow"><b>Captions</b><span className="small muted">Caption, event and patrol on each photo</span></span><input type="checkbox" role="switch" checked={f.captions} onChange={e => set({ captions: e.target.checked })} /></label>
      <div className="sheet-foot"><button className="btn accent big" disabled={!count} onClick={start}><Icon name="play" size={18} />Play {count} photo{count === 1 ? '' : 's'}{count ? ` · about ${Math.max(1, Math.round(count * f.speed / 60))} min` : ''}</button></div>
    </div>
  );
}
