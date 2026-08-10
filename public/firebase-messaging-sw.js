/* Firebase Cloud Messaging service worker.
 *
 * This is what makes a notification arrive when the Pima tab is closed. The
 * page's own JS is not running then — only this worker is — so background
 * delivery lives here and nowhere else.
 *
 * Served from /firebase-messaging-sw.js by convention: the Firebase SDK looks
 * for exactly that path at the origin root, which is why the file sits in
 * public/ rather than being bundled.
 *
 * It cannot read import.meta.env, so the config is passed in as query params by
 * lib/push.ts when it registers the worker. Only the Firebase *web* config goes
 * here — all of it is public by design (it identifies the project, it does not
 * authorise sending). The service account that can actually send stays in the
 * send-push edge function.
 */
/* global importScripts, firebase, self */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

if (config.apiKey && config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    self.registration.showNotification(n.title || 'بيما', {
      body: n.body || '',
      // The only icon this project ships — site.webmanifest points at the same
      // file. /icon-192.png was invented; it does not exist, and a missing
      // icon silently degrades to the browser's generic bell.
      icon: '/pima-hero.png',
      badge: '/pima-hero.png',
      // RTL so Arabic bodies render correctly in the OS notification shade.
      dir: 'rtl',
      lang: 'ar',
      // Collapses repeats of the same booking into one entry instead of
      // stacking five notifications for five messages in one thread.
      tag: d.bookingId || d.type || undefined,
      data: d,
    });
  });
}

// Tapping the notification should land on the thing it is about, not just the
// home screen — and should focus an already-open Pima tab rather than opening
// a second one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.bookingId ? `/?booking=${data.bookingId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
