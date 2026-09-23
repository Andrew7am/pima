import type { Booking } from '../types';

/**
 * The financial core, as the frontend is allowed to see it.
 *
 * Every number on an owner, admin or guest money screen used to be recomputed
 * in React from `bookings.total_price`, `bookings.deposit_amount` and
 * `bookings.commission_rate`. That worked while a trigger stamped a 15%
 * deposit onto every row and every house was on the same commission. It stops
 * working the moment `create_booking_with_financials` owns pricing:
 *
 *   - `bookings.deposit_amount` is 0 BY DESIGN. The real deposit lives in
 *     booking_financials, because PD-16 can raise it above the headline rate
 *     to cover the margin floor.
 *   - `bookings.commission_rate` only describes COMMISSION houses. Under
 *     MARKUP and NET_RATE there is no commission rate at all, so anything
 *     shaped `total x rate` is not merely imprecise, it is meaningless.
 *   - what the owner is owed is NOT a function of what the customer pays.
 *     Under MARKUP the customer pays 180 and the house is entitled to 150;
 *     the 30 is Pima's, and no arithmetic on the booking row can find it.
 *
 * So this module does no arithmetic on prices. It reads the snapshot the
 * database already computed, through whichever of the three role-scoped views
 * the caller is entitled to, and says plainly when there is no snapshot.
 *
 * WHY `Money` CARRIES A SOURCE. Bookings made before the cutover have no
 * booking_financials row, and the owner's own manual/walk-in booking path
 * still creates such rows today. Those cannot be answered from the financial
 * core, and blanking them would erase money an admin is actually chasing. So
 * each figure reports where it came from, and the screens can say so rather
 * than presenting a legacy estimate as a core fact.
 *
 * WHY `value` CAN BE null. An amount nobody can establish must render as a
 * dash, never as 0. A zero reads as "nothing is owed", and that is the single
 * most expensive wrong answer this app can give.
 */

// ---------------------------------------------------------------------------
// The three role views, field for field
// ---------------------------------------------------------------------------

/** `fin_booking_summary_customer` — RLS: guest_user_id = auth.uid(). */
export interface CustomerFinancials {
  bookingId: string;
  houseId: string;
  currency: string;
  retailPrice: number;
  promoDiscount: number;
  pointsDiscount: number;
  pointsRedeemed: number;
  /** Retail less promotion and points. What the guest owes in total. */
  finalPrice: number;
  /** The PD-16 deposit as stored. NOT finalPrice x depositRate. */
  depositAmount: number;
  /** Deposit money Pima has actually banked (PIMA_CASH legs). */
  depositReceived: number;
  depositRemaining: number;
  /** finalPrice - depositAmount. Paid direct to the house at arrival (PD-04). */
  arrivalBalanceExternal: number;
  refundPayable: number;
  policyFreeCancelDays: number;
  policyPartialRefundDays: number;
  policyPartialRefundPct: number;
}

/** `fin_booking_summary_owner` — RLS: owner_id = auth.uid(). */
export interface OwnerFinancials {
  bookingId: string;
  houseId: string;
  currency: string;
  /** The CUSTOMER's price. Context only; never the owner's entitlement. */
  finalPrice: number;
  /** What the house is owed for this booking, in total, under its agreement. */
  ownerEntitlement: number;
  /** The slice of the entitlement Pima holds: entitlement - arrival balance. */
  ownerCashHeld: number;
  ownerSettledAmount: number;
  /** held - settled. The only figure that may be offered as transferable. */
  ownerCashPayable: number;
  /** Money the house owes Pima back (NET_RATE over-collection at the door). */
  ownerReceivableOutstanding: number;
  ownerReceivableStatuses: string | null;
  settlementHoldStatus: string | null;
  settlementHoldUntil: string | null;
  settlementReleasedAt: string | null;
  ownerCashReleaseDate: string | null;
  /** What the GUEST still owes, handed to the house at the door. */
  arrivalBalanceExternal: number;
  policyFreeCancelDays: number;
  policyPartialRefundDays: number;
  policyPartialRefundPct: number;
}

