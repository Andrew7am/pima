import { describe, it, expect } from 'vitest';
import { summarizeFinances, accountBalances, refundsDue } from './adminFinance';
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

  it('counts a per-booking settlement once, not twice', () => {
    // settleBookingsPayout (db.ts:776-790) writes BOTH a completed payout row
    // and owner_settled_at on the booking, with the same timestamp. Treating
    // those as two independent settlements showed one 2,000 transfer as 4,000.
    // The first version of this test passed only because it left the payout
    // row out — which the real code path never does.
    const settledAt = '2026-08-05T09:00:00Z';
    const s = run({
      bookings: [booking({ id: 'b1', ownerSettledAt: settledAt })],
      payouts: [{ id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 2000, status: 'completed',
        requestedAt: settledAt, completedAt: settledAt } as Payout],
    });
    expect(s.ownersOwed).toBe(0);
    expect(s.ownersPaid).toBe(2000);
    expect(s.perOwner[0].paid).toBe(2000);
  });

  it('reports what actually left, not what the current rate would make it', () => {
    // The payout row is the EGP that moved. Re-deriving it from today's
    // commission rate would silently reprice every past transfer the moment
    // the admin edits the rate — and the settings screen promises the
    // opposite: «التغييرات بتأثر على الحجوزات الجديدة والدفعات الجاية».
    const settledAt = '2026-08-05T09:00:00Z';
    const at5pct = { id: 'x1', houseId: 'h1', ownerId: 'o1', amount: 3500, status: 'completed',
      requestedAt: settledAt, completedAt: settledAt } as Payout;
    const args = { bookings: [booking({ id: 'b1', ownerSettledAt: settledAt })], payouts: [at5pct] };
    expect(run({ ...args, commissionRate: 0.05 }).ownersPaid).toBe(3500);
    expect(run({ ...args, commissionRate: 0.20 }).ownersPaid).toBe(3500);
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

describe('accountBalances', () => {
  const p = (over: Partial<Payment> & { id: string }): Payment => ({
    bookingId: 'b1', userId: 'u1', userName: 'ضيف', amount: 1000, paymentMethod: 'instapay',
    paymentStatus: 'approved', paymentDate: '2026-08-01T00:00:00Z', ...over,
  } as Payment);

  it('tallies each of Pima\u2019s accounts separately', () => {
    const r = accountBalances({ window: null, payments: [
      p({ id: 'p1', receivedAccount: 'إنستاباي بيما', amount: 3000 }),
      p({ id: 'p2', receivedAccount: 'إنستاباي بيما', amount: 2000 }),
      p({ id: 'p3', receivedAccount: 'فودافون كاش', amount: 1500 }),
    ] });
    expect(r.accounts.map((a) => [a.account, a.net])).toEqual([
      ['إنستاباي بيما', 5000], ['فودافون كاش', 1500],
    ]);
  });

  it('takes refunds back out of the account they left from', () => {
    const r = accountBalances({ window: null, payments: [
      p({ id: 'p1', receivedAccount: 'إنستاباي بيما', amount: 3000, refundedAmount: 1000 }),
    ] });
    expect(r.accounts[0]).toMatchObject({ received: 3000, refunded: 1000, net: 2000 });
  });

  it('shows unassigned payments rather than dropping them', () => {
    // Dropping them would make this disagree with the finance page for no
    // visible reason, which is worse than an untidy row.
    const r = accountBalances({ window: null, payments: [p({ id: 'p1', amount: 800 })] });
    expect(r.accounts[0].account).toBe('غير محدد');
    expect(r.unassignedCount).toBe(1);
  });

  it('ignores payments that were never approved', () => {
    const r = accountBalances({ window: null, payments: [
      p({ id: 'p1', receivedAccount: 'بنك', paymentStatus: 'pending' }),
    ] });
    expect(r.accounts).toEqual([]);
  });
});

describe('refundsDue', () => {
  const b = (over: Partial<Booking> & { id: string }): Booking => ({
    houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'مينا', userPhone: '',
    userEmail: '', userRole: 'individual', checkIn: '2026-09-10', checkOut: '2026-09-12',
    guestsCount: 10, totalPrice: 20000, depositPaid: true, depositAmount: 3000,
    status: 'approved', isLargeConferenceQuote: false, ...over,
  } as Booking);
  const p = (over: Partial<Payment> & { id: string }): Payment => ({
    bookingId: 'b1', userId: 'u1', userName: 'مينا', amount: 3000, paymentMethod: 'instapay',
    paymentStatus: 'approved', paymentDate: '2026-08-01T00:00:00Z', ...over,
  } as Payment);

  it('owes the guest back when the trip was cancelled', () => {
    const r = refundsDue({ bookings: [b({ id: 'b1', status: 'cancelled' })], payments: [p({ id: 'p1' })] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ outstanding: 3000, reason: 'cancelled' });
  });

  it('owes only what is left after a partial refund', () => {
    const r = refundsDue({
      bookings: [b({ id: 'b1', status: 'cancelled' })],
      payments: [p({ id: 'p1', refundedAmount: 1000 })],
    });
    expect(r[0].outstanding).toBe(2000);
  });

  it('drops the row once it is fully refunded', () => {
    const r = refundsDue({
      bookings: [b({ id: 'b1', status: 'cancelled' })],
      payments: [p({ id: 'p1', refundedAmount: 3000 })],
    });
    expect(r).toEqual([]);
  });

  it('owes the guest back when they simply overpaid a live booking', () => {
    const r = refundsDue({ bookings: [b({ id: 'b1' })], payments: [p({ id: 'p1', amount: 25000 })] });
    expect(r[0]).toMatchObject({ outstanding: 5000, reason: 'overpaid' });
  });

  it('says nothing about an ordinary deposit on a live booking', () => {
    // The 85% still to be paid at the door is not an overpayment.
    expect(refundsDue({ bookings: [b({ id: 'b1' })], payments: [p({ id: 'p1' })] })).toEqual([]);
  });

  it('biggest amount first', () => {
    const r = refundsDue({
      bookings: [b({ id: 'b1', status: 'cancelled' }), b({ id: 'b2', status: 'cancelled' })],
      payments: [p({ id: 'p1', amount: 1000 }), p({ id: 'p2', bookingId: 'b2', amount: 9000 })],
    });
    expect(r.map((x) => x.outstanding)).toEqual([9000, 1000]);
  });
});
