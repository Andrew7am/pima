import type { Booking, Payment } from '../types';

/**
 * Where a booking stands, and the one thing the guest can do about it.
 *
 * Pure, and separate from the screen, because the rule that matters here is a
 * promise rather than a layout: the booking flow tells the guest no money is
 * taken until the house approves, so nothing may offer payment while the
 * request is still under review. That is a claim about their money, and it is
 * worth a test rather than a code review.
 *
 * Exactly one action per stage. A screen that renders `action` and nothing
 * else cannot show a future step by accident.
 */
export type BookingStage =
  | 'review'            // sent, house has not answered
  | 'awaiting_deposit'  // approved, deposit owed
  | 'verifying'         // proof sent, platform checking it
  | 'confirmed'         // deposit settled, stay ahead
  | 'stayed'            // finished
  | 'closed';           // rejected or cancelled

export type BookingAction = 'refresh' | 'pay' | 'none' | 'voucher' | 'review';

export interface BookingStageInfo {
  stage: BookingStage;
  /** The single primary action, or 'none' when the guest waits. */
  action: BookingAction;
  /** True only where money may legitimately be asked for. */
  canPay: boolean;
}

/** A payment sent but not yet accepted or refused. */
export function hasPendingPayment(bookingId: string, payments: Payment[] = []): boolean {
  return payments.some((p) => p.bookingId === bookingId && p.paymentStatus === 'pending');
}

export function getBookingStage(booking: Booking, payments: Payment[] = []): BookingStageInfo {
  if (booking.status === 'rejected' || booking.status === 'cancelled') {
    return { stage: 'closed', action: 'none', canPay: false };
  }

  if (booking.status === 'completed') {
    return { stage: 'stayed', action: 'review', canPay: false };
  }

  // Still with the house. Nothing is owed, so nothing may be offered — this is
  // the promise the booking flow makes, enforced here rather than in markup.
  if (booking.status === 'pending') {
    return { stage: 'review', action: 'refresh', canPay: false };
  }

  // Approved from here on.
  const settled =
    booking.depositPaid ||
    booking.paymentStatus === 'paid_deposit' ||
    booking.paymentStatus === 'paid_full';

  if (settled) return { stage: 'confirmed', action: 'voucher', canPay: false };

  // Proof is in and being checked: asking again would take the money twice.
  if (hasPendingPayment(booking.id, payments)) {
    return { stage: 'verifying', action: 'none', canPay: false };
  }

  return { stage: 'awaiting_deposit', action: 'pay', canPay: true };
}