/** `fin_booking_summary_admin` — RLS: is_admin(auth.uid()). */
export interface AdminFinancials extends OwnerFinancials {
  ownerId: string;
  guestUserId: string;
  modelType: 'MARKUP' | 'COMMISSION' | 'NET_RATE';
  retailPrice: number;
  promoDiscount: number;
  pointsDiscount: number;
  pointsRedeemed: number;
  depositRate: number;
  depositStandard: number;
  depositAmount: number;
  depositBasis: string;
  pimaCashReceived: number;
  depositRemaining: number;
  refundPayable: number;
  pimaGrossMargin: number;
  requiredMinMargin: number;
  minMarginRate: number;
  projectedNetMargin: number;
  assumedTransferFee: number;
  transferFeeActual: number;
  promoCostRecognised: number;
  pointsCostRecognised: number;
  cashShortfall: number;
  marginWarning: boolean;
  overrideRequired: boolean;
  commissionRate: number | null;
  pricingBasis: string;
  pricingQuantity: number;
}

/** Snapshots by booking id. A missing key = this booking predates the core. */
export type FinancialsIndex<T> = Record<string, T>;

// ---------------------------------------------------------------------------
// A figure, and where it came from
// ---------------------------------------------------------------------------

export type MoneySource =
  /** Read from booking_financials through a role view. Authoritative. */
  | 'core'
  /** Derived from the pre-cutover booking columns. An estimate. */
  | 'legacy'
  /** Nobody can say. Render a dash, never a zero. */
  | 'unknown';

export interface Money {
  value: number | null;
  source: MoneySource;
}

export const core = (value: number): Money => ({ value, source: 'core' });
export const legacy = (value: number): Money => ({ value, source: 'legacy' });
export const unknownMoney: Money = { value: null, source: 'unknown' };

/** For callers that need a number and have a defensible default. */
export function moneyOr(m: Money, fallback: number): number {
  return m.value ?? fallback;
}

/**
 * Add figures without laundering unknowns into zeros.
 *
 * `total` sums everything that COULD be established; `unknown` counts what
 * could not. A caller that ignores `unknown` is understating the total, so the
 * UI shows an "unpriced" marker instead of a confident wrong sum.
 */
export function sumMoney(items: Money[]): { total: number; unknown: number; legacy: number } {
  let total = 0;
  let unknown = 0;
  let legacyCount = 0;
  for (const m of items) {
    if (m.value === null) { unknown++; continue; }
    total += m.value;
    if (m.source === 'legacy') legacyCount++;
  }
  return { total, unknown, legacy: legacyCount };
}

// ---------------------------------------------------------------------------
// OWNER: what the house collects, is owed, and can be paid
// ---------------------------------------------------------------------------

/**
 * (A) What the CUSTOMER still owes, handed to the house at the door.
 *
 * Before: `totalPrice - (depositPaid ? depositAmount : 0)`. Under the core
 * `deposit_amount` is 0, so that returns the full retail price and the house
 * is told to collect 180 on a booking where the guest already paid Pima 54.
 *
 * After: the stored `arrival_balance_external`, with the ONE legacy guard that
 * is still right — if the deposit was never actually paid, the balance at the
 * door is the whole price. paymentLedger's comment records what happens
 * without it: the house collects the reduced amount and the shortfall is never
 * recovered.
 *
 * KNOWN LIMIT: a PARTIALLY paid deposit still reads as paid, so the door
 * figure is short by the unpaid part. That is unchanged from the legacy
 * behaviour, and the admin `underpaid_deposit` exception is what catches it.
 */
