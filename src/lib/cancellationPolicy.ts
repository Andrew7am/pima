// Cancellation & refund policy math (migration 054, extended by 0128). One
// source of truth for every place the policy is shown: the booking form, the
// guest's cancel confirmation, and the admin settings screen.
//
// Since 0128 the numbers are no longer platform-wide. They may come from the
// property, from the platform fallback, or — for a booking already taken —
// from the snapshot frozen onto that booking. Which of the three applies is
// decided in lib/bookingPolicy and nowhere else; this file does the arithmetic
// on whatever it is handed.
import { Booking, Payment } from '../types';
import { approvedTotalFor } from './paymentLedger';
import { EffectivePolicy, RefundPolicy, policyForBooking } from './bookingPolicy';

export type RefundTier = 'full' | 'partial' | 'none';

export function daysUntil(dateStr: string, from: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Takes any RefundPolicy — a PlatformSettings satisfies it structurally, so
 * every existing caller is unaffected, and a resolved property policy or a
 * booking's snapshot can be passed in exactly the same way.
 */
export function getRefundTier(checkIn: string, policy: RefundPolicy, from: Date = new Date()): { tier: RefundTier; pct: number; daysLeft: number } {
  const daysLeft = daysUntil(checkIn, from);
  if (daysLeft >= policy.freeCancelDays) return { tier: 'full', pct: 1, daysLeft };
  if (daysLeft >= policy.partialRefundDays) return { tier: 'partial', pct: policy.partialRefundPct, daysLeft };
  return { tier: 'none', pct: 0, daysLeft };
}

/**
 * What the guest has actually paid so far.
 *
 * Money received, never money owed. Pass the approved payment rows and this
 * sums them; those rows are the only record of cash that actually arrived.
 *
 * The status-derived branch is now explicitly a fallback for callers with no
 * payment rows to hand. It used to be the whole function, reading
 * booking.depositAmount ?? 0 — correct while the legacy trigger stamped a
 * deposit onto every row, and silently wrong under the financial core, where
 * bookings.deposit_amount is deliberately 0 and the real figure lives in
 * booking_financials. A booking paid in full would then refund nothing,
 * because ?? 0 does not catch 0.
 *
 * Returns null, not 0, when it cannot tell. An unknown amount rendered as
 * zero is how a guest gets refunded nothing.
 */
export function paidAmountOf(booking: Booking, payments?: Payment[]): number | null {
  if (payments) return approvedTotalFor(booking.id, payments);
  if (booking.paymentStatus === 'paid_full') return booking.totalPrice;
  if (booking.paymentStatus === 'paid_deposit') {
    // 0 here means 'the financial core owns this figure', not 'nothing paid'.
    return booking.depositAmount && booking.depositAmount > 0 ? booking.depositAmount : null;
  }
  if (!booking.paymentStatus || booking.paymentStatus === 'unpaid') return 0;
  return null;
}

/**
 * What this booking is owed back.
 *
 * Uses the policy the booking was TAKEN under, not the one its property
 * advertises today. An owner who shortens their free-cancellation window in
 * March must not thereby reduce a refund owed on a booking made in February;
 * the guest agreed to the earlier terms and the row remembers them.
 *
 * `policy` is returned as well as used, so the cancel dialog can state the
 * actual numbers rather than repeating the platform's.
 */
export function refundAmountFor(booking: Booking, settings: RefundPolicy, from: Date = new Date(), payments?: Payment[]): { tier: RefundTier; pct: number; daysLeft: number; paid: number | null; refund: number | null; policy: EffectivePolicy } {
  const policy = policyForBooking(booking, settings);
  const { tier, pct, daysLeft } = getRefundTier(booking.checkIn, policy, from);
  const paid = paidAmountOf(booking, payments);
  // An unknown paid amount must not silently become a zero refund.
  if (paid === null) return { tier, pct, daysLeft, paid: null, refund: null, policy };
  return { tier, pct, daysLeft, paid, refund: Math.round(paid * pct), policy };
}
