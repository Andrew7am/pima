import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

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
 * Share text through WhatsApp, by whichever route the phone will allow.
 *
 * This took four attempts, and the reason is worth recording because each one
 * failed for a different reason:
 *
 *   window.open(waMe, '_blank')  — a silent no-op in the Android WebView.
 *                                  Nothing opened and nothing threw.
 *   Browser.open({ url: waMe })  — a Chrome Custom Tab INSIDE the app, which
 *                                  loads wa.me: a web page whose job is to
 *                                  ask to open WhatsApp. Not sharing.
 *   whatsapp:// via location     — the right idea, but Android 11 hides other
 *                                  apps unless <queries> names them, so the
 *                                  intent had nothing to resolve to.
 *   <queries> in the manifest    — correct, and it only takes effect in a
 *                                  freshly built APK.
 *
 * The share sheet is what finally works everywhere, and the distinction is
 * exact: a DIRECT launch has to resolve a target, and an invisible app
 * resolves to nothing. ACTION_SEND through the system chooser resolves
 * nothing at all — the OS draws the sheet and the user picks. Package
 * visibility never enters into it.
 *
 * The sheet cannot pre-fill a recipient, so a share aimed at one number still
 * goes through the scheme, then falls back to the clipboard. The order is
 * therefore: sheet (no recipient) → scheme → clipboard → wa.me in a tab.
 */
export type ShareOutcome = 'opened' | 'copied' | 'failed';

export async function shareToWhatsApp(text: string, to?: string): Promise<ShareOutcome> {
  const waMe = whatsAppShareUrl(text, to);

  if (!Capacitor.isNativePlatform()) {
    window.open(waMe, '_blank', 'noopener,noreferrer');
    return 'opened';
  }

  // The share sheet first, because it is the one route that does not depend
  // on package visibility at all.
  //
  // Android 11 hid other apps from us unless <queries> names them, which is
  // what broke every earlier attempt: a direct whatsapp:// intent has to
  // RESOLVE the target, and an invisible app resolves to nothing. ACTION_SEND
  // through the system chooser resolves nothing — the OS draws the sheet and
  // the user picks. So this works even where the direct launch cannot.
  //
  // The trade-off is that the recipient cannot be pre-filled, so a share
  // aimed at a specific number still tries the scheme first.
  if (!to) {
    try {
      await Share.share({ text, dialogTitle: 'مشاركة' });
      return 'opened';
    } catch {
      // Cancelled, or no share targets. Fall through to the scheme.
    }
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

  await new Promise((resolve) => setTimeout(resolve, APP_HANDOFF_MS));
  document.removeEventListener('visibilitychange', markHandedOff);
  window.removeEventListener('pagehide', markHandedOff);
  if (handedOff || document.visibilityState === 'hidden') return 'opened';

  // The hand-off did not happen, and on an APK built before the manifest
  // declared <queries> it never will — Android will not let this app see
  // WhatsApp, so nothing it tries can reach it.
  //
  // So stop trying to leave and make the button useful where it stands: put
  // the invitation on the clipboard. Pasting it into WhatsApp by hand is one
  // extra step, and it works on every build, today, with no rebuild and no
  // permission. A button that always does something beats a button that
  // silently does nothing.
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // Clipboard refused too — fall back to a browser tab on wa.me, which at
    // least puts the message somewhere the sender can act on.
    await openExternal(waMe);
    return 'failed';
  }
}
