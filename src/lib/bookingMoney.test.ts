import { describe, it, expect } from 'vitest';
import { bookingMoney } from './bookingMoney';
import { quotableDepositRate } from './bookingFinancials';
import type { Booking } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';

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

/**
 * P2-6. The owner's screens passed the RAW settings.depositRate into
 * bookingMoney. A booking created by the financial core carries
 * deposit_amount = 0 by design, so whenever its snapshot was unavailable the
 * deposit fell through to totalPrice x rate — and that rate is the legacy
 * 0.15 whenever the fin_client_settings() overlay had failed. The guest's
 * screens had been guarded by quotableDepositRate() since the cutover; the
 * owner's had not.
 */
describe('bookingMoney never invents a deposit from the legacy rate', () => {
  const CORE = booking({ depositAmount: 0, totalPrice: 10000 });

  it('takes the deposit from the financial snapshot when there is one', () => {
    const m = bookingMoney(CORE, null, undefined, { depositAmount: 3000 });
    expect(m.deposit).toBe(3000);
  });

  it('prefers the snapshot even when an authoritative rate is available', () => {
    // PD-16 can lift the deposit above the headline rate. 3400 is not 30% of
    // 10000, and the snapshot is still the answer.
    const m = bookingMoney(CORE, 0.30, undefined, { depositAmount: 3400 });
    expect(m.deposit).toBe(3400);
  });

  it('reports UNKNOWN with no snapshot, no stored figure and no authoritative rate', () => {
    const m = bookingMoney(CORE, null);
    expect(m.deposit).toBeNull();
  });

  it('does not compute 15% of the total in that case', () => {
    const m = bookingMoney(CORE, null);
    expect(m.deposit).not.toBe(1500);        // 10000 x 0.15, what it used to return
    expect(m.deposit).not.toBe(3000);        // nor 30%
    expect(m.deposit).toBeNull();
  });

  it('still honours a pre-core booking that stored its own deposit', () => {
    // Those rows were priced that way, so the figure came from somewhere real.
    const legacyRow = booking({ depositAmount: 1500, totalPrice: 10000 });
    expect(bookingMoney(legacyRow, null).deposit).toBe(1500);
  });

  it('still derives from a rate the financial core vouched for', () => {
    expect(bookingMoney(CORE, 0.30).deposit).toBe(3000);
  });

  it('quotableDepositRate cannot hand it the legacy rate', () => {
    // The default settings carry 0.15 AND the flag that says so is not
    // authoritative, which is exactly the state after a failed overlay.
    expect(DEFAULT_PLATFORM_SETTINGS.depositRate).toBe(0.15);
    expect(quotableDepositRate(DEFAULT_PLATFORM_SETTINGS)).toBeNull();
    expect(bookingMoney(CORE, quotableDepositRate(DEFAULT_PLATFORM_SETTINGS)).deposit).toBeNull();
    // and once the overlay succeeds, the 30% rate does flow through
    const live = { ...DEFAULT_PLATFORM_SETTINGS, depositRate: 0.30, depositRateIsAuthoritative: true };
    expect(bookingMoney(CORE, quotableDepositRate(live)).deposit).toBe(3000);
  });
});

describe('an unknown deposit does not become a collected figure', () => {
  const CORE = booking({ depositAmount: 0, totalPrice: 10000 });

  it('contributes no floor to collected', () => {
    // depositPaid used to multiply the invented deposit into 'collected',
    // which carried the guess one step further into outstanding and percent.
    const m = bookingMoney(booking({ ...CORE, depositPaid: true, paymentStatus: undefined }), null);
    expect(m.deposit).toBeNull();
    expect(m.collected).toBe(0);
    expect(m.outstanding).toBe(10000);
  });

  it('says so, rather than claiming nothing was collected', () => {
    // collectedKnown exists precisely so the UI can print a dash instead of a
    // zero. Claiming 'known' here is what showed a paid guest an unpaid balance.
    const m = bookingMoney(booking({ ...CORE, depositPaid: true, paymentStatus: undefined }), null);
    expect(m.collectedKnown).toBe(false);
  });

  it('is still known when the snapshot supplies the deposit', () => {
    const m = bookingMoney(booking({ ...CORE, depositPaid: true, paymentStatus: undefined }),
      null, undefined, { depositAmount: 3000 });
    expect(m.collected).toBe(3000);
    expect(m.collectedKnown).toBe(true);
    expect(m.outstanding).toBe(7000);
  });

  it('is still known from payment rows even without a deposit figure', () => {
    const m = bookingMoney(booking({ ...CORE, depositPaid: true, paymentStatus: 'paid_full' }), null);
    expect(m.collected).toBe(10000);
    expect(m.collectedKnown).toBe(true);
    expect(m.fullyPaid).toBe(true);
  });
});

describe('the owner screens pass the guarded rate', () => {
  it('and everything else about the figures is unchanged', () => {
    // The regression guard for the fields the fix must not disturb.
    const b = booking({ paymentStatus: 'paid_deposit', depositPaid: true, depositAmount: 1500 });
    const m = bookingMoney(b, quotableDepositRate(DEFAULT_PLATFORM_SETTINGS), undefined,
      { depositAmount: 3000 });
    expect(m.deposit).toBe(3000);
    expect(m.collected).toBe(3000);
    expect(m.outstanding).toBe(7000);
    expect(m.percent).toBe(30);
    expect(m.balanceApplies).toBe(true);
    expect(m.awaitingProof).toBe(false);
    expect(m.fullyPaid).toBe(false);
    expect(m.collectedKnown).toBe(true);
  });
});
