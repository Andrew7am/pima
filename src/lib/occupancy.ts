import { Booking } from '../types';

/**
 * One definition of "occupancy" for the whole owner dashboard.
 *
 * There were four, all labelled الإشغال, all showing a different number:
 *
 *   OwnerDashboardShell  booked bed-days ÷ (beds × days in month)
 *   OwnerToday           days with ANY booking ÷ days in month  — capacity ignored
 *   OwnerCalendar        days with any booking ÷ days shown     — same, different range
 *   OwnerDashboardShell  beds occupied right now ÷ total beds   — a different thing entirely
 *
 * So a house with one guest booked for the whole month read 100% on two
 * screens and 3% on another, under the same word. An owner cannot price
 * against a number that changes depending on where they look — and the one
 * that ignores capacity is the dangerous one, because it says "full" when the
 * house is nearly empty.
 *
 * Two honest metrics, named apart:
 *
 *   occupancyRate  — bed-nights sold ÷ bed-nights available. The hotel
 *                    definition, the one that answers "should I raise prices".
 *   bedsInUseOn    — how many beds are slept in on a given night. A staffing
 *                    number, not a performance one.
 *
 * A day with any booking at all is not occupancy and is not offered here; if a
 * screen wants that, it should say «أيام محجوزة» and count them itself.
 */

/** Bookings that actually hold a bed. A request nobody accepted does not. */
export function heldBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.status === 'approved' || b.status === 'completed');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nights between two ISO dates. Check-out day is not a night slept. */
function nightsBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO);
  const b = Date.parse(toISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** Nights of a booking that fall inside [from, to). */
export function nightsInWindow(booking: Booking, fromISO: string, toISO: string): number {
  const start = booking.checkIn > fromISO ? booking.checkIn : fromISO;
  const end = booking.checkOut < toISO ? booking.checkOut : toISO;
  return nightsBetween(start, end);
}

export interface OccupancyInput {
  bookings: Booking[];
  /** Total beds the house can sell. Zero or missing → occupancy is unknowable. */
  bedsCount: number;
  /** Inclusive start, exclusive end — the same convention as check-in/check-out. */
  fromISO: string;
  toISO: string;
}

/**
 * Bed-nights sold ÷ bed-nights available, 0–100.
 *
 * Returns null rather than 0 when the house has no beds on file: "we do not
 * know" and "nobody came" are different answers, and showing ٠٪ for a house
 * that never entered its capacity reads as a business problem instead of a
 * missing field.
 */
export function occupancyRate({ bookings, bedsCount, fromISO, toISO }: OccupancyInput): number | null {
  const availableNights = nightsBetween(fromISO, toISO);
  if (bedsCount <= 0 || availableNights <= 0) return null;

  const soldBedNights = heldBookings(bookings).reduce(
    (sum, b) => sum + nightsInWindow(b, fromISO, toISO) * Math.max(0, b.guestsCount),
    0,
  );

  const pct = (soldBedNights / (bedsCount * availableNights)) * 100;
  // An overbooked window can exceed 100; report it rather than hide it — the
  // owner needs to see that more guests are booked than there are beds.
  return Math.round(pct);
}

/** Beds slept in on one night. Check-out day does not count as a night. */
export function bedsInUseOn(bookings: Booking[], dateISO: string): number {
  return heldBookings(bookings)
    .filter((b) => b.checkIn <= dateISO && dateISO < b.checkOut)
    .reduce((sum, b) => sum + Math.max(0, b.guestsCount), 0);
}

/** First and last day of a month, in the [from, to) form the helpers expect. */
export function monthWindow(year: number, monthIndex0: number): { fromISO: string; toISO: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextYear = monthIndex0 === 11 ? year + 1 : year;
  const nextMonth = monthIndex0 === 11 ? 0 : monthIndex0 + 1;
  return {
    fromISO: `${year}-${pad(monthIndex0 + 1)}-01`,
    toISO: `${nextYear}-${pad(nextMonth + 1)}-01`,
  };
}
