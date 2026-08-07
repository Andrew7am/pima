import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// Native push registration. No-op on web (guarded), and the plugin is loaded via
// a dynamic import so it never ships in the web bundle. Requires a Firebase (FCM)
// project on Android and APNs on iOS to actually deliver — see the push runbook.
let listenersBound = false;

export async function registerPushNotifications(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    if (!listenersBound) {
      listenersBound = true;
      // Fired once the OS hands us the FCM/APNs token — persist it for the server.
      PushNotifications.addListener('registration', async (token) => {
        const platform = Capacitor.getPlatform(); // 'android' | 'ios'
        const { error } = await supabase.from('device_tokens').upsert(
          { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
          { onConflict: 'token' },
        );
        if (error) console.warn('device_tokens upsert failed:', error);
      });
      PushNotifications.addListener('registrationError', (err) => console.warn('push registrationError:', err));
    }

    await PushNotifications.register();
  } catch (e) {
    // Plugin missing (web) or not yet configured — never break the app over push.
    console.warn('registerPushNotifications skipped:', e);
  }
}

// ─── Web push ────────────────────────────────────────────────────────────────
//
// The half that did not exist. registerPushNotifications returns on its first
// line for anything that is not the Android app, so until now every visitor on
// pimastay.com got in-app notifications only: nothing reached them once the tab
// was closed, which is the moment a notification is actually worth sending.
//
// It rides the SAME path as native — an FCM token in `device_tokens`, delivered
// by the existing send-push function — because FCM treats a web token like any
// other. One Firebase project, one webhook, one sender; no second protocol and
// no second table.

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/** True when the browser can do this AND the project has been configured.
 *  Used to decide whether to offer the opt-in at all — showing a switch that
 *  cannot work is worse than showing nothing. */
export function webPushAvailable(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window &&
    Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && VAPID_KEY)
  );
}

export type WebPushState = 'unsupported' | 'default' | 'granted' | 'denied';

// Browser permission is NOT the same thing as "Pima is sending to this
// browser". A page cannot revoke its own permission, so switching the feature
// off deletes the token and leaves permission granted. Without this flag the
// switch would read 'granted' and spring back ON after a reload — and worse,
// syncWebPushToken would re-register the very token the user just removed.
const ENABLED_KEY = 'pima_web_push_on';

function locallyEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
function setLocallyEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch { /* private mode — the token in the DB is still the real state */ }
}

export function webPushState(): WebPushState {
  if (!webPushAvailable()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && locallyEnabled()) return 'granted';
  return 'default';
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  // The config travels as query params because a service worker cannot read
  // import.meta.env. All of it is public Firebase web config — the credential
  // that can actually send lives only in the edge function.
  const qs = new URLSearchParams({
    apiKey: FIREBASE_CONFIG.apiKey!,
    projectId: FIREBASE_CONFIG.projectId!,
    messagingSenderId: FIREBASE_CONFIG.messagingSenderId ?? '',
    appId: FIREBASE_CONFIG.appId ?? '',
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`, { scope: '/' });
}

async function storeWebToken(userId: string): Promise<boolean> {
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG as Record<string, string>);
  const registration = await swRegistration();
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY!,
    serviceWorkerRegistration: registration,
  });
  if (!token) return false;

  const { error } = await supabase.from('device_tokens').upsert(
    { user_id: userId, token, platform: 'web', updated_at: new Date().toISOString() },
    { onConflict: 'token' },
  );
  if (error) {
    console.warn('device_tokens upsert failed (web):', error);
    return false;
  }
  return true;
}

/**
 * Ask for permission and register this browser. Must be called from a real
 * click.
 *
 * Deliberately NOT called on page load: an unprompted permission dialog is
 * dismissed by most people, and once denied it cannot be asked again from the
 * page — one bad auto-prompt costs that browser its notifications permanently.
 * Chrome also penalises origins that do it.
 */
export async function enableWebPush(userId: string): Promise<WebPushState> {
  if (!webPushAvailable()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission as WebPushState;
    const stored = await storeWebToken(userId);
    if (!stored) return 'default';
    setLocallyEnabled(true);
    return 'granted';
  } catch (e) {
    console.warn('enableWebPush failed:', e);
    return webPushState();
  }
}

/**
 * Stop sending to THIS browser.
 *
 * A page cannot revoke its own notification permission — only the user can, in
 * browser settings. So «off» means removing this browser's token, which is what
 * actually stops the notifications. Scoped to this one token on purpose: the
 * same account signed in on a phone and a laptop should be able to silence one
 * without silencing the other.
 */
export async function disableWebPush(): Promise<void> {
  setLocallyEnabled(false);
  if (!webPushAvailable() || Notification.permission !== 'granted') return;
  try {
    const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG as Record<string, string>);
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY!,
      serviceWorkerRegistration: await swRegistration(),
    });
    if (token) await supabase.from('device_tokens').delete().eq('token', token);
  } catch (e) {
    console.warn('disableWebPush failed:', e);
  }
}

/**
 * Refresh the stored token for a browser that already granted permission.
 *
 * Safe to call on every login because it never prompts — it returns early
 * unless permission is already 'granted'. Needed because FCM tokens rotate,
 * and a stale token is a notification that silently goes nowhere.
 */
export async function syncWebPushToken(userId: string): Promise<void> {
  if (webPushState() !== 'granted') return;
  try {
    await storeWebToken(userId);
  } catch (e) {
    console.warn('syncWebPushToken failed:', e);
  }
}