export function ownerArrivalBalance(booking: Booking, fin?: OwnerFinancials | AdminFinancials): Money {
  if (fin) return core(booking.depositPaid ? fin.arrivalBalanceExternal : fin.finalPrice);
  return legacy(Math.max(0, booking.totalPrice - (booking.depositPaid ? (booking.depositAmount || 0) : 0)));
}

/**
 * (B) What the house is entitled to for this booking, in total.
 *
 * There is no legacy equivalent. `totalPrice - commission` answers a different
 * question and answers it wrongly for two of the three models, so a booking
 * with no snapshot reports unknown rather than a plausible-looking number.
 */
export function ownerEntitlement(fin?: OwnerFinancials | AdminFinancials): Money {
  return fin ? core(fin.ownerEntitlement) : unknownMoney;
}

/** (C) The deposit the guest owes Pima: finalPrice - arrival balance. */
export function depositToPima(fin?: OwnerFinancials | AdminFinancials): Money {
  return fin ? core(fin.finalPrice - fin.arrivalBalanceExternal) : unknownMoney;
}

/**
 * (D) The settlement hold: the part of the entitlement Pima is holding.
 *
 *   hold = GREATEST(0, entitlement - arrival balance)
 *
 * Pima only ever holds the deposit, and the deposit covers Pima's own margin
 * first. Whatever of the entitlement remains after the guest pays the house
 * directly is what Pima still has to send. Under NET_RATE the house often
 * collects MORE at the door than it is entitled to, so the hold is 0 and the
 * excess becomes an owner receivable instead.
 */
export function ownerHold(fin?: OwnerFinancials | AdminFinancials): Money {
  return fin ? core(fin.ownerCashHeld) : unknownMoney;
}

/**
 * (E) What Pima can actually transfer for this booking right now.
 *
 * NOT the entitlement: most of the entitlement never passes through Pima.
 * NOT the hold: part of it may already have been settled.
 *
 *   payable = GREATEST(0, hold - already settled)
 */
export function ownerPayable(fin?: OwnerFinancials | AdminFinancials): Money {
  return fin ? core(fin.ownerCashPayable) : unknownMoney;
}

/** Money the HOUSE owes Pima back — the mirror of a payable. */
export function ownerReceivable(fin?: OwnerFinancials | AdminFinancials): Money {
  return fin ? core(fin.ownerReceivableOutstanding) : unknownMoney;
}

export type HoldState = 'held' | 'released' | 'cancelled' | 'none' | 'unknown';

export function holdState(fin?: OwnerFinancials | AdminFinancials): HoldState {
  if (!fin) return 'unknown';
  const status = (fin.settlementHoldStatus || '').toUpperCase();
  if (status === 'HELD') return 'held';
  if (status === 'RELEASED') return 'released';
  if (status === 'CANCELLED') return 'cancelled';
  return 'none';
}

export const HOLD_LABEL: Record<HoldState, string> = {
  held: 'محجوز للتسوية',
  released: 'تم الإفراج',
  cancelled: 'ملغي',
  none: 'بدون حجز',
  unknown: 'غير محدد',
};

// ---------------------------------------------------------------------------
// CUSTOMER: what the guest pays
// ---------------------------------------------------------------------------

/**
 * The deposit the guest owes, as the financial core stored it.
 *
 * Before: `totalPrice * settings.depositRate`, recomputed in React. That
 * silently disagrees with the charge whenever PD-16's margin floor raises the
 * deposit above the headline rate — which is exactly when the guest is most
 * likely to query it.
 *
 * The rate fallback survives only for pre-cutover bookings, which were priced
 * that way, and is labelled legacy so the screen can stop short of implying
 * the figure came from the core.
 *
 * `depositRate` is NULL when the financial core could not be reached. That is
 * not the same as 0.15, and it must not be allowed to become 0.15: the guest
 * would be quoted half of what the server charges, on every screen, with
 * nothing marking when it started. An unknown rate produces an unknown
 * deposit. A booking that already carries a stored figure is unaffected —
 * that number came from somewhere real.
 */
