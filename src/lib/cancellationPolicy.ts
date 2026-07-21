// Cancellation & refund policy math (migration 054). One source of truth
// for every place the policy is shown: the booking form, the guest's
// cancel confirmation, and the admin settings screen.
import { Booking, PlatformSettings } from '../types';

export type RefundTier = 'full' | 'partial' | 'none';

export function daysUntil(dateStr: string, from: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function getRefundTier(checkIn: string, settings: PlatformSettings, from: Date = new Date()): { tier: RefundTier; pct: number; daysLeft: number } {
  const daysLeft = daysUntil(checkIn, from);
  if (daysLeft >= settings.freeCancelDays) return { tier: 'full', pct: 1, daysLeft };
  if (daysLeft >= settings.partialRefundDays) return { tier: 'partial', pct: settings.partialRefundPct, daysLeft };
  return { tier: 'none', pct: 0, daysLeft };
}

// What the guest has actually paid so far — refunds only ever apply to
// real money received, not the booking's face value.
export function paidAmountOf(booking: Booking): number {
  if (booking.paymentStatus === 'paid_full') return booking.totalPrice;
  if (booking.paymentStatus === 'paid_deposit') return booking.depositAmount ?? 0;
  return 0;
}

export function refundAmountFor(booking: Booking, settings: PlatformSettings, from: Date = new Date()): { tier: RefundTier; pct: number; daysLeft: number; paid: number; refund: number } {
  const { tier, pct, daysLeft } = getRefundTier(booking.checkIn, settings, from);
  const paid = paidAmountOf(booking);
  return { tier, pct, daysLeft, paid, refund: Math.round(paid * pct) };
}
