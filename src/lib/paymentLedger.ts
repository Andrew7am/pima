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
/**
 * The commission rate THIS booking was agreed at.
 *
 * Stamped onto the row when the booking is made (migration 108) and never
 * changed after. Before that column existed there was only the live platform
 * rate, so a rate change silently recomputed the commission on every booking
 * ever made — cutting what owners were owed on deals already closed. The
 * fallback is only for a row written by a client older than the migration.
 */
export function rateOf(booking: Booking, fallbackRate: number): number {
  return booking.commissionRate ?? fallbackRate;
}

/** Pima's cut of one booking, at that booking's own rate. */
export function commissionOf(booking: Booking, fallbackRate: number): number {
  return Math.round((booking.totalPrice || 0) * rateOf(booking, fallbackRate));
}

/** Pima's cut across a set of bookings — each at its own agreed rate. */
export function commissionTotal(bookings: Booking[], fallbackRate: number): number {
  return bookings.reduce((sum, b) => sum + commissionOf(b, fallbackRate), 0);
}

/**
 * What the owner keeps of the whole BOOKED value — collected or not.
 *
 * This is a headline figure, not a payable one: most of it is cash the guest
 * hands over at the door and Pima never touches. See availableForTransfer for
 * what can actually be sent.
 */
export function ownerNetOfBooked(bookings: Booking[], fallbackRate: number): number {
  const gross = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  return gross - commissionTotal(bookings, fallbackRate);
}

/**
 * What the owner keeps of money ACTUALLY COLLECTED through the platform.
 *
 * The admin's owner-dues table used to compute this as collected × (1 − the
 * CURRENT global rate), while the owner's own screen used booked value. Two
 * numbers, both labelled «صافي مستحقات», differing by more than tenfold in
 * ordinary data.
 */
export function ownerNetOfCollected(
  collectedByBooking: { booking: Booking; collected: number }[],
  fallbackRate: number,
): number {
  return collectedByBooking.reduce(
    (sum, { booking, collected }) => sum + (collected - collected * rateOf(booking, fallbackRate)),
    0,
  );
}

export function ownerShareOf(booking: Booking, commissionRate: number): number {
  return Math.max(0, Math.round((booking.depositAmount || 0) - (booking.totalPrice || 0) * rateOf(booking, commissionRate)));
}

/**
 * Drop the bookings an owner has already been paid for through a payout
 * REQUEST, so the admin cannot transfer the same share a second time.
 *
 * There are two ways an owner gets paid and they did not know about each
 * other. settleBookingsPayout stamps ownerSettledAt on the bookings it
 * covers, so those drop out of the ready-to-transfer list by themselves.
 * Completing an owner's own payout request does not stamp anything — it
 * names a house and an amount, never a booking — so the bookings that funded
 * it stayed in the list looking unpaid, and the admin could send the money
 * again.
 *
 * Netting is oldest-first, which is the order the money was earned in and the
 * order an owner assumes when he asks to be paid.
 *
 * The subtlety: settleBookingsPayout writes a payout row AND stamps the
 * bookings, using one timestamp for both. Counting that row here would net off
 * a SECOND, unrelated booking — paying the owner once but marking two
 * bookings settled. Those rows are identified by that shared timestamp and
 * skipped.
 */
export function unclaimedOwedBookings(args: {
  owed: Booking[];
  allBookings: Booking[];
  payouts: Payout[];
  commissionRate: number;
}): { remaining: Booking[]; coveredAmount: number } {
  const { owed, allBookings, payouts, commissionRate } = args;

  const settledStamps = new Set(
    allBookings.filter((b) => b.ownerSettledAt).map((b) => `${b.houseId}|${b.ownerSettledAt}`),
  );

  const claimedByHouse = new Map<string, number>();
  for (const p of payouts) {
    if (p.status === 'rejected') continue;
    if (p.completedAt && settledStamps.has(`${p.houseId}|${p.completedAt}`)) continue;
    claimedByHouse.set(p.houseId, (claimedByHouse.get(p.houseId) || 0) + p.amount);
  }

  const byOldest = [...owed].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime(),
  );

  const remaining: Booking[] = [];
  let coveredAmount = 0;
  for (const b of byOldest) {
    const share = ownerShareOf(b, commissionRate);
    const budget = claimedByHouse.get(b.houseId) || 0;
    if (budget >= share && share > 0) {
      claimedByHouse.set(b.houseId, budget - share);
      coveredAmount += share;
      continue;
    }
    remaining.push(b);
  }
  return { remaining, coveredAmount };
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
