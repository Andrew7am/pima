import { describe, it, expect } from 'vitest';
import { rateOf, commissionOf, ownerShareOf } from './paymentLedger';
import type { Booking } from '../types';

/**
 * A closed deal keeps the rate it was closed at.
 *
 * Migration 0113 froze commission_rate onto each booking because a live global
 * rate silently recomputed the commission on every booking ever made: raising
 * it from 5% to 7% cut what owners were owed on deals already closed, in some
 * cases on money already transferred.
 *
 * rateOf has always been written for that. What was missing was mapBooking
 * reading the column, so commissionRate was undefined on every booking and the
 * fallback — the live rate — ran every time. These cover the behaviour the
 * migration was for, not just the mapping.
 */

const booking = (over: Partial<Booking>) => ({
  id: 'b1', totalPrice: 10000, depositAmount: 10000, ...over,
} as unknown as Booking);

describe('commission is charged at the booking\'s own rate', () => {
  it('uses the rate stamped on the booking, not the current platform rate', () => {
    const old = booking({ commissionRate: 0.05 });
    // The platform has since moved to 7%. The old deal is still a 5% deal.
    expect(rateOf(old, 0.07)).toBe(0.05);
    expect(commissionOf(old, 0.07)).toBe(500);
  });

  it('falls back to the live rate only when the booking has none', () => {
    const preMigration = booking({});
    expect(rateOf(preMigration, 0.07)).toBe(0.07);
    expect(commissionOf(preMigration, 0.07)).toBe(700);
  });

  it('a stamped zero is honoured, not treated as missing', () => {
    // ?? not ||. A booking agreed at no commission must not silently inherit
    // the platform rate.
    const free = booking({ commissionRate: 0 });
    expect(rateOf(free, 0.07)).toBe(0);
    expect(commissionOf(free, 0.07)).toBe(0);
  });

  it('the owner keeps more on a deal closed at the lower rate', () => {
    const old = booking({ commissionRate: 0.05 });
    const now = booking({ commissionRate: 0.07 });
    expect(ownerShareOf(old, 0.07)).toBeGreaterThan(ownerShareOf(now, 0.07));
  });
});