export function customerDeposit(
  booking: Booking,
  fin: CustomerFinancials | undefined,
  /** null when settings.depositRateIsAuthoritative is false. */
  depositRate: number | null,
): Money {
  if (fin) return core(fin.depositAmount);
  if (booking.depositAmount && booking.depositAmount > 0) return legacy(booking.depositAmount);
  if (depositRate === null) return unknownMoney;
  return legacy(Math.round(booking.totalPrice * depositRate));
}

/**
 * The rate a screen may quote from, or null if there is nothing trustworthy.
 *
 * One place to ask, so no screen has to remember the flag exists.
 */
export function quotableDepositRate(settings: { depositRate: number; depositRateIsAuthoritative: boolean }): number | null {
  return settings.depositRateIsAuthoritative ? settings.depositRate : null;
}

/**
 * What share of THIS booking the deposit actually is, for a label beside it.
 *
 * Screens used to print `settings.depositRate` next to a deposit they had
 * read from the snapshot. The two come from different places and disagree in
 * two ordinary cases:
 *
 *   - the fin_client_settings() overlay fails, so the rate is still the
 *     legacy 0.15 while the amount beside it is the real 30%;
 *   - PD-16 lifts the deposit to the margin floor, so the booking's deposit
 *     is deliberately NOT the headline rate at all.
 *
 * A percentage derived from the booking's own two numbers cannot contradict
 * them, because it is a description of them. Where they are not both known —
 * no snapshot, an unpriced booking — there is no honest percentage to give,
 * and null tells the caller to print the amount alone rather than guess.
 */
export function depositPercentOf(deposit: number | null, total: number | null): number | null {
  if (deposit == null || total == null) return null;
  if (!(total > 0) || !(deposit > 0)) return null;
  if (deposit > total) return null;
  return Math.round((deposit / total) * 100);
}

/** The total the guest owes. Retail less promotion and points, as stored. */
export function customerFinalPrice(booking: Booking, fin?: CustomerFinancials): Money {
  return fin ? core(fin.finalPrice) : legacy(booking.totalPrice);
}

/** What the guest still pays at the door. Never recomputed from the rate. */
export function customerArrivalBalance(booking: Booking, fin?: CustomerFinancials): Money {
  if (fin) return core(fin.arrivalBalanceExternal);
  const dep = booking.depositPaid ? (booking.depositAmount || 0) : 0;
  return legacy(Math.max(0, booking.totalPrice - dep));
}

/** Deposit money Pima has actually banked against this booking. */
export function customerDepositReceived(fin?: CustomerFinancials): Money {
  return fin ? core(fin.depositReceived) : unknownMoney;
}

// ---------------------------------------------------------------------------
// Row mappers — snake_case view rows to the shapes above
// ---------------------------------------------------------------------------

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function mapCustomerFinancials(r: Record<string, unknown>): CustomerFinancials {
  return {
    bookingId: String(r.booking_id),
    houseId: String(r.house_id),
    currency: String(r.currency ?? 'EGP'),
    retailPrice: num(r.retail_price),
    promoDiscount: num(r.promo_discount),
    pointsDiscount: num(r.points_discount),
    pointsRedeemed: num(r.points_redeemed),
    finalPrice: num(r.final_price),
    depositAmount: num(r.deposit_amount),
    depositReceived: num(r.deposit_received),
    depositRemaining: num(r.deposit_remaining),
    arrivalBalanceExternal: num(r.arrival_balance_external),
    refundPayable: num(r.refund_payable),
    policyFreeCancelDays: num(r.policy_free_cancel_days),
    policyPartialRefundDays: num(r.policy_partial_refund_days),
    policyPartialRefundPct: num(r.policy_partial_refund_pct),
  };
}

