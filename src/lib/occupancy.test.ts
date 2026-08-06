import { describe, it, expect } from 'vitest';
import { occupancyRate, bedsInUseOn, nightsInWindow, monthWindow, heldBookings } from './occupancy';
import type { Booking } from '../types';

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف',
    userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
    checkIn: '2026-08-01', checkOut: '2026-08-03', guestsCount: 10,
    totalPrice: 1000, depositPaid: false, depositAmount: 150,
    status: 'approved', isLargeConferenceQuote: false, createdAt: '2026-07-01T00:00:00Z',
    ...over,
  } as Booking;
}

const AUGUST = monthWindow(2026, 7); // 2026-08-01 → 2026-09-01, 31 nights

describe('occupancyRate', () => {
  // THE bug this replaces: OwnerToday counted "days with any booking ÷ days in
  // month", so one guest booked all month read 100% on a 40-bed house.
  it('measures beds sold, not days touched', () => {
    const oneGuestAllMonth = booking({ checkIn: '2026-08-01', checkOut: '2026-09-01', guestsCount: 1 });
    // 31 bed-nights sold out of 40 × 31 available.
    expect(occupancyRate({ bookings: [oneGuestAllMonth], bedsCount: 40, ...AUGUST })).toBe(3);
  });

  it('reads 100 only when every bed is sold every night', () => {
    const full = booking({ checkIn: '2026-08-01', checkOut: '2026-09-01', guestsCount: 40 });
    expect(occupancyRate({ bookings: [full], bedsCount: 40, ...AUGUST })).toBe(100);
  });

  it('adds up overlapping bookings', () => {
    const a = booking({ id: 'a', checkIn: '2026-08-01', checkOut: '2026-08-11', guestsCount: 20 });
    const b = booking({ id: 'b', checkIn: '2026-08-01', checkOut: '2026-08-11', guestsCount: 20 });
    // 2 × 10 nights × 20 guests = 400 of 40 × 31 = 1240 → 32%
    expect(occupancyRate({ bookings: [a, b], bedsCount: 40, ...AUGUST })).toBe(32);
  });

  it('counts only the nights that fall inside the window', () => {
    const straddling = booking({ checkIn: '2026-07-28', checkOut: '2026-08-03', guestsCount: 40 });
    // Only Aug 1 and Aug 2 are in August: 2 × 40 = 80 of 1240 → 6%
    expect(occupancyRate({ bookings: [straddling], bedsCount: 40, ...AUGUST })).toBe(6);
  });

  // A request nobody accepted holds no bed, so it cannot fill the house.
  it('ignores pending, rejected and cancelled bookings', () => {
    const ignored = (['pending', 'rejected', 'cancelled'] as const).map((status, i) =>
      booking({ id: `x${i}`, status, checkIn: '2026-08-01', checkOut: '2026-09-01', guestsCount: 40 }),
    );
    expect(occupancyRate({ bookings: ignored, bedsCount: 40, ...AUGUST })).toBe(0);
  });

  it('counts a completed stay — it happened', () => {
    const done = booking({ status: 'completed', checkIn: '2026-08-01', checkOut: '2026-09-01', guestsCount: 40 });
    expect(occupancyRate({ bookings: [done], bedsCount: 40, ...AUGUST })).toBe(100);
  });

  // "We do not know" and "nobody came" are different answers. Showing ٠٪ for a
  // house that never filled in its capacity reads as a business problem rather
  // than a missing field.
  it('answers null, not zero, when the house has no beds on file', () => {
    expect(occupancyRate({ bookings: [booking()], bedsCount: 0, ...AUGUST })).toBeNull();
  });

  it('answers null for an empty window', () => {
    expect(occupancyRate({ bookings: [], bedsCount: 40, fromISO: '2026-08-01', toISO: '2026-08-01' })).toBeNull();
  });

  // Hiding this would leave the owner unaware they are oversold.
  it('reports above 100 when more guests are booked than there are beds', () => {
    const oversold = booking({ checkIn: '2026-08-01', checkOut: '2026-09-01', guestsCount: 50 });
    expect(occupancyRate({ bookings: [oversold], bedsCount: 40, ...AUGUST })).toBe(125);
  });
});

describe('bedsInUseOn', () => {
  it('counts guests sleeping that night', () => {
    const b = booking({ checkIn: '2026-08-10', checkOut: '2026-08-13', guestsCount: 12 });
    expect(bedsInUseOn([b], '2026-08-10')).toBe(12);
    expect(bedsInUseOn([b], '2026-08-12')).toBe(12);
  });

  // Check-out day is not a night slept — counting it double-books the bed
  // against the next arrival.
  it('does not count the departure day', () => {
    const b = booking({ checkIn: '2026-08-10', checkOut: '2026-08-13', guestsCount: 12 });
    expect(bedsInUseOn([b], '2026-08-13')).toBe(0);
  });

  it('is zero before arrival', () => {
    const b = booking({ checkIn: '2026-08-10', checkOut: '2026-08-13', guestsCount: 12 });
    expect(bedsInUseOn([b], '2026-08-09')).toBe(0);
  });
});

describe('nightsInWindow', () => {
  it('is the nights slept, not the days touched', () => {
    // Arrive Saturday, leave Monday — two nights, three calendar days.
    expect(nightsInWindow(booking({ checkIn: '2026-08-01', checkOut: '2026-08-03' }), '2026-08-01', '2026-09-01')).toBe(2);
  });

  it('is zero for a stay entirely outside the window', () => {
    expect(nightsInWindow(booking({ checkIn: '2026-06-01', checkOut: '2026-06-05' }), '2026-08-01', '2026-09-01')).toBe(0);
  });
});

describe('monthWindow', () => {
  it('ends on the first of the next month, exclusive', () => {
    expect(monthWindow(2026, 7)).toEqual({ fromISO: '2026-08-01', toISO: '2026-09-01' });
  });

  it('rolls the year over in December', () => {
    expect(monthWindow(2026, 11)).toEqual({ fromISO: '2026-12-01', toISO: '2027-01-01' });
  });
});

describe('heldBookings', () => {
  it('keeps only what actually holds a bed', () => {
    const all = (['pending', 'approved', 'rejected', 'completed', 'cancelled'] as const)
      .map((status, i) => booking({ id: `b${i}`, status }));
    expect(heldBookings(all).map((b) => b.status)).toEqual(['approved', 'completed']);
  });
});
