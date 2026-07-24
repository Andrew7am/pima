import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

// Error tracking — production builds only, so local dev noise never pollutes
// the dashboard. The DSN is a publishable identifier (not a secret): it can
// only ingest events, never read them, so committing it here is safe and
// avoids per-machine/per-deploy env-var setup.
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://9cc7d646df79b75ea19028f29b95cc3b@o4511768990253056.ingest.de.sentry.io/4511768997789776',
    sendDefaultPii: false,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// We no longer ship a PWA — the goal is to drive real app downloads, not web
// installs. Actively remove any service worker a previous build registered on a
// visitor's device (and its caches), so nobody stays on a stale installed copy.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => undefined);
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => undefined);
  }
}
