import type { Booking, Payment, Payout } from '../types';
import { approvedTotalFor, cashDueAtArrival, ownerShareOf } from './paymentLedger';

/**
 * The admin finance page's figures, in one testable place.
 *
 * paymentLedger.ts already says why this file exists: money arithmetic that
 * lives in a component is arithmetic nobody can test, so it drifts. It drifted
 * anyway — the finance tab grew a fourth private copy of the split and got it
 * backwards, taking the commission out of the DEPOSIT instead of out of the
 * booking value. On a 20,000 booking with a 15% deposit and a 5% rate it
 * printed 150 where the payout engine transfers on a commission of 1,000, and
 * told the admin the owner was owed 2,850 where the button next door pays
 * 2,000. Everything here therefore routes through ownerShareOf() so the two
 * screens cannot disagree again: whatever the payout tab transfers is what
 * this reports.
 *
 * TWO THINGS THIS ENCODES that the old inline version did not:
 *
 * 1. Pima only ever holds DEPOSITS. The remaining ~85% is cash the guest hands
 *    the owner at the door and Pima never sees. The old page subtracted it as
 *    «متبقٍ لم يُحصّل» under a warning triangle — permanently flagging 85% of
 *    the business as a collection failure when it is the design.
 *
 * 2. Money that has already left is gone. Completed payouts and per-booking
 *    settlements (ownerSettledAt) both reduce what Pima still owes. The old
 *    figure was a running total of everything ever collected, presented as a
 *    live liability, so it never moved no matter how many transfers the admin
 *    made.
 *
 * Everything is scoped by WHEN THE MONEY MOVED — payment date, payout
 * completion date — not by the trip's check-in date. A deposit banked today
 * for a trip next month is cash in hand today. The old page dated it to the
 * trip and then ended every window at «now», so it appeared in no period at
 * all except «كل الوقت».
 */

export interface FinanceWindow {
  start: Date;
  end: Date;
}

export interface OwnerFinanceRow {
  id: string;
  name: string;
  /** Deposits Pima received against this owner's bookings, in the window. */
  collected: number;
  /** Pima's commission on those bookings. */
  commission: number;
  /** Still sitting with Pima, not yet transferred. */
  owed: number;
  /** Already transferred, by either settlement route. */
  paid: number;
}

export interface FinanceSummary {
  /** Deposits Pima actually received and holds — excludes cash-at-house. */
  collectedByPima: number;
  /** Deposits paid in cash straight to the owner. Pima never held these. */
  collectedByOwnerDirect: number;
  /** Approved money on bookings later cancelled or rejected — refund pending. */
  collectedOnCancelled: number;
  /** Pima's own cut, capped at what was actually received. */
  platformCommission: number;
  /** Owner money Pima is still holding. */
  ownersOwed: number;
  /** Owner money Pima has already sent, by either route. */
  ownersPaid: number;
  /** The balance the guest still pays the owner in cash on arrival. */
  cashAtDoor: number;
  /** Value of the bookings whose money moved in this window. */
  bookingValue: number;
  bookingCount: number;
  perOwner: OwnerFinanceRow[];
  perHouse: { id: string; name: string; amount: number }[];
}

const isLive = (b: Booking) => b.status !== 'cancelled' && b.status !== 'rejected';

function inWindow(iso: string | undefined, w: FinanceWindow | null): boolean {
  if (!w) return true;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= w.start && d <= w.end;
}

/**
 * A cash deposit was handed over at the house, so the owner already has it.
 * The payouts tab excludes these for the same reason — prompting a transfer
 * would pay the owner money Pima never collected.
 */
function isCashPayment(p: Payment): boolean {
  return p.paymentMethod === 'cash';
}

