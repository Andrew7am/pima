// Cancellation & refund policy math (migration 054, extended by 0128). One
// source of truth for every place the policy is shown: the booking form, the
// guest's cancel confirmation, and the admin settings screen.
//
// Since 0128 the numbers are no longer platform-wide. They may come from the
// property, from the platform fallback, or — for a booking already taken —
// from the snapshot frozen onto that booking. Which of the three applies is
// decided in lib/bookingPolicy and nowhere else; this file does the arithmetic
// on whatever it is handed.
import { Booking } from '../types';
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

// What the guest has actually paid so far — refunds only ever apply to
// real money received, not the booking's face value.
export function paidAmountOf(booking: Booking): number {
  if (booking.paymentStatus === 'paid_full') return booking.totalPrice;
  if (booking.paymentStatus === 'paid_deposit') return booking.depositAmount ?? 0;
  return 0;
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
export function refundAmountFor(booking: Booking, settings: RefundPolicy, from: Date = new Date()): { tier: RefundTier; pct: number; daysLeft: number; paid: number; refund: number; policy: EffectivePolicy } {
  const policy = policyForBooking(booking, settings);
  const { tier, pct, daysLeft } = getRefundTier(booking.checkIn, policy, from);
  const paid = paidAmountOf(booking);
  return { tier, pct, daysLeft, paid, refund: Math.round(paid * pct), policy };
}
