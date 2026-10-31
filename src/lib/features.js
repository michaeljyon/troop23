import { useApi, sessionToken, troopCode } from './api.js';

// Which parts of Basecamp the troop has switched on (Leader tools → Settings → Features),
// and the options that go with them. Everything is on until leaders turn it off.
export const FEATURE_DEFAULTS = { games: true, hikes: true, inspect: true, vote: true, notes: true, campfire: true, ceremonies: true, knots: true, points: true, hunts: true, duty: true, sky: true, coh: true, kitchen: true, gear: true, counselors: true };
export const OPT_DEFAULTS = { hikeHideEnds: true, voteLiveDefault: true, notesParentsPLC: false, gamesLive: true, fireSuggest: true, pointsInspect: true, pointsHunts: true };
// which screens belong to which switch
export const ROUTE_FEATURE = { games: 'games', play: 'games', live: 'games', hikes: 'hikes', track: 'hikes', inspect: 'inspect', vote: 'vote', notes: 'notes', campfire: 'campfire', ceremonies: 'ceremonies', knots: 'knots', points: 'points', hunts: 'hunts', sky: 'sky', coh: 'coh', kitchen: 'kitchen', gear: 'gear', counselors: 'counselors' };

import { useEffect } from 'react';
export const refreshSettings = () => dispatchEvent(new Event('settings-changed'));
export function useSettings() {
  const s = useApi(sessionToken() || troopCode() ? 'settings' : null);
  useEffect(() => { const f = () => s.refresh(); addEventListener('settings-changed', f); return () => removeEventListener('settings-changed', f); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { features: { ...FEATURE_DEFAULTS, ...(s.data?.features || {}) }, opts: { ...OPT_DEFAULTS, ...(s.data?.opts || {}) }, loaded: !!s.data, refresh: s.refresh };
}
export const useFeatures = () => useSettings().features;
export const useOpts = () => useSettings().opts;
