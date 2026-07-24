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
