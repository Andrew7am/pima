import { describe, it, expect } from 'vitest';
import { pendingRenewals, emptyBedNightsAhead, type HouseForOccupancy } from './seasonPlanning';
import type { Booking } from '../types';

const NOW = new Date('2026-08-07T12:00:00Z').getTime();

const bk = (over: Partial<Booking> & { id: string }): Booking => ({
  houseId: 'h1', houseName: 'بيت النور', userId: 'u1', userName: 'مينا', userPhone: '0100',
  userEmail: '', userRole: 'servant', checkIn: '2025-08-10', checkOut: '2025-08-13',
  guestsCount: 40, totalPrice: 30000, depositPaid: true, depositAmount: 4500,
  status: 'completed', isLargeConferenceQuote: false, ...over,
} as Booking);

describe('pendingRenewals', () => {
  it('finds a group that came this time last year and has not rebooked', () => {
    const rows = pendingRenewals({ bookings: [bk({ id: 'b1', organizationName: 'كنيسة مار مرقس' })], now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('كنيسة مار مرقس');
    expect(rows[0].lastGuests).toBe(40);
  });

  it('drops a group that has already booked again', () => {
    const bookings = [
      bk({ id: 'b1', organizationName: 'كنيسة مار مرقس' }),
      bk({ id: 'b2', organizationName: 'كنيسة مار مرقس', checkIn: '2026-08-20', status: 'approved' }),
    ];
    expect(pendingRenewals({ bookings, now: NOW })).toHaveLength(0);
  });

  it('does not count a cancelled rebooking as having come back', () => {
    const bookings = [
      bk({ id: 'b1', organizationName: 'كنيسة مار مرقس' }),
      bk({ id: 'b2', organizationName: 'كنيسة مار مرقس', checkIn: '2026-08-20', status: 'cancelled' }),
    ];
    expect(pendingRenewals({ bookings, now: NOW })).toHaveLength(1);
  });

  it('groups by the church, not by whoever held the phone that year', () => {
    const bookings = [
      bk({ id: 'b1', organizationName: 'كنيسة مار مرقس', userId: 'u1', totalPrice: 30000 }),
      bk({ id: 'b2', organizationName: 'كنيسة مار مرقس', userId: 'u2', totalPrice: 50000 }),
    ];
    const rows = pendingRenewals({ bookings, now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0].lastTotal).toBe(50000); // the booking worth calling about
  });

  it('treats a person with no church as their own group', () => {
    const rows = pendingRenewals({ bookings: [bk({ id: 'b1', organizationName: undefined })], now: NOW });
    expect(rows[0].name).toBe('مينا');
  });

  it('ignores a booking outside the anniversary window', () => {
    const rows = pendingRenewals({ bookings: [bk({ id: 'b1', checkIn: '2025-02-10' })], now: NOW });
    expect(rows).toHaveLength(0);
  });

  it('ignores bookings that were never confirmed', () => {
    const rows = pendingRenewals({ bookings: [bk({ id: 'b1', status: 'rejected' })], now: NOW });
    expect(rows).toHaveLength(0);
  });

  it('sorts the biggest group first', () => {
    const rows = pendingRenewals({
      bookings: [
        bk({ id: 'b1', organizationName: 'أ', totalPrice: 10000 }),
        bk({ id: 'b2', organizationName: 'ب', totalPrice: 90000 }),
      ], now: NOW,
    });
    expect(rows.map((r) => r.name)).toEqual(['ب', 'أ']);
  });
});

describe('emptyBedNightsAhead', () => {
  const house = (over: Partial<HouseForOccupancy> = {}): HouseForOccupancy => ({
    id: 'h1', name: 'بيت النور', bedsCount: 10, pricePerNightPerPerson: 100, status: 'approved', ...over,
  });

  it('prices a completely empty week at full capacity', () => {
    const r = emptyBedNightsAhead({ houses: [house()], bookings: [], now: NOW, weeks: 1 });
    expect(r.weeks[0].capacity).toBe(70);      // 10 beds x 7 nights
    expect(r.weeks[0].emptyBeds).toBe(70);
    expect(r.totalEmptyValue).toBe(7000);
    expect(r.weeks[0].occupancyPct).toBe(0);
  });

  it('subtracts the nights a booking actually occupies', () => {
    // 7-9 Aug is two nights (checkout day is not a night).
    const b = bk({ id: 'b1', checkIn: '2026-08-07', checkOut: '2026-08-09', guestsCount: 4, status: 'approved' });
    const r = emptyBedNightsAhead({ houses: [house()], bookings: [b], now: NOW, weeks: 1 });
    expect(r.weeks[0].booked).toBe(8);
    expect(r.weeks[0].emptyBeds).toBe(62);
    expect(r.totalEmptyValue).toBe(6200);
  });

  it('does not count a cancelled booking as occupying beds', () => {
    const b = bk({ id: 'b1', checkIn: '2026-08-07', checkOut: '2026-08-09', guestsCount: 4, status: 'cancelled' });
    expect(emptyBedNightsAhead({ houses: [house()], bookings: [b], now: NOW, weeks: 1 }).weeks[0].booked).toBe(0);
  });

  it('removes blocked nights from capacity instead of calling them empty', () => {
    // The owner took those beds off the market himself — they are not a
    // missed sale and must not be priced as one.
    const r = emptyBedNightsAhead({
      houses: [house({ blockedDates: ['2026-08-07', '2026-08-08'] })], bookings: [], now: NOW, weeks: 1,
    });
    expect(r.weeks[0].capacity).toBe(50);
    expect(r.totalEmptyValue).toBe(5000);
  });

  it('counts only approved houses as sellable capacity', () => {
    const r = emptyBedNightsAhead({
      houses: [house(), house({ id: 'h2', status: 'pending' })], bookings: [], now: NOW, weeks: 1,
    });
    expect(r.weeks[0].capacity).toBe(70);
  });

  it('never reports negative empty beds when a house is oversold', () => {
    const b = bk({ id: 'b1', checkIn: '2026-08-07', checkOut: '2026-08-08', guestsCount: 99, status: 'approved' });
    const r = emptyBedNightsAhead({ houses: [house()], bookings: [b], now: NOW, weeks: 1 });
    expect(r.weeks[0].emptyBeds).toBeGreaterThanOrEqual(0);
    expect(r.weeks[0].booked).toBe(10);
  });

  it('returns one row per week ahead', () => {
    const r = emptyBedNightsAhead({ houses: [house()], bookings: [], now: NOW, weeks: 8 });
    expect(r.weeks).toHaveLength(8);
    expect(r.weeks[0].startISO).toBe('2026-08-07');
    expect(r.weeks[1].startISO).toBe('2026-08-14');
  });
});

describe('calendar days, not UTC instants', () => {
  // The first version used local midnight for the arithmetic and
  // toISOString() for the labels. East of Greenwich that shifted every date
  // back a day — and since blockedDates are plain calendar strings, the
  // blocked-night lookup was comparing against the wrong night.
  const house: HouseForOccupancy = {
    id: 'h1', name: 'بيت', bedsCount: 10, pricePerNightPerPerson: 100, status: 'approved',
  };

  it('labels the first week from today, in local calendar terms', () => {
    const r = emptyBedNightsAhead({ houses: [house], bookings: [], now: NOW, weeks: 1 });
    const today = new Date(NOW);
    const p = (n: number) => String(n).padStart(2, '0');
    expect(r.weeks[0].startISO).toBe(`${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`);
  });

  it('blocks exactly the nights the owner named', () => {
    const first = emptyBedNightsAhead({ houses: [house], bookings: [], now: NOW, weeks: 1 }).weeks[0].startISO;
    const r = emptyBedNightsAhead({ houses: [{ ...house, blockedDates: [first] }], bookings: [], now: NOW, weeks: 1 });
    expect(r.weeks[0].capacity).toBe(60); // exactly one night of 10 beds removed
  });
});
