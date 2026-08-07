import { describe, it, expect } from 'vitest';
import type { Booking, Payment, Payout } from '../types';
import {
  approvedTotalFor, depositDue, cashDueAtArrival,
  availableForTransfer, ownerShareOf, resolvePaymentVerdict, unclaimedOwedBookings,
} from './paymentLedger';

// Every case below is a defect that reached production, not a hypothetical.

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  userId: 'u1',
  userName: 'ضيف',
  userEmail: 'g@example.com',
  userPhone: '01000000000',
  houseId: 'h1',
  houseName: 'بيت',
  checkIn: '2026-08-15',
  checkOut: '2026-08-18',
  guestsCount: 10,
  totalPrice: 10000,
  depositAmount: 1500,
  depositPaid: false,
  status: 'approved',
  paymentStatus: 'unpaid',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
} as Booking);

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  bookingId: 'b1',
  userId: 'u1',
  userName: 'ضيف',
  amount: 1500,
  paymentMethod: 'instapay',
  paymentStatus: 'pending',
  paymentDate: '2026-08-02T00:00:00.000Z',
  ...over,
});

const payout = (over: Partial<Payout> = {}): Payout => ({
  id: 'po1',
  houseId: 'h1',
  ownerId: 'o1',
  amount: 1000,
  status: 'pending',
  requestedAt: '2026-08-02T00:00:00.000Z',
  ...over,
});

describe('what the platform counts as received', () => {
  it('counts only approved payments', () => {
    const rows = [
      payment({ id: 'p1', amount: 1500, paymentStatus: 'approved' }),
      payment({ id: 'p2', amount: 9000, paymentStatus: 'pending' }),
      payment({ id: 'p3', amount: 5000, paymentStatus: 'rejected' }),
    ];
    expect(approvedTotalFor('b1', rows)).toBe(1500);
  });

  it('ignores payments filed against another booking', () => {
    const rows = [
      payment({ id: 'p1', amount: 1500, paymentStatus: 'approved' }),
      payment({ id: 'p2', bookingId: 'b2', amount: 9999, paymentStatus: 'approved' }),
    ];
    expect(approvedTotalFor('b1', rows)).toBe(1500);
  });
});

describe('the deposit quoted to the guest', () => {
  it('uses the amount the server stored, not the current rate', () => {
    // An admin who changes deposit_rate must not silently re-quote every open
    // booking — the owner screens still sum the stored number.
    expect(depositDue(booking({ depositAmount: 1500 }), 0.3)).toBe(1500);
  });

  it('falls back to the rate only when the booking carries no amount', () => {
    expect(depositDue(booking({ depositAmount: 0 }), 0.15)).toBe(1500);
  });
});

describe('cash the owner collects at the door', () => {
  it('subtracts the deposit once it was actually received', () => {
    expect(cashDueAtArrival(booking({ depositPaid: true }))).toBe(8500);
  });

  it('does NOT subtract a deposit that never arrived', () => {
    // The bug: an approved booking whose deposit was never paid told the owner
    // to collect 8,500 instead of the full 10,000, and the 1,500 was lost.
    expect(cashDueAtArrival(booking({ depositPaid: false }))).toBe(10000);
  });

  it('never goes negative on an overpaid booking', () => {
    expect(cashDueAtArrival(booking({ depositPaid: true, depositAmount: 12000 }))).toBe(0);
  });
});

