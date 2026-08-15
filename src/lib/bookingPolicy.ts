// Property-specific booking policy (migration 0128).
//
// One question, asked in two tenses, and this file is the only place either is
// answered:
//
//   resolvePolicy(house, settings)     what governs a booking made NOW
//   policyForBooking(booking, settings) what governs one already TAKEN
//
// They differ, and the difference is the point. A property's policy is live and
// its owner may change it at any time; a booking's policy was frozen onto the
// row when it was created. An owner who tightens their terms in March must not
// thereby rewrite what a guest agreed to in February — so anything showing or
// computing a refund for an existing booking must go through the second
// function, never the first.
import { RetreatHouse, Booking, PlatformSettings } from '../types';

/** Where a resolved field's value came from — shown in the admin view. */
export type PolicySource = 'property' | 'platform' | 'snapshot' | 'none';

export interface EffectivePolicy {
  freeCancelDays: number;
  partialRefundDays: number;
  partialRefundPct: number;
  /** undefined = this property has no child rule, so every guest is charged. */
  childFreeUnderAge?: number;
  notes?: string;
  source: {
    freeCancelDays: PolicySource;
    partialRefundDays: PolicySource;
    partialRefundPct: PolicySource;
    childFreeUnderAge: PolicySource;
  };
}

/** Just the three refund numbers — what getRefundTier actually needs. */
export interface RefundPolicy {
  freeCancelDays: number;
  partialRefundDays: number;
  partialRefundPct: number;
}

/**
 * The policy in force for a property right now.
 *
 * Field by field, not all-or-nothing: a house that sets only a longer free
 * window keeps the platform's partial terms. Mirrors stamp_booking_policy in
 * migration 0128 — if the two disagree, the guest is shown one policy and held
 * to another.
 */
export function resolvePolicy(
  house: Pick<RetreatHouse, 'freeCancelDays' | 'partialRefundDays' | 'partialRefundPct' | 'childFreeUnderAge' | 'bookingPolicyNotes'> | null | undefined,
  settings: RefundPolicy,
): EffectivePolicy {
  const pick = <T>(own: T | null | undefined, fallback: T): [T, PolicySource] =>
    own === null || own === undefined ? [fallback, 'platform'] : [own, 'property'];

  const [freeCancelDays, sFree] = pick(house?.freeCancelDays, settings.freeCancelDays);
  const [partialRefundDays, sDays] = pick(house?.partialRefundDays, settings.partialRefundDays);
  const [partialRefundPct, sPct] = pick(house?.partialRefundPct, settings.partialRefundPct);

  return {
    freeCancelDays,
    partialRefundDays,
    partialRefundPct,
    // Deliberately no platform fallback: there is no platform-wide child rule,
    // and inventing one would change the price of every existing property.
    childFreeUnderAge: house?.childFreeUnderAge ?? undefined,
    notes: house?.bookingPolicyNotes || undefined,
    source: {
      freeCancelDays: sFree,
      partialRefundDays: sDays,
      partialRefundPct: sPct,
      childFreeUnderAge: house?.childFreeUnderAge == null ? 'none' : 'property',
    },
  };
}

/**
 * The policy this booking is actually held to.
 *
 * A booking taken after migration 0128 carries its own snapshot and that is
 * final. One taken before it has no snapshot, and falls back to the live
 * platform policy — which is not a guess: platform-wide terms are precisely
 * what those bookings were made under, because per-property terms did not yet
 * exist. The house is deliberately not consulted for an old booking; doing so
 * would apply terms to it that were never offered.
 */
export function policyForBooking(booking: Booking, settings: RefundPolicy): EffectivePolicy {
  const has = booking.policyFreeCancelDays != null
    && booking.policyPartialRefundDays != null
    && booking.policyPartialRefundPct != null;

  if (!has) {
    return {
      ...resolvePolicy(null, settings),
      childFreeUnderAge: undefined,
    };
  }

  return {
    freeCancelDays: booking.policyFreeCancelDays as number,
    partialRefundDays: booking.policyPartialRefundDays as number,
    partialRefundPct: booking.policyPartialRefundPct as number,
    childFreeUnderAge: booking.policyChildFreeUnderAge ?? undefined,
    source: {
      freeCancelDays: 'snapshot',
      partialRefundDays: 'snapshot',
      partialRefundPct: 'snapshot',
      childFreeUnderAge: booking.policyChildFreeUnderAge == null ? 'none' : 'snapshot',
    },
  };
}

/**
 * How many of the party pay.
 *
 * MUST mirror validate_booking_price in migration 0128 exactly: the server
 * recomputes the price from its own rates and rejects anything below the floor.
 * A free child the client grants and the server does not is not a cosmetic
 * difference — the booking fails with PRICE_TOO_LOW.
 *
 * Strictly under: "children under 5" charges a child who has turned 5.
 */
export function chargeableGuests(
  totalGuests: number,
  childAges: number[] | undefined,
  childFreeUnderAge: number | undefined,
): number {
  return Math.max(0, totalGuests - freeChildCount(childAges, childFreeUnderAge));
}

export function freeChildCount(
  childAges: number[] | undefined,
  childFreeUnderAge: number | undefined,
): number {
  if (!childAges?.length || childFreeUnderAge == null) return 0;
  return childAges.filter((a) => Number.isFinite(a) && a < childFreeUnderAge).length;
}

/** Capacity is always the whole party — a child who pays nothing still sleeps somewhere. */
export const totalGuestsOf = (adults: number, children: number) => adults + children;
