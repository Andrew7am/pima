import { describe, it, expect } from 'vitest';
import { summarizeFinances } from './adminFinance';
import type { Booking, Payment, Payout } from '../types';

const RATE = 0.05;

const booking = (over: Partial<Booking> & { id: string }): Booking => ({
  houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف', userPhone: '',
  userEmail: '', userRole: 'individual', checkIn: '2026-09-10', checkOut: '2026-09-12',
  guestsCount: 10, totalPrice: 20000, depositPaid: true, depositAmount: 3000,
  status: 'approved', isLargeConferenceQuote: false,
  ...over,
} as Booking);

const payment = (over: Partial<Payment> & { id: string; bookingId: string }): Payment => ({
  userId: 'u1', userName: 'ضيف', amount: 3000, paymentMethod: 'instapay',
  paymentStatus: 'approved', paymentDate: '2026-08-01T10:00:00Z',
  ...over,
} as Payment);

const HOUSES = [{ id: 'h1', name: 'بيت النور', ownerId: 'o1' }];
const USERS = [{ id: 'o1', name: 'أستاذ مينا' }];

const run = (over: Partial<Parameters<typeof summarizeFinances>[0]> = {}) =>
  summarizeFinances({
    bookings: [booking({ id: 'b1' })],
    payments: [payment({ id: 'p1', bookingId: 'b1' })],
    payouts: [],
    houses: HOUSES,
    users: USERS,
    commissionRate: RATE,
    window: null,
    platformCollects: true,
    ...over,
  });

