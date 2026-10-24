import { useEffect, useState } from 'react';
import { readLocal, writeLocal, useLocal } from './store.js';

export const troopCode = () => readLocal('troop-code', '');
export const sessionToken = () => readLocal('session', '');
export const setTroopCode = c => writeLocal('troop-code', c);
export const leaderPass = () => sessionStorage.getItem('leader-pass') || '';

export async function api(path, { method = 'GET', body, leader } = {}) {
  const h = { Accept: 'application/json' };
  if (body) h['Content-Type'] = 'application/json';
  const code = troopCode();
  if (code) h['x-troop-code'] = code;
  const tok = sessionToken();
  if (tok) h['x-session'] = tok;
  const lp = leader || leaderPass();
  if (lp) h['x-leader-passcode'] = lp;
  let res;
  try { res = await fetch(`/api/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch { const e = new Error('No connection. Check your signal and try again.'); e.offline = true; throw e; }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && data?.error?.startsWith('Enter the troop code')) { setTroopCode(''); writeLocal('session', ''); }
    const e = new Error(data?.error || (res.status === 404 && !data ? 'The pack server isn\'t running on this deploy.' : `Request failed (${res.status})`));
    e.status = res.status; throw e;
  }
  return data;
}

// Image URLs carry the pack code as ?k= because <img> can't send headers.
export const photoUrl = (id, thumb) => `/api/photos/${id}${thumb ? '/thumb' : ''}?${sessionToken() ? `s=${sessionToken()}` : `k=${encodeURIComponent(troopCode())}`}`;
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
  const [acct] = useLocal('account', null);
  useEffect(() => { leaderSubs.add(setOn); return () => leaderSubs.delete(setOn); }, []);
  return on || !!acct?.member?.leader;
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

// ---------------------------------------------------------------- accounts
// A personal code (or invite link #/join/CODE) signs this device in. The
// account is refreshed from the server so patrol, leader role and linked
// scouts stay current, and it fills in the local "me" profile.
export async function redeemCode(code) {
  const r = await api('auth/redeem', { method: 'POST', body: { code } });
  writeLocal('session', r.token);
  await refreshAccount();
  return r;
}
export async function refreshAccount() {
  if (!sessionToken()) return null;
  try {
    const a = await api('me');
    writeLocal('account', a);
    const m = a.member;
    writeLocal('me', { name: m.name, role: m.role === 'scout' ? 'scout' : m.leader ? 'leader' : 'parent', patrol: m.patrol || readLocal('me', {}).patrol || '', memberId: m.id });
    return a;
  } catch (e) {
    if (e.status === 401) { writeLocal('session', ''); writeLocal('account', null); }
    return null;
  }
}
export async function signOut() {
  await api('auth/signout', { method: 'POST', body: {} }).catch(() => {});
  writeLocal('session', ''); writeLocal('account', null); writeLocal('me', { name: '', role: 'scout', patrol: '' }); writeLocal('troop-code', '');
}
export const useAccount = () => useLocal('account', null)[0];

// Keep a small piece of personal data in sync across this person's devices.
export function useSynced(key, fallback) {
  const [v, setV] = useLocal(key, fallback);
  const acct = useAccount();
  const sk = key.replace(/[^a-z0-9_-]/gi, '_');
  useEffect(() => {
    if (!acct) return;
    api(`me/data/${sk}`).then(d => { if (d.value != null) setV(d.value); }).catch(() => {});
  }, [acct?.member?.id, sk]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = next => {
    setV(next);
    if (!acct) return;
    clearTimeout(syncTimers[sk]);
    syncTimers[sk] = setTimeout(() => api(`me/data/${sk}`, { method: 'PUT', body: { value: readLocal(key, fallback) } }).catch(() => {}), 800);
  };
  return [v, set];
}
const syncTimers = {};
