import type { Booking } from '../types';

/**
 * The two things a seasonal business should be doing in February.
 *
 * Pima's whole year is a few weeks of summer. Migration 005 already knows it —
 * loyalty points are doubled for check-ins OUTSIDE July and August, to push
 * demand off the peak. But the admin panel had nothing that acted on the
 * season at all: no way to see which weeks ahead are still empty, and no way
 * to see which church groups came last year and have not come back.
 *
 * Both are computed entirely from bookings the app already has.
 */

const DAY = 86400000;

/**
 * Everything here is a CALENDAR day, so nothing may touch UTC.
 *
 * The first version mixed the two — local midnight for the arithmetic,
 * toISOString() for the labels. In Egypt (UTC+2/+3) that shifted every date
 * back one day, which was not merely a cosmetic off-by-one on the week
 * headings: blockedDates are plain 'YYYY-MM-DD' calendar strings, so the
 * blocked-night lookup was comparing against the wrong night and pricing beds
 * as empty that the owner had taken off the market, and vice versa.
 *
 * new Date('2026-08-07') also parses as UTC midnight by spec, which lands on
 * the 6th anywhere west of Greenwich. Date-only strings are therefore split by
 * hand rather than handed to the Date parser.
 */
const iso = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const dayStart = (d: string | Date) => {
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? NaN : new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
};
const isLive = (b: Booking) => b.status !== 'cancelled' && b.status !== 'rejected';
const isConfirmed = (b: Booking) => b.status === 'approved' || b.status === 'completed';

// ---------------------------------------------------------------------------
// Who came last year and has not come back
// ---------------------------------------------------------------------------

export interface RenewalRow {
  /** The church or group, falling back to the person when there is no group. */
  key: string;
  name: string;
  userId: string;
  phone: string;
  lastCheckIn: string;
  lastHouseName: string;
  lastGuests: number;
  lastTotal: number;
}

/**
 * A church that brought forty teenagers last August will bring forty more this
 * August — but only if somebody calls them before the houses fill.
 *
 * Grouped by organizationName because the CHURCH is the customer, not whichever
 * servant happened to hold the phone that year. Where there is no organisation
 * the person is the group.
 *
 * `windowDays` widens the anniversary either side, since nobody rebooks on the
 * exact date. Anyone with any live booking in the future is already back and
 * drops out.
 */
export function pendingRenewals(args: {
  bookings: Booking[];
  now?: number;
  windowDays?: number;
}): RenewalRow[] {
  const now = args.now ?? Date.now();
  const windowDays = args.windowDays ?? 45;

  const anniversary = now - 365 * DAY;
  const from = anniversary - windowDays * DAY;
  const to = anniversary + windowDays * DAY;

  const keyOf = (b: Booking) => (b.organizationName || '').trim() || `user:${b.userId}`;

  // Anyone already booked for any future date is not a renewal target.
  const alreadyBack = new Set<string>();
  for (const b of args.bookings) {
    if (!isLive(b)) continue;
    const t = dayStart(b.checkIn);
    if (!Number.isNaN(t) && t >= dayStart(new Date(now))) alreadyBack.add(keyOf(b));
  }

  const best = new Map<string, RenewalRow>();
  for (const b of args.bookings) {
    if (!isConfirmed(b)) continue;
    const t = dayStart(b.checkIn);
    if (Number.isNaN(t) || t < from || t > to) continue;
    const key = keyOf(b);
    if (alreadyBack.has(key)) continue;

    const row: RenewalRow = {
      key,
      name: (b.organizationName || '').trim() || b.userName,
      userId: b.userId,
      phone: b.userPhone,
      lastCheckIn: b.checkIn,
      lastHouseName: b.houseName,
      lastGuests: b.guestsCount,
      lastTotal: b.totalPrice,
    };
    // Keep the biggest booking per group — that is the one worth the call.
    const prev = best.get(key);
    if (!prev || row.lastTotal > prev.lastTotal) best.set(key, row);
  }

  return [...best.values()].sort((a, b) => b.lastTotal - a.lastTotal);
}

// ---------------------------------------------------------------------------
// Bed-nights that are about to expire unsold
// ---------------------------------------------------------------------------

export interface WeekOccupancy {
  startISO: string;
  endISO: string;
  /** Bed-nights the approved houses could sell that week. */
  capacity: number;
  /** Bed-nights actually taken. */
  booked: number;
  emptyBeds: number;
  /** What those empty beds would have been worth at list price. */
  emptyValue: number;
  occupancyPct: number;
}

export interface HouseForOccupancy {
  id: string;
  name: string;
  bedsCount: number;
  pricePerNightPerPerson: number;
  status: string;
  blockedDates?: string[];
}

/**
 * A bed empty on a Friday in August is revenue that cannot be recovered — it
 * is not deferred to September, it is gone. This is the number that says which
 * week to put a banner on, and the promo-banner tool is already built.
 *
 * Only approved houses count as capacity; a pending listing cannot be sold.
 * Blocked dates are removed from capacity rather than counted as empty, since
 * the owner has taken those beds off the market himself.
 */
