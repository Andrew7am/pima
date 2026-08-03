import type { Booking, Payment, Payout } from '../types';

/**
 * The money questions, answered in one place.
 *
 * These used to be answered inline on each screen, and the screens disagreed:
 * "how much is still owed" was computed two different ways in the same file,
 * and "how much can Pima transfer to this owner" forgot that a completed
 * transfer had already left. Money arithmetic that lives in a component is
 * arithmetic nobody can test, so it drifts.
 *
 * Nothing here reads or writes anything — every function takes the rows it
 * needs and returns a number or a decision.
 */

/** Every approved payment on a booking, optionally ignoring one row by id. */
export function approvedPaymentsFor(
  bookingId: string,
  payments: Payment[],
  excludePaymentId?: string,
): Payment[] {
  return payments.filter(
    (p) => p.bookingId === bookingId
      && p.paymentStatus === 'approved'
      && p.id !== excludePaymentId,
  );
}

/** What the platform has actually confirmed as received against a booking. */
export function approvedTotalFor(
  bookingId: string,
  payments: Payment[],
  excludePaymentId?: string,
): number {
  return approvedPaymentsFor(bookingId, payments, excludePaymentId)
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * What the guest owes now.
 *
 * The server normalises `deposit_amount` on every write
 * (validate_booking_price: ROUND(total_price * deposit_rate)) and it is the
 * figure every owner and admin finance screen sums, so it is what the guest
 * must be quoted. The rate is only a fallback for a row that somehow carries
 * no deposit_amount at all.
 */
export function depositDue(booking: Booking, depositRate: number): number {
  return booking.depositAmount || Math.round(booking.totalPrice * depositRate);
}

/**
 * Cash the owner collects at the door.
 *
 * `depositAmount` is set on every booking whether or not it was ever paid, so
 * it only comes off the total once `depositPaid` is true. Without that guard
 * an approved booking whose deposit never arrived told the owner to collect
 * only the remaining 85%, and the shortfall was never recovered.
 */
export function cashDueAtArrival(booking: Booking): number {
  return Math.max(0, booking.totalPrice - (booking.depositPaid ? booking.depositAmount : 0));
}

/**
 * What Pima can actually transfer to an owner right now.
 *
 * Pima only ever holds the deposits; the rest is cash the owner collects
 * directly on arrival and must never be presented as a transferable balance.
 * From what it holds, three things come off:
 *
 *   - the platform commission on the whole booking value;
 *   - every payout request that has not been rejected — including COMPLETED
 *     ones. Offsetting only the pending ones meant the full balance sprang
 *     back the moment an admin marked a transfer paid, and the owner could
 *     request the same money again, indefinitely;
 *   - anything the admin already settled one booking at a time, which stamps
 *     `ownerSettledAt` and never touches the payouts table at all.
 */
export function availableForTransfer(args: {
  depositReceived: number;
  platformCommissionAmount: number;
  payouts: Payout[];
  confirmedBookings: Booking[];
  commissionRate: number;
}): number {
  const { depositReceived, platformCommissionAmount, payouts, confirmedBookings, commissionRate } = args;

  const claimed = payouts
    .filter((p) => p.status !== 'rejected')
    .reduce((sum, p) => sum + p.amount, 0);

  // Mirror the amount the admin actually transfers per booking: the deposit
  // held, minus the full commission on the booking.
  const settledPerBooking = confirmedBookings
    .filter((b) => b.ownerSettledAt)
    .reduce((sum, b) => sum + ownerShareOf(b, commissionRate), 0);

  const held = Math.max(0, depositReceived - platformCommissionAmount);
  return Math.max(0, held - claimed - settledPerBooking);
}

/** The owner's cut of one booking's deposit, as the admin payout tab computes it. */
export function ownerShareOf(booking: Booking, commissionRate: number): number {
  return Math.max(0, Math.round((booking.depositAmount || 0) - (booking.totalPrice || 0) * commissionRate));
}

/**
 * What approving or rejecting one payment proof means for its booking.
 *
 * `null` means: record the verdict on the payment row, and leave the booking
 * exactly as it is.
 */
export type PaymentVerdict =
  | null
  | { paymentStatus: Booking['paymentStatus']; status?: Booking['status']; depositPaid: boolean };

export function resolvePaymentVerdict(args: {
  booking: Booking;
  payment: Payment;
  /** The full payments list; the payment under review is filtered out by id. */
  payments: Payment[];
  verdict: 'approved' | 'rejected';
}): PaymentVerdict {
  const { booking, payment, payments, verdict } = args;
  const otherApproved = approvedPaymentsFor(booking.id, payments, payment.id);

  if (verdict === 'approved') {
    // A proof left in the queue after the guest cancelled or the owner
    // rejected must not bring the booking back to life — those dates have
    // very likely been resold since. Keep the money on the payment row and
    // leave the booking closed; the refund is a human decision.
    if (booking.status === 'cancelled' || booking.status === 'rejected') return null;

    // Judge the whole ledger, not this one row. Two approved half-transfers
    // both read as 'paid_deposit' before, so a fully settled booking never
    // reached 'paid_full' and kept showing the owner an outstanding balance.
    const paidTotal = otherApproved.reduce((sum, p) => sum + p.amount, 0) + payment.amount;
    return {
      paymentStatus: paidTotal >= booking.totalPrice ? 'paid_full' : 'paid_deposit',
      status: 'approved',
      depositPaid: true,
    };
  }

  // Rejecting a later proof must not erase an earlier valid one. The points
  // trigger (migration 024) derives what was paid from the booking's
  // payment_status, so writing 'unpaid' here clawed back points the guest had
  // legitimately earned on the first payment.
  if (otherApproved.length > 0) return null;

  return { paymentStatus: 'unpaid', depositPaid: false };
}
