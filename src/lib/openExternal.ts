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
