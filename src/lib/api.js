import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from './store.js';

export const troopCode = () => readLocal('troop-code', '');
export const setTroopCode = c => writeLocal('troop-code', c);
export const leaderPass = () => sessionStorage.getItem('leader-pass') || '';

export async function api(path, { method = 'GET', body, leader } = {}) {
  const h = { Accept: 'application/json' };
  if (body) h['Content-Type'] = 'application/json';
  const code = troopCode();
  if (code) h['x-troop-code'] = code;
  const lp = leader || leaderPass();
  if (lp) h['x-leader-passcode'] = lp;
  let res;
  try { res = await fetch(`/api/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch { const e = new Error('No connection. Check your signal and try again.'); e.offline = true; throw e; }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('leader') && path !== 'join') setTroopCode('');
    const e = new Error(data?.error || (res.status === 404 && !data ? 'The pack server isn\'t running on this deploy.' : `Request failed (${res.status})`));
    e.status = res.status; throw e;
  }
  return data;
}

// Image URLs carry the pack code as ?k= because <img> can't send headers.
export const photoUrl = (id, thumb) => `/api/photos/${id}${thumb ? '/thumb' : ''}?k=${encodeURIComponent(troopCode())}`;
export const leaderPhotoUrl = (id, pass, thumb) => `/api/leader/photos/${id}/${thumb ? 'thumb' : 'file'}?lk=${encodeURIComponent(pass)}`;

// Small shared fetch hook with a refresh().
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stop = false;
    setState(s => ({ ...s, loading: true }));
    api(path).then(data => !stop && setState({ data, error: null, loading: false }))
      .catch(error => !stop && setState(s => ({ data: s.data, error, loading: false })));
    return () => { stop = true; };
  }, [path, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, refresh: () => setTick(x => x + 1) };
}

// Leader mode: the leader passcode lives in this browser tab's session only.
const leaderSubs = new Set();
export function setLeaderPass(p) {
  if (p) sessionStorage.setItem('leader-pass', p); else sessionStorage.removeItem('leader-pass');
  leaderSubs.forEach(f => f(!!p));
}
export function useLeaderMode() {
  const [on, setOn] = useState(!!leaderPass());
  useEffect(() => { leaderSubs.add(setOn); return () => leaderSubs.delete(setOn); }, []);
  return on;
}

// Save a document in a collection (PUT /api/c/:col/:id).
export const saveDoc = (col, id, doc, by) => api(`c/${col}/${id}`, { method: 'PUT', body: { ...doc, _by: by || '' } });
export const deleteDoc = (col, id) => api(`c/${col}/${id}`, { method: 'DELETE' });

// List a collection: useCol('outings'), useCol('rsvps', { outing: id }).
export function useCol(col, query) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  const r = useApi(`c/${col}${qs}`);
  return { ...r, items: r.data?.items || [] };
}
export const usePatrols = () => { const s = useApi('settings'); return s.data?.patrols || null; };
