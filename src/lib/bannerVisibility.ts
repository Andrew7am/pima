import { PromoBanner, User, Booking } from '../types';

// Is this banner supposed to be on screen right now?
//
// One place decides it, so the guest page, the admin list and the analytics
// panel can never disagree about what "live" means.
//
//   isActive   the manual off switch — always wins
//   draft      never shows
//   scheduled  shows only inside its own window
//   published  shows now (the default for every pre-migration-084 row)
export function isBannerLive(b: PromoBanner, now: number = Date.now()): boolean {
  if (!b.isActive) return false;
  const status = b.status ?? 'published';
  if (status === 'draft') return false;
  if (status === 'scheduled') {
    if (b.startsAt && now < new Date(b.startsAt).getTime()) return false;
    if (b.endsAt && now > new Date(b.endsAt).getTime()) return false;
  }
  return true;
}

// Does this visitor match the banner's audience? An empty audience — which is
// what every pre-migration-085 banner has — matches everyone, including
// logged-out visitors. A rule that needs an account (role/governorate/booked)
// can only match a signed-in user, so an anonymous visitor never sees a banner
// aimed at a specific segment.
export function matchesAudience(b: PromoBanner, user: User | null, bookings: Booking[] = []): boolean {
  const a = b.audience;
  if (!a) return true;
  const targeted = !!(a.roles?.length || a.governorates?.length || (a.booked && a.booked !== 'any'));
  if (!targeted) return true;
  if (!user) return false;

  if (a.roles?.length && !a.roles.includes(user.role)) return false;
  if (a.governorates?.length && !a.governorates.includes(user.governorate ?? '')) return false;
  if (a.booked && a.booked !== 'any') {
    const has = bookings.some((bk) => bk.userId === user.id && bk.status !== 'rejected' && bk.status !== 'cancelled');
    if (a.booked === 'yes' && !has) return false;
    if (a.booked === 'no' && has) return false;
  }
  return true;
}

// Stable 0..n-1 bucket from a string — the same visitor always lands in the
// same variant, so a split test measures the banner and not the shuffle.
function hashPick(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % n;
}

// Collapses split-test groups: banners sharing an `experiment` are variants of
// one test, and exactly one of them survives for this visitor.
export function pickExperimentVariants(banners: PromoBanner[], seed: string): PromoBanner[] {
  const groups = new Map<string, PromoBanner[]>();
  const out: PromoBanner[] = [];
  for (const b of banners) {
    if (!b.experiment) { out.push(b); continue; }
    const list = groups.get(b.experiment) ?? [];
    list.push(b);
    groups.set(b.experiment, list);
  }
  for (const [key, list] of groups) {
    const ordered = list.slice().sort((x, y) => x.id.localeCompare(y.id)); // stable order
    out.push(ordered[hashPick(`${seed}:${key}`, ordered.length)]);
  }
  return out;
}

// Human label for the admin list, so a scheduled-but-not-started banner reads
// differently from one that is actually running.
export function bannerStateLabel(b: PromoBanner, now: number = Date.now()): { label: string; tone: 'live' | 'idle' | 'warn' } {
  if (!b.isActive) return { label: 'متوقف', tone: 'idle' };
  const status = b.status ?? 'published';
  if (status === 'draft') return { label: 'مسودة', tone: 'idle' };
  if (status === 'scheduled') {
    if (b.startsAt && now < new Date(b.startsAt).getTime()) return { label: 'مجدول', tone: 'warn' };
    if (b.endsAt && now > new Date(b.endsAt).getTime()) return { label: 'منتهي', tone: 'warn' };
    return { label: 'يعمل الآن', tone: 'live' };
  }
  if (b.endsAt && now > new Date(b.endsAt).getTime()) return { label: 'منتهي', tone: 'warn' };
  return { label: 'منشور', tone: 'live' };
}
