import { Booking } from '../types';
import { paidAmountOf } from './cancellationPolicy';

/**
 * What has actually been collected on a booking, and whether a balance means
 * anything yet.
 *
 * This existed twice, differently. The owner's list card asked paidAmountOf();
 * the detail panel one tap away subtracted the deposit and never looked at
 * paymentStatus at all — so a booking the guest had paid in full read
 * «مسدَّد بالكامل» in the list and «المبلغ المتبقي ٤,٠٨٠ ج.م» when you opened
 * it. Two screens, one booking, opposite claims about money.
 *
 * One function, so they cannot drift again.
 */
export interface BookingMoney {
  /** The agreed deposit, or the platform rate applied to the total. */
  deposit: number;
  /** Money genuinely received. */
  collected: number;
  /** Still owed. Zero when nothing is owed — never negative. */
  outstanding: number;
  /** Share collected, 0–100, clamped. */
  percent: number;
  /**
   * Whether «المتبقي» is a real claim.
   *
   * False for a request nobody has approved and for a booking that is over:
   * printing a balance there tells the owner a guest owes money that was never
   * asked for. The number still exists; it just isn't a debt.
   */
  balanceApplies: boolean;
  /** A transfer receipt has been sent and not yet accepted or refused. */
  awaitingProof: boolean;
  fullyPaid: boolean;
}

export function bookingMoney(booking: Booking, depositRate: number): BookingMoney {
  const deposit = booking.depositAmount || Math.round(booking.totalPrice * depositRate);
  // paidAmountOf is the refund math's answer and the one that knows about
  // 'paid_full'. The legacy depositPaid flag is taken alongside it rather than
  // instead of it: rows written before paymentStatus existed carry only the
  // boolean, and reading those as nothing-paid understates what came in.
  const collected = Math.max(paidAmountOf(booking), booking.depositPaid ? deposit : 0);
  const outstanding = Math.max(0, booking.totalPrice - collected);
  const percent = booking.totalPrice > 0
    ? Math.max(0, Math.min(100, Math.round((collected / booking.totalPrice) * 100)))
    : 0;

  return {
    deposit,
    collected,
    outstanding,
    percent,
    balanceApplies: booking.status === 'approved' || booking.status === 'completed',
    awaitingProof: booking.paymentStatus === 'pending_verification',
    fullyPaid: collected >= booking.totalPrice && booking.totalPrice > 0,
  };
}
