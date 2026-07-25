import { describe, it, expect } from 'vitest';
import { daysUntil, getRefundTier, paidAmountOf, refundAmountFor } from './cancellationPolicy';
import type { Booking, PlatformSettings } from '../types';

const settings = {
  freeCancelDays: 7,
  partialRefundDays: 3,
  partialRefundPct: 0.5,
} as PlatformSettings;

// A fixed "today" so these tests never depend on the wall clock.
const TODAY = new Date(2026, 6, 10); // 10 July 2026, local time

function booking(over: Partial<Booking>): Booking {
  return { checkIn: '2026-07-20', totalPrice: 1000, ...over } as Booking;
}

describe('daysUntil', () => {
  it('counts whole days ahead, ignoring the time of day', () => {
    expect(daysUntil('2026-07-17', TODAY)).toBe(7);
    expect(daysUntil('2026-07-10', TODAY)).toBe(0);
  });

  it('goes negative for dates already past', () => {
    expect(daysUntil('2026-07-08', TODAY)).toBe(-2);
  });
});

describe('getRefundTier', () => {
  it('gives a full refund at or beyond the free-cancel window', () => {
    expect(getRefundTier('2026-07-20', settings, TODAY)).toMatchObject({ tier: 'full', pct: 1 });
    expect(getRefundTier('2026-07-17', settings, TODAY)).toMatchObject({ tier: 'full' }); // exactly 7 days
  });

  it('gives a partial refund inside the partial window', () => {
    expect(getRefundTier('2026-07-16', settings, TODAY)).toMatchObject({ tier: 'partial', pct: 0.5 }); // 6 days
    expect(getRefundTier('2026-07-13', settings, TODAY)).toMatchObject({ tier: 'partial' });           // exactly 3 days
  });

  it('gives nothing once inside the partial cut-off', () => {
    expect(getRefundTier('2026-07-12', settings, TODAY)).toMatchObject({ tier: 'none', pct: 0 }); // 2 days
    expect(getRefundTier('2026-07-10', settings, TODAY)).toMatchObject({ tier: 'none' });          // today
    expect(getRefundTier('2026-07-01', settings, TODAY)).toMatchObject({ tier: 'none' });          // already passed
  });
});

describe('paidAmountOf', () => {
  it('counts the full price only when fully paid', () => {
    expect(paidAmountOf(booking({ paymentStatus: 'paid_full', totalPrice: 1000 }))).toBe(1000);
  });

  it('counts only the deposit when a deposit was paid', () => {
    expect(paidAmountOf(booking({ paymentStatus: 'paid_deposit', depositAmount: 300 }))).toBe(300);
  });

  // Refunds must never be computed against money that was never received.
  it('counts nothing for unpaid bookings', () => {
    expect(paidAmountOf(booking({ paymentStatus: 'unpaid' }))).toBe(0);
    expect(paidAmountOf(booking({ paymentStatus: 'paid_deposit', depositAmount: undefined }))).toBe(0);
  });
});

describe('refundAmountFor', () => {
  it('refunds everything actually paid inside the free window', () => {
    const b = booking({ checkIn: '2026-07-20', paymentStatus: 'paid_deposit', depositAmount: 300 });
    expect(refundAmountFor(b, settings, TODAY)).toMatchObject({ tier: 'full', paid: 300, refund: 300 });
  });

  it('halves the paid amount inside the partial window and rounds to a whole pound', () => {
    const b = booking({ checkIn: '2026-07-16', paymentStatus: 'paid_deposit', depositAmount: 333 });
    expect(refundAmountFor(b, settings, TODAY)).toMatchObject({ tier: 'partial', paid: 333, refund: 167 });
  });

  it('refunds nothing past the cut-off even when fully paid', () => {
    const b = booking({ checkIn: '2026-07-11', paymentStatus: 'paid_full', totalPrice: 1000 });
    expect(refundAmountFor(b, settings, TODAY)).toMatchObject({ tier: 'none', paid: 1000, refund: 0 });
  });
});