export function mapOwnerFinancials(r: Record<string, unknown>): OwnerFinancials {
  return {
    bookingId: String(r.booking_id),
    houseId: String(r.house_id),
    currency: String(r.currency ?? 'EGP'),
    finalPrice: num(r.final_price),
    ownerEntitlement: num(r.owner_entitlement),
    ownerCashHeld: num(r.owner_cash_held),
    ownerSettledAmount: num(r.owner_settled_amount),
    ownerCashPayable: num(r.owner_cash_payable),
    ownerReceivableOutstanding: num(r.owner_receivable_outstanding),
    ownerReceivableStatuses: str(r.owner_receivable_statuses),
    settlementHoldStatus: str(r.settlement_hold_status),
    settlementHoldUntil: str(r.settlement_hold_until),
    settlementReleasedAt: str(r.settlement_released_at),
    ownerCashReleaseDate: str(r.owner_cash_release_date),
    arrivalBalanceExternal: num(r.arrival_balance_external),
    policyFreeCancelDays: num(r.policy_free_cancel_days),
    policyPartialRefundDays: num(r.policy_partial_refund_days),
    policyPartialRefundPct: num(r.policy_partial_refund_pct),
  };
}

export function mapAdminFinancials(r: Record<string, unknown>): AdminFinancials {
  return {
    ...mapOwnerFinancials(r),
    ownerId: String(r.owner_id ?? ''),
    guestUserId: String(r.guest_user_id ?? ''),
    modelType: String(r.model_type || 'COMMISSION') as AdminFinancials['modelType'],
    retailPrice: num(r.retail_price),
    promoDiscount: num(r.promo_discount),
    pointsDiscount: num(r.points_discount),
    pointsRedeemed: num(r.points_redeemed),
    depositRate: num(r.deposit_rate),
    depositStandard: num(r.deposit_standard),
    depositAmount: num(r.deposit_amount),
    depositBasis: String(r.deposit_basis ?? ''),
    pimaCashReceived: num(r.pima_cash_received),
    depositRemaining: num(r.deposit_remaining),
    refundPayable: num(r.refund_payable),
    pimaGrossMargin: num(r.pima_gross_margin),
    requiredMinMargin: num(r.required_min_margin),
    minMarginRate: num(r.min_margin_rate),
    projectedNetMargin: num(r.projected_net_margin),
    assumedTransferFee: num(r.assumed_transfer_fee),
    transferFeeActual: num(r.transfer_fee_actual),
    promoCostRecognised: num(r.promo_cost_recognised),
    pointsCostRecognised: num(r.points_cost_recognised),
    cashShortfall: num(r.cash_shortfall),
    marginWarning: r.margin_warning === true,
    overrideRequired: r.override_required === true,
    commissionRate: r.commission_rate === null || r.commission_rate === undefined ? null : Number(r.commission_rate),
    pricingBasis: String(r.pricing_basis ?? ''),
    pricingQuantity: num(r.pricing_quantity),
  };
}

export function indexByBooking<T extends { bookingId: string }>(rows: T[]): FinancialsIndex<T> {
  const out: FinancialsIndex<T> = {};
  for (const r of rows) out[r.bookingId] = r;
  return out;
}

// ---------------------------------------------------------------------------
// The pre-core fallback, in exactly one place
// ---------------------------------------------------------------------------

/**
 * What the owner was owed under the arrangement that predates the financial
 * core, and ONLY under it.
 *
 * Read the guard before the formula. These two functions are reachable only
 * when `booking_financials` has no row for the booking, and a booking made
 * through `create_booking_with_financials` always has one, written in the same
 * transaction. So a MARKUP or NET_RATE booking can never arrive here: before
 * the agreement system existed every house was on commission, and
 * `bookings.commission_rate` is the rate that booking was actually closed at
 * (migration 108). Applying it to those rows is not model-blindness, it is the
 * correct model for that era — which is why the legacy figures are preserved
 * rather than blanked, and why they are labelled `legacy` on the way out.
 *
 * THE HOLE THIS DOES NOT CLOSE: the owner's manual/walk-in booking path still
 * inserts bookings directly, so it still produces snapshot-less rows TODAY, on
 * houses that may be MARKUP. Until that path moves onto the RPC these helpers
 * can be reached by a booking they were never meant for. That is recorded as
 * an open finding, not papered over here.
 */
