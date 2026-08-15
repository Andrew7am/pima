import { describe, it, expect } from 'vitest';
import { resolvePolicy, policyForBooking, chargeableGuests, freeChildCount } from './bookingPolicy';
import { refundAmountFor } from './cancellationPolicy';
import { computeStayPrice } from './pricing';
import type { Booking, PlatformSettings, RetreatHouse } from '../types';

const platform = {
  freeCancelDays: 7,
  partialRefundDays: 3,
  partialRefundPct: 0.5,
} as PlatformSettings;

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse =>
  ({ id: 'h1', pricePerNightPerPerson: 100, ...over }) as RetreatHouse;

const booking = (over: Partial<Booking>): Booking =>
  ({ checkIn: '2026-07-20', totalPrice: 1000, ...over }) as Booking;

const TODAY = new Date(2026, 6, 10); // 10 July 2026

describe('resolvePolicy — property over platform, field by field', () => {
  it('inherits every field from the platform when the house sets none', () => {
    const p = resolvePolicy(house(), platform);
    expect(p).toMatchObject({ freeCancelDays: 7, partialRefundDays: 3, partialRefundPct: 0.5 });
    expect(p.childFreeUnderAge).toBeUndefined();
    expect(p.source.freeCancelDays).toBe('platform');
  });

  it('uses the property values when it sets them', () => {
    const p = resolvePolicy(house({ freeCancelDays: 14, partialRefundDays: 7, partialRefundPct: 0.25, childFreeUnderAge: 3 }), platform);
    expect(p).toMatchObject({ freeCancelDays: 14, partialRefundDays: 7, partialRefundPct: 0.25, childFreeUnderAge: 3 });
    expect(p.source.freeCancelDays).toBe('property');
  });

  // The whole reason the columns are nullable rather than copied.
  it('mixes: a custom free window keeps the inherited partial terms', () => {
    const p = resolvePolicy(house({ freeCancelDays: 30 }), platform);
    expect(p).toMatchObject({ freeCancelDays: 30, partialRefundDays: 3, partialRefundPct: 0.5 });
    expect(p.source.freeCancelDays).toBe('property');
    expect(p.source.partialRefundDays).toBe('platform');
  });

  // 0 is a real policy ("no free cancellation at all") and must survive.
  it('does not mistake a deliberate zero for "unset"', () => {
    const p = resolvePolicy(house({ freeCancelDays: 0, partialRefundPct: 0 }), platform);
    expect(p.freeCancelDays).toBe(0);
    expect(p.partialRefundPct).toBe(0);
    expect(p.source.freeCancelDays).toBe('property');
  });

  it('has no platform fallback for the child rule', () => {
    expect(resolvePolicy(house(), platform).childFreeUnderAge).toBeUndefined();
    expect(resolvePolicy(house(), platform).source.childFreeUnderAge).toBe('none');
  });

  it('treats a null house (guest with nothing loaded) as pure platform', () => {
    expect(resolvePolicy(null, platform)).toMatchObject({ freeCancelDays: 7, partialRefundDays: 3 });
  });
});

describe('policyForBooking — what was agreed, not what is advertised', () => {
  it('uses the snapshot frozen onto the booking', () => {
    const b = booking({
      policyFreeCancelDays: 7, policyPartialRefundDays: 3,
      policyPartialRefundPct: 0.5, policyChildFreeUnderAge: 5,
    });
    expect(policyForBooking(b, platform)).toMatchObject({
      freeCancelDays: 7, partialRefundDays: 3, partialRefundPct: 0.5, childFreeUnderAge: 5,
    });
    expect(policyForBooking(b, platform).source.freeCancelDays).toBe('snapshot');
  });

  // Backward compatibility: bookings taken before migration 0128.
  it('falls back to the live platform policy when there is no snapshot', () => {
    const p = policyForBooking(booking({}), platform);
    expect(p).toMatchObject({ freeCancelDays: 7, partialRefundDays: 3, partialRefundPct: 0.5 });
    expect(p.childFreeUnderAge).toBeUndefined();
    expect(p.source.freeCancelDays).toBe('platform');
  });

  it('keeps the snapshot even when the platform policy has since moved', () => {
    const b = booking({ policyFreeCancelDays: 7, policyPartialRefundDays: 3, policyPartialRefundPct: 0.5 });
    const later = { freeCancelDays: 30, partialRefundDays: 20, partialRefundPct: 0.1 } as PlatformSettings;
    expect(policyForBooking(b, later)).toMatchObject({ freeCancelDays: 7, partialRefundDays: 3, partialRefundPct: 0.5 });
  });
});

