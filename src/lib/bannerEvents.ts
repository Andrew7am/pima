import { supabase } from './supabase';

// First-party banner tracking (migration 083). Impressions and clicks are
// written straight to Pima's own database so the admin dashboard can show real
// numbers — unlike lib/analytics.ts, which forwards funnel events to GA4 and
// can never be read back into an admin screen.
//
// Privacy: no IP, no user-agent string, nothing identifying. Just an opaque
// per-tab session id, a coarse platform label and the viewport width.

export type BannerElementKind = 'button' | 'title' | 'subtitle' | 'badge' | 'image' | 'icons' | 'logo';

const SESSION_KEY = 'pima_banner_session';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 's_nostorage';
  }
}

function platform(): 'android' | 'ios' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'web';
}

// One impression per banner per tab-session — a rotating carousel must not
// inflate its own numbers every four seconds.
const seen = new Set<string>();

async function send(bannerId: string, kind: 'impression' | 'click', element?: BannerElementKind) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('banner_events').insert({
      banner_id: bannerId,
      kind,
      element: element ?? null,
      platform: platform(),
      viewport: typeof window !== 'undefined' ? Math.round(window.innerWidth) : null,
      session_id: sessionId(),
      user_id: auth?.user?.id ?? null,
    });
  } catch {
    // Tracking must never break the page or block a click.
  }
}

export function recordBannerImpression(bannerId?: string): void {
  if (!bannerId || seen.has(bannerId)) return;
  seen.add(bannerId);
  void send(bannerId, 'impression');
}

export function recordBannerClick(bannerId: string | undefined, element: BannerElementKind): void {
  if (!bannerId) return;
  void send(bannerId, 'click', element);
}
