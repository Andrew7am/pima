import type { Booking, Payment, Payout } from '../types';
import { approvedTotalFor, cashDueAtArrival, ownerShareOf, rateOf } from './paymentLedger';

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
    // rateOf, not the bare rate: `owed` below goes through ownerShareOf, which
    // already honours the rate stamped on the booking (migration 108). Charging
    // commission at TODAY's rate while owing at the AGREED one made the two
    // columns stop adding up the moment the rate was edited — collected minus
    // commission no longer equalled owed. Both anchored to the same rate now.
    platformCommission += Math.min(received, Math.round(b.totalPrice * rateOf(b, commissionRate)));
    bookingValue += b.totalPrice;
  }

  // What Pima still owes owners — a BALANCE AT A DATE, not a flow.
  //
  // This used to be summed over heldBookings, which is deposits that arrived
  // INSIDE the window. So filtering to «هذا الشهر» made every June deposit
  // still unremitted vanish from what Pima owes, while transfers made against
  // those same June deposits stayed counted in full. The figure came out
  // understated, went into the CSV under a filename naming the period, and
  // painted an owner «متسدّد» in green purely because no new deposit of his
  // had landed that month.
  //
  // Collected and commission stay windowed: those are FLOWS, and a flow is
  // what a period is for. What is owed is a STOCK — everything held on or
  // before the window's end and not settled by then.
  const asAt = w?.end;
  const settledByThen = (b: Booking) =>
    !!b.ownerSettledAt && (!asAt || new Date(b.ownerSettledAt) <= asAt);

  const heldAsAt = platformCollects ? bookings.filter((b) => {
    if (!isLive(b)) return false;
    const held = payments.some((p) =>
      p.bookingId === b.id && p.paymentStatus === 'approved' && !isCashPayment(p)
      && (!asAt || (!!p.paymentDate && new Date(p.paymentDate) <= asAt)));
    return held && !settledByThen(b);
  }) : [];
  const ownersOwed = heldAsAt.reduce((s, b) => s + ownerShareOf(b, commissionRate), 0);

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

  // Flows in the window: what came in and what Pima earned on it.
  for (const b of heldBookings) {
    const house = houseById.get(b.houseId);
    if (!house) continue;
    const row = rowFor(house.ownerId);
    const received = approvedTotalFor(b.id, payments);
    row.collected += received;
    row.commission += Math.min(received, Math.round(b.totalPrice * rateOf(b, commissionRate)));
    houseAgg.set(b.houseId, (houseAgg.get(b.houseId) || 0) + received);
  }

  // The balance, on the same basis as the page total — everything held by the
  // window's end and not settled by then. Computed separately from the loop
  // above because it is a stock and that one is a flow; running them together
  // is what put an owner in a green «متسدّد» badge while he was still owed
  // money from a deposit that arrived last month.
  for (const b of heldAsAt) {
    const house = houseById.get(b.houseId);
    if (!house) continue;
    rowFor(house.ownerId).owed += ownerShareOf(b, commissionRate);
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

// ---------------------------------------------------------------------------
// The treasury: what is in each of Pima's own accounts
// ---------------------------------------------------------------------------

export interface AccountBalance {
  account: string;
  received: number;
  refunded: number;
  net: number;
  count: number;
}

/**
 * Money in, per collection account, so the app can be tallied against the real
 * balances at the end of a week.
 *
 * payment_method records the KIND of transfer — instapay, vodafone, bank — not
 * WHICH account, and Pima has several. Reconciling was impossible: a transfer
 * that never actually arrived looked identical to one that did.
 *
 * Payments recorded before the account column existed, and any recorded
 * without one, are reported under «غير محدد» rather than dropped. Dropping
 * them would make the totals here disagree with the finance page for no
 * visible reason, which is worse than an untidy row.
 */
export function accountBalances(args: {
  payments: Payment[];
  window: FinanceWindow | null;
}): { accounts: AccountBalance[]; unassignedCount: number } {
  const { payments, window: w } = args;
  const rows = new Map<string, AccountBalance>();
  let unassignedCount = 0;

  for (const p of payments) {
    if (p.paymentStatus !== 'approved') continue;
    if (!inWindow(p.paymentDate, w)) continue;
    const key = (p.receivedAccount || '').trim() || 'غير محدد';
    if (key === 'غير محدد') unassignedCount++;
    let row = rows.get(key);
    if (!row) { row = { account: key, received: 0, refunded: 0, net: 0, count: 0 }; rows.set(key, row); }
    row.received += p.amount;
    row.refunded += p.refundedAmount || 0;
    row.count++;
  }
  for (const row of rows.values()) row.net = row.received - row.refunded;

  return {
    accounts: [...rows.values()].sort((a, b) => b.net - a.net),
    unassignedCount,
  };
}

// ---------------------------------------------------------------------------
// Refunds owed
// ---------------------------------------------------------------------------

export interface RefundDue {
  paymentId: string;
  bookingId: string;
  who: string;
  houseName: string;
  received: number;
  alreadyRefunded: number;
  outstanding: number;
  reason: 'cancelled' | 'overpaid';
}

/**
 * Money Pima is holding that belongs to a guest.
 *
 * Two ways it happens: the trip was cancelled or rejected after the deposit
 * arrived, or the guest simply sent more than the booking costs. Both were
 * invisible — payment_status has no refunded state, so the money stayed
 * counted as collected indefinitely and nothing said it was owed back.
 *
 * Partial refunds are respected: only what is still outstanding is listed, so
 * a row leaves this queue when it is actually settled and not before.
 */
export function refundsDue(args: { bookings: Booking[]; payments: Payment[] }): RefundDue[] {
  const { bookings, payments } = args;
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const out: RefundDue[] = [];

  for (const p of payments) {
    if (p.paymentStatus !== 'approved') continue;
    const b = byId.get(p.bookingId);
    if (!b) continue;
    const already = p.refundedAmount || 0;

    const dead = b.status === 'cancelled' || b.status === 'rejected';
    if (dead) {
      const outstanding = p.amount - already;
      if (outstanding > 0) {
        out.push({
          paymentId: p.id, bookingId: b.id, who: b.userName, houseName: b.houseName,
          received: p.amount, alreadyRefunded: already, outstanding, reason: 'cancelled',
        });
      }
      continue;
    }

    // Still a live trip, but the guest sent more than it costs.
    const receivedForBooking = approvedTotalFor(b.id, payments);
    const over = receivedForBooking - b.totalPrice;
    if (over > 0) {
      const outstanding = Math.min(over, p.amount) - already;
      if (outstanding > 0) {
        out.push({
          paymentId: p.id, bookingId: b.id, who: b.userName, houseName: b.houseName,
          received: p.amount, alreadyRefunded: already, outstanding, reason: 'overpaid',
        });
      }
    }
  }

  return out.sort((a, b) => b.outstanding - a.outstanding);
}
