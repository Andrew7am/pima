import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
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

// PWA: register the service worker so بيما is installable ("add to home screen")
// and works offline. Web + production only — never inside the Capacitor app
// (it has its own WebView) and never in dev (avoids stale-cache surprises).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed:', err));
  });
}
