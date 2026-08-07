import { describe, it, expect } from 'vitest';
import { findFinanceExceptions } from './adminExceptions';
import type { Booking, Payment, Payout } from '../types';

const HOUSES = [{ id: 'h1', name: 'بيت النور' }];
const NOW = new Date('2026-08-07T12:00:00Z').getTime();

const bk = (over: Partial<Booking> & { id: string }): Booking => ({
  houseId: 'h1', houseName: 'بيت النور', userId: 'u1', userName: 'مينا', userPhone: '',
  userEmail: '', userRole: 'individual', checkIn: '2026-09-10', checkOut: '2026-09-12',
  guestsCount: 10, totalPrice: 20000, depositPaid: false, depositAmount: 3000,
  status: 'approved', isLargeConferenceQuote: false, ...over,
} as Booking);

const pay = (over: Partial<Payment> & { id: string }): Payment => ({
  bookingId: 'b1', userId: 'u1', userName: 'مينا', amount: 3000, paymentMethod: 'instapay',
  paymentStatus: 'approved', paymentDate: '2026-08-01T00:00:00Z', ...over,
} as Payment);

const run = (bookings: Booking[], payments: Payment[] = [], payouts: Payout[] = []) =>
  findFinanceExceptions({ bookings, payments, payouts, houses: HOUSES, commissionRate: 0.05, now: NOW });

const kinds = (bookings: Booking[], payments?: Payment[], payouts?: Payout[]) =>
  run(bookings, payments, payouts).map((e) => e.kind);

describe('findFinanceExceptions', () => {
  it('stays completely empty when everything agrees', () => {
    const b = bk({ id: 'b1', depositPaid: true });
    expect(run([b], [pay({ id: 'p1' })])).toEqual([]);
  });

  it('does NOT flag the 85% the guest pays the owner at the door', () => {
    // The whole reason a generic reconciliation report is useless here: every
    // booking is supposed to look 85% unpaid.
    const b = bk({ id: 'b1', depositPaid: true, totalPrice: 100000, depositAmount: 15000 });
    expect(run([b], [pay({ id: 'p1', amount: 15000 })])).toEqual([]);
  });

  it('catches a deposit marked paid with no payment behind it', () => {
    // The documented one: the owner is told to collect the balance only, and
    // the deposit he credits was never received.
    const b = bk({ id: 'b1', depositPaid: true });
    const found = run([b], []);
    expect(found.map((e) => e.kind)).toContain('deposit_paid_but_nothing_received');
    expect(found[0].severity).toBe('high');
    // Arabic numerals with the app's own separator, like every other number
    // it shows — these sentences sit beside figures formatted the same way.
    expect(found[0].detail).toContain('١٧٬٠٠٠');
    expect(found[0].detail).not.toMatch(/[0-9]/);
  });

  it('catches a short deposit', () => {
    const found = run([bk({ id: 'b1' })], [pay({ id: 'p1', amount: 2500 })]);
    const e = found.find((x) => x.kind === 'underpaid_deposit')!;
    expect(e.amount).toBe(500);
  });

  it('catches an overpayment, because the guest is owed money', () => {
    const found = run([bk({ id: 'b1' })], [pay({ id: 'p1', amount: 25000 })]);
    const e = found.find((x) => x.kind === 'overpaid_booking')!;
    expect(e.amount).toBe(5000);
    expect(e.severity).toBe('high');
  });

  it('catches paid_full that is not actually full', () => {
    const b = bk({ id: 'b1', paymentStatus: 'paid_full', depositPaid: true });
    expect(kinds([b], [pay({ id: 'p1', amount: 3000 })])).toContain('marked_paid_full_but_short');
  });

  it('catches money held on a cancelled booking', () => {
    const b = bk({ id: 'b1', status: 'cancelled', depositPaid: true });
    const found = run([b], [pay({ id: 'p1' })]);
    expect(found.map((e) => e.kind)).toEqual(['collected_on_cancelled']);
    expect(found[0].amount).toBe(3000);
  });

  it('does not pile other complaints onto a cancelled booking', () => {
    // One row per problem, and a cancelled booking has exactly one.
    const b = bk({ id: 'b1', status: 'cancelled', depositPaid: true, paymentStatus: 'paid_full' });
    expect(run([b], [pay({ id: 'p1', amount: 1 })])).toHaveLength(1);
  });

  it('flags a deposit sitting on an unconfirmed booking only after the grace period', () => {
    const b = bk({ id: 'b1', status: 'pending', depositPaid: true });
    const fresh = pay({ id: 'p1', paymentDate: '2026-08-05T00:00:00Z' }); // 2 days
    expect(kinds([b], [fresh])).not.toContain('held_against_unconfirmed_booking');

    const old = pay({ id: 'p1', paymentDate: '2026-07-20T00:00:00Z' }); // 18 days
    expect(kinds([b], [old])).toContain('held_against_unconfirmed_booking');
  });

  it('catches a settled booking with no transfer recorded', () => {
    const b = bk({ id: 'b1', depositPaid: true, ownerSettledAt: '2026-08-06T10:00:00Z' });
    expect(kinds([b], [pay({ id: 'p1' })], [])).toContain('settled_without_payout');
  });

  it('accepts a settled booking whose payout row matches', () => {
    const stamp = '2026-08-06T10:00:00Z';
    const b = bk({ id: 'b1', depositPaid: true, ownerSettledAt: stamp });
    const po = { id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 2000, status: 'completed',
      requestedAt: stamp, completedAt: stamp } as Payout;
    expect(kinds([b], [pay({ id: 'p1' })], [po])).not.toContain('settled_without_payout');
  });

  it('catches paying an owner more than Pima ever held for him', () => {
    const b = bk({ id: 'b1', depositPaid: true });               // owner share 2000
    const po = { id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 5000, status: 'completed',
      requestedAt: '2026-08-01', completedAt: '2026-08-02T00:00:00Z' } as Payout;
    const e = run([b], [pay({ id: 'p1' })], [po]).find((x) => x.kind === 'paid_owner_more_than_held')!;
    expect(e.amount).toBe(3000);
  });

  it('ignores a rejected payout when judging what was sent', () => {
    const b = bk({ id: 'b1', depositPaid: true });
    const po = { id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 5000, status: 'rejected',
      requestedAt: '2026-08-01', completedAt: '2026-08-02T00:00:00Z' } as Payout;
    expect(kinds([b], [pay({ id: 'p1' })], [po])).not.toContain('paid_owner_more_than_held');
  });

  it('puts the worst and biggest first', () => {
    const a = bk({ id: 'b1', depositPaid: true });                        // high
    const c = bk({ id: 'b2', depositAmount: 3000 });                      // medium, short by 500
    const found = run([a, c], [pay({ id: 'p2', bookingId: 'b2', amount: 2500 })]);
    expect(found[0].severity).toBe('high');
  });

  it('gives every row a stable id so dismissing one sticks', () => {
    const b = bk({ id: 'b1', depositPaid: true });
    expect(run([b], []).map((e) => e.id)).toEqual(run([b], []).map((e) => e.id));
    expect(run([b], [])[0].id).toBe('deposit_paid_but_nothing_received:b1');
  });
});
