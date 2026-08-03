import { describe, it, expect } from 'vitest';
import { bookingMoney } from './bookingMoney';
import type { Booking } from '../types';

const RATE = 0.15;

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'booking_1', houseId: 'h1', houseName: 'بيت', userId: 'u1', userName: 'ضيف',
  userPhone: '01000000000', userEmail: 'g@example.com', userRole: 'user',
  checkIn: '2026-08-10', checkOut: '2026-08-13', guestsCount: 10,
  totalPrice: 10000, depositPaid: false, depositAmount: 1500,
  status: 'approved', isLargeConferenceQuote: false, paymentStatus: 'unpaid',
  createdAt: '2026-08-01T10:00:00.000Z',
  ...over,
} as Booking);

describe('bookingMoney', () => {
  it('counts a full payment as the whole price, not just the deposit', () => {
    // The bug this function exists for: the detail panel subtracted only the
    // deposit, so a guest who had paid everything still showed 8,500 owed.
    const m = bookingMoney(booking({ paymentStatus: 'paid_full', depositPaid: true }), RATE);
    expect(m.collected).toBe(10000);
    expect(m.outstanding).toBe(0);
    expect(m.percent).toBe(100);
    expect(m.fullyPaid).toBe(true);
  });

  it('counts a deposit payment as the deposit', () => {
    const m = bookingMoney(booking({ paymentStatus: 'paid_deposit', depositPaid: true }), RATE);
    expect(m.collected).toBe(1500);
    expect(m.outstanding).toBe(8500);
    expect(m.percent).toBe(15);
    expect(m.fullyPaid).toBe(false);
  });

  it('still credits a legacy row that has only the depositPaid flag', () => {
    // Rows written before paymentStatus existed carry the boolean alone.
    // Reading those as nothing-paid understates what the owner received.
    const m = bookingMoney(booking({ depositPaid: true, paymentStatus: undefined }), RATE);
    expect(m.collected).toBe(1500);
  });

  it('reports nothing collected when nothing has been paid', () => {
    const m = bookingMoney(booking(), RATE);
    expect(m.collected).toBe(0);
    expect(m.outstanding).toBe(10000);
    expect(m.percent).toBe(0);
  });

  it('derives the deposit from the rate only when none was agreed', () => {
    expect(bookingMoney(booking({ depositAmount: 0 }), RATE).deposit).toBe(1500);
    expect(bookingMoney(booking({ depositAmount: 2400 }), RATE).deposit).toBe(2400);
  });

  describe('balanceApplies', () => {
    it('is false while the owner has not answered the request', () => {
      // «المتبقي 10,000» on a booking nobody approved says the guest owes
      // money they were never asked for.
      expect(bookingMoney(booking({ status: 'pending' }), RATE).balanceApplies).toBe(false);
    });

    it('is false once the booking is cancelled or rejected', () => {
      expect(bookingMoney(booking({ status: 'cancelled' }), RATE).balanceApplies).toBe(false);
      expect(bookingMoney(booking({ status: 'rejected' }), RATE).balanceApplies).toBe(false);
    });

    it('is true for a live or finished stay', () => {
      expect(bookingMoney(booking({ status: 'approved' }), RATE).balanceApplies).toBe(true);
      expect(bookingMoney(booking({ status: 'completed' }), RATE).balanceApplies).toBe(true);
    });

    it('does not hide what was collected on a cancelled booking', () => {
      // A refund is owed against it, so the figure still has to be available.
      const m = bookingMoney(booking({ status: 'cancelled', paymentStatus: 'paid_deposit', depositPaid: true }), RATE);
      expect(m.balanceApplies).toBe(false);
      expect(m.collected).toBe(1500);
    });
  });

  it('flags a receipt waiting on review', () => {
    expect(bookingMoney(booking({ paymentStatus: 'pending_verification' }), RATE).awaitingProof).toBe(true);
    expect(bookingMoney(booking(), RATE).awaitingProof).toBe(false);
  });

  it('never draws a bar past its track or below zero', () => {
    const over = bookingMoney(booking({ totalPrice: 1000, depositAmount: 1500, depositPaid: true }), RATE);
    expect(over.percent).toBe(100);
    expect(over.outstanding).toBe(0);
  });

  it('does not divide by a zero total', () => {
    const m = bookingMoney(booking({ totalPrice: 0, depositAmount: 0 }), RATE);
    expect(m.percent).toBe(0);
    expect(m.outstanding).toBe(0);
    expect(m.fullyPaid).toBe(false);
  });

  it('agrees with itself across the two screens for the same booking', () => {
    // The regression guard: whatever the list card and the detail panel show,
    // they now come from this one call.
    const b = booking({ paymentStatus: 'paid_full', depositPaid: true, totalPrice: 4800, depositAmount: 720 });
    const list = bookingMoney(b, RATE);
    const detail = bookingMoney(b, RATE);
    expect(detail.outstanding).toBe(list.outstanding);
    expect(detail.outstanding).toBe(0);
  });
});
