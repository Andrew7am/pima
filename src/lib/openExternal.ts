import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Open a link that belongs outside the app.
 *
 * `window.open(url, '_blank')` is a no-op inside the Capacitor Android
 * WebView: nothing opens, nothing throws, and the tap simply does nothing.
 * That is why sharing a room code to WhatsApp appeared broken — the button
 * worked, the link was fine, and the WebView swallowed it.
 *
 * The app already knew this in one place. AuthScreen uses Browser.open for
 * the Google OAuth hand-off with a comment explaining that the WebView cannot
 * do it. This puts the same knowledge somewhere every caller can reach.
 *
 * A wa.me link opened this way lands in Chrome Custom Tabs, which recognises
 * it and hands off to the WhatsApp app — so the share sheet the player
 * expects is what they get.
 */
export async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
      return;
    } catch (err) {
      console.warn('openExternal:', err);
      // Fall through — a blocked plugin should not swallow the link silently.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** The canonical public address, as used by the invoice, the ICS feed and referrals. */
export const SITE_URL = 'https://pimastay.com';

/**
 * A wa.me share link. `to` is digits only — country code first, no '+' or
 * spaces, which is wa.me's own rule — or omitted to let the sender choose a
 * recipient from their contacts.
 */
export function whatsAppShareUrl(text: string, to?: string): string {
  const base = to ? `https://wa.me/${to.replace(/[^0-9]/g, '')}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** How long to wait for the WhatsApp app to take over before falling back. */
const APP_HANDOFF_MS = 1200;

/**
 * Share text through WhatsApp.
 *
 * Two wrong answers came before this one, and the difference matters:
 *
 *   window.open(waMe, '_blank')  — a silent no-op in the Android WebView.
 *                                  Nothing happened at all.
 *   Browser.open({ url: waMe })  — opens a Chrome Custom Tab INSIDE the app,
 *                                  which loads wa.me: a web page that then
 *                                  asks to open WhatsApp. Better than
 *                                  nothing, still not sharing.
 *
 * The scheme URL is what actually reaches the app. Capacitor's WebViewClient
 * hands any scheme it does not recognise to an Android Intent, and
 * `whatsapp://send` is registered by WhatsApp itself — so the compose screen
 * opens directly with the text already in it.
 *
 * If WhatsApp is not installed the intent goes nowhere and the page simply
 * stays put, which is why the wa.me fallback is armed on a timer: if we are
 * still on screen after a moment, the hand-off did not happen. Leaving the
 * app cancels it, because the page is hidden by then.
 */
export async function shareToWhatsApp(text: string, to?: string): Promise<void> {
  const waMe = whatsAppShareUrl(text, to);

  if (!Capacitor.isNativePlatform()) {
    window.open(waMe, '_blank', 'noopener,noreferrer');
    return;
  }

  const digits = to ? to.replace(/[^0-9]/g, '') : '';
  const scheme = digits
    ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?text=${encodeURIComponent(text)}`;

  let handedOff = false;
  const markHandedOff = () => { handedOff = true; };
  document.addEventListener('visibilitychange', markHandedOff, { once: true });
  window.addEventListener('pagehide', markHandedOff, { once: true });

  window.location.href = scheme;

  setTimeout(() => {
    document.removeEventListener('visibilitychange', markHandedOff);
    window.removeEventListener('pagehide', markHandedOff);
    if (handedOff || document.visibilityState === 'hidden') return;
    // WhatsApp did not take it. A Custom Tab on wa.me at least gives the
    // sender somewhere to go, rather than a button that did nothing.
    void openExternal(waMe);
  }, APP_HANDOFF_MS);
}