describe('chargeableGuests — strictly under the free age', () => {
  it('charges nobody less when the property has no child rule', () => {
    expect(chargeableGuests(4, [4, 8], undefined)).toBe(4);
  });

  it('frees a child under the age', () => {
    expect(chargeableGuests(2, [4], 5)).toBe(1);
  });

  // The boundary the approval called out explicitly.
  it('CHARGES a child exactly at the free age', () => {
    expect(chargeableGuests(2, [5], 5)).toBe(2);
  });

  it('charges a child above the free age', () => {
    expect(chargeableGuests(2, [8], 5)).toBe(2);
  });

  it('handles several children of different ages', () => {
    expect(chargeableGuests(6, [1, 4, 5, 9], 5)).toBe(4); // two free
    expect(freeChildCount([1, 4, 5, 9], 5)).toBe(2);
  });

  it('charges the whole party when no ages were given', () => {
    expect(chargeableGuests(4, undefined, 5)).toBe(4);
    expect(chargeableGuests(4, [], 5)).toBe(4);
  });

  it('ignores a non-finite age rather than silently discounting it', () => {
    expect(chargeableGuests(3, [NaN, 4], 5)).toBe(2);
  });
});

// The scenario from the B3.4 approval, end to end on the client side. The same
// scenario runs against the real triggers in the migration's SQL harness; this
// asserts the CLIENT agrees with the server, because a disagreement is not a
// cosmetic bug — the database rejects the booking with PRICE_TOO_LOW.
describe('critical regression: 2 adults + children aged 4 and 8', () => {
  const h = house({ freeCancelDays: 7, partialRefundDays: 3, partialRefundPct: 0.5, childFreeUnderAge: 5 });

  it('prices 3 of the 4 guests, and 4 still occupy beds', () => {
    const policy = resolvePolicy(h, platform);
    const total = 2 + 2;
    const chargeable = chargeableGuests(total, [4, 8], policy.childFreeUnderAge);
    expect(total).toBe(4);          // capacity
    expect(chargeable).toBe(3);     // price
    // 2 nights at 100/person.
    expect(computeStayPrice(h, '2026-08-01', '2026-08-03', chargeable).total).toBe(600);
    expect(computeStayPrice(h, '2026-08-01', '2026-08-03', total).total).toBe(800);
  });

  it('a booking already taken keeps 7/3/50/under-5 after the owner moves to 14/7/25/under-3', () => {
    const taken = booking({
      checkIn: '2026-07-20', paymentStatus: 'paid_full', totalPrice: 600,
      policyFreeCancelDays: 7, policyPartialRefundDays: 3,
      policyPartialRefundPct: 0.5, policyChildFreeUnderAge: 5,
    });
    const tightened = house({ freeCancelDays: 14, partialRefundDays: 7, partialRefundPct: 0.25, childFreeUnderAge: 3 });

    // The property now advertises the new terms...
    expect(resolvePolicy(tightened, platform)).toMatchObject({ freeCancelDays: 14, childFreeUnderAge: 3 });
    // ...but the booking is still held to the old ones.
    expect(policyForBooking(taken, platform)).toMatchObject({ freeCancelDays: 7, childFreeUnderAge: 5 });

    // 10 days out: full refund under the old policy (>= 7).
    expect(refundAmountFor(taken, platform, TODAY)).toMatchObject({ tier: 'full', refund: 600 });
  });

  it('a NEW booking on the same property uses the new rule, so the 4-year-old now pays', () => {
    const tightened = house({ freeCancelDays: 14, partialRefundDays: 7, partialRefundPct: 0.25, childFreeUnderAge: 3 });
    const policy = resolvePolicy(tightened, platform);
    expect(chargeableGuests(4, [4, 8], policy.childFreeUnderAge)).toBe(4);
    expect(computeStayPrice(tightened, '2026-08-01', '2026-08-03', 4).total).toBe(800);
  });
});

describe('refundAmountFor uses the booking’s own policy', () => {
  it('a stricter snapshot denies a refund the platform policy would have allowed', () => {
    // 10 days out. Platform would refund in full (>= 7); this booking's own
    // snapshot demands 14, and only reaches the partial tier.
    const b = booking({
      checkIn: '2026-07-20', paymentStatus: 'paid_full', totalPrice: 1000,
      policyFreeCancelDays: 14, policyPartialRefundDays: 7, policyPartialRefundPct: 0.25,
    });
    expect(refundAmountFor(b, platform, TODAY)).toMatchObject({ tier: 'partial', refund: 250 });
  });

  it('a looser snapshot grants a refund the platform policy would have denied', () => {
    // 4 days out: platform gives 50%, this booking's snapshot gives everything.
    const b = booking({
      checkIn: '2026-07-14', paymentStatus: 'paid_deposit', depositAmount: 400,
      policyFreeCancelDays: 2, policyPartialRefundDays: 1, policyPartialRefundPct: 0.5,
    });
    expect(refundAmountFor(b, platform, TODAY)).toMatchObject({ tier: 'full', refund: 400 });
  });

  it('reports the policy it used, so the dialog can state real numbers', () => {
    const b = booking({ checkIn: '2026-07-20', policyFreeCancelDays: 21, policyPartialRefundDays: 10, policyPartialRefundPct: 0.3 });
    expect(refundAmountFor(b, platform, TODAY).policy.freeCancelDays).toBe(21);
  });
});
