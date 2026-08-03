import { useState } from 'react';
import App from './App';
import SplashScreen from './components/SplashScreen';

/**
 * The app, with its six seconds in front of it.
 *
 * The splash is a sibling of <App/> rather than a gate in front of it, which
 * is what makes scene 7 a dissolve and not a cut: the home screen is mounted,
 * laid out and has its data on the way while the animation is still playing,
 * so when the surface fades there is a real page underneath rather than a
 * loading state.
 *
 * It is skipped wherever six seconds would be six seconds in someone's way:
 * a shared house link, a group-registration link, a password reset. Those are
 * arrivals with a destination already in mind.
 */
function wantsSplash() {
  if (typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  // Named, not "any query string": a link with a utm tag on it is still
  // someone opening the app for the first time, and should still get this.
  if (new URLSearchParams(search).has('join')) return false;     // group sign-up
  if (/^\/house\//.test(pathname)) return false;                  // a shared place
  if (/type=recovery/.test(hash)) return false;                   // password reset
  return true;
}

export default function Boot() {
  const [splashDone, setSplashDone] = useState(() => !wantsSplash());

  return (
    <>
      <App />
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </>
  );
}