export function summarizeFinances(args: {
  bookings: Booking[];
  payments: Payment[];
  payouts: Payout[];
  houses: { id: string; name: string; ownerId: string }[];
  users: { id: string; name: string }[];
  commissionRate: number;
  window: FinanceWindow | null;
  /**
   * False when Pima has no collection accounts configured, in which case it
   * never receives a guest payment at all and there is nothing to transfer.
   * The payouts tab gates on the same condition.
   */
  platformCollects: boolean;
}): FinanceSummary {
  const { bookings, payments, payouts, houses, users, commissionRate, window: w, platformCollects } = args;

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const houseById = new Map(houses.map((h) => [h.id, h]));
  const userName = (id: string) => users.find((u) => u.id === id)?.name || 'مالك';

  const approvedInWindow = payments.filter(
    (p) => p.paymentStatus === 'approved' && inWindow(p.paymentDate, w),
  );

  let collectedByPima = 0;
  let collectedByOwnerDirect = 0;
  let collectedOnCancelled = 0;
  const heldBookingIds = new Set<string>();

  for (const p of approvedInWindow) {
    const b = bookingById.get(p.bookingId);
    if (!b) continue;
    if (!isLive(b)) { collectedOnCancelled += p.amount; continue; }
    if (isCashPayment(p) || !platformCollects) { collectedByOwnerDirect += p.amount; continue; }
    collectedByPima += p.amount;
    heldBookingIds.add(b.id);
  }

  const heldBookings = [...heldBookingIds].map((id) => bookingById.get(id)!).filter(Boolean);

  // Commission is charged on the whole booking, but Pima cannot keep more than
  // it is actually holding — hence the cap. Without it a booking whose deposit
  // came in below the nominal amount would report a commission larger than the
  // cash received.
  let platformCommission = 0;
  let bookingValue = 0;
  for (const b of heldBookings) {
    const received = approvedTotalFor(b.id, payments);
    platformCommission += Math.min(received, Math.round(b.totalPrice * commissionRate));
    bookingValue += b.totalPrice;
  }

  // What Pima still owes: the same per-booking share the payout tab transfers,
  // over the bookings it has not settled yet.
  const owedBookings = heldBookings.filter((b) => !b.ownerSettledAt);
  const ownersOwed = owedBookings.reduce((s, b) => s + ownerShareOf(b, commissionRate), 0);

  // What has already left, counted ONCE, from the payouts table only.
  //
  // It is tempting to add up ownerShareOf() over the bookings stamped
  // ownerSettledAt and treat that as a second, independent settlement route.
  // It is not one. settleBookingsPayout (db.ts:776-790) inserts a completed
  // owner_payouts row AND stamps owner_settled_at on the same bookings with
  // the same timestamp — it is the only writer of that column in the whole
  // codebase. Adding both showed every per-booking transfer twice: a 2,000
  // settlement read as 4,000.
  //
  // Payouts are also the better source on their own terms. owner_payouts.amount
  // is the EGP that actually moved, recorded at the moment it moved.
  // Recomputing it with ownerShareOf() applies TODAY's commission rate to a
  // transfer made under whatever rate was in force then, so every past payout
  // would silently change the next time the rate is edited.
  const ownersPaid = payouts
    .filter((p) => p.status === 'completed' && inWindow(p.completedAt, w))
    .reduce((s, p) => s + p.amount, 0);

  const cashAtDoor = heldBookings.reduce((s, b) => s + cashDueAtArrival(b), 0);

  // Per owner, from the same per-booking numbers, so the rows add up to the
  // page totals instead of rounding independently.
  const ownerAgg = new Map<string, OwnerFinanceRow>();
  const rowFor = (ownerId: string) => {
    let row = ownerAgg.get(ownerId);
    if (!row) {
      row = { id: ownerId, name: userName(ownerId), collected: 0, commission: 0, owed: 0, paid: 0 };
      ownerAgg.set(ownerId, row);
    }
    return row;
  };

  const houseAgg = new Map<string, number>();

  for (const b of heldBookings) {
    const house = houseById.get(b.houseId);
    if (!house) continue;
    const row = rowFor(house.ownerId);
    const received = approvedTotalFor(b.id, payments);
    row.collected += received;
    row.commission += Math.min(received, Math.round(b.totalPrice * commissionRate));
    // Settled bookings are not added to `owed`; what was paid for them comes
    // from the payout rows below, never from re-deriving the share here.
    if (!b.ownerSettledAt) row.owed += ownerShareOf(b, commissionRate);
    houseAgg.set(b.houseId, (houseAgg.get(b.houseId) || 0) + received);
  }

  // The single source for money that left, matching the page total.
  for (const p of payouts) {
    if (p.status !== 'completed' || !inWindow(p.completedAt, w)) continue;
    rowFor(p.ownerId).paid += p.amount;
  }

  const perOwner = [...ownerAgg.values()].sort((a, b) => b.owed - a.owed || b.collected - a.collected);
  const perHouse = [...houseAgg.entries()]
    .map(([id, amount]) => ({ id, name: houseById.get(id)?.name || id, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    collectedByPima,
    collectedByOwnerDirect,
    collectedOnCancelled,
    platformCommission,
    ownersOwed,
    ownersPaid,
    cashAtDoor,
    bookingValue,
    bookingCount: heldBookings.length,
    perOwner,
    perHouse,
  };
}
