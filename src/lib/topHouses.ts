import type { Booking, Payment, RetreatHouse } from '../types';

/**
 * "Which houses are doing best" — asked two different ways, named two
 * different things.
 *
 * The admin panel used to answer this twice under one word. The النمو tab
 * ranked houses by how many bookings they took this month and printed the
 * booked value beside them; the التقارير tab ranked by how much money was
 * actually collected in the selected period. Both were called `topHouses`,
 * both were headed as though they were the same list, and neither said what
 * it ranked on — so a house with many small bookings led one list while a
 * house with one large paid booking led the other, and nothing on screen
 * explained why the two disagreed.
 *
 * They are both worth asking. They are not the same question, so they no
 * longer share a name:
 *
 *   - byBookings  → demand. Who is busy.
 *   - byCollected → cash. Who has actually paid in.
 *
 * Booked value is NOT revenue. A booking counts toward `bookedValue` the
 * moment it is approved, whether or not a pound has arrived, which is why
 * that field is not called revenue anywhere.
 */

export interface TopHouseByBookings {
  house: RetreatHouse;
  /** Bookings taken in the window. */
  count: number;
  /** Sum of totalPrice — what was booked, not what was collected. */
  bookedValue: number;
}

export interface TopHouseByCollected {
  id: string;
  name: string;
  /** Sum of approved payments. Money that actually arrived. */
  collected: number;
}

/** A booking holds a place once it is approved; pending and cancelled do not. */
function held(b: Booking): boolean {
  return b.status === 'approved' || b.status === 'completed';
}

/**
 * Busiest houses by number of bookings TAKEN in the window.
 *
 * Keyed on createdAt — when the booking was made — because this measures
 * demand arriving, not stays happening. Ties break on booked value so the
 * order is stable rather than dependent on Map insertion.
 */
export function topHousesByBookings(
  bookings: Booking[],
  houses: RetreatHouse[],
  fromTs: number,
  limit = 5,
): TopHouseByBookings[] {
  const perHouse = new Map<string, { count: number; bookedValue: number }>();
  for (const b of bookings) {
    if (!held(b)) continue;
    if (new Date(b.createdAt).getTime() < fromTs) continue;
    const cur = perHouse.get(b.houseId) ?? { count: 0, bookedValue: 0 };
    perHouse.set(b.houseId, { count: cur.count + 1, bookedValue: cur.bookedValue + b.totalPrice });
  }
  return [...perHouse.entries()]
    .map(([houseId, v]) => ({ house: houses.find((h) => h.id === houseId), ...v }))
    .filter((x): x is TopHouseByBookings => Boolean(x.house))
    .sort((a, b) => b.count - a.count || b.bookedValue - a.bookedValue)
    .slice(0, limit);
}

/**
 * Highest-collecting houses by money actually received.
 *
 * Only approved payments count — a payment awaiting verification may still
 * be rejected, and counting it would tell the admin money is in hand that
 * is not. `bookingIds` is the set already narrowed by the period filter, so
 * the window is whatever the admin selected rather than a second opinion
 * about dates.
 */
export function topHousesByCollected(
  payments: Payment[],
  bookingHouseId: Record<string, string>,
  houses: RetreatHouse[],
  bookingIds: Set<string>,
  limit = 5,
): TopHouseByCollected[] {
  const collected: Record<string, number> = {};
  for (const p of payments) {
    if (p.paymentStatus !== 'approved') continue;
    if (!bookingIds.has(p.bookingId)) continue;
    const hid = bookingHouseId[p.bookingId];
    if (!hid) continue;
    collected[hid] = (collected[hid] || 0) + p.amount;
  }
  return Object.entries(collected)
    .map(([id, amount]) => ({ id, name: houses.find((h) => h.id === id)?.name || id, collected: amount }))
    .sort((a, b) => b.collected - a.collected || a.name.localeCompare(b.name, 'ar'))
    .slice(0, limit);
}