describe('what Pima can transfer to an owner', () => {
  const base = {
    depositReceived: 10000,
    platformCommissionAmount: 500,
    confirmedBookings: [] as Booking[],
    commissionRate: 0.05,
  };

  it('offsets requests that are still open', () => {
    expect(availableForTransfer({ ...base, payouts: [payout({ amount: 4000 })] })).toBe(5500);
  });

  it('keeps offsetting a request after it has been paid out', () => {
    // The bug: 'completed' dropped out of the filter, so the full balance
    // sprang back the moment an admin marked the transfer done and the owner
    // could request the same money again, week after week.
    expect(availableForTransfer({
      ...base,
      payouts: [payout({ amount: 4000, status: 'completed' })],
    })).toBe(5500);
  });

  it('frees the money up again when a request is rejected', () => {
    expect(availableForTransfer({
      ...base,
      payouts: [payout({ amount: 4000, status: 'rejected' })],
    })).toBe(9500);
  });

  it('also subtracts bookings the admin settled one at a time', () => {
    // That channel stamps ownerSettledAt and never touches the payouts table,
    // so it was invisible here and the owner could be paid twice.
    const settled = booking({ ownerSettledAt: '2026-08-03T00:00:00.000Z', depositAmount: 1500, totalPrice: 10000 });
    expect(ownerShareOf(settled, 0.05)).toBe(1000);
    expect(availableForTransfer({ ...base, payouts: [], confirmedBookings: [settled] })).toBe(8500);
  });

  it('never offers a negative balance', () => {
    expect(availableForTransfer({
      ...base,
      payouts: [payout({ amount: 999999, status: 'completed' })],
    })).toBe(0);
  });
});

describe('approving a payment', () => {
  it('confirms the booking and marks the deposit received', () => {
    const b = booking({ status: 'pending' });
    const p = payment({ amount: 1500 });
    expect(resolvePaymentVerdict({ booking: b, payment: p, payments: [p], verdict: 'approved' }))
      .toEqual({ paymentStatus: 'paid_deposit', status: 'approved', depositPaid: true });
  });

  it('reaches paid_full only when the approved payments SUM to the total', () => {
    // The bug: this compared one payment against the total, so two approved
    // half-transfers both read as paid_deposit and the owner kept seeing an
    // outstanding balance on a fully settled booking.
    const first = payment({ id: 'p1', amount: 5000, paymentStatus: 'approved' });
    const second = payment({ id: 'p2', amount: 5000 });
    const out = resolvePaymentVerdict({
      booking: booking(), payment: second, payments: [first, second], verdict: 'approved',
    });
    expect(out).toEqual({ paymentStatus: 'paid_full', status: 'approved', depositPaid: true });
  });

  it('leaves a cancelled booking closed', () => {
    // The bug: a proof left in the queue after the guest cancelled forced the
    // booking back to 'approved' — onto dates that had very likely been resold.
    const b = booking({ status: 'cancelled' });
    const p = payment();
    expect(resolvePaymentVerdict({ booking: b, payment: p, payments: [p], verdict: 'approved' })).toBeNull();
  });

  it('leaves a rejected booking closed', () => {
    const b = booking({ status: 'rejected' });
    const p = payment();
    expect(resolvePaymentVerdict({ booking: b, payment: p, payments: [p], verdict: 'approved' })).toBeNull();
  });
});

describe('rejecting a payment', () => {
  it('marks the booking unpaid when it was the only proof', () => {
    const p = payment();
    expect(resolvePaymentVerdict({ booking: booking(), payment: p, payments: [p], verdict: 'rejected' }))
      .toEqual({ paymentStatus: 'unpaid', depositPaid: false });
  });

  it('does not erase an earlier approved payment', () => {
    // The bug: writing 'unpaid' here made the points trigger read the paid
    // amount as zero and claw back points the guest had legitimately earned
    // on the first, valid transfer.
    const valid = payment({ id: 'p1', amount: 1500, paymentStatus: 'approved' });
    const bogus = payment({ id: 'p2', amount: 1500 });
    expect(resolvePaymentVerdict({
      booking: booking({ depositPaid: true, paymentStatus: 'paid_deposit' }),
      payment: bogus, payments: [valid, bogus], verdict: 'rejected',
    })).toBeNull();
  });

  it("does not erase the owner's cash confirmation", () => {
    // Cash now files an approved payment row, so the same guard covers it.
    const cash = payment({ id: 'pay_cash_b1', amount: 1500, paymentMethod: 'cash', paymentStatus: 'approved' });
    const bogus = payment({ id: 'p2' });
    expect(resolvePaymentVerdict({
      booking: booking({ depositPaid: true }), payment: bogus, payments: [cash, bogus], verdict: 'rejected',
    })).toBeNull();
  });
});

