import { describe, it, expect } from 'vitest';
import { buildBookingJourney, approvedDepositPayment } from './bookingJourney';
import type { Booking, Payment } from '../types';

const base = {
  id: 'b1', houseId: 'h1', houseName: 'بيت السيدة العذراء', userId: 'u1',
  userName: 'أندرو', userPhone: '0100', userEmail: 'a@b.c', userRole: 'servant',
  checkIn: '2026-07-15', checkOut: '2026-07-18', guestsCount: 18,
  totalPrice: 7560, depositAmount: 1134, depositPaid: false,
  status: 'pending', isLargeConferenceQuote: false,
  createdAt: '2026-07-18T08:00:00Z',
} as unknown as Booking;

const booking = (over: Partial<Booking> = {}) => ({ ...base, ...over }) as Booking;

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1', bookingId: 'b1', userId: 'u1', userName: 'أندرو', amount: 1134,
  paymentMethod: 'instapay', paymentStatus: 'approved', paymentDate: '2026-07-19T09:00:00Z',
  ...over,
} as Payment);

const stateOf = (b: Booking, p: Payment[] = []) =>
  Object.fromEntries(buildBookingJourney(b, p).steps.map((s) => [s.key, s.state]));

describe('booking journey sequencing', () => {
  it('parks a brand-new request on the approval step', () => {
    expect(stateOf(booking())).toEqual({
      submitted: 'done', approved: 'current', deposit: 'upcoming',
      arrival: 'upcoming', departure: 'upcoming',
    });
  });

  it('moves to the deposit once the owner approves', () => {
    expect(stateOf(booking({ status: 'approved' }))).toEqual({
      submitted: 'done', approved: 'done', deposit: 'current',
      arrival: 'upcoming', departure: 'upcoming',
    });
  });

  it('waits on arrival once the deposit is paid', () => {
    const s = stateOf(booking({ status: 'approved', depositPaid: true }));
    expect(s.deposit).toBe('done');
    expect(s.arrival).toBe('current');
  });

  it('moves to the end of the stay once the guest checks in', () => {
    const s = stateOf(booking({ status: 'approved', depositPaid: true, checkedInAt: '2026-07-15T14:00:00Z' }));
    expect(s.arrival).toBe('done');
    expect(s.departure).toBe('current');
  });

  it('finishes when the guest has checked out', () => {
    const j = buildBookingJourney(booking({
      status: 'approved', depositPaid: true,
      checkedInAt: '2026-07-15T14:00:00Z', checkedOutAt: '2026-07-18T10:00:00Z',
    }));
    expect(j.steps.every((s) => s.state === 'done')).toBe(true);
    expect(j.finished).toBe(true);
  });

  // Older records were marked 'completed' before the check-in/out stamps
  // existed. A finished stay implies both ends of it happened.
  it('treats a completed booking as fully travelled even without the stamps', () => {
    const s = stateOf(booking({ status: 'completed', depositPaid: true }));
    expect(Object.values(s).every((v) => v === 'done')).toBe(true);
  });

  // An owner recording an already-paid walk-in skips the middle entirely; the
  // line still has to read coherently rather than showing a gap.
  it('renders coherently when stages are skipped', () => {
    const s = stateOf(booking({ status: 'approved', depositPaid: true, checkedOutAt: '2026-07-18T10:00:00Z' }));
    expect(Object.values(s).every((v) => v === 'done')).toBe(true);
  });
});

describe('booking journey dates', () => {
  it('dates each stage only from a real column', () => {
    const j = buildBookingJourney(
      booking({
        status: 'approved', approvedAt: '2026-07-18T12:00:00Z',
        checkedInAt: '2026-07-15T14:00:00Z', checkedOutAt: '2026-07-18T10:00:00Z',
      }),
      [payment()],
    );
    const at = Object.fromEntries(j.steps.map((s) => [s.key, s.at]));

    expect(at.submitted).toBe('2026-07-18T08:00:00Z');
    expect(at.approved).toBe('2026-07-18T12:00:00Z');
    expect(at.deposit).toBe('2026-07-19T09:00:00Z');
    expect(at.arrival).toBe('2026-07-15T14:00:00Z');
    expect(at.departure).toBe('2026-07-18T10:00:00Z');
  });

  // Bookings confirmed before migration 087 have no approved_at. The step must
  // still render — just without a date. Inventing one would be worse.
  it('leaves the approval undated when the column is empty', () => {
    const j = buildBookingJourney(booking({ status: 'approved' }));
    const approved = j.steps.find((s) => s.key === 'approved')!;

    expect(approved.state).toBe('done');
    expect(approved.at).toBeUndefined();
  });

  // A submitted-but-unverified transfer must not date the deposit step, or the
  // guest would think a payment they still owe had gone through.
  it('ignores a payment the platform has not approved', () => {
    const pending = [payment({ paymentStatus: 'pending' })];

    expect(approvedDepositPayment('b1', pending)).toBeUndefined();
    const j = buildBookingJourney(booking({ status: 'approved' }), pending);
    expect(j.steps.find((s) => s.key === 'deposit')!.state).toBe('current');
  });

  it('ignores payments belonging to another booking', () => {
    expect(approvedDepositPayment('b1', [payment({ bookingId: 'b2' })])).toBeUndefined();
  });
});

describe('booking journey message', () => {
  it("explains each stage in the guest's own terms", () => {
    expect(buildBookingJourney(booking()).message).toContain('بيراجع طلبك');
    expect(buildBookingJourney(booking({ status: 'approved' })).message).toContain('ادفع العربون');
    expect(buildBookingJourney(booking({ status: 'approved', depositPaid: true })).message)
      .toContain(base.houseName);
    expect(buildBookingJourney(booking({
      status: 'approved', depositPaid: true, checkedInAt: '2026-07-15T14:00:00Z',
    })).message).toContain('إقامة سعيدة');
    expect(buildBookingJourney(booking({ status: 'completed', depositPaid: true })).message)
      .toContain('اكتملت إقامتك');
  });
});