export function emptyBedNightsAhead(args: {
  houses: HouseForOccupancy[];
  bookings: Booking[];
  now?: number;
  weeks?: number;
}): { weeks: WeekOccupancy[]; totalEmptyValue: number; totalEmptyBeds: number } {
  const now = args.now ?? Date.now();
  const weekCount = args.weeks ?? 8;
  const start = dayStart(new Date(now));

  const sellable = args.houses.filter((h) => h.status === 'approved');
  const blocked = new Map(sellable.map((h) => [h.id, new Set(h.blockedDates ?? [])]));

  // Nights each live booking occupies, as bed-nights on the house.
  const takenByNight = new Map<string, number>();
  for (const b of args.bookings) {
    if (!isLive(b)) continue;
    const ci = dayStart(b.checkIn);
    const co = dayStart(b.checkOut);
    if (Number.isNaN(ci) || Number.isNaN(co)) continue;
    for (let t = ci; t < co; t += DAY) {
      const k = `${b.houseId}|${iso(t)}`;
      takenByNight.set(k, (takenByNight.get(k) || 0) + b.guestsCount);
    }
  }

  const weeks: WeekOccupancy[] = [];
  let totalEmptyValue = 0;
  let totalEmptyBeds = 0;

  for (let w = 0; w < weekCount; w++) {
    const wStart = start + w * 7 * DAY;
    let capacity = 0, booked = 0, emptyValue = 0;

    for (let d = 0; d < 7; d++) {
      const night = iso(wStart + d * DAY);
      for (const h of sellable) {
        if (blocked.get(h.id)?.has(night)) continue;
        capacity += h.bedsCount;
        const taken = Math.min(h.bedsCount, takenByNight.get(`${h.id}|${night}`) || 0);
        booked += taken;
        emptyValue += (h.bedsCount - taken) * h.pricePerNightPerPerson;
      }
    }

    const emptyBeds = capacity - booked;
    weeks.push({
      startISO: iso(wStart),
      endISO: iso(wStart + 6 * DAY),
      capacity, booked, emptyBeds, emptyValue,
      occupancyPct: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
    });
    totalEmptyValue += emptyValue;
    totalEmptyBeds += emptyBeds;
  }

  return { weeks, totalEmptyValue, totalEmptyBeds };
}

// ---------------------------------------------------------------------------
// Did they come back?
// ---------------------------------------------------------------------------

/**
 * One church, spelled the way people actually type it.
 *
 * organizationName is free text re-entered on every booking, so «كنيسة مار
 * جرجس» and «مارجرجس» are two different customers to any code that compares
 * the raw strings — and a return rate built on that over-reports churn,
 * because a church that came back under a slightly different spelling looks
 * like one that left.
 *
 * Normalises the things Egyptian Arabic typing varies on and nobody means:
 * the alef forms, ya vs alef maqsura, ta marbuta vs ha, tatweel, diacritics,
 * spacing, and the word «كنيسة» itself, which is present about half the time.
 */
export function normalizeOrgName(raw: string): string {
  return (raw || '')
    .replace(/[\u064B-\u0652\u0670]/g, '')      // harakat
    .replace(/\u0640/g, '')                      // tatweel
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')  // أ إ آ -> ا
    .replace(/\u0649/g, '\u064A')                // ى -> ي
    .replace(/\u0629/g, '\u0647')                // ة -> ه
    .replace(/^\s*كنيسه\s*/u, '')                // the word itself, post-normalisation
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ReturnCohort {
  /** Check-in year the group first appeared in. */
  year: number;
  groups: number;
  returned: number;
  /** 0-100. */
  ratePct: number;
}

/**
 * What share of the churches that came in one year came back the next.
 *
 * Nothing in this codebase measures this — a search for retention, cohort or
 * return rate finds nothing, and every figure on the growth tab is
 * arrival-side: new users, new bookings, a signup funnel. So the question
 * «are we keeping anyone» has never had an answer, in either direction.
 *
 * pendingRenewals answers a neighbouring question — who is due back — but it
 * windows to ±45 days around one anniversary and silently drops everyone
 * outside it, which is precisely the group that vanished. Same rows, counted
 * instead of listed.
 */
export function returnCohorts(args: { bookings: Booking[] }): ReturnCohort[] {
  const yearsByGroup = new Map<string, Set<number>>();

  for (const b of args.bookings) {
    if (!isConfirmed(b)) continue;
    const t = dayStart(b.checkIn);
    if (Number.isNaN(t)) continue;
    const key = normalizeOrgName(b.organizationName || '') || `user:${b.userId}`;
    const year = new Date(t).getFullYear();
    const set = yearsByGroup.get(key) ?? new Set<number>();
    set.add(year);
    yearsByGroup.set(key, set);
  }

  const perYear = new Map<number, { groups: number; returned: number }>();
  for (const years of yearsByGroup.values()) {
    for (const y of years) {
      const row = perYear.get(y) ?? { groups: 0, returned: 0 };
      row.groups += 1;
      if (years.has(y + 1)) row.returned += 1;
      perYear.set(y, row);
    }
  }

  return [...perYear.entries()]
    .map(([year, r]) => ({
      year, groups: r.groups, returned: r.returned,
      ratePct: r.groups > 0 ? Math.round((r.returned / r.groups) * 100) : 0,
    }))
    .sort((a, b) => a.year - b.year);
}
