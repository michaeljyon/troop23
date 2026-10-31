import { useEffect, useState } from 'react';

// Tiny hash router: #/gallery?album=derby, #/outing/abc?tab=meals
//
// Navigation works by *page*, not by every tap:
// - Switching tabs or filters inside a page (same screen, same item) replaces
//   the current history entry instead of adding one, so the phone's back
//   gesture and our Back button skip over them.
// - Back goes to the page you came from, named on the button ("‹ Outings").
//   If you opened a page directly (a link or notification), it goes to the
//   page's parent section instead of leaving the app.
function parse(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '') || 'home';
  const [path, qs = ''] = raw.split('?');
  const [name, ...args] = path.split('/').filter(Boolean);
  return { name: name || 'home', args, query: Object.fromEntries(new URLSearchParams(qs)) };
}
// a "page" is a screen plus the item it shows (an outing, a hike, a scout…)
// (a few screens open a sub-page with a query value, like a photo album)
const SUBPAGE = { gallery: 'album' };
const pageKey = r => `${r.name}/${r.args[0] || ''}${SUBPAGE[r.name] && r.query[SUBPAGE[r.name]] ? `/${r.query[SUBPAGE[r.name]]}` : ''}`;

// friendly names for the Back button and the parent of each page
const NAMES = {
  home: 'Home', outings: 'Outings', outing: 'Outing', gallery: 'Photos', kitchen: 'Kitchen', gear: 'Gear locker', packing: 'Packing list',
  messages: 'Chat', thread: 'Chat', more: 'More', leaders: 'Leader tools', advancement: 'Advancement', counselors: 'Counselors',
  hikes: 'Hikes', track: 'Recording', permission: 'Photo permission', snap: 'Snap', slideshow: 'Slideshow',
};
export function pageName(r) {
  if (r.name === 'advancement' && r.args[0]) return 'Scout';
  if (r.name === 'hikes' && r.args[0]) return 'Hike';
  if (r.name === 'thread') return 'Conversation';
  if (r.name === 'gallery' && r.query.album) return 'Album';
  return NAMES[r.name] || 'Back';
}
export function parentOf(r) {
  if (r.name === 'gallery' && r.query.album) return 'gallery';
  if (r.args[0] && ['advancement', 'hikes'].includes(r.name)) return r.name;
  return { outing: 'outings', thread: 'messages', track: 'hikes', counselors: 'advancement', slideshow: 'gallery', snap: 'home', kitchen: 'more', gear: 'more', gallery: 'more',
    packing: 'more', permission: 'more', leaders: 'more', hikes: 'more', advancement: 'more', outings: 'home', messages: 'home', more: 'home' }[r.name] || 'home';
}

// pages visited this session, one entry per page (kept in step with history)
const STACK_KEY = 'nav-stack';
const readStack = () => { try { return JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]'); } catch { return []; } };
const writeStack = s => { try { sessionStorage.setItem(STACK_KEY, JSON.stringify(s.slice(-40))); } catch { /* private mode */ } };
let replacing = false;   // set while we replace the current history entry
function record(hash) {
  const r = parse(hash), key = pageKey(r);
  const s = readStack();
  if (replacing && s.length) { replacing = false; const at0 = s.map(x => x.key).lastIndexOf(key); if (at0 >= 0 && at0 < s.length - 1) s.splice(at0 + 1); else s[s.length - 1] = { key, hash, name: pageName(r) }; writeStack(s); return s; }
  const at = s.map(x => x.key).lastIndexOf(key);
  if (s.length && s[s.length - 1].key === key) s[s.length - 1].hash = hash;   // same page, new tab/filter
  else if (at >= 0) s.splice(at + 1);                                          // went back to an earlier page
  else s.push({ key, hash, name: pageName(r) });
  if (at >= 0) s[at].hash = hash;
  writeStack(s);
  return s;
}
let lastKey = pageKey(parse());
record(location.hash || '#/');

// links to the same page (tabs, filters) replace instead of adding history
if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || a.target) return;
    const href = a.getAttribute('href');
    if (pageKey(parse(href)) === lastKey && href !== location.hash) { e.preventDefault(); replacing = true; location.replace(href); }
  }, true);
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      const n = parse();
      record(location.hash || '#/');
      setR(n);
      const k = pageKey(n);
      if (k !== lastKey) window.scrollTo(0, 0);
      lastKey = k;
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

// go('outing/123?tab=meals'). Staying on the same page replaces history.
export const go = (to, { replace } = {}) => {
  const hash = to.startsWith('#') ? to : `#/${to}`;
  if (hash === location.hash) return;
  if (replace ?? pageKey(parse(hash)) === lastKey) { replacing = true; location.replace(hash); } else location.hash = hash;
};

// Where Back goes from here, and what it's called
export function backTarget(fallback) {
  const s = readStack();
  const cur = parse();
  if (s.length > 1 && s[s.length - 1].key === pageKey(cur)) return { hash: s[s.length - 2].hash, name: s[s.length - 2].name, history: true };
  const p = fallback || parentOf(cur);
  return { hash: `#/${p === 'home' ? '' : p}`, name: pageName(parse(`#/${p}`)), history: false };
}
export function back(fallback) {
  const t = backTarget(fallback);
  if (t.history && history.length > 1) {
    history.back();
    // if the browser's history didn't line up (e.g. after a redirect), go straight there
    const want = pageKey(parse(t.hash));
    setTimeout(() => { if (pageKey(parse()) !== want) { replacing = true; location.replace(t.hash); } }, 350);
  } else { replacing = true; location.replace(t.hash); }
}
export function useBackTarget(fallback) {
  const [t, setT] = useState(() => backTarget(fallback));
  useEffect(() => { const on = () => setT(backTarget(fallback)); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, [fallback]);
  return t;
}