describe('unclaimedOwedBookings', () => {
  const bk = (over: Partial<Booking> & { id: string }): Booking => ({
    houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف', userPhone: '',
    userEmail: '', userRole: 'individual', checkIn: '2026-09-10', checkOut: '2026-09-12',
    guestsCount: 10, totalPrice: 20000, depositPaid: true, depositAmount: 3000,
    status: 'approved', isLargeConferenceQuote: false, ...over,
  } as Booking);
  const po = (over: Partial<Payout> & { id: string }): Payout => ({
    houseId: 'h1', ownerId: 'o1', amount: 2000, status: 'completed',
    requestedAt: '2026-08-01', completedAt: '2026-08-02T10:00:00Z', ...over,
  } as Payout);

  // ownerShareOf: 3000 − 20000×0.05 = 2000 per booking.

  it('drops a booking already covered by a completed payout request', () => {
    const owed = [bk({ id: 'b1' })];
    const r = unclaimedOwedBookings({ owed, allBookings: owed, payouts: [po({ id: 'x1' })], commissionRate: 0.05 });
    expect(r.remaining).toHaveLength(0);
    expect(r.coveredAmount).toBe(2000);
  });

  it('leaves the rest when the payout covers only some of them', () => {
    const owed = [bk({ id: 'b1', checkIn: '2026-09-01' }), bk({ id: 'b2', checkIn: '2026-09-20' })];
    const r = unclaimedOwedBookings({ owed, allBookings: owed, payouts: [po({ id: 'x1' })], commissionRate: 0.05 });
    expect(r.remaining.map((b) => b.id)).toEqual(['b2']); // oldest settled first
    expect(r.coveredAmount).toBe(2000);
  });

  it('ignores a rejected payout request', () => {
    const owed = [bk({ id: 'b1' })];
    const r = unclaimedOwedBookings({ owed, allBookings: owed, payouts: [po({ id: 'x1', status: 'rejected' })], commissionRate: 0.05 });
    expect(r.remaining).toHaveLength(1);
  });

  it('does not double-net the payout row a per-booking settlement writes', () => {
    // settleBookingsPayout writes the payout AND stamps owner_settled_at with
    // the same timestamp. b1 is already out of `owed` because it is stamped;
    // counting its payout row again would wrongly settle b2 as well — paying
    // once and marking two bookings done.
    const stamp = '2026-08-02T10:00:00Z';
    const settled = bk({ id: 'b1', ownerSettledAt: stamp });
    const stillOwed = bk({ id: 'b2', checkIn: '2026-09-20' });
    const r = unclaimedOwedBookings({
      owed: [stillOwed],
      allBookings: [settled, stillOwed],
      payouts: [po({ id: 'x1', completedAt: stamp })],
      commissionRate: 0.05,
    });
    expect(r.remaining.map((b) => b.id)).toEqual(['b2']);
    expect(r.coveredAmount).toBe(0);
  });

  it('nets each house separately', () => {
    const owed = [bk({ id: 'b1', houseId: 'h1' }), bk({ id: 'b2', houseId: 'h2' })];
    const r = unclaimedOwedBookings({ owed, allBookings: owed, payouts: [po({ id: 'x1', houseId: 'h1' })], commissionRate: 0.05 });
    expect(r.remaining.map((b) => b.id)).toEqual(['b2']);
  });

  it('counts a pending request as claimed, so it cannot be paid twice while in flight', () => {
    const owed = [bk({ id: 'b1' })];
    const r = unclaimedOwedBookings({ owed, allBookings: owed, payouts: [po({ id: 'x1', status: 'pending', completedAt: undefined })], commissionRate: 0.05 });
    expect(r.remaining).toHaveLength(0);
  });
});