describe('summarizeFinances', () => {
  it('charges commission on the booking value, not on the deposit', () => {
    // The defect this module exists to fix. A 20,000 booking with a 3,000
    // deposit at 5%: the commission is 1,000 (5% of 20,000), not 150 (5% of
    // 3,000). 850 of Pima's own revenue per booking went missing.
    const s = run();
    expect(s.platformCommission).toBe(1000);
    expect(s.platformCommission).not.toBe(150);
  });

  it('owes the owner exactly what the payout tab transfers', () => {
    // deposit 3000 − commission 1000 = 2000. The old page said 2,850, which is
    // Pima's whole commission plus 850 more than it holds for the owner.
    const s = run();
    expect(s.ownersOwed).toBe(2000);
  });

  it('never reports a commission larger than the cash actually received', () => {
    // A part-paid deposit: 600 received against a 20,000 booking whose
    // commission would be 1,000. Pima cannot keep more than it holds.
    const s = run({ payments: [payment({ id: 'p1', bookingId: 'b1', amount: 600 })] });
    expect(s.platformCommission).toBe(600);
  });

  it('excludes payments on cancelled and rejected bookings from owner dues', () => {
    const s = run({ bookings: [booking({ id: 'b1', status: 'cancelled' })] });
    expect(s.collectedByPima).toBe(0);
    expect(s.ownersOwed).toBe(0);
    // but the cash is real and still reported, pending a refund decision
    expect(s.collectedOnCancelled).toBe(3000);
  });

  it('does not treat a cash deposit as money Pima holds', () => {
    // Handed over at the house — the owner already has it.
    const s = run({ payments: [payment({ id: 'p1', bookingId: 'b1', paymentMethod: 'cash' })] });
    expect(s.collectedByPima).toBe(0);
    expect(s.collectedByOwnerDirect).toBe(3000);
    expect(s.ownersOwed).toBe(0);
  });

  it('holds nothing when Pima has no collection accounts configured', () => {
    const s = run({ platformCollects: false });
    expect(s.collectedByPima).toBe(0);
    expect(s.collectedByOwnerDirect).toBe(3000);
    expect(s.ownersOwed).toBe(0);
  });

  it('stops owing money that has already been settled per booking', () => {
    const s = run({ bookings: [booking({ id: 'b1', ownerSettledAt: '2026-08-05T09:00:00Z' })] });
    expect(s.ownersOwed).toBe(0);
    expect(s.ownersPaid).toBe(2000);
  });

  it('stops owing money that has already gone out as a completed payout', () => {
    const s = run({
      payouts: [{ id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 2000, status: 'completed',
        requestedAt: '2026-08-02', completedAt: '2026-08-04T12:00:00Z' } as Payout],
    });
    expect(s.ownersPaid).toBe(2000);
  });

  it('ignores payouts that were rejected', () => {
    const s = run({
      payouts: [{ id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 2000, status: 'rejected',
        requestedAt: '2026-08-02', completedAt: '2026-08-04T12:00:00Z' } as Payout],
    });
    expect(s.ownersPaid).toBe(0);
    expect(s.ownersOwed).toBe(2000);
  });

  it('reports the door balance separately instead of as an uncollected debt', () => {
    // 20,000 − 3,000 deposit = 17,000 the guest pays the owner on arrival.
    // This is the design, not a collection failure.
    const s = run();
    expect(s.cashAtDoor).toBe(17000);
    expect(s.collectedByPima).toBe(3000);
  });

  it('scopes by the date the money moved, not the trip date', () => {
    // Deposit banked on 1 Aug for a trip on 10 Sep. A window over August must
    // contain it; the old page dated it to the check-in and lost it.
    const august = { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-31T23:59:59Z') };
    expect(run({ window: august }).collectedByPima).toBe(3000);

    const september = { start: new Date('2026-09-01T00:00:00Z'), end: new Date('2026-09-30T23:59:59Z') };
    expect(run({ window: september }).collectedByPima).toBe(0);
  });

  it('adds the owner rows up to the page totals', () => {
    // Two bookings for the same owner. Rounding per row must not drift from
    // the total, which is what the old per-owner Math.round did.
    const s = run({
      bookings: [
        booking({ id: 'b1', totalPrice: 20001, depositAmount: 3001 }),
        booking({ id: 'b2', totalPrice: 15001, depositAmount: 2251 }),
      ],
      payments: [
        payment({ id: 'p1', bookingId: 'b1', amount: 3001 }),
        payment({ id: 'p2', bookingId: 'b2', amount: 2251 }),
      ],
    });
    const rowCommission = s.perOwner.reduce((t, r) => t + r.commission, 0);
    const rowOwed = s.perOwner.reduce((t, r) => t + r.owed, 0);
    expect(rowCommission).toBe(s.platformCommission);
    expect(rowOwed).toBe(s.ownersOwed);
  });

  it('sorts owners by who is owed the most, so the admin sees the backlog first', () => {
    const s = run({
      bookings: [
        booking({ id: 'b1', houseId: 'h1' }),
        booking({ id: 'b2', houseId: 'h2', totalPrice: 40000, depositAmount: 6000 }),
      ],
      payments: [
        payment({ id: 'p1', bookingId: 'b1' }),
        payment({ id: 'p2', bookingId: 'b2', amount: 6000 }),
      ],
      houses: [...HOUSES, { id: 'h2', name: 'بيت السلام', ownerId: 'o2' }],
      users: [...USERS, { id: 'o2', name: 'أستاذ جرجس' }],
    });
    expect(s.perOwner[0].id).toBe('o2');
    expect(s.perOwner[0].owed).toBe(4000); // 6000 − 40000×0.05
  });

  it('returns zeroes rather than throwing on an empty platform', () => {
    const s = run({ bookings: [], payments: [], payouts: [] });
    expect(s.collectedByPima).toBe(0);
    expect(s.ownersOwed).toBe(0);
    expect(s.bookingCount).toBe(0);
    expect(s.perOwner).toEqual([]);
  });

  it('ignores a payment whose booking no longer exists', () => {
    const s = run({ payments: [payment({ id: 'p1', bookingId: 'gone' })] });
    expect(s.collectedByPima).toBe(0);
  });
});
