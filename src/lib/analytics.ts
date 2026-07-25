// Funnel analytics — GA4, loaded only when a measurement id is configured.
//
// Ships dark by design: with no VITE_GA_ID set, every call here is a no-op and
// no third-party script is ever fetched. That keeps the bundle honest for
// anyone who clones the repo, and lets analytics be switched on by adding one
// environment variable in Vercel — no code change, no redeploy of logic.
//
// Privacy: only counts and opaque ids are sent. Never a name, email, phone,
// message body, or anything a person could be identified by — those belong in
// the database, not in a third-party analytics account.

const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim();

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loading: Promise<void> | null = null;

// Honour the browser's Do Not Track / Global Privacy Control signals rather
// than only the cookie banner.
function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
  const legacy = (window as unknown as { doNotTrack?: string }).doNotTrack;
  return nav.doNotTrack === '1' || legacy === '1' || nav.globalPrivacyControl === true;
}

function ensureLoaded(): Promise<void> {
  if (!GA_ID || optedOut()) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // an ad-blocker must never break the app
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: false,     // this is an SPA; pages are sent explicitly
      anonymize_ip: true,
    });
  });
  return loading;
}

/** Records a funnel event. Silently does nothing when analytics is off. */
export function track(event: string, params: Params = {}): void {
  if (!GA_ID || optedOut()) return;
  void ensureLoaded().then(() => window.gtag?.('event', event, params));
}

/** Records a screen change in the SPA. */
export function trackScreen(screen: string): void {
  if (!GA_ID || optedOut()) return;
  void ensureLoaded().then(() => window.gtag?.('event', 'page_view', {
    page_title: screen,
    page_location: `${window.location.origin}/#${screen}`,
  }));
}

// ─── The funnel worth watching ─────────────────────────────────────────────
// Each step answers a question the growth dashboard currently cannot:
// how many visitors look, how many start, and where they drop.

export const analytics = {
  viewHouse: (houseId: string, governorate?: string) =>
    track('view_item', { item_id: houseId, item_category: governorate }),

  searchHouses: (governorate?: string, hasDates?: boolean) =>
    track('search', { governorate, has_dates: !!hasDates }),

  startBooking: (houseId: string, guests: number, nights: number) =>
    track('begin_checkout', { item_id: houseId, guests, nights }),

  submitBooking: (houseId: string, totalPrice: number, guests: number) =>
    track('purchase_intent', { item_id: houseId, value: totalPrice, currency: 'EGP', guests }),

  signedUp: (role: string) => track('sign_up', { method: 'app', role }),

  loggedIn: (method: string) => track('login', { method }),

  // A guest hit a login wall — the single most useful drop-off signal there is.
  hitLoginWall: (context: string) => track('login_required', { context }),
};
