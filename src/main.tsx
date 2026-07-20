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
