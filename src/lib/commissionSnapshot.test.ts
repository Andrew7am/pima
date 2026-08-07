import { describe, it, expect } from 'vitest';
import {
  rateOf, commissionOf, commissionTotal, ownerNetOfBooked, ownerNetOfCollected,
  ownerShareOf, availableForTransfer,
} from './paymentLedger';
import type { Booking, Payout } from '../types';

/**
 * The commission rate used to be a single live global number. Every screen
 * multiplied by whatever it was AT THAT MOMENT, over every booking ever made.
 * Raising it from 5% to 7% therefore recomputed the commission on deals closed
 * a year earlier — quietly cutting what owners were owed, including on money
 * already transferred to them.
 *
 * Migration 108 stamps the rate onto the booking. These pin the behaviour that
 * makes that worth doing.
 */

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف',
    userPhone: '0100', userEmail: 'a@b.c', userRole: 'servant',
    checkIn: '2026-08-01', checkOut: '2026-08-03', guestsCount: 10,
    totalPrice: 10000, depositPaid: true, depositAmount: 1500,
    status: 'approved', isLargeConferenceQuote: false,
    createdAt: '2026-07-01T00:00:00Z', ...over,
  } as Booking;
}

describe('rateOf', () => {
  it('uses the rate the booking was agreed at', () => {
    expect(rateOf(booking({ commissionRate: 0.05 }), 0.07)).toBe(0.05);
  });

  // Only for a row written before the column existed.
  it('falls back to the platform rate when the booking has none', () => {
    expect(rateOf(booking({ commissionRate: undefined }), 0.07)).toBe(0.07);
  });

  it('respects a zero rate rather than treating it as missing', () => {
    expect(rateOf(booking({ commissionRate: 0 }), 0.07)).toBe(0);
  });
});

describe('a rate change does not reach into the past', () => {
  const old5 = booking({ id: 'old', commissionRate: 0.05, totalPrice: 10000 });
  const new7 = booking({ id: 'new', commissionRate: 0.07, totalPrice: 10000 });

  it('charges each booking its own rate', () => {
    expect(commissionOf(old5, 0.07)).toBe(500);
    expect(commissionOf(new7, 0.07)).toBe(700);
  });

  // THE regression this exists to catch: if someone reverts to a single global
  // rate, both of these become 700 and the total becomes 1400.
  it('totals a mixed book at mixed rates', () => {
    expect(commissionTotal([old5, new7], 0.07)).toBe(1200);
  });

  it('leaves the old booking untouched no matter what the platform rate is', () => {
    for (const platformRate of [0.05, 0.07, 0.2, 0]) {
      expect(commissionOf(old5, platformRate)).toBe(500);
    }
  });
});

describe('the two owner-net figures are different questions', () => {
  const bookings = [
    booking({ id: 'a', commissionRate: 0.05, totalPrice: 10000 }),
    booking({ id: 'b', commissionRate: 0.05, totalPrice: 6000 }),
  ];

  it('booked net counts everything booked, collected or not', () => {
    expect(ownerNetOfBooked(bookings, 0.05)).toBe(16000 - 800);
  });

  // The admin's owner-dues table answered this one while the owner's own
  // screen answered the one above — and both were labelled «صافي مستحقات».
  it('collected net counts only money that actually arrived', () => {
    const net = ownerNetOfCollected([{ booking: bookings[0], collected: 1500 }], 0.05);
    expect(net).toBe(1500 - 75);
  });

  it('the two disagree by design, and by a lot', () => {
    const booked = ownerNetOfBooked(bookings, 0.05);
    const collected = ownerNetOfCollected([{ booking: bookings[0], collected: 1500 }], 0.05);
    expect(booked).toBeGreaterThan(collected * 5);
  });
});

describe('availableForTransfer with per-booking rates', () => {
  const mk = (id: string, rate: number, total: number, dep: number, settled = false) =>
    booking({ id, commissionRate: rate, totalPrice: total, depositAmount: dep, depositPaid: true,
      ...(settled ? { ownerSettledAt: '2026-08-01T00:00:00Z' } : {}) } as Partial<Booking>);

  it('holds only the deposits, less each booking own commission', () => {
    const bs = [mk('a', 0.05, 10000, 1500), mk('b', 0.05, 6000, 900)];
    const depositReceived = 2400;
    const commission = commissionTotal(bs, 0.05); // 500 + 300
    expect(availableForTransfer({
      depositReceived, platformCommissionAmount: commission, payouts: [],
      confirmedBookings: bs, commissionRate: 0.05,
    })).toBe(2400 - 800);
  });

  // The algebra that must hold: removing a settled booking removes its WHOLE
  // deposit from the pot — not its deposit twice, and not only its commission.
  it('removes a settled booking exactly once', () => {
    const unsettled = mk('a', 0.05, 10000, 1500);
    const settled = mk('b', 0.05, 6000, 900, true);
    const bs = [unsettled, settled];
    const commission = commissionTotal(bs, 0.05);
    const got = availableForTransfer({
      depositReceived: 2400, platformCommissionAmount: commission, payouts: [],
      confirmedBookings: bs, commissionRate: 0.05,
    });
    // Only the unsettled booking's deposit, less its own commission.
    expect(got).toBe(1500 - 500);
  });

  it('subtracts every payout that was not rejected, completed ones included', () => {
    const bs = [mk('a', 0.05, 10000, 1500)];
    const payouts = [
      { id: 'p1', status: 'completed', amount: 400 },
      { id: 'p2', status: 'rejected', amount: 999 },
    ] as unknown as Payout[];
    expect(availableForTransfer({
      depositReceived: 1500, platformCommissionAmount: 500, payouts,
      confirmedBookings: bs, commissionRate: 0.05,
    })).toBe(1500 - 500 - 400);
  });

  it('never goes negative', () => {
    const bs = [mk('a', 0.05, 100000, 100)];
    expect(availableForTransfer({
      depositReceived: 100, platformCommissionAmount: 5000, payouts: [],
      confirmedBookings: bs, commissionRate: 0.05,
    })).toBe(0);
  });
});

describe('ownerShareOf uses the booking own rate', () => {
  it('pays the old rate on an old booking', () => {
    const old = booking({ commissionRate: 0.05, totalPrice: 10000, depositAmount: 1500 });
    expect(ownerShareOf(old, 0.07)).toBe(1500 - 500);
  });

  it('floors at zero when the commission exceeds the deposit', () => {
    const thin = booking({ commissionRate: 0.05, totalPrice: 100000, depositAmount: 100 });
    expect(ownerShareOf(thin, 0.05)).toBe(0);
  });
});
