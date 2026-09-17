import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Telling an iPhone user the one thing that would make notifications work.
 *
 * iOS exposes the Notification API only to a site added to the Home Screen; in
 * an ordinary Safari tab it is absent. webPushAvailable() is therefore false
 * and the opt-in is hidden — correctly, it could not work — which leaves the
 * user with nothing on screen and no way to learn that two taps would fix it.
 *
 * The predicate has to be exact in both directions. A false positive sends
 * somebody to install an app that still will not notify them, which is worse
 * than staying quiet.
 */

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Mobile Safari/537.36';

const saved = {
  Notification: (globalThis as Record<string, unknown>).Notification,
  PushManager: (globalThis as Record<string, unknown>).PushManager,
};

function setUp(opts: { ua: string; canPush: boolean; standalone?: boolean; touchPoints?: number }) {
  vi.stubGlobal('navigator', {
    userAgent: opts.ua,
    maxTouchPoints: opts.touchPoints ?? 5,
    standalone: opts.standalone ?? false,
    serviceWorker: {},
  });
  vi.stubGlobal('matchMedia', () => ({ matches: Boolean(opts.standalone) }));
  if (opts.canPush) {
    (globalThis as Record<string, unknown>).Notification = class {};
    (globalThis as Record<string, unknown>).PushManager = class {};
  } else {
    delete (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).PushManager;
  }
}

// The module reads its config at import time, so each case re-imports it with
// the env it needs.
async function subject(configured: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_FIREBASE_API_KEY', configured ? 'k' : '');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', configured ? 'p' : '');
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', configured ? 'v' : '');
  const m = await import('./push');
  return m.iosNeedsHomeScreen;
}

beforeEach(() => {
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (saved.Notification) (globalThis as Record<string, unknown>).Notification = saved.Notification;
  if (saved.PushManager) (globalThis as Record<string, unknown>).PushManager = saved.PushManager;
});

describe('iosNeedsHomeScreen', () => {
  it('is true for an iPhone in an ordinary Safari tab', async () => {
    setUp({ ua: IPHONE, canPush: false });
    expect(await (await subject(true))()).toBe(true);
  });

  it('is false once the site is on the Home Screen', async () => {
    setUp({ ua: IPHONE, canPush: true, standalone: true });
    expect(await (await subject(true))()).toBe(false);
  });

  it('is false on Android, which can push from a tab', async () => {
    setUp({ ua: ANDROID, canPush: true });
    expect(await (await subject(true))()).toBe(false);
  });

  it('stays quiet when the project has no push keys', async () => {
    // Installing would not help — nothing can be sent either way.
    setUp({ ua: IPHONE, canPush: false });
    expect(await (await subject(false))()).toBe(false);
  });

  it('catches an iPad, which reports itself as a Mac', async () => {
    setUp({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      canPush: false,
      touchPoints: 5,
    });
    expect(await (await subject(true))()).toBe(true);
  });

  it('does not mistake a real Mac for an iPad', async () => {
    setUp({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      canPush: false,
      touchPoints: 0,
    });
    expect(await (await subject(true))()).toBe(false);
  });
});
