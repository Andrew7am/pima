import { PromoBanner } from '../types';

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
