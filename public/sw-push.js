// Phone notifications for Troop 23 Basecamp (loaded by the app's service worker).
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Troop 23 Basecamp';
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: '/brand/icon-192.png', badge: '/brand/icon-192.png', data: { url: d.url || '#/' },
    }),
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null,
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.url) || '#/';
  const target = new URL('/' + hash.replace(/^\/?/, ''), self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        try { await w.navigate(target); } catch { w.postMessage({ type: 'open', hash }); }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
