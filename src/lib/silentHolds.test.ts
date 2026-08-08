import { describe, it, expect } from 'vitest';
import { silentHolds, totalSilentHolds } from './silentHolds';
import type { Booking } from '../types';

const NOW = new Date(2026, 7, 8, 12).getTime();   // 8 Aug 2026, local

const bk = (over: Partial<Booking> & { id: string }): Booking => ({
  houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'مينا', userPhone: '',
  userEmail: '', userRole: 'servant', checkIn: '2026-08-12', checkOut: '2026-08-15',
  guestsCount: 40, totalPrice: 30000, depositPaid: false, depositAmount: 4500,
  status: 'pending', isLargeConferenceQuote: false, createdAt: '2026-08-02T00:00:00Z',
  ...over,
} as Booking);

describe('silentHolds', () => {
  it('counts the beds an unanswered request is holding out of search', () => {
    // check_booking_capacity counts pending as occupying, so to the whole
    // marketplace this is indistinguishable from a confirmed booking.
    const r = silentHolds({ bookings: [bk({ id: 'b1' })], now: NOW });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ houseId: 'h1', count: 1, bedsHeld: 40 });
  });

  it('adds up several requests on one house', () => {
    const r = silentHolds({
      bookings: [bk({ id: 'b1', guestsCount: 40 }), bk({ id: 'b2', guestsCount: 55 })], now: NOW,
    });
    expect(r[0]).toMatchObject({ count: 2, bedsHeld: 95 });
  });

  it('ignores anything the owner has already answered', () => {
    const r = silentHolds({
      bookings: [
        bk({ id: 'b1', status: 'approved' }),
        bk({ id: 'b2', status: 'rejected' }),
        bk({ id: 'b3', status: 'cancelled' }),
      ], now: NOW,
    });
    expect(r).toEqual([]);
  });

  it('ignores a request whose dates have already passed', () => {
    // Beds "held" for a week that is over is a stale row, not a live cost —
    // telling him he is holding them would be noise.
    const r = silentHolds({
      bookings: [bk({ id: 'b1', checkIn: '2026-07-01', checkOut: '2026-07-04' })], now: NOW,
    });
    expect(r).toEqual([]);
  });

  it('keeps a request whose stay is running right now', () => {
    const r = silentHolds({
      bookings: [bk({ id: 'b1', checkIn: '2026-08-07', checkOut: '2026-08-10' })], now: NOW,
    });
    expect(r).toHaveLength(1);
  });

  it('reports how long the oldest has been waiting', () => {
    const r = silentHolds({
      bookings: [
        bk({ id: 'b1', createdAt: '2026-08-06T00:00:00Z' }),
        bk({ id: 'b2', createdAt: '2026-08-02T00:00:00Z' }),
      ], now: NOW,
    });
    expect(r[0].oldestDays).toBe(6);
  });

  it('puts the house losing the most beds first', () => {
    const r = silentHolds({
      bookings: [
        bk({ id: 'b1', houseId: 'small', guestsCount: 10 }),
        bk({ id: 'b2', houseId: 'big', guestsCount: 90 }),
      ], now: NOW,
    });
    expect(r.map((h) => h.houseId)).toEqual(['big', 'small']);
  });

  it('can be scoped to one owner’s houses', () => {
    const r = silentHolds({
      bookings: [bk({ id: 'b1', houseId: 'mine' }), bk({ id: 'b2', houseId: 'someone-else' })],
      houseIds: ['mine'], now: NOW,
    });
    expect(r.map((h) => h.houseId)).toEqual(['mine']);
  });

  it('survives a booking with no createdAt rather than reporting NaN days', () => {
    const r = silentHolds({ bookings: [bk({ id: 'b1', createdAt: undefined })], now: NOW });
    expect(r[0].oldestDays).toBe(0);
  });

  it('rolls up across houses for the admin', () => {
    const holds = silentHolds({
      bookings: [
        bk({ id: 'b1', houseId: 'h1', guestsCount: 40 }),
        bk({ id: 'b2', houseId: 'h2', guestsCount: 25 }),
      ], now: NOW,
    });
    expect(totalSilentHolds(holds)).toEqual({ requests: 2, beds: 65 });
  });

  it('is empty when nothing is waiting', () => {
    expect(silentHolds({ bookings: [], now: NOW })).toEqual([]);
    expect(totalSilentHolds([])).toEqual({ requests: 0, beds: 0 });
  });
});
