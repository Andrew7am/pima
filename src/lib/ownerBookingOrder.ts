import { Booking } from '../types';

/**
 * The order an owner's booking list should be read in.
 *
 * There was no order at all: the list was filters chained onto whatever
 * sequence the rows arrived in, so a request waiting on a yes could sit below
 * a booking cancelled last spring, and «كل الحجوزات» — the tab an owner opens
 * first — was the one place you could not tell what was urgent.
 *
 * Kept here rather than inside the 2,000-line dashboard because this decides
 * what a person sees first when they open the app, and that deserves a test.
 */
export type BookingCategory =
  | 'new' | 'pending_payment' | 'confirmed'
  | 'arrivals_today' | 'departures_today' | 'completed' | 'cancelled';

export function categorizeBooking(b: Booking, todayStr: string): BookingCategory {
  if (b.status === 'pending') return 'new';
  if (b.status === 'rejected' || b.status === 'cancelled') return 'cancelled';
  if (b.status === 'completed') return 'completed';
  if (b.status === 'approved' && b.checkIn === todayStr) return 'arrivals_today';
  if (b.status === 'approved' && b.checkOut === todayStr) return 'departures_today';
  if (b.status === 'approved' && !b.depositPaid) return 'pending_payment';
  return 'confirmed';
}

/** Lower sorts first. Ordered by who is waiting on the owner, not by status. */
export const BOOKING_URGENCY: Record<BookingCategory, number> = {
  new: 0,               // someone is waiting on a yes or a no
  arrivals_today: 1,    // they turn up in hours
  pending_payment: 2,   // approved, money outstanding
  departures_today: 3,
  confirmed: 4,
  completed: 5,
  cancelled: 6,
};

/** Terminal groups read newest-first; everything else soonest-first. */
const TERMINAL = BOOKING_URGENCY.completed;

export function compareForOwner(a: Booking, b: Booking, todayStr: string): number {
  const ra = BOOKING_URGENCY[categorizeBooking(a, todayStr)];
  const rb = BOOKING_URGENCY[categorizeBooking(b, todayStr)];
  if (ra !== rb) return ra - rb;
  // Inside a group: the soonest arrival first, because that is the one being
  // prepared for. For finished and cancelled ones the most recent is what
  // anyone is actually looking for.
  return ra >= TERMINAL ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn);
}

export const sortForOwner = (list: Booking[], todayStr: string): Booking[] =>
  list.slice().sort((a, b) => compareForOwner(a, b, todayStr));
