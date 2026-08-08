import type { Booking } from '../types';

/**
 * The beds an owner's silence is holding off the market.
 *
 * check_booking_capacity counts a booking as occupying beds when its status is
 * 'pending' OR 'approved', and get_houses_availability runs the same maths for
 * search. That is the correct decision — search must never promise capacity the
 * insert would then reject — but it has a consequence nobody designed and no
 * screen shows: to the entire marketplace, a request the owner has not answered
 * is indistinguishable from a confirmed booking.
 *
 * So an owner who leaves three requests sitting has withdrawn those beds from
 * his own listing. He experiences that as «بيما مش بتجيبلي حد».
 *
 * Nothing here is new data. It is the same arithmetic the database already
 * performs, pointed at the owner instead of at the search results.
 */

export interface SilentHold {
  houseId: string;
  /** Requests waiting on him. */
  count: number;
  /** Beds those requests are holding out of search. */
  bedsHeld: number;
  /** Days the oldest has been waiting. */
  oldestDays: number;
  /** The window they cover, for the sentence. */
  firstCheckIn: string;
  lastCheckOut: string;
}

const DAY = 86400000;

const dayStart = (d: string | Date) => {
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  }
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? NaN : new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
};

/**
 * Pending requests, per house, with what they are costing.
 *
 * Only requests whose stay is still ahead: beds held for dates that have
 * already passed are a different problem (a stale row), and telling an owner
 * he is "holding" beds in a week that is over would be noise.
 */
export function silentHolds(args: {
  bookings: Booking[];
  houseIds?: string[];
  now?: number;
}): SilentHold[] {
  const now = args.now ?? Date.now();
  const today = dayStart(new Date(now));
  const scope = args.houseIds ? new Set(args.houseIds) : null;

  const byHouse = new Map<string, Booking[]>();
  for (const b of args.bookings) {
    if (b.status !== 'pending') continue;
    if (scope && !scope.has(b.houseId)) continue;
    const co = dayStart(b.checkOut);
    if (Number.isNaN(co) || co < today) continue;   // the stay is already over
    const list = byHouse.get(b.houseId) ?? [];
    list.push(b);
    byHouse.set(b.houseId, list);
  }

  const out: SilentHold[] = [];
  for (const [houseId, list] of byHouse) {
    const bedsHeld = list.reduce((s, b) => s + (b.guestsCount || 0), 0);
    const ages = list
      .map((b) => (b.createdAt ? Math.floor((now - new Date(b.createdAt).getTime()) / DAY) : 0))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const ins = list.map((b) => b.checkIn).sort();
    const outs = list.map((b) => b.checkOut).sort();
    out.push({
      houseId,
      count: list.length,
      bedsHeld,
      oldestDays: ages.length ? Math.max(...ages) : 0,
      firstCheckIn: ins[0],
      lastCheckOut: outs[outs.length - 1],
    });
  }

  // Most beds held first — that is the one costing him most.
  return out.sort((a, b) => b.bedsHeld - a.bedsHeld);
}

/** Every house's holds rolled into one figure, for the admin's cross-house view. */
export function totalSilentHolds(holds: SilentHold[]): { requests: number; beds: number } {
  return holds.reduce(
    (acc, h) => ({ requests: acc.requests + h.count, beds: acc.beds + h.bedsHeld }),
    { requests: 0, beds: 0 },
  );
}
