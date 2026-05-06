// Tidings service worker.
// Receives a Web Push with `{ count: N }` and updates the home-screen
// app-icon badge via the Web App Badging API. No notification UI —
// the badge is the entire signal (matches Magnify's pattern).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let count = 0;
  try {
    if (event.data) {
      const payload = event.data.json();
      if (typeof payload.count === 'number') count = payload.count;
    }
  } catch (e) {
    // Non-JSON payload — leave count at 0.
  }

  event.waitUntil((async () => {
    try {
      if (count > 0 && self.navigator && 'setAppBadge' in self.navigator) {
        await self.navigator.setAppBadge(count);
      } else if (self.navigator && 'clearAppBadge' in self.navigator) {
        await self.navigator.clearAppBadge();
      }
    } catch (err) {
      // Browser doesn't support badging — silently ignore.
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('/');
  })());
});
