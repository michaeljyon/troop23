// Phone notifications: turn on/off per device and choose what to hear about.
import { api } from './api.js';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'install' (iPhone: add to Home Screen first) | 'unsupported' | 'blocked'
export function pushSupport() {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  if (!('PushManager' in window) || !('Notification' in window)) return isIOS() && !standalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ok';
}
const b64 = s => { const p = '='.repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
async function reg(wait = 8000) {
  const r = await Promise.race([navigator.serviceWorker.ready, new Promise(res => setTimeout(() => res(null), wait))]);
  if (!r) throw new Error('Basecamp is still installing. Try again in a moment.');
  return r;
}
async function currentSub(wait) { try { return await (await reg(wait)).pushManager.getSubscription(); } catch { return null; } }

export async function pushStatus() {
  if (pushSupport() !== 'ok') return { on: false };
  const sub = await currentSub(3000);
  if (!sub || Notification.permission !== 'granted') return { on: false };
  return api('push/status', { method: 'POST', body: { endpoint: sub.endpoint } });
}

export async function enablePush(prefs) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked for Basecamp. Turn them on in your phone\'s Settings, then try again.' : 'Notifications weren\'t turned on.');
  const { publicKey } = await api('push/key');
  const r = await reg();
  let sub = await r.pushManager.getSubscription();
  if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
  return api('push/subscribe', { method: 'POST', body: { sub: sub.toJSON(), prefs } });
}
export async function savePushPrefs(prefs) {
  const sub = await currentSub();
  if (!sub) throw new Error('Turn notifications on first.');
  return api('push/subscribe', { method: 'POST', body: { sub: sub.toJSON(), prefs } });
}
export async function disablePush() {
  const sub = await currentSub();
  if (sub) { await api('push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
}
export const testPush = () => api('push/test', { method: 'POST', body: {} });
