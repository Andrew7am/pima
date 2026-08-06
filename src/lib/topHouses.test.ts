import { describe, it, expect } from 'vitest';
import { topHousesByBookings, topHousesByCollected } from './topHouses';
import type { Booking, Payment, RetreatHouse } from '../types';

const houses = [
  { id: 'h1', name: 'بيت مارمرقس' },
  { id: 'h2', name: 'بيت مارمينا' },
  { id: 'h3', name: 'بيت العذراء' },
] as unknown as RetreatHouse[];

const MONTH_START = new Date('2026-08-01T00:00:00Z').getTime();

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف',
    userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
    checkIn: '2026-08-10', checkOut: '2026-08-12', guestsCount: 10,
    totalPrice: 1000, depositPaid: false, depositAmount: 150,
    status: 'approved', isLargeConferenceQuote: false,
    createdAt: '2026-08-05T00:00:00Z', ...over,
  } as Booking;
}

function payment(over: Partial<Payment> = {}): Payment {
  return {
    id: 'p1', bookingId: 'b1', userId: 'u1', amount: 500,
    paymentStatus: 'approved', createdAt: '2026-08-05T00:00:00Z', ...over,
  } as unknown as Payment;
}

describe('topHousesByBookings', () => {
  it('ranks by how many bookings were taken, not by their value', () => {
    const rows = topHousesByBookings([
      booking({ id: 'a', houseId: 'h1', totalPrice: 100 }),
      booking({ id: 'b', houseId: 'h1', totalPrice: 100 }),
      booking({ id: 'c', houseId: 'h2', totalPrice: 9000 }),
    ], houses, MONTH_START);
    expect(rows.map((r) => r.house.id)).toEqual(['h1', 'h2']);
    expect(rows[0].count).toBe(2);
    expect(rows[0].bookedValue).toBe(200);
  });

  // THE drift this replaces: the growth tab printed sum(totalPrice) under a
  // heading that read like revenue. Nothing here has necessarily been paid.
  it('reports booked value, which is not money received', () => {
    const rows = topHousesByBookings(
      [booking({ houseId: 'h1', totalPrice: 5000, depositPaid: false })],
      houses, MONTH_START,
    );
    expect(rows[0].bookedValue).toBe(5000);
  });

  it('ignores bookings nobody approved', () => {
    const rows = topHousesByBookings(([ 'pending', 'rejected', 'cancelled' ] as const).map(
      (status, i) => booking({ id: `x${i}`, status }),
    ), houses, MONTH_START);
    expect(rows).toEqual([]);
  });

  it('counts a completed stay — it happened', () => {
    const rows = topHousesByBookings([booking({ status: 'completed' })], houses, MONTH_START);
    expect(rows[0].count).toBe(1);
  });

  // Keyed on when the booking was MADE, because this measures demand
  // arriving. A stay this month booked last month is last month's demand.
  it('excludes bookings created before the window', () => {
    const rows = topHousesByBookings(
      [booking({ createdAt: '2026-07-28T00:00:00Z' })], houses, MONTH_START,
    );
    expect(rows).toEqual([]);
  });

  it('drops rows whose house no longer exists rather than rendering a blank', () => {
    const rows = topHousesByBookings([booking({ houseId: 'deleted' })], houses, MONTH_START);
    expect(rows).toEqual([]);
  });

  it('breaks ties on booked value so the order does not wander', () => {
    const rows = topHousesByBookings([
      booking({ id: 'a', houseId: 'h1', totalPrice: 100 }),
      booking({ id: 'b', houseId: 'h2', totalPrice: 900 }),
    ], houses, MONTH_START);
    expect(rows.map((r) => r.house.id)).toEqual(['h2', 'h1']);
  });

  it('keeps only the top N', () => {
    const rows = topHousesByBookings(
      houses.map((h, i) => booking({ id: `b${i}`, houseId: h.id })), houses, MONTH_START, 2,
    );
    expect(rows).toHaveLength(2);
  });
});

describe('topHousesByCollected', () => {
  const map = { b1: 'h1', b2: 'h2', b3: 'h1' };
  const ids = new Set(['b1', 'b2', 'b3']);

  it('ranks by money actually received', () => {
    const rows = topHousesByCollected([
      payment({ id: 'p1', bookingId: 'b1', amount: 300 }),
      payment({ id: 'p2', bookingId: 'b3', amount: 300 }),
      payment({ id: 'p3', bookingId: 'b2', amount: 1000 }),
    ], map, houses, ids);
    expect(rows.map((r) => r.id)).toEqual(['h2', 'h1']);
    expect(rows[0].collected).toBe(1000);
  });

  // A receipt still under review may yet be rejected. Counting it would tell
  // the admin money is in hand that is not.
  it('ignores payments that are not approved', () => {
    const rows = topHousesByCollected(([ 'pending', 'rejected' ] as const).map(
      (paymentStatus, i) => payment({ id: `p${i}`, paymentStatus }),
    ), map, houses, ids);
    expect(rows).toEqual([]);
  });

  it('respects the period filter it was handed', () => {
    const rows = topHousesByCollected(
      [payment({ bookingId: 'b1', amount: 300 })], map, houses, new Set(['b2']),
    );
    expect(rows).toEqual([]);
  });

  it('skips a payment whose booking has no house on file', () => {
    const rows = topHousesByCollected(
      [payment({ bookingId: 'orphan', amount: 300 })], { }, houses, new Set(['orphan']),
    );
    expect(rows).toEqual([]);
  });

  it('falls back to the id when the house was deleted', () => {
    const rows = topHousesByCollected(
      [payment({ bookingId: 'b1', amount: 300 })], { b1: 'gone' }, houses, ids,
    );
    expect(rows[0].name).toBe('gone');
  });
});

// The two answers are allowed to disagree — that is why they have different
// names. This pins the disagreement so nobody "fixes" one to match the other.
describe('the two questions are different questions', () => {
  it('can rank the same houses in opposite orders', () => {
    const bookings = [
      booking({ id: 'b1', houseId: 'h1', totalPrice: 200 }),
      booking({ id: 'b3', houseId: 'h1', totalPrice: 200 }),
      booking({ id: 'b2', houseId: 'h2', totalPrice: 5000 }),
    ];
    const byBookings = topHousesByBookings(bookings, houses, MONTH_START);
    const byCollected = topHousesByCollected(
      [payment({ id: 'p1', bookingId: 'b2', amount: 5000 })],
      { b1: 'h1', b2: 'h2', b3: 'h1' }, houses, new Set(['b1', 'b2', 'b3']),
    );
    expect(byBookings[0].house.id).toBe('h1');
    expect(byCollected[0].id).toBe('h2');
  });
});
