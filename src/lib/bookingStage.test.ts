import { describe, it, expect } from 'vitest';
import { getBookingStage } from './bookingStage';
import type { Booking, Payment } from '../types';

// The booking flow tells the guest, on three separate screens, that nothing is
// charged until the house approves. These tests are that promise, written down.

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1', houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'أندرو',
  userPhone: '0100', userEmail: 'a@b.c', userRole: 'individual',
  checkIn: '2026-07-15', checkOut: '2026-07-18', guestsCount: 2,
  totalPrice: 840, depositPaid: false, depositAmount: 126,
  status: 'pending', isLargeConferenceQuote: false, createdAt: '2026-07-01',
  ...over,
});

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1', bookingId: 'b1', userId: 'u1', userName: 'أندرو', amount: 126,
  paymentMethod: 'instapay', paymentStatus: 'pending', paymentDate: '2026-07-02',
  ...over,
});

describe('money is never asked for before the house has approved', () => {
  it('offers no payment while the request is still under review', () => {
    const s = getBookingStage(booking({ status: 'pending' }));
    expect(s.stage).toBe('review');
    expect(s.canPay).toBe(false);
    expect(s.action).toBe('refresh');
  });

  it('still offers no payment on a pending request that carries a deposit amount', () => {
    // The amount is known from the moment the request is priced; knowing it is
    // not permission to collect it.
    expect(getBookingStage(booking({ status: 'pending', depositAmount: 126 })).canPay).toBe(false);
  });

  it('offers no payment on a rejected or cancelled booking', () => {
    expect(getBookingStage(booking({ status: 'rejected' })).canPay).toBe(false);
    expect(getBookingStage(booking({ status: 'cancelled' })).canPay).toBe(false);
  });
});

describe('once approved, the deposit is the one thing to do', () => {
  it('asks for the deposit', () => {
    const s = getBookingStage(booking({ status: 'approved' }));
    expect(s.stage).toBe('awaiting_deposit');
    expect(s.action).toBe('pay');
    expect(s.canPay).toBe(true);
  });

  it('stops asking while a proof is being checked, so nobody pays twice', () => {
    const s = getBookingStage(booking({ status: 'approved' }), [payment()]);
    expect(s.stage).toBe('verifying');
    expect(s.action).toBe('none');
    expect(s.canPay).toBe(false);
  });

  it('asks again if the proof was refused', () => {
    const s = getBookingStage(booking({ status: 'approved' }), [payment({ paymentStatus: 'rejected' })]);
    expect(s.stage).toBe('awaiting_deposit');
    expect(s.canPay).toBe(true);
  });

  it('treats a settled deposit as confirmed, by any of the three markers', () => {
    for (const over of [
      { depositPaid: true },
      { paymentStatus: 'paid_deposit' as const },
      { paymentStatus: 'paid_full' as const },
    ]) {
      const s = getBookingStage(booking({ status: 'approved', ...over }));
      expect(s.stage).toBe('confirmed');
      expect(s.canPay).toBe(false);
      expect(s.action).toBe('voucher');
    }
  });
});

describe('after the stay', () => {
  it('asks for a review and nothing else', () => {
    const s = getBookingStage(booking({ status: 'completed', depositPaid: true }));
    expect(s.stage).toBe('stayed');
    expect(s.action).toBe('review');
    expect(s.canPay).toBe(false);
  });
});

describe('every stage names exactly one action', () => {
  it('never returns canPay without the pay action, or the reverse', () => {
    const cases: Booking[] = [
      booking({ status: 'pending' }),
      booking({ status: 'approved' }),
      booking({ status: 'approved', depositPaid: true }),
      booking({ status: 'completed' }),
      booking({ status: 'rejected' }),
      booking({ status: 'cancelled' }),
    ];
    for (const b of cases) {
      const s = getBookingStage(b);
      expect(s.canPay).toBe(s.action === 'pay');
    }
  });
});
