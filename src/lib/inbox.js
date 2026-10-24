// One shared poll of the member's conversations, used by the tab badge,
// header bell, Home "needs your reply" card and the welcome-back sheet.
import { useEffect, useState } from 'react';
import { api } from './api.js';

let state = { threads: null, unread: 0, reply: 0 };
const subs = new Set();
let timer = null, inflight = null;
const emit = () => subs.forEach(f => f(state));

export function refreshInbox() {
  if (inflight) return inflight;
  inflight = api('threads').then(d => {
    const threads = d.threads || [];
    state = { threads, unread: threads.filter(t => t.unread).length, reply: threads.filter(t => t.needsReply).length };
    try { const c = new Set(threads.filter(t => t.unread || t.needsReply).map(t => t.id)).size; if (c) navigator.setAppBadge?.(c); else navigator.clearAppBadge?.(); } catch { /* not supported */ }
    emit();
  }).catch(() => {}).finally(() => { inflight = null; });
  return inflight;
}

export function useInbox(on) {
  const [s, setS] = useState(state);
  useEffect(() => {
    if (!on) return undefined;
    subs.add(setS);
    if (subs.size === 1) {
      refreshInbox();
      timer = setInterval(() => document.visibilityState === 'visible' && refreshInbox(), 45000);
      document.addEventListener('visibilitychange', onShow);
      addEventListener('threads-read', refreshInbox);
    } else setS(state);
    return () => {
      subs.delete(setS);
      if (!subs.size) { clearInterval(timer); document.removeEventListener('visibilitychange', onShow); removeEventListener('threads-read', refreshInbox); }
    };
  }, [on]);
  return on ? s : { threads: null, unread: 0, reply: 0 };
}
function onShow() { if (document.visibilityState === 'visible') refreshInbox(); }
