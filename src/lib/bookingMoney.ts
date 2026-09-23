import { Booking, Payment } from '../types';
import { paidAmountOf } from './cancellationPolicy';
import { depositDue } from './paymentLedger';

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
 *
 * Not a rival to lib/paymentLedger, which answers the same questions from the
 * Payment rows themselves — that is the authoritative record and the one to
 * use wherever the payments array is in hand. This reads the booking's own
 * summary fields, because the owner's dashboard is never given that array.
 * The deposit comes from paymentLedger either way rather than being derived
 * a second time here.
 */
export interface BookingMoney {
  /**
   * The agreed deposit — from the financial-core snapshot, or the figure the
   * booking stored before the core existed.
   *
   * NULL when neither is available and no AUTHORITATIVE rate was supplied.
   * It used to fall through to `totalPrice x depositRate` with whatever rate
   * the caller handed over, which on an owner screen was the raw
   * `settings.depositRate` — still the legacy 0.15 whenever the
   * fin_client_settings() overlay had failed. A booking created by the
   * financial core carries deposit_amount = 0 by design, so that fallback was
   * reached by exactly the bookings it was most wrong about. An unknown
   * deposit is now unknown; the UI prints a dash.
   */
  deposit: number | null;
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
  /**
   * False when no payment rows were supplied and the row itself cannot say
   * what was collected. The UI should render — rather than a figure, because
   * an unknown amount shown as 0 reads as 'the guest has paid nothing'.
   */
  collectedKnown: boolean;
}

/** Just enough of a financial-core snapshot to price a deposit. */
export interface DepositSnapshot { depositAmount: number }

export function bookingMoney(
  booking: Booking,
  /**
   * An AUTHORITATIVE deposit rate, or null when there is none.
   *
   * Callers pass quotableDepositRate(settings), which is null unless the rate
   * came from the financial core — never the legacy platform_settings 0.15.
   * The same guard customerDeposit() already applies, applied here too so the
   * owner's screens cannot answer differently from the guest's.
   */
  depositRate: number | null,
  payments?: Payment[],
  /** The core snapshot, when the caller has one. See lib/bookingFinancials. */
  fin?: DepositSnapshot,
): BookingMoney {
  // The stored deposit beats any rate arithmetic: PD-16 can raise it above
  // the headline rate to cover the margin floor, and depositDue would then
  // quote the guest less than the booking actually charged. depositDue
  // stays as the pre-core fallback, where deposit_amount was the truth —
  // reached only when the booking HAS a stored figure, or when the rate the
  // caller supplied is one the financial core vouched for.
  const deposit: number | null = fin
    ? fin.depositAmount
    : (booking.depositAmount > 0 || depositRate !== null)
      ? depositDue(booking, depositRate ?? 0)
      : null;
  // paidAmountOf is the refund math's answer and the one that knows about
  // 'paid_full'. The legacy depositPaid flag is taken alongside it rather than
  // instead of it: rows written before paymentStatus existed carry only the
  // boolean, and reading those as nothing-paid understates what came in.
  // null means 'we cannot tell from this row' — under the financial core
  // bookings.deposit_amount is 0 by design, so a status-only reading of a
  // deposit-paid booking knows nothing. Treating that as zero collected is
  // what showed a paid guest an unpaid balance, so it is kept separate.
  const paid = paidAmountOf(booking, payments);
  // An unknown deposit contributes no floor. It used to contribute the
  // rate-derived guess, which is the number this change exists to stop
  // inventing — and a floor built on a guess is the guess again, one step on.
  const depositFloor = booking.depositPaid && deposit !== null ? deposit : 0;
  const collected = Math.max(paid ?? 0, depositFloor);
  // Two independent ways to be able to state a figure.
  //
  // The payment side speaks when it reports something positive, or when it
  // reports zero on a booking that does not also claim a paid deposit — a
  // deposit-paid row reading 0 is a contradiction, not an answer.
  //
  // The deposit side speaks only when we know what the deposit WAS. It used
  // to speak on the depositPaid flag alone, which was safe while the flag
  // always came with a stored amount; under the financial core that amount is
  // 0 and the figure lives in the snapshot, so with no snapshot the flag says
  // that money arrived without saying how much. Claiming that as known is
  // what shows a paid guest an unpaid balance.
  const paidTellsUs = paid !== null && (paid > 0 || !booking.depositPaid);
  const depositTellsUs = booking.depositPaid && deposit !== null;
  const collectedKnown = paidTellsUs || depositTellsUs;
  const outstanding = Math.max(0, booking.totalPrice - collected);
  const percent = booking.totalPrice > 0
    ? Math.max(0, Math.min(100, Math.round((collected / booking.totalPrice) * 100)))
    : 0;

  return {
    deposit,
    collected,
    collectedKnown,
    outstanding,
    percent,
    balanceApplies: booking.status === 'approved' || booking.status === 'completed',
    awaitingProof: booking.paymentStatus === 'pending_verification',
    fullyPaid: collected >= booking.totalPrice && booking.totalPrice > 0,
  };
}