export function legacyOwnerEntitlement(booking: Booking, fallbackRate: number): Money {
  const rate = booking.commissionRate ?? fallbackRate;
  return legacy(Math.max(0, Math.round(booking.totalPrice * (1 - rate))));
}

/** The pre-core transferable balance: the deposit held, less the commission. */
export function legacyOwnerPayable(booking: Booking, fallbackRate: number): Money {
  const rate = booking.commissionRate ?? fallbackRate;
  return legacy(Math.max(0, Math.round((booking.depositAmount || 0) - booking.totalPrice * rate)));
}

/** The house's entitlement, from the core when there is one. */
export function entitlementOf(booking: Booking, fin: OwnerFinancials | AdminFinancials | undefined, fallbackRate: number): Money {
  return fin ? core(fin.ownerEntitlement) : legacyOwnerEntitlement(booking, fallbackRate);
}

/**
 * What Pima may transfer for this booking.
 *
 * The deposit-paid guard is the whole point: `owner_cash_payable` is a
 * CONTRACTUAL figure that exists from the moment the booking is priced, so
 * offering it before the guest's money arrives would have Pima transfer cash
 * it is not holding.
 */
export function payableOf(booking: Booking, fin: OwnerFinancials | AdminFinancials | undefined, fallbackRate: number): Money {
  if (!booking.depositPaid) return core(0);
  return fin ? core(fin.ownerCashPayable) : legacyOwnerPayable(booking, fallbackRate);
}

/**
 * The deposit figure, from whichever view the caller happens to hold.
 *
 * The owner view deliberately omits `deposit_amount` — an owner is told what
 * the guest still owes at the door, not how Pima structured its own
 * collection. It is recoverable all the same, because
 * `arrival_balance_external` is defined as `final_price - deposit_amount`, so
 * the difference is the deposit. Deriving it here keeps that one identity in
 * a single place instead of inline on three screens.
 */
export function depositSnapshot(
  fin?: OwnerFinancials | CustomerFinancials | AdminFinancials,
): { depositAmount: number } | undefined {
  if (!fin) return undefined;
  if ('depositAmount' in fin) return { depositAmount: fin.depositAmount };
  return { depositAmount: fin.finalPrice - fin.arrivalBalanceExternal };
}

/**
 * What a money field renders as when nobody can establish it.
 *
 * One constant, because a dash and a zero must never be a per-screen choice:
 * a zero in a money column is a claim that nothing is owed.
 */
export const DASH = '—';

/**
 * What may actually be transferred for one booking, right now.
 *
 * `owner_cash_payable` is a CONTRACTUAL figure: it exists from the moment the
 * booking is priced and says what Pima will owe once the guest pays. It is not
 * a statement about money Pima is holding.
 *
 * Those two diverge whenever a deposit is underpaid. `resolvePaymentVerdict`
 * marks a booking deposit-paid on ANY approved payment, so a guest who sent 10
 * against a 54 deposit produces a booking that looks settled and a payable of
 * 24 — and an admin prompted to transfer 24 of the 10 that arrived.
 *
 * The cap is the whole function. Everything else it delegates.
 */
export function transferableOf(
  booking: Booking,
  fin: OwnerFinancials | AdminFinancials | undefined,
  fallbackRate: number,
  /** Approved payments banked against this booking. */
  cashReceived: number,
): Money {
  const payable = payableOf(booking, fin, fallbackRate);
  if (payable.value === null) return payable;
  return { value: Math.max(0, Math.min(payable.value, cashReceived)), source: payable.source };
}
